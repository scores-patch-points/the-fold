// scripts/build-lemma-table.mjs — mine a form→lemma table for the binder's light stemmer from a RECEIVED UD treebank (never hand-written).
//   node scripts/build-lemma-table.mjs [en_pud-ud-test.conllu] [pos-eng.json] [--unimorph=/path/to/eng]   → fold-chat-lemmas-en.js
// A form enters only if: (a) the light stemmer does not already unify it with its lemma; (b) every attestation gives the SAME lemma (unanimous;
// no count threshold); (c) it is a VERB or AUX there; (d) the English POS pack (UD EWT) has never seen it as NOUN, PROPN or ADJ — so a form that
// is also a noun ("saw", "left") never becomes its verb's stem. Experiment 3 of eval/modelvsrules/PREREG.md; rules frozen before the run.
// Experiment 4 adds UniMorph English rows (lemma TAB form TAB features): a form enters only if EVERY UniMorph analysis of it is a verb analysis
// with the SAME lemma, the light stemmer does not unify it, and the POS pack has never seen it as NOUN/PROPN/ADJ; where the two sources
// disagree the form is dropped. The raw UniMorph file is untrusted data: read as text only, kept outside the repository, its sha256 recorded.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lightStemOf } from "../fold-chat-frame.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONLLU = process.argv[2] || "/Users/mlacy/Documents/3.0/eoreader7-latest/native/eval/fixtures/ud-english-pud/en_pud-ud-test.conllu";
const POS = process.argv[3] || "/Users/mlacy/Documents/3.0/janus/priors/pos-eng.json";
const OUT = path.join(HERE, "..", "fold-chat-lemmas-en.js");
const UNI = (process.argv.find((a) => a.startsWith("--unimorph=")) || "").slice("--unimorph=".length) || null;

const seen = new Map();   // form → Map(lemma → { n, upos:Set })
let tokens = 0, sentences = 0;
for (const line of fs.readFileSync(CONLLU, "utf8").split("\n")) {
  if (line.startsWith("# sent_id")) sentences++;
  if (!line || line.startsWith("#")) continue;
  const c = line.split("\t");
  if (c.length < 4 || /[-.]/.test(c[0])) continue;
  tokens++;
  const form = c[1].toLowerCase(), lemma = c[2].toLowerCase(), upos = c[3];
  if (!/^\p{L}+$/u.test(form) || !/^\p{L}+$/u.test(lemma)) continue;
  if (!seen.has(form)) seen.set(form, new Map());
  const m = seen.get(form);
  if (!m.has(lemma)) m.set(lemma, { n: 0, upos: new Set() });
  const e = m.get(lemma); e.n++; e.upos.add(upos);
}
const pos = JSON.parse(fs.readFileSync(POS, "utf8")).forms || {};
const NOUNISH = ["NOUN", "PROPN", "ADJ"];
const table = {}, dropped = { already: 0, ambiguous: 0, notVerb: 0, nounish: 0 };
for (const [form, lemmas] of [...seen.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
  if (lemmas.size !== 1) { dropped.ambiguous++; continue; }
  const [[lemma, info]] = [...lemmas.entries()];
  if (lemma === form) continue;
  if (lightStemOf(form, "en") === lightStemOf(lemma, "en")) { dropped.already++; continue; }
  if (![...info.upos].every((u) => u === "VERB" || u === "AUX")) { dropped.notVerb++; continue; }
  const p = pos[form];
  if (p && NOUNISH.some((k) => (p[k] || 0) > 0)) { dropped.nounish++; continue; }
  table[form] = lemma;
}
// ── UniMorph English (Experiment 4) ──────────────────────────────────────────────────────────────────────────────────────
const uniDropped = { notVerbOrAmbiguous: 0, already: 0, nounish: 0, disagreeWithTreebank: 0 };
let uniSha = null, uniRows = 0, uniAdded = 0;
if (UNI) {
  const raw = fs.readFileSync(UNI);
  uniSha = crypto.createHash("sha256").update(raw).digest("hex");
  const byForm = new Map();                                   // form → { lemmas:Set, allVerb:boolean }
  for (const line of raw.toString("utf8").split("\n")) {
    const c = line.split("\t");
    if (c.length < 3) continue;
    uniRows++;
    const lemma = c[0].toLowerCase(), form = c[1].toLowerCase(), isVerb = /^V(;|$)/.test(c[2]);
    if (!/^\p{L}+$/u.test(form) || !/^\p{L}+$/u.test(lemma)) continue;
    let e = byForm.get(form); if (!e) { e = { lemmas: new Set(), allVerb: true }; byForm.set(form, e); }
    e.lemmas.add(lemma); if (!isVerb) e.allVerb = false;
  }
  for (const [form, e] of [...byForm.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (e.lemmas.size !== 1 || !e.allVerb) { uniDropped.notVerbOrAmbiguous++; continue; }
    const lemma = [...e.lemmas][0];
    if (lemma === form) continue;
    if (lightStemOf(form, "en") === lightStemOf(lemma, "en")) { uniDropped.already++; continue; }
    const p = pos[form];
    if (p && NOUNISH.some((k) => (p[k] || 0) > 0)) { uniDropped.nounish++; continue; }
    if (form in table && table[form] !== lemma) { delete table[form]; uniDropped.disagreeWithTreebank++; continue; }
    if (!(form in table)) { table[form] = lemma; uniAdded++; }
  }
}
const prov = { source: "UD_English-PUD en_pud-ud-test.conllu (" + path.basename(CONLLU) + ")", license: "CC BY-SA 4.0 (Universal Dependencies English-PUD)" + (UNI ? "; CC BY-SA (UniMorph English, github.com/unimorph/eng)" : ""), tokens, sentences,
  unimorph: UNI ? { file: "eng", sha256: uniSha, rows: uniRows, added: uniAdded, dropped: uniDropped } : null,
  posPack: "janus/priors/pos-eng.json (UD_English-EWT train)", builder: "scripts/build-lemma-table.mjs", dropped };
const body = `// GENERATED by scripts/build-lemma-table.mjs from a received UD treebank — never hand-edit; rebuild instead.
// ${Object.keys(table).length} irregular forms (verb/aux only, unanimous, not already unified by the light stemmer, never a noun in the POS pack).
// Experiment 3 of eval/modelvsrules/PREREG.md.
export const LEMMAS_EN = Object.freeze(${JSON.stringify(table, null, 1)});
export const LEMMAS_EN_PROVENANCE = Object.freeze(${JSON.stringify(prov, null, 1)});
`;
fs.writeFileSync(OUT, body);
console.log(`${Object.keys(table).length} entries from ${tokens} tokens / ${sentences} sentences; dropped`, JSON.stringify(dropped), UNI ? `| UniMorph rows ${uniRows}, added ${uniAdded}, dropped ${JSON.stringify(uniDropped)}, sha256 ${uniSha.slice(0, 16)}…` : "");
console.log("module bytes:", fs.statSync(OUT).size);
