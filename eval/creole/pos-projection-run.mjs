// eval/creole/pos-projection-run.mjs — the I/O half of the POS projection: load staged parallel text, skip every held-out
// sentence, select arms on pcm dev, report on pcm test and hat, build the packs, write them with their measured error bar.
//   node eval/creole/pos-projection-run.mjs select            → packs/_work/selection.json   (pcm dev; adopt factors)
//   node eval/creole/pos-projection-run.mjs report            → packs/CALIBRATION.json       (pcm test, hat, curves, baselines)
//   node eval/creole/pos-projection-run.mjs build [codes…]    → packs/pos-<code>.json
// Everything is pre-registered in POS-PROJECTION-PREREG.md. Never writes under janus/priors (F4).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as P from "./pos-projection.mjs";
import { foldText } from "../../fold-chat-foldtext.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.FOLD_3_0 ?? "/Users/mlacy/Documents/3.0";
const LIVE = `${ROOT}/live_priors-latest`;
const CV = `${LIVE}/11-multi-language/dialects-pidgins-creoles`;
const CREOLEVAL = `${CV}/creoleval`, KMT = `${CV}/kreyol-mt/bitexts`, UDHR = `${LIVE}/06-government-legal/un-udhr`;
const PRIORS = `${ROOT}/janus/priors`;
const OUT = path.join(HERE, "packs"), WORK = path.join(OUT, "_work");
const args = process.argv.slice(2);
const stage = args[0];
const B = Number(args[args.indexOf("--B") + 1]) || P.DECLARED.B;

const writeSafe = (f, text) => {
  const abs = path.resolve(f);
  if (abs.startsWith(path.resolve(PRIORS))) throw new Error(`F4: refusing to write under janus/priors: ${abs}`);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
};
const lines = (f) => fs.readFileSync(f, "utf8").split("\n");
const tsvRows = (f) => lines(f).slice(1).map((l) => l.split("\t")).filter((r) => r.length >= 2);
const uniq = (pairs) => { const seen = new Set(), out = []; for (const p of pairs) { const k = P.foldKey(p.c); if (k && !seen.has(k)) { seen.add(k); out.push(p); } } return out; };

// ── anchors ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const anchorPacks = {};
for (const l of ["eng", "fra", "spa"]) anchorPacks[l] = JSON.parse(fs.readFileSync(`${PRIORS}/pos-${l}.json`, "utf8"));
const anchors = Object.fromEntries(Object.entries(anchorPacks).map(([l, p]) => [l, P.anchorIndex(p.forms)]));

// ── held-out ─────────────────────────────────────────────────────────────────────────────────────────────────────────
function conllu(f) {
  const out = []; let cur = null;
  for (const l of lines(f)) {
    if (l.startsWith("# sent_id")) cur = { id: l.split("=")[1].trim(), tokens: [] }, out.push(cur);
    else if (l.startsWith("# text = ")) cur.text = l.slice(9);
    else if (l.startsWith("# text_en = ")) cur.en = l.slice(12);
    else if (l.startsWith("# text_ortho = ")) cur.ortho = l.slice(15);
    else if (l && !l.startsWith("#") && cur) { const c = l.split("\t"); if (/^\d+$/.test(c[0])) cur.tokens.push({ form: c[1], upos: c[3] }); }
  }
  return out;
}
const PCM = { train: conllu(`${CREOLEVAL}/pos_ud_naija_pcm/pcm_nsc-ud-train_sample.conllu`), dev: conllu(`${CREOLEVAL}/pos_ud_naija_pcm/pcm_nsc-ud-dev_sample.conllu`), test: conllu(`${CREOLEVAL}/pos_ud_naija_pcm/pcm_nsc-ud-test_sample.conllu`) };
function heldOutKeys({ includePcm }) {
  const keys = new Map(); // key → file label
  const add = (label, arr) => { for (const s of arr) { const k = P.foldKey(s); if (k) keys.set(k, label); } };
  const T = `${CREOLEVAL}/tatoeba_sentence_mining`;
  // BASELINE's list (hat-fra, tpi-eng, pap-eng, sag-eng, gcf-fra, jam-eng) plus hat-eng_sample1 and the cbk files; gcf-eng.tsv is
  // NOT in the list and is a build source (its overlap with gcf-fra is caught by the key guard)
  for (const f of fs.readdirSync(T).filter((x) => x.endsWith(".tsv") && x !== "gcf-eng.tsv")) add(`tatoeba/${f}`, tsvRows(`${T}/${f}`).map((r) => r[0]));
  for (const f of ["ht-en.trg", "ht-fr.trg", "ht-es.trg"]) add(`mt_mit_haiti/${f}`, lines(`${CREOLEVAL}/mt_mit_haiti/${f}`).map((l) => l.split("\t")[1]).filter(Boolean));
  for (const f of ["en-cr_dev.jsonl", "en-cr_test.jsonl"]) add(`mt_kreolmorisien/${f}`, lines(`${CREOLEVAL}/mt_kreolmorisien/${f}`).filter(Boolean).map((l) => JSON.parse(l).target));
  if (includePcm) for (const sp of ["dev", "test"]) add(`pos_ud_naija_pcm/${sp}`, PCM[sp].flatMap((s) => [s.text, s.ortho].filter(Boolean)));
  return keys;
}
const HELD_ALL = heldOutKeys({ includePcm: true });
const HELD_NOPCM = heldOutKeys({ includePcm: false });
function guarded(pairs, held, label, log) {
  const { kept, dropped } = P.excludeHeldOut(uniq(pairs), new Set(held.keys()));
  log.push({ source: label, offered: kept.length + dropped.length, droppedHeldOut: dropped.length, kept: kept.length });
  return kept;
}

