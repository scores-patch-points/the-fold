// eval/creole/langid-build.mjs — the corpora of the creole language-ID tier, with the hash split (LANGID-PREREG.md).
//   creoleSentences()  → [{ lang, src, id, text, fold }]   what the tier is BUILT from (BUILD FROM sources only)
//   creoleForms()      → { lang: Map(form → count) }        janus POS-pack vocabulary (a form has no sentence id: used whole)
//   nullSentences()    → [{ src, lang, text, fold }]        non-creole Latin text: calibrates the cutoffs and checks UNCHANGED
//   perturb(text, kind) → the declared typing perturbations (strip diacritics / transposition / leetspeak)
// HELD-OUT FILES (BASELINE.md) are refused by path: assertAllowed() throws if a loader is ever pointed at one.
import fs from "node:fs";
import path from "node:path";

export const ROOT = process.env.CREOLE_CORPUS_ROOT || "/Users/mlacy/Documents/3.0/live_priors-latest";
export const JANUS = process.env.CREOLE_JANUS_PRIORS || "/Users/mlacy/Documents/3.0/janus/priors";
const CR = path.join(ROOT, "11-multi-language/dialects-pidgins-creoles");
const UDHR = path.join(ROOT, "06-government-legal/un-udhr");

// BASELINE.md "HELD-OUT FILES" (and the whole mt_mit_haiti / pcm NSC / kreolmorisien dirs' test+dev sides): never read.
export const HELD_OUT = [
  "creoleval/mt_mit_haiti", "creoleval/mt_kreolmorisien/en-cr_test.jsonl", "creoleval/mt_kreolmorisien/en-cr_dev.jsonl",
  "creoleval/pos_ud_naija_pcm", "tatoeba_sentence_mining/hat-fra_sample1", "tatoeba_sentence_mining/tpi-eng_sample1",
  "tatoeba_sentence_mining/pap-eng_sample1", "tatoeba_sentence_mining/sag-eng_sample1", "tatoeba_sentence_mining/gcf-fra",
  "tatoeba_sentence_mining/jam-eng",
];
export function assertAllowed(p) {
  const s = String(p).replace(/\\/g, "/");
  for (const h of HELD_OUT) if (s.includes(h)) throw new Error("held-out file refused: " + p);
  return p;
}
const read = (p) => fs.readFileSync(assertAllowed(p), "utf8");

