// eval/creole/salience-measure.mjs — the pre-registered measurement of eval/creole/SALIENCE-PREREG.md.
//
//   node eval/creole/salience-measure.mjs all --before <checkout at the parent commit> [--after <checkout>] [--seeds 20] [--json out.json]
//   node eval/creole/salience-measure.mjs run --root <checkout>          one variant, one JSON object on stdout (the child of `all`)
//   node eval/creole/salience-measure.mjs pap [--root <checkout>]        the pre-registered harm check for the Wiktionary packs (§6)
//
// It imports the Fold's own readers from a checkout root (murmur, frame, snippets, salience-infer) and asks them about held-out
// tokens. Nothing here is tuned: the comparison is real vs. the 20 seeded null builds, rank-based.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const CREOLEVAL = "/Users/mlacy/Documents/3.0/live_priors-latest/11-multi-language/dialects-pidgins-creoles/creoleval";
const PACKS = "/Users/mlacy/Documents/3.0/janus/priors";
const CLOSED_UPOS = new Set(["DET", "ADP", "AUX", "PRON", "CCONJ", "SCONJ", "PART"]);
const CONTENT_UPOS = new Set(["NOUN", "PROPN", "VERB", "ADJ", "ADV", "NUM"]);
const HAS_LETTER = /\p{L}/u;
const arg = (k, d = null) => { const i = process.argv.indexOf("--" + k); return i >= 0 ? process.argv[i + 1] : d; };
const imp = (root, f) => import(pathToFileURL(path.join(root, f)).href);

// ── data ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function conllu(file) {
  const sents = []; let cur = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (line.startsWith("#")) continue;
    if (!line.trim()) { if (cur.length) sents.push(cur); cur = []; continue; }
    const c = line.split("\t");
    if (/[-.]/.test(c[0])) continue;                     // multiword ranges / empty nodes
    cur.push({ form: c[1], upos: c[3] });
  }
  if (cur.length) sents.push(cur);
  return sents;
}
const textLines = (f, col, skipHeader = false) => fs.readFileSync(path.join(CREOLEVAL, f), "utf8").split("\n").slice(skipHeader ? 1 : 0).map((l) => l.split("\t")[col]).filter(Boolean);