// ── parallel sources ─────────────────────────────────────────────────────────────────────────────────────────────────
const paras = (f) => lines(f).slice(4).join("\n").split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
function udhrSources(code, anchorLangs, name = code) {
  const creole = paras(`${UDHR}/udhr-${code}.txt`);
  return anchorLangs.map((a) => ({ name: `udhr-${name}~${a}`, group: `udhr-${name}`, anchor: anchors[a], anchorLang: a, kind: "udhr", licence: "public domain (UN GA res. 217 A (III)); unicode encodings via github.com/wooorm/udhr", pairs: P.pairParagraphs(creole, paras(`${UDHR}/udhr-${a === "eng" ? "eng" : a}.txt`)) }));
}
const jsonlPairs = (f, cKey, aKey) => lines(f).filter(Boolean).map((l) => { const j = JSON.parse(l); return { c: j[cKey], a: j[aKey] }; });
const LANGS = {
  mfe: { udhr: ["052"], bitext: (held, log) => [{ name: "morisienmt-en-cr(train_sample)", group: "morisienmt", anchor: anchors.eng, anchorLang: "eng", kind: "bitext", licence: "MIT (KreolMorisienMT, prajdabre/KreolMorisienMT)", file: `${CREOLEVAL}/mt_kreolmorisien/en-cr_train_sample.jsonl`, pairs: guarded(jsonlPairs(`${CREOLEVAL}/mt_kreolmorisien/en-cr_train_sample.jsonl`, "target", "input"), held, "mt_kreolmorisien/en-cr_train_sample", log) }] },
  tpi: { udhr: ["tpi"], bitext: (held, log) => [{ name: "kreyol-mt-tpi-eng", group: "kmt-tpi", anchor: anchors.eng, anchorLang: "eng", kind: "bitext", licence: "CC BY 2.0 FR (Tatoeba exports, via kreyol-mt staging)", file: `${KMT}/tpi-eng/tpi-eng.tsv`, pairs: guarded(tsvRows(`${KMT}/tpi-eng/tpi-eng.tsv`).map((r) => ({ c: r[1], a: r[3] })), held, "kreyol-mt/tpi-eng", log) }] },
  sag: { udhr: ["sag"], bitext: () => [] },
  jam: { udhr: ["055"], bitext: () => [] },
  gcf: { udhr: [], bitext: (held, log) => [
    { name: "kreyol-mt-gcf-fra", group: "kmt-gcf-fra", anchor: anchors.fra, anchorLang: "fra", kind: "bitext", licence: "CC BY 2.0 FR (Tatoeba exports, via kreyol-mt staging)", file: `${KMT}/gcf-fra/gcf-fra.tsv`, pairs: guarded(tsvRows(`${KMT}/gcf-fra/gcf-fra.tsv`).map((r) => ({ c: r[1], a: r[3] })), held, "kreyol-mt/gcf-fra", log) },
    { name: "tatoeba-gcf-eng", group: "tatoeba-gcf-eng", anchor: anchors.eng, anchorLang: "eng", kind: "bitext", licence: "CC BY 2.0 FR (Tatoeba, via CreoleVal staging)", file: `${CREOLEVAL}/tatoeba_sentence_mining/gcf-eng.tsv`, pairs: guarded(tsvRows(`${CREOLEVAL}/tatoeba_sentence_mining/gcf-eng.tsv`).map((r) => ({ c: r[0], a: r[3] })), held, "tatoeba/gcf-eng", log) },
  ] },
};