// FNV-1a over source:id → bucket 0..4 (the split rule in LANGID-PREREG.md)
export function fnv(s) { let h = 0x811c9dc5; for (const ch of Buffer.from(String(s), "utf8")) { h ^= ch; h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
export const foldOf = (key) => fnv(key) % 5;

/** language code → { name, lexifier } (lexifier = the APiCS survey header's "Lexifier:" field; sag/lin have none) */
export const META = Object.freeze({
  hat: { name: "Haitian Creole", lexifier: "French" }, gcf: { name: "Guadeloupean Creole", lexifier: "French" },
  acf: { name: "Saint Lucian Creole", lexifier: "French" }, mfe: { name: "Mauritian Creole", lexifier: "French" },
  crs: { name: "Seychellois Creole", lexifier: "French" }, pcm: { name: "Nigerian Pidgin", lexifier: "English" },
  jam: { name: "Jamaican Creole", lexifier: "English" }, tpi: { name: "Tok Pisin", lexifier: "English" },
  bis: { name: "Bislama", lexifier: "English" }, pis: { name: "Pijin", lexifier: "English" }, kri: { name: "Krio", lexifier: "English" },
  djk: { name: "Ndyuka", lexifier: "English" }, srn: { name: "Sranan", lexifier: "English" },
  pap: { name: "Papiamentu", lexifier: "Spanish" }, kea: { name: "Kabuverdianu", lexifier: "Portuguese" },
  pov: { name: "Upper Guinea Creole", lexifier: "Portuguese" }, sag: { name: "Sango", lexifier: null }, lin: { name: "Lingala", lexifier: null },
});

// ── sentences ─────────────────────────────────────────────────────────────────────────────────────────────────
const HEADER = /^(?:Language:|Adopted:|Publisher:|Universal Declaration of Human Rights)/i;
/** Split a paragraph into sentences on terminal punctuation (and ; :) followed by space; keeps those of >= 2 words. */
export function sentencesOf(par) {
  return String(par).replace(/\s+/g, " ").split(/(?<=[.!?;:])\s+/u).map((s) => s.trim()).filter((s) => s.split(" ").length >= 2 && /\p{L}/u.test(s));
}
function udhrSentences(file, lang) {
  const out = [];
  const lines = read(path.join(UDHR, file)).split(/\r?\n/).filter((l) => l.trim() && !HEADER.test(l.trim()));
  lines.forEach((l, i) => sentencesOf(l).forEach((s, k) => { const id = `${file}:${i}:${k}`; out.push({ lang, src: "udhr", id, text: s, fold: foldOf(id) }); }));
  return out;
}
function bitext(dir, lang) {
  // header: <x>_id <x>_text <y>_id <y>_text ; one pair id per creole sentence (duplicates collapse on the creole id)
  const rows = read(path.join(CR, "kreyol-mt/bitexts", dir, dir + ".tsv")).split("\n").slice(1).filter(Boolean).map((l) => l.split("\t"));
  const seen = new Set(), out = [];
  for (const [id, text] of rows) { if (!text || seen.has(id)) continue; seen.add(id); out.push({ lang, src: "kreyol-mt", id: dir + ":" + id, text: text.trim(), fold: foldOf(dir + ":" + id) }); }
  return out;
}
/** The lexifier side of a Kreyol-MT bitext: non-creole text for the null. */
function bitextOther(dir) {
  const rows = read(path.join(CR, "kreyol-mt/bitexts", dir, dir + ".tsv")).split("\n").slice(1).filter(Boolean).map((l) => l.split("\t"));
  return rows.map((r) => r[3]).filter(Boolean);
}
/** APiCS interlinear examples: after "(N)" the lines alternate word / gloss until a free-translation line (>= 4 words). */
export function apicsExamples(text) {
  const L = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = [];
  for (let i = 0; i < L.length; i++) {
    if (!/^\(\d+\)$/.test(L[i])) continue;
    const words = [];
    let j = i + 1, closed = false;
    for (; j < L.length && j < i + 80; j++) {
      const toks = L[j].split(/\s+/);
      if (toks.length >= 4 || /^\(\d+\)$/.test(L[j])) { closed = true; break; }
      words.push(L[j]);
    }
    if (!closed || words.length < 4 || words.length % 2) continue;       // an odd count means the gloss alignment slipped
    const creole = words.filter((_, k) => k % 2 === 0).join(" ");
    if (/[=]/.test(creole)) continue;
    out.push(creole);
  }
  return out;
}
const APICS = { "02": "srn", "04": "djk", "08": "jam", "15": "kri", "17": "pcm", "22": "tpi", "23": "bis", "30": "kea", "33": "pov", "47": "pap", "49": "hat", "50": "gcf", "55": "mfe", "56": "crs", "59": "sag", "60": "lin" };
function apics() {
  const dir = path.join(CR, "apics/surveys"), out = [];
  for (const f of fs.readdirSync(dir)) {
    const n = (f.match(/^survey-(\d+)-/) || [])[1];
    if (!APICS[n]) continue;
    apicsExamples(read(path.join(dir, f))).forEach((t, i) => { const id = `apics-${n}:${i}`; out.push({ lang: APICS[n], src: "apics", id, text: t, fold: foldOf(id) }); });
  }
  return out;
}
const UDHR_FILES = { "udhr-hat_kreyol.txt": "hat", "udhr-hat_popular.txt": "hat", "udhr-052.txt": "mfe", "udhr-crs.txt": "crs", "udhr-056.txt": "acf", "udhr-055.txt": "jam",
  "udhr-pcm.txt": "pcm", "udhr-tpi.txt": "tpi", "udhr-pap.txt": "pap", "udhr-sag.txt": "sag", "udhr-kea.txt": "kea", "udhr-pov.txt": "pov",
  "udhr-008.txt": "pov", "udhr-kri.txt": "kri", "udhr-bis.txt": "bis", "udhr-pis.txt": "pis", "udhr-lin.txt": "lin" };
// DECONTAMINATION. Some build sources are the same Tatoeba sentences as a held-out file (measured: kreyol-mt/gcf-fra is 915 of the 923
// sentences of the held-out tatoeba gcf-fra.tsv). The held-out files are read here ONLY to make an exclusion set of normalised
// sentences (no text, count or feature of them ever enters a prior or a cutoff); any build/null sentence in it is dropped.
const normKey = (s) => String(s).toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
let HELD = null;
function heldOutSet() {
  if (HELD) return HELD;
  const D = path.join(CR, "creoleval"), set = new Set();
  const tsv = (f, col) => fs.readFileSync(path.join(D, f), "utf8").split("\n").slice(1).map((l) => l.split("\t")[col]).filter(Boolean);
  const trg = (f) => fs.readFileSync(path.join(D, f), "utf8").split("\n").map((l) => l.split("\t")[1]).filter(Boolean);
  const jl = (f) => fs.readFileSync(path.join(D, f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).target);
  const cu = (f) => fs.readFileSync(path.join(D, f), "utf8").split("\n").filter((l) => l.startsWith("# text = ")).map((l) => l.slice(9));
  const all = [...trg("mt_mit_haiti/ht-en.trg"), ...tsv("tatoeba_sentence_mining/hat-fra_sample1.tsv", 0), ...tsv("tatoeba_sentence_mining/tpi-eng_sample1.tsv", 0),
    ...tsv("tatoeba_sentence_mining/pap-eng_sample1.tsv", 0), ...tsv("tatoeba_sentence_mining/sag-eng_sample1.tsv", 0), ...tsv("tatoeba_sentence_mining/gcf-fra.tsv", 0),
    ...tsv("tatoeba_sentence_mining/jam-eng.tsv", 0), ...jl("mt_kreolmorisien/en-cr_test.jsonl"), ...jl("mt_kreolmorisien/en-cr_dev.jsonl"),
    ...cu("pos_ud_naija_pcm/pcm_nsc-ud-test_sample.conllu"), ...cu("pos_ud_naija_pcm/pcm_nsc-ud-dev_sample.conllu")];
  for (const t of all) set.add(normKey(t));
  return (HELD = set);
}
export const decontam = { dropped: {}, kept: {} };
let CS = null;
export function creoleSentences() {
  if (CS) return CS;
  CS = [];
  for (const [f, lang] of Object.entries(UDHR_FILES)) CS.push(...udhrSentences(f, lang));
  for (const [d, lang] of [["djk-eng", "djk"], ["hat-eng", "hat"], ["gcf-fra", "gcf"], ["tpi-eng", "tpi"], ["crs-fra", "crs"]]) CS.push(...bitext(d, lang));
  CS.push(...apics());
  const held = heldOutSet();
  const keep = [];
  for (const x of CS) { if (held.has(normKey(x.text))) decontam.dropped[x.lang] = (decontam.dropped[x.lang] || 0) + 1; else { keep.push(x); decontam.kept[x.lang] = (decontam.kept[x.lang] || 0) + 1; } }
  return (CS = keep);
}
const POS = { pcm: "pos-pcm.json", hat: "pos-hat.json", pap: "pos-pap.json", kea: "pos-kea.json", bis: "pos-bis.json", pis: "pos-pis.json", crs: "pos-crs.json", pov: "pos-pov.json", lin: "pos-lin.json" };
export function creoleForms() {
  const out = {};
  for (const [lang, f] of Object.entries(POS)) {
    const p = JSON.parse(read(path.join(JANUS, f)));
    const m = new Map();
    for (const [form, tags] of Object.entries(p.forms)) { let c = 0; for (const n of Object.values(tags)) c += n; m.set(form, c); }
    out[lang] = m;
  }
  return out;
}

/** The base's UDHR prior key for a UDHR file (scripts/build-udhr-priors.mjs: the name without udhr- / .txt, underscores removed). */
export const udhrKey = (file) => file.replace(/^udhr-|\.txt$/g, "").replace(/_/g, "");
/** The base UDHR priors the creole priors supersede (the creoles' own UDHR translations): never competitors. */
export const SUPERSEDES = [...new Set([...Object.keys(UDHR_FILES).map(udhrKey), "lintones"])];
/** Every non-creole UDHR translation as sentences with their hash fold, keyed by the base prior key: the cross-fit competitors. */
export function udhrCompetitors() {
  const out = {};
  for (const f of fs.readdirSync(UDHR).filter((x) => x.startsWith("udhr-") && x.endsWith(".txt"))) {
    const key = udhrKey(f);
    if (SUPERSEDES.includes(key)) continue;
    const arr = [];
    read(path.join(UDHR, f)).split(/\r?\n/).filter((l) => l.trim() && !HEADER.test(l.trim())).forEach((l, i) => sentencesOf(l).forEach((s, k) => { const id = `${f}:${i}:${k}`; arr.push({ text: s, fold: foldOf("udhr:" + id) }); }));
    out[key] = arr;
  }
  return out;
}

// ── the null: non-creole Latin-script text ───────────────────────────────────────────────────────────────────
// creoles the tier has no prior for (007 Saotomense, 030/ktu Kituba) and Lingala's tonal edition are not "non-creole": out of the null
const NON_CREOLE_UDHR_SKIP = new Set(Object.keys(UDHR_FILES).map((f) => f.replace(/^udhr-|\.txt$/g, "")).concat(["hat_kreyol", "hat_popular", "007", "030", "ktu", "lin_tones"]));
export function nullSentences() {
  const out = [];
  const held = heldOutSet();
  const add = (src, lang, id, text) => { const t = String(text).replace(/\s+/g, " ").trim(); if (t.length >= 2 && !held.has(normKey(t)) && /\p{Script=Latin}/u.test(t) && !/[\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Han}]/u.test(t)) out.push({ src, lang, text: t, fold: foldOf(src + ":" + id) }); };
  // 1. the app's own 40-language asks (eval/langid/labelled.json), never the no-prior class (it may hold a creole or an unlisted language)
  const lab = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "langid", "labelled.json");
  JSON.parse(fs.readFileSync(lab, "utf8")).forEach((it, i) => { if (it.cls !== "no-prior") add("asks", (it.accept || [])[0] || "", it.id || i, it.text); });
  // 2. every UDHR translation that is not a creole in UNIT (sentences)
  for (const f of fs.readdirSync(UDHR).filter((x) => x.startsWith("udhr-") && x.endsWith(".txt"))) {
    const code = f.replace(/^udhr-|\.txt$/g, "");
    if (NON_CREOLE_UDHR_SKIP.has(code)) continue;
    const raw = read(path.join(UDHR, f));
    const lang = ((raw.match(/^Language:.*\((\w+)\)\s*$/m) || [])[1]) || code;
    raw.split(/\r?\n/).filter((l) => l.trim() && !HEADER.test(l.trim())).forEach((l, i) => sentencesOf(l).forEach((s, k) => add("udhr", lang, `${f}:${i}:${k}`, s)));
  }
  // 3. the lexifier side of the Kreyol-MT bitexts (French / English Tatoeba sentences)
  for (const d of ["djk-eng", "hat-eng", "gcf-fra", "tpi-eng", "crs-fra"]) {
    const lang = d.endsWith("fra") ? "fr" : "en";
    const seen = new Set();
    bitextOther(d).forEach((t, i) => { if (!seen.has(t)) { seen.add(t); add("kreyol-mt-" + d, lang, i, t); } });
  }
  // 4. Tatoeba sample files that are NOT in the held-out list: the lexifier column only
  const tat = path.join(CR, "creoleval/tatoeba_sentence_mining");
  for (const [f, col, lang] of [["hat-eng_sample1.tsv", 1, "en"], ["gcf-eng.tsv", 1, "en"], ["cbk-eng_sample1.tsv", 1, "en"], ["cbk-spa.tsv", 1, "es"]]) {
    const p = path.join(tat, f); if (!fs.existsSync(p)) continue;
    read(p).split("\n").slice(1).forEach((l, i) => { const t = l.split("\t")[col]; if (t) add("tatoeba-" + f, lang, i, t); });
  }
  // 5. Wikipedia and the classics (long prose, split into sentences)
  for (const [rel, lang] of [["11-multi-language/wikipedia-lang/fr", "fr"], ["11-multi-language/wikipedia-lang/tr", "tr"]]) {
    const dir = path.join(ROOT, rel); if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => /\.(txt|md)$/.test(x)).slice(0, 40)) read(path.join(dir, f)).split(/\r?\n/).forEach((l, i) => sentencesOf(l).slice(0, 8).forEach((s, k) => add("wiki-" + lang, lang, `${f}:${i}:${k}`, s)));
  }
  // 6. long prose: Gutenberg / Britannica / Shakespeare / the classics (en fr it de sv …), at most PER_FILE evenly spaced sentences a file
  const PER_FILE = 300;
  const proseDirs = ["01-literature-books/gitenberg", "02-encyclopedic/1911-britannica", "15-western-canon", "11-multi-language/gutenberg-non-en",
    "11-multi-language/french-originals", "11-multi-language/italian-originals", "11-multi-language/parallel-classics", "18-childrens-books"];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  for (const rel of proseDirs) {
    const dir = path.join(ROOT, rel); if (!fs.existsSync(dir)) continue;
    for (const f of walk(dir).filter((x) => /\.(txt|md)$/.test(x) && !/README|ATTRIBUTION|LICENSE/.test(x)).sort()) {
      const sents = read(f).split(/\r?\n/).flatMap((l) => sentencesOf(l)).filter((s) => s.length < 400);
      const step = Math.max(1, Math.ceil(sents.length / PER_FILE));
      for (let i = 0; i < sents.length; i += step) add("prose", path.basename(path.dirname(f)), `${path.relative(ROOT, f)}:${i}`, sents[i]);
    }
  }
  return out;
}

// ── declared typing perturbations (mechanical; not thresholds) ───────────────────────────────────────────────
const LEET = { e: "3", a: "4", o: "0", i: "1", s: "5", t: "7" };
export function perturb(text, kind) {
  const toks = String(text).split(/(\s+)/);
  let w = 0;
  return toks.map((t) => {
    if (/^\s*$/.test(t)) return t;
    const k = w++;
    if (kind === "strip") return t.normalize("NFD").replace(/\p{M}+/gu, "").normalize("NFC");
    if (kind === "swap") { if (k % 3 !== 2) return t; const cs = [...t]; for (let i = 0; i + 1 < cs.length; i++) if (cs[i] !== cs[i + 1] && /\p{L}/u.test(cs[i]) && /\p{L}/u.test(cs[i + 1])) { [cs[i], cs[i + 1]] = [cs[i + 1], cs[i]]; break; } return cs.join(""); }
    if (kind === "leet") { if (k % 2 !== 1 || [...t].length < 3) return t; return [...t].map((c) => LEET[c.toLowerCase()] || c).join(""); }
    return t;
  }).join("");
}
export const PERTURBATIONS = ["strip", "swap", "leet"];