// ── one variant ───────────────────────────────────────────────────────────────────────────────────────────────────────
async function measure(root) {
  const { foldText } = await imp(root, "fold-chat-foldtext.js");
  const infer = await imp(root, "fold-chat-salience-infer.js");
  const { functionWordsOf } = await imp(root, "fold-chat-snippets.js");
  const { closedClassOf, tokensOf } = await imp(root, "fold-chat-frame.js");
  const { murmurOf } = await imp(root, "fold-chat-murmur.js");
  const fwOf = (L) => { try { return functionWordsOf(L); } catch { return null; } };

  // M2: the frame/witness reading of one surface form in language L (fold-chat-witness.js:467/507/547 and closedClassOf).
  const reader = (L) => {
    const closed = closedClassOf(fwOf(L), L);
    return (form) => {
      const t = tokensOf(form, L)[0];
      const fold = t ? t.fold : foldText(form);
      if (closed(fold)) return "closed";
      const s = infer.salienceOf(form, L);
      return s == null || infer.isName(form, L) ? "name" : "content";
    };
  };
  const tally = () => ({ closed: 0, name: 0, content: 0, n: 0 });
  const bump = (t, c) => { t[c]++; t.n++; };
  const out = { meta: { functionWordsOfPcm: !!fwOf("pcm"), functionWordsOfHat: !!fwOf("hat"), priorPcm: infer.salienceOf("person", "pcm") != null, priorHat: infer.salienceOf("moun", "hat") != null } };

  // ── pcm: gold ──
  const pcmSents = [...conllu(path.join(CREOLEVAL, "pos_ud_naija_pcm/pcm_nsc-ud-dev_sample.conllu")), ...conllu(path.join(CREOLEVAL, "pos_ud_naija_pcm/pcm_nsc-ud-test_sample.conllu"))]
    .map((s) => s.filter((t) => HAS_LETTER.test(t.form)));
  const rd = reader("pcm");
  const closedGold = tally(), contentGold = tally(), propnGold = tally(), all = tally(), calledClosed = { n: 0, goldClosed: 0 };
  const missed = {}, falseClosed = {};                                       // diagnostics (added after the prereg run; counts by form)
  for (const s of pcmSents) for (const t of s) {
    const c = rd(t.form);
    bump(all, c);
    if (CLOSED_UPOS.has(t.upos)) bump(closedGold, c);
    if (CONTENT_UPOS.has(t.upos)) bump(contentGold, c);
    if (t.upos === "PROPN") bump(propnGold, c);
    if (c === "closed") { calledClosed.n++; if (CLOSED_UPOS.has(t.upos)) calledClosed.goldClosed++; else { const k = `${foldText(t.form)}/${t.upos}`; falseClosed[k] = (falseClosed[k] || 0) + 1; } }
    if (CLOSED_UPOS.has(t.upos) && c !== "closed") { const k = `${foldText(t.form)}/${t.upos}/${c}`; missed[k] = (missed[k] || 0) + 1; }
  }
  // M1: the murmur end to end on the reconstructed sentence
  const m1 = { sentences: pcmSents.length, langs: {}, langsForced: {}, closedWherePcmForced: 0, treatedWherePcmForced: 0, closedGold: 0, treated: 0, treatedForced: 0, langIsPcm: 0, treatedWherePcm: 0, closedWherePcm: 0 };
  const tre = (m, form) => { const t = (foldText(form).match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/u) || [])[0]; return !!t && [...m.names, ...m.content, ...m.unknown, ...m.low].includes(t); };
  for (const s of pcmSents) {
    const q = s.map((t) => t.form).join(" ");
    const m = murmurOf({ question: q }), mf = murmurOf({ question: q, prior: "pcm" });
    m1.langs[m.lang] = (m1.langs[m.lang] || 0) + 1;
    m1.langsForced[mf.lang] = (m1.langsForced[mf.lang] || 0) + 1;
    if (m.lang === "pcm") m1.langIsPcm++;
    for (const t of s) if (CLOSED_UPOS.has(t.upos)) {
      m1.closedGold++;
      const a = tre(m, t.form), b = tre(mf, t.form);
      if (a) m1.treated++; if (b) m1.treatedForced++;
      if (m.lang === "pcm") { m1.closedWherePcm++; if (a) m1.treatedWherePcm++; }
      if (mf.lang === "pcm") { m1.closedWherePcmForced++; if (b) m1.treatedWherePcmForced++; }
    }
  }
  out.pcm = { sentences: pcmSents.length, tokens: all.n, closedGold, contentGold, propnGold, all, calledClosed, m1, missed, falseClosed };

  // ── hat: held-out text, no gold ──
  const hatLines = [...textLines("mt_mit_haiti/ht-en.trg", 1), ...textLines("tatoeba_sentence_mining/hat-fra_sample1.tsv", 0, true)];
  const rh = reader("hat");
  const hall = tally(); const caps = { n: 0, calledClosed: 0, closedForms: {} };
  const lowerSeen = new Set(); for (const line of hatLines) for (const t of tokensOf(line, "hat")) if (/^\p{Ll}/u.test(t.text)) lowerSeen.add(foldText(t.text));
  for (const line of hatLines) {
    const toks = tokensOf(line, "hat");
    toks.forEach((t, i) => {
      if (!HAS_LETTER.test(t.text)) return;
      const c = rh(t.text);
      bump(hall, c);
      if (i > 0 && /^\p{Lu}\p{Ll}/u.test(t.text)) {
        const between = line.slice(toks[i - 1].end, t.start);
        if (!/[.!?…:;"“”«»()—–-]/u.test(between)) { caps.n++; if (c === "closed") { caps.calledClosed++; caps.closedForms[t.text] = (caps.closedForms[t.text] || 0) + 1; } }
      }
    });
  }
  const FORMS = ["ki", "yon", "nan", "se", "te", "pa", "di", "a", "la", "e", "moun", "ayiti"];
  caps.alsoLowercase = Object.keys(caps.closedForms).filter((f) => lowerSeen.has(foldText(f))).length;   // diagnostic: a capitalised function word that also occurs lower-cased
  out.hat = { lines: hatLines.length, tokens: hall.n, all: hall, caps, forms: Object.fromEntries(FORMS.map((f) => [f, rh(f)])) };
  // the named forms across the other creole asks of eval/creole/prompts.json, in the language each belongs to
  const rp = reader("pcm");
  out.pcmForms = Object.fromEntries(["wetin", "di", "weh", "em", "dem", "wey", "na"].map((f) => [f, rp(f)]));
  return out;
}

// ── orchestration ───────────────────────────────────────────────────────────────────────────────────────────────────────
function variantRoot(afterRoot, name, buildArgs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `creole-${name}-`));
  for (const f of fs.readdirSync(afterRoot)) if (f.endsWith(".js")) fs.copyFileSync(path.join(afterRoot, f), path.join(dir, f));
  fs.symlinkSync(path.join(afterRoot, "vendor"), path.join(dir, "vendor"));
  for (const l of ["pcm", "hat"]) {
    const r = spawnSync(process.execPath, [path.join(REPO, "scripts", "build-salience-prior.mjs"), path.join(PACKS, `pos-${l}.json`), "--lang", l, "--out", path.join(dir, `fold-chat-salience-prior-${l}.js`), ...buildArgs], { encoding: "utf8" });
    if (r.status !== 0) throw new Error(`build ${l}: ${r.stderr}`);
    if (!buildArgs.includes("--closed")) fs.appendFileSync(path.join(dir, `fold-chat-salience-prior-${l}.js`), "export const CLOSED_CLASS = Object.freeze([]);\n");
  }
  return dir;
}
const runRoot = (root) => {
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "run", "--root", root], { encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`run ${root}: ${r.stderr.slice(0, 600)}`);
  return JSON.parse(r.stdout);
};
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + "%" : "n/a");
const stats = (xs) => ({ min: Math.min(...xs), max: Math.max(...xs), mean: xs.reduce((a, b) => a + b, 0) / xs.length });