// ── evaluation ───────────────────────────────────────────────────────────────────────────────────────────────────────
const goldPcm = (sents) => sents.map((s) => s.tokens);
function goldHat() {
  const hat = JSON.parse(fs.readFileSync(`${PRIORS}/pos-hat.json`, "utf8"));
  const byForm = new Map();
  for (const [form, d] of Object.entries(hat.forms)) for (const [u, n] of Object.entries(d)) { const k = foldText(form); if (!byForm.has(k)) byForm.set(k, []); for (let i = 0; i < n; i++) byForm.get(k).push({ form: k, upos: u }); }
  return [...byForm.values()]; // one cluster per form (A4)
}
const correctVector = (forms, gold) => P.correctPerSentence(P.tally(forms, gold));
const nontrivialAcc = (forms, gold) => { const s = P.summarise(P.tally(forms, gold)); return { correct: s.correct, tokens: s.tokens, coverage: s.coverage, accuracyCovered: s.accuracyCovered, accuracyAll: s.accuracyAll, macroF1: s.macroF1 }; };
function report(forms, gold, seed) {
  const sents = P.tally(forms, gold), s = P.summarise(sents), rand = P.rng(seed);
  const stats = []; const keys = Object.keys(s.perClass);
  for (let b = 0; b < P.DECLARED.BOOT; b++) {
    const r = []; for (let i = 0; i < sents.length; i++) r.push(sents[Math.floor(rand() * sents.length)]);
    const x = P.summarise(r); stats.push(x);
  }
  const ci = (get) => { const v = stats.map(get).filter((x) => x !== null && Number.isFinite(x)).sort((a, c) => a - c); if (!v.length) return null; const q = (z) => v[Math.min(v.length - 1, Math.floor(z * (v.length - 1)))]; return [q(P.DECLARED.CI[0]), q(P.DECLARED.CI[1])]; };
  const perClass = {};
  for (const u of keys) perClass[u] = { ...s.perClass[u], precisionCI: ci((x) => x.perClass[u]?.precision ?? null), recallCI: ci((x) => x.perClass[u]?.recall ?? null) };
  return { tokens: s.tokens, covered: s.covered, correct: s.correct, coverage: s.coverage, coverageCI: ci((x) => x.coverage), accuracyCovered: s.accuracyCovered, accuracyCoveredCI: ci((x) => x.accuracyCovered), accuracyAll: s.accuracyAll, accuracyAllCI: ci((x) => x.accuracyAll), macroF1: s.macroF1, macroF1CI: ci((x) => x.macroF1), trivial: { tokens: s.trivial, correctByScript: s.trivialTp }, perClass };
}

// ── configurations ───────────────────────────────────────────────────────────────────────────────────────────────────
const pcmPairs = (sents) => sents.filter((s) => s.ortho && s.en).map((s) => ({ c: s.ortho, a: s.en }));
function bitextPcm(fold, nSub) {
  const other = fold === "dev" ? "test" : "dev";
  let pairs = uniq([...pcmPairs(PCM.train), ...pcmPairs(PCM[other])]);
  if (nSub && nSub < pairs.length) { const r = P.rng(P.DECLARED.SEED + nSub); pairs = P.shuffled(pairs, r).slice(0, nSub); }
  return [{ name: `ud-naija-text_ortho~text_en(train_sample+${other})`, group: "pcm-bitext", anchor: anchors.eng, anchorLang: "eng", kind: "bitext", licence: "CC BY-SA 4.0 (UD_Naija-NSC)", pairs }];
}
const udhrAnchors = (multi) => (multi ? ["eng", "fra", "spa"] : ["eng"]);
const optsOf = (c) => ({ gateClosed: !!c.gateClosed, gateOpen: !!c.gateOpen, identity: !!c.identity });
const logOnly = [];