async function all() {
  const before = arg("before"); if (!before) throw new Error("--before <checkout at the parent commit> is required");
  const after = path.resolve(arg("after", REPO));
  const seeds = +arg("seeds", 20);
  const res = { before: runRoot(path.resolve(before)), after: runRoot(after), l1only: null, null: [] };
  res.l1only = runRoot(variantRoot(after, "l1", []));
  for (let k = 1; k <= seeds; k++) res.null.push(runRoot(variantRoot(after, `null${k}`, ["--closed", "--shuffle", String(k)])));
  const J = arg("json"); if (J) fs.writeFileSync(J, JSON.stringify(res, null, 1));
  report(res);
}

function report(res) {
  const P = (v) => v.pcm;
  const closedShare = (v) => (P(v).closedGold.n - P(v).closedGold.closed) / P(v).closedGold.n;    // closed-class gold tokens still read as name/content
  const nameShare = (v) => P(v).closedGold.name / P(v).closedGold.n;
  const falseClosed = (v) => P(v).contentGold.closed / P(v).contentGold.n;
  const propnClosed = (v) => P(v).propnGold.closed;
  const precision = (v) => (P(v).calledClosed.n ? P(v).calledClosed.goldClosed / P(v).calledClosed.n : NaN);
  const m1 = (v) => P(v).m1.treated / P(v).m1.closedGold;
  const row = (name, fn, fmt = (x) => (100 * x).toFixed(1) + "%") => {
    const nl = res.null.map(fn).filter((x) => !Number.isNaN(x)), s = stats(nl);
    console.log(`| ${name} | ${fmt(fn(res.before))} | ${fmt(fn(res.l1only))} | ${fmt(fn(res.after))} | ${fmt(s.min)} / ${fmt(s.mean)} / ${fmt(s.max)} |`);
  };
  const p = res.after.pcm;
  console.log(`pcm held-out gold: ${p.sentences} sentences, ${p.tokens} letter-bearing tokens; closed-class gold N=${p.closedGold.n}, content-class gold N=${p.contentGold.n}, PROPN gold N=${p.propnGold.n}; null = ${res.null.length} seeded builds\n`);
  console.log("| quantity | before | L1 only | after (L1+L2) | null min / mean / max |\n|---|---|---|---|---|");
  row("A closed-class gold tokens read as name or content (M2)", closedShare);
  row("A' ... of which as a name candidate (unmeasured or PROPN)", nameShare);
  row("B closed-class gold tokens read as name/content/unknown by the murmur, language as detected (M1)", m1);
  row("C false-closed: content-class gold tokens called closed", falseClosed);
  row("D PROPN gold tokens called closed (count)", propnClosed, (x) => String(x));
  row("E precision of the closed set on running tokens", precision);
  const sorted = (fn) => res.null.map(fn).sort((a, b) => a - b);
  const gate = (name, ok) => console.log(`gate ${name}: ${ok ? "MET" : "NOT MET"}`);
  gate("A  after < min(null)", closedShare(res.after) < Math.min(...res.null.map(closedShare)));
  gate("D  after <= min(null)", propnClosed(res.after) <= Math.min(...res.null.map(propnClosed)));
  gate("E  after > max(null)", precision(res.after) > Math.max(...res.null.map(precision)));
  console.log(`\nM1 language the murmur detected on those ${p.m1.sentences} sentences (after): ${JSON.stringify(p.m1.langs)}; detector said pcm on ${p.m1.langIsPcm}`);
  console.log(`M1 with prior:"pcm" injected, languages the murmur ended up using: ${JSON.stringify(p.m1.langsForced)}; where it used pcm: ${p.m1.treatedWherePcmForced}/${p.m1.closedWherePcmForced} closed-class gold tokens treated (before: ${res.before.pcm.m1.treatedWherePcmForced}/${res.before.pcm.m1.closedWherePcmForced})`);
  console.log(`M1 with prior:"pcm" injected, all sentences: before ${pct(res.before.pcm.m1.treatedForced, res.before.pcm.m1.closedGold)}, L1 only ${pct(res.l1only.pcm.m1.treatedForced, res.l1only.pcm.m1.closedGold)}, after ${pct(p.m1.treatedForced, p.m1.closedGold)}, null max ${pct(Math.max(...res.null.map((v) => v.pcm.m1.treatedForced)), p.m1.closedGold)} min ${pct(Math.min(...res.null.map((v) => v.pcm.m1.treatedForced)), p.m1.closedGold)}`);
  const h = res.after.hat;
  console.log(`\nhat held-out text (no gold): ${h.lines} lines, ${h.tokens} letter-bearing tokens`);
  const hs = (v) => v.hat.all.closed / v.hat.all.n, hn = (v) => v.hat.all.name / v.hat.all.n;
  const ns = res.null.map(hs), nn = res.null.map(hn);
  console.log(`G2 token mass called closed (coverage, not accuracy): before ${(100 * hs(res.before)).toFixed(1)}%  L1only ${(100 * hs(res.l1only)).toFixed(1)}%  after ${(100 * hs(res.after)).toFixed(1)}%  null min/mean/max ${(100 * Math.min(...ns)).toFixed(1)} / ${(100 * ns.reduce((a, b) => a + b, 0) / ns.length).toFixed(1)} / ${(100 * Math.max(...ns)).toFixed(1)}`);
  console.log(`   read as a name candidate (unmeasured or PROPN-dominant): before ${(100 * hn(res.before)).toFixed(1)}%  after ${(100 * hn(res.after)).toFixed(1)}%  null min/mean/max ${(100 * Math.min(...nn)).toFixed(1)} / ${(100 * nn.reduce((a, b) => a + b, 0) / nn.length).toFixed(1)} / ${(100 * Math.max(...nn)).toFixed(1)}`);
  console.log(`G3 mid-sentence capitalised tokens called closed: after ${h.caps.calledClosed}/${h.caps.n} ${JSON.stringify(h.caps.closedForms)}; before ${res.before.hat.caps.calledClosed}/${res.before.hat.caps.n}; null ${res.null.map((v) => v.hat.caps.calledClosed).join(",")}`);
  console.log(`   (diagnostic, added after the run) of ${Object.keys(h.caps.closedForms).length} distinct capitalised forms called closed, ${h.caps.alsoLowercase} also occur lower-cased in the same text`);
  const top = (o, n = 12) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k}×${v}`).join(" ");
  console.log(`\npcm misses (closed-class gold read as name/content, after; N=${Object.values(p.missed).reduce((a, b) => a + b, 0)}): ${top(p.missed, 25)}`);
  console.log(`pcm false-closed (not closed-class gold, called closed, after; N=${Object.values(p.falseClosed).reduce((a, b) => a + b, 0)}): ${top(p.falseClosed, 25)}`);
  console.log(`M1 where the murmur's own detector said pcm: closed-class gold tokens ${p.m1.closedWherePcm}, treated after ${p.m1.treatedWherePcm}; same sentences before: ${res.before.pcm.m1.treatedWherePcm}/${res.before.pcm.m1.closedWherePcm}`);
  console.log("\nG1 named forms (M2 category) | before | after | null seeds that close it (of " + res.null.length + ")");
  for (const f of Object.keys(h.forms)) console.log(`| ${f} | ${res.before.hat.forms[f]} | ${h.forms[f]} | ${res.null.filter((v) => v.hat.forms[f] === "closed").length} |`);
  console.log("\npcm named forms (M2): " + Object.entries(res.after.pcmForms).map(([k, v]) => `${k}=${res.before.pcmForms[k]}→${v}`).join(" "));
}

// ── the pap / kea harm check (PREREG §6) ─────────────────────────────────────────────────────────────────────────────────
async function papCheck() {
  const root = path.resolve(arg("root", REPO));
  const { foldText } = await imp(root, "fold-chat-foldtext.js");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "creole-pap-"));
  const text = { pap: textLines("tatoeba_sentence_mining/pap-eng_sample1.tsv", 0, true), kea: null };
  const toks = (lines) => lines.flatMap((l) => foldText(l).match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) || []);
  for (const l of ["pap", "kea", "pcm", "hat"]) {
    const out = path.join(dir, `m-${l}.js`);
    const r = spawnSync(process.execPath, [path.join(REPO, "scripts", "build-salience-prior.mjs"), path.join(PACKS, `pos-${l}.json`), "--lang", l, "--closed", "--out", out], { encoding: "utf8" });
    if (r.status !== 0) { console.log(l, "build failed", r.stderr); continue; }
    const M = await import(pathToFileURL(out).href);
    const lines = l === "hat" ? [...textLines("mt_mit_haiti/ht-en.trg", 1), ...textLines("tatoeba_sentence_mining/hat-fra_sample1.tsv", 0, true)] : l === "pcm" ? conllu(path.join(CREOLEVAL, "pos_ud_naija_pcm/pcm_nsc-ud-test_sample.conllu")).concat(conllu(path.join(CREOLEVAL, "pos_ud_naija_pcm/pcm_nsc-ud-dev_sample.conllu"))).map((s) => s.map((t) => t.form).join(" ")) : text[l];
    console.log(`\n== ${l}: pack forms ${Object.keys(JSON.parse(fs.readFileSync(path.join(PACKS, `pos-${l}.json`), "utf8")).forms).length}, salient ${Object.keys(M.SALIENCE_PRIOR).length}, closed-class ${M.CLOSED_CLASS.length}`);
    if (!lines) { console.log("   no held-out text staged for this language: H1/H2 cannot be run → REFUSED by rule 3"); continue; }
    const T = toks(lines), freq = new Map();
    for (const t of T) freq.set(t, (freq.get(t) || 0) + 1);
    const order = [...freq].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    let cum = 0; const top = [];
    for (const [f, n] of order) { top.push([f, n]); cum += n; if (cum * 2 >= T.length) break; }
    const bad = top.filter(([f]) => M.SALIENCE_PRIOR[f] != null);
    console.log(`   held-out tokens ${T.length}, distinct ${freq.size}; half-mass set = top ${top.length} forms; listed with salience > 0: ${bad.length}`);
    console.log(`   H2 offenders: ${bad.map(([f, n]) => `${f}(${n}, salience ${M.SALIENCE_PRIOR[f]})`).join(" ") || "none"}`);
    const closedTop = top.filter(([f]) => M.CLOSED_CLASS.includes(f)).length;
    console.log(`   of the half-mass forms, in the closed class: ${closedTop}; neither listed nor closed: ${top.length - closedTop - bad.length}`);
    console.log(`   top 15: ${top.slice(0, 15).map(([f, n]) => `${f}:${n}`).join(" ")}`);
  }
}

const cmd = process.argv[2];
if (cmd === "run") { process.stdout.write(JSON.stringify(await measure(path.resolve(arg("root", REPO))))); }
else if (cmd === "all") await all();
else if (cmd === "pap") await papCheck();
else if (cmd === "report") report(JSON.parse(fs.readFileSync(arg("json"), "utf8")));   // re-print (and mutation-check the gates) from a saved run
else { console.error("usage: salience-measure.mjs all --before <root> | run --root <root> | pap"); process.exit(2); }