async function select() {
  const out = { B, protocol: "prereg §4; pcm dev; max-T over sign flips", decisions: [] };
  const devGold = goldPcm(PCM.dev);
  const pcmUdhr = (multi) => udhrSources("pcm", udhrAnchors(multi));
  let cfg = { multi: false, gateClosed: false, gateOpen: false, identity: false };
  // M — decided in C1 (UDHR only)
  {
    const A = P.projectBase(pcmUdhr(true), { B }), S = P.projectBase(pcmUdhr(false), { B });
    const fa = P.finalizePack(A).forms, fs_ = P.finalizePack(S).forms;
    const va = correctVector(fa, devGold), vb = correctVector(fs_, devGold);
    const t = P.pairedMaxT(va, vb, P.rng(11));
    out.decisions.push({ factor: "M multi-anchor (C1)", ...t, a: nontrivialAcc(fa, devGold), b: nontrivialAcc(fs_, devGold) });
    cfg.multi = t.adopt;
  }
  // G1, G2, I — decided in C2 (pcm cross-fit, dev)
  const srcC2 = [...bitextPcm("dev"), ...pcmUdhr(cfg.multi)];
  const base = P.projectBase(srcC2, { B });
  const arms = [["G1 closed gate", "gateClosed"], ["G2 open gate", "gateOpen"], ["I identity fill", "identity"]];
  let cur = P.finalizePack(base, optsOf(cfg)).forms;
  for (const [label, key] of arms) {
    const trial = { ...cfg, [key]: true };
    const nxt = P.finalizePack(base, optsOf(trial)).forms;
    const t = P.pairedMaxT(correctVector(nxt, devGold), correctVector(cur, devGold), P.rng(13));
    out.decisions.push({ factor: `${label} (C2)`, ...t, with: nontrivialAcc(nxt, devGold), without: nontrivialAcc(cur, devGold) });
    if (t.adopt) { cfg = trial; cur = nxt; }
  }
  out.adopted = cfg;
  writeSafe(path.join(WORK, "selection.json"), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
}

const loadCfg = () => JSON.parse(fs.readFileSync(path.join(WORK, "selection.json"), "utf8")).adopted;

async function calibrate() {
  const cfg = loadCfg(), o = optsOf(cfg), M = cfg.multi;
  const rec = { B, adopted: cfg, built: "see git", conditions: {}, curves: {}, baselines: {}, falsifiers: {}, factorDeltas: {} };
  const hatGold = goldHat();
  const baselineFor = (forms0, gold) => { // B0 majority class, B1 identity-only lexicon
    const cnt = {}; for (const s of gold) for (const t of s) if (!P.scriptClass(t.form)) cnt[t.upos] = (cnt[t.upos] ?? 0) + 1;
    const maj = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
    return { majorityClass: maj };
  };
  const run = (label, sources, gold, seed, extra = {}) => {
    const t0 = Date.now();
    const base = P.projectBase(sources, { B });
    const pack = P.finalizePack(base, o);
    const rep = report(pack.forms, gold, seed);
    const chance = P.chanceDiscoveries(base);
    // F1 (A2): the real pack vs the raw lexicon of every shuffled draw, correct non-trivial tokens
    const nullCorrect = base.nullRaw.map((d) => nontrivialAcc(P.lexiconOf(d), gold).correct);
    const f1 = { real: rep.correct, nullMax: Math.max(...nullCorrect), holds: rep.correct > Math.max(...nullCorrect) };
    // baselines
    const ident = {};
    for (const s of base.prepared) for (const p of s.tp) for (const f of p.c) { if (P.scriptClass(f) || Object.hasOwn(ident, f)) continue; const d = s.anchor.get(f); if (d) ident[f] = { [P.dominant(d)]: 1 }; }
    const b1 = nontrivialAcc(ident, gold);
    const maj = baselineFor(null, gold).majorityClass;
    const allMaj = {}; for (const s of base.prepared) for (const p of s.tp) for (const f of p.c) if (!P.scriptClass(f)) allMaj[f] = { [maj]: 1 };
    const b0 = nontrivialAcc(allMaj, gold);
    // factor deltas around the adopted configuration (reported, never fed back)
    const deltas = {};
    for (const [k, v] of Object.entries({ gateClosed: !o.gateClosed, gateOpen: !o.gateOpen, identity: !o.identity })) {
      const alt = P.finalizePack(base, { ...o, [k]: v });
      const a = nontrivialAcc(alt.forms, gold);
      deltas[`${k}=${v}`] = { macroF1: a.macroF1 - rep.macroF1, accuracyAll: a.accuracyAll - rep.accuracyAll, coverage: a.coverage - rep.coverage };
    }
    const fitPairs = pack.stats.sources.reduce((n, s) => n + s.pairs, 0), fitTokens = pack.stats.sources.reduce((n, s) => n + s.creoleTokens, 0);
    console.error(`${label}: pairs=${fitPairs} forms=${pack.stats.forms} acc=${rep.accuracyAll.toFixed(3)} cov=${rep.coverage.toFixed(3)} mF1=${rep.macroF1.toFixed(3)} F1chance=${f1.holds} (${Date.now() - t0}ms)`);
    return { label, fit: { pairs: fitPairs, creoleTokens: fitTokens, sources: pack.stats.sources, forms: pack.stats.forms, lambdas: pack.stats.lambdas }, ...extra, report: rep, falsifiers: { F1: f1, chanceDiscoveries: { real: chance.real, nullMax: chance.nullMax, beatsChance: chance.beatsChance }, F5: { beatsB0: rep.macroF1 > b0.macroF1, beatsB1: rep.macroF1 > b1.macroF1 } }, baselines: { B0: b0, B1: b1 }, factorDeltas: deltas };
  };
  // pcm test (reporting fold): C1, C2, learning curve
  const testGold = goldPcm(PCM.test), devGold = goldPcm(PCM.dev);
  rec.conditions.pcm_test_C1 = run("pcm test C1 (UDHR only)", udhrSources("pcm", udhrAnchors(M)), testGold, 101);
  rec.conditions.pcm_test_C2 = run("pcm test C2 (bitext+UDHR)", [...bitextPcm("test"), ...udhrSources("pcm", udhrAnchors(M))], testGold, 102);
  rec.conditions.pcm_dev_C1 = run("pcm dev C1 (selection fold, for reference)", udhrSources("pcm", udhrAnchors(M)), devGold, 103);
  rec.conditions.pcm_dev_C2 = run("pcm dev C2 (selection fold, for reference)", [...bitextPcm("dev"), ...udhrSources("pcm", udhrAnchors(M))], devGold, 104);
  // learning curve on test fold: bitext subset sizes (UDHR kept)
  rec.curves.pcm_test_C2 = [];
  for (const n of [25, 50, 100]) rec.curves.pcm_test_C2.push(run(`pcm test C2 n=${n}`, [...bitextPcm("test", n), ...udhrSources("pcm", udhrAnchors(M))], testGold, 110 + n, { bitextPairs: n }));
  // hat: C1 (both UDHR versions), C2 (+ kreyol-mt hat-eng, guarded), S-large (calibration only)
  const hatU = [...udhrSources("hat_kreyol", udhrAnchors(M), "hat_kreyol"), ...udhrSources("hat_popular", udhrAnchors(M), "hat_popular")];
  rec.conditions.hat_C1 = run("hat C1 (UDHR only)", hatU, hatGold, 201);
  const hatLog = [];
  const hatKmt = { name: "kreyol-mt-hat-eng", group: "kmt-hat", anchor: anchors.eng, anchorLang: "eng", kind: "bitext", licence: "CC BY 2.0 FR (Tatoeba exports, via kreyol-mt staging)", pairs: guarded(tsvRows(`${KMT}/hat-eng/hat-eng.tsv`).map((r) => ({ c: r[1], a: r[3] })), HELD_NOPCM, "kreyol-mt/hat-eng", hatLog) };
  rec.conditions.hat_C2 = run("hat C2 (kmt hat-eng + UDHR)", [hatKmt, ...hatU], hatGold, 202, { guardLog: hatLog });
  // S-large: calibration-only, reads held-out Haitian text, ships nothing
  const frPairs = uniq(lines(`${CREOLEVAL}/mt_mit_haiti/ht-fr.trg`).map((l, i) => ({ c: l.split("\t")[1], a: lines(`${CREOLEVAL}/mt_mit_haiti/ht-fr.src`)[i]?.split("\t")[1] })).filter((p) => p.c && p.a));
  const sLarge = { name: "CALIBRATION-ONLY ht-fr (held-out)", group: "mit-haiti-fr", anchor: anchors.fra, anchorLang: "fra", kind: "calibration-only", licence: "n/a (never shipped)", pairs: frPairs };
  rec.conditions.hat_Slarge = run("hat S-large (calibration only; held-out text)", [sLarge, hatKmt, ...hatU], hatGold, 203, { calibrationOnly: true, note: "reads held-out creole text; nothing shipped; not used for selection" });
  rec.guardLog = { hat: hatLog };
  writeSafe(path.join(OUT, "CALIBRATION.json"), JSON.stringify(rec, null, 1));
  console.error("wrote CALIBRATION.json");
}

// ── packs ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const heldCreoleTokens = (code) => { // read-only coverage measurement against the held-out creole text; never used to build
  const T = `${CREOLEVAL}/tatoeba_sentence_mining`;
  const sets = {
    mfe: lines(`${CREOLEVAL}/mt_kreolmorisien/en-cr_test.jsonl`).filter(Boolean).map((l) => JSON.parse(l).target),
    tpi: tsvRows(`${T}/tpi-eng_sample1.tsv`).map((r) => r[0]),
    sag: tsvRows(`${T}/sag-eng_sample1.tsv`).map((r) => r[0]),
    jam: tsvRows(`${T}/jam-eng.tsv`).map((r) => r[0]),
    gcf: tsvRows(`${T}/gcf-fra.tsv`).map((r) => r[0]),
  };
  return sets[code] ?? [];
};
function nearestRow(cal, hasBitext, nPairs) {
  if (!hasBitext) return { cond: "C1", pcm: cal.conditions.pcm_test_C1, hat: cal.conditions.hat_C1, row: "UDHR only" };
  const rows = [...cal.curves.pcm_test_C2.map((r) => ({ n: r.bitextPairs, r })), { n: cal.conditions.pcm_test_C2.fit.sources[0].pairs, r: cal.conditions.pcm_test_C2 }].sort((a, b) => a.n - b.n);
  const ok = rows.filter((x) => x.n <= nPairs);
  const pick = ok.length ? ok[ok.length - 1] : rows[0];
  return { cond: "C2", pcm: pick.r, hat: cal.conditions.hat_C2, row: `pcm bitext ${pick.n} pairs${nPairs > rows[rows.length - 1].n ? ` (pack has ${nPairs}: beyond the largest calibrated row)` : ""}` };
}
const brief = (c) => ({ nonTrivialTokens: c.report.tokens, coverage: +c.report.coverage.toFixed(3), accuracyOnCovered: c.report.accuracyCovered === null ? null : +c.report.accuracyCovered.toFixed(3), macroF1: +c.report.macroF1.toFixed(3), macroF1CI95: c.report.macroF1CI?.map((x) => +x.toFixed(3)), fitPairs: c.fit.pairs, fitCreoleTokens: c.fit.creoleTokens, perUPOS: Object.fromEntries(Object.entries(c.report.perClass).map(([u, v]) => [u, { nGold: v.nGold, precision: v.precision === null ? null : +v.precision.toFixed(2), recall: +v.recall.toFixed(2) }])) });

async function build(codes) {
  const cal = JSON.parse(fs.readFileSync(path.join(OUT, "CALIBRATION.json"), "utf8"));
  const cfg = cal.adopted, o = optsOf(cfg);
  const summary = {};
  for (const code of codes) {
    const L = LANGS[code]; if (!L) { console.error(`no recipe for ${code}`); continue; }
    const log = [];
    const sources = [...L.bitext(HELD_ALL, log), ...L.udhr.flatMap((u) => udhrSources(u, udhrAnchors(cfg.multi), code))];
    if (!sources.length) { console.error(`${code}: no source`); continue; }
    const base = P.projectBase(sources, { B });
    const chance = P.chanceDiscoveries(base);
    const pack = P.finalizePack(base, o);
    const nPairs = pack.stats.sources.reduce((n, s) => n + s.pairs, 0), nTok = pack.stats.sources.reduce((n, s) => n + s.creoleTokens, 0);
    const hasBitext = sources.some((s) => s.kind === "bitext");
    const bitextPairs = pack.stats.sources.filter((s) => !s.name.startsWith("udhr-")).reduce((n, s) => n + s.pairs, 0);
    const near = nearestRow(cal, hasBitext, bitextPairs);
    // read-only coverage against the held-out running text
    const held = heldCreoleTokens(code); let tt = 0, hit = 0; const miss = new Map();
    for (const s of held) for (const w of P.tokenize(s)) { if (P.scriptClass(w)) continue; tt += 1; if (Object.hasOwn(pack.forms, w)) hit += 1; else miss.set(w, (miss.get(w) ?? 0) + 1); }
    const f1ok = chance.beatsChance;
    const provenance = {
      giver: `POS projection (annotation transfer) — word alignment by IBM Model 1 with a diagonal prior, both directions, intersection links; each link adds the anchor form's own UD UPOS distribution (soft vote, ambiguity kept); a (form, class) vote kept only if it strictly exceeds all ${B} shuffled-pairing runs of the same pipeline. Anchor taggers: ${[...new Set(sources.map((s) => s.anchorLang))].map((l) => `pos-${l} (${anchorPacks[l].provenance.giver})`).join("; ")}. Parallel text: ${sources.map((s) => `${s.name} [${s.pairs.length} pairs, ${s.licence}]`).join("; ")}. Builder: eval/creole/pos-projection-run.mjs (pre-registered in eval/creole/POS-PROJECTION-PREREG.md).`,
      license: "CC BY-SA 4.0 (projection; anchors UD CC BY-SA 4.0; parallel sources as listed — MIT / CC BY 2.0 FR / public domain)",
      method: "eval/creole/pos-projection.mjs",
      adoptedArms: cfg,
      parallel: sources.map((s) => ({ name: s.name, kind: s.kind, pairs: s.pairs.length, licence: s.licence, anchor: s.anchorLang })),
      heldOutGuard: { rule: "a training sentence is dropped when its letters+digits key equals any creole sentence of any held-out file", log },
      trainingSize: { pairs: nPairs, creoleTokens: nTok, forms: pack.stats.forms, rawForms: pack.stats.rawForms },
      chance: { realKeptVotes: chance.real, bestShuffledRunKeptVotes: chance.nullMax, beatsChance: f1ok },
      heldOutCoverage: { text: "creole side of the language-ID held-out file, read-only, never used to build", wordTokens: tt, covered: hit, coverage: tt ? +(hit / tt).toFixed(3) : null, commonestMissing: [...miss].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([w, n]) => `${w}×${n}`) },
      calibration: {
        note: "Per-UPOS precision/recall of the SAME method on languages with gold, at the nearest data size. This is the method's error bar, not a measurement of this language; domain shift is not calibrated. Abstentions count against recall. 95% bootstrap intervals are in packs/CALIBRATION.json.",
        condition: near.cond, row: near.row,
        pcm_ud_naija_test: brief(near.pcm),
        hat_vs_pos_hat_lexicon: brief(near.hat),
      },
      trust: "type-level lexicon only; a form absent here is a typed gap, not a negative; closed-class forms projected from an English/French aux/ADP/PRON are the most reliable, open-class recall is low",
    };
    summary[code] = { pairs: nPairs, tokens: nTok, forms: pack.stats.forms, heldOutCoverage: provenance.heldOutCoverage.coverage, beatsChance: f1ok, near: near.row };
    if (!f1ok) { console.error(`${code}: F1 chance falsifier FIRED (${chance.real} kept votes vs ${chance.nullMax} from a shuffled run) — pack not written`); continue; }
    writeSafe(path.join(OUT, `pos-${code}.json`), JSON.stringify(P.packShape(code, pack.forms, provenance), null, 1));
    console.error(`${code}: ${JSON.stringify(summary[code])}`);
  }
  writeSafe(path.join(WORK, "build-summary.json"), JSON.stringify(summary, null, 1));
}

if (stage === "select") await select();
else if (stage === "report") await calibrate();
else if (stage === "build") await build(args.slice(1).filter((a) => /^[a-z]{3}$/.test(a)).length ? args.slice(1).filter((a) => /^[a-z]{3}$/.test(a)) : ["mfe", "tpi", "sag", "jam", "gcf"]);
else { console.error("usage: select | report | build [codes…]  [--B n]"); process.exit(2); }
void logOnly;
