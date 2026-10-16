// scripts/build-salience-prior.mjs — derive a SALIENCE prior from a REAL POSPrior@1.
//
// Informed by a real prior, never hand-typed: the khora/live_priors POSPrior@1 packs, per word
// FORM, the UPOS attestation counts of the UD English treebank (UD_English-EWT, gold). A form's
// salience is a weighted read of that distribution — a name (PROPN) is what an ask is about, a
// common noun/verb/adj is content, an adverb is weak, and a function class (DET/ADP/AUX/PRON/…)
// names nothing. The weights are DECLARED (the author, 2026-10-10; II.11) — the DATA is the prior.
//
//   node scripts/build-salience-prior.mjs [path/to/pos-prior-en.json]
//   POS_PRIOR=/path/to/pos-prior-en.json node scripts/build-salience-prior.mjs
//   node scripts/build-salience-prior.mjs /path/to/pos-pcm.json --lang pcm --closed
//
// Emits fold-chat-salience-prior.js (a frozen form -> 0..9 table). Never edit the output.
//
// --closed        also emit CLOSED_CLASS: the forms the pack itself calls closed-class, by the rule scripts/build-function-words.mjs
//                 already uses (≥ 5 tokens and ≥ 50 % of them DET/ADP/AUX/PRON/CCONJ/SCONJ/PART). The salience table drops function
//                 words (weight 0), so without this a language that has no FUNCTION_WORDS entry reads every function word as an
//                 unmeasured candidate NAME. es/fr/en are built without it (their closed class is FUNCTION_WORDS). A closed-class
//                 form is OMITTED from the salience table (it is a function word, never content: "dey" is AUX 77 %, VERB 23 %).
// --shuffle SEED  the NULL build (eval/creole/SALIENCE-PREREG.md): the tag distributions are permuted across forms (Fisher–Yates,
//                 mulberry32(SEED)); form set, count mass and the 5-token floor are preserved, only the owner of each tag mix moves.
// --out PATH      write there instead of fold-chat-salience-prior[-LANG].js (null builds and tests).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// --lang xx writes fold-chat-salience-prior-xx.js (a non-English prior); without it, the English module as before
const flag = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const LANG = flag("--lang");
const CLOSED_OUT = process.argv.includes("--closed");
const SHUFFLE = flag("--shuffle");
const OUT = flag("--out") ? path.resolve(flag("--out")) : path.resolve(HERE, LANG ? `../fold-chat-salience-prior-${LANG}.js` : "../fold-chat-salience-prior.js");
const DEFAULT_PRIOR = "/Users/mlacy/Documents/3.0/live_priors-latest/derived-priors/pos-priors/pos-prior-en.json";
const SRC = (process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null) || process.env.POS_PRIOR || DEFAULT_PRIOR;
// the closed UPOS classes (the same set as scripts/build-function-words.mjs)
const CLOSED_UPOS = new Set(["ADP", "DET", "PRON", "AUX", "CCONJ", "SCONJ", "PART"]);

// DECLARED salience weights per UPOS class (the ordering, not the data). Everything unnamed is 0.
const W = { PROPN: 9, NOUN: 7, VERB: 6, ADJ: 4, ADV: 1 };

let j;
try { j = JSON.parse(fs.readFileSync(SRC, "utf8")); }
catch (e) { console.error(`cannot read POSPrior at ${SRC}\n  ${e.message}\n  pass the path, or set POS_PRIOR`); process.exit(2); }
if (j.schema !== "POSPrior@1") { console.error(`not a POSPrior@1 (got ${j.schema})`); process.exit(2); }

const { foldText } = await import("../fold-chat-foldtext.js");
let raw = j.forms || {};
if (SHUFFLE != null) {
  // the null: keys sorted (the file's own order must not matter), the distributions permuted among them, seeded and deterministic
  let a = (Number(SHUFFLE) >>> 0) || 1;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const keys = Object.keys(raw).sort();
  const dists = keys.map((k) => raw[k]);
  for (let i = dists.length - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [dists[i], dists[k]] = [dists[k], dists[i]]; }
  raw = Object.fromEntries(keys.map((k, i) => [k, dists[i]]));
}
// a non-English prior is keyed by the FOLDED form (lookups fold first): forms that fold together pool their counts
const forms = {};
if (LANG) { for (const [f, d] of Object.entries(raw)) { const k = foldText(f); const t = (forms[k] ||= {}); for (const [c, n] of Object.entries(d)) t[c] = (t[c] || 0) + n; } }
else Object.assign(forms, raw);
const rows = [];
const closed = [];
for (const form of Object.keys(forms)) {
  const dist = forms[form] || {};
  let num = 0, den = 0;
  for (const [cls, n] of Object.entries(dist)) { den += n; num += (W[cls] || 0) * n; }
  if (!den) continue;
  if (CLOSED_OUT) { let c = 0; for (const [cls, n] of Object.entries(dist)) if (CLOSED_UPOS.has(cls)) c += n; if (den >= 5 && c / den >= 0.5) { closed.push([form, den]); continue; } }   // closed wins: a function word carries no salience
  const score = Math.round(num / den);            // 0..9
  if (score <= 0) continue;                        // function classes carry no salience; FUNCTION_WORDS owns them
  rows.push([form, score]);
}
rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
closed.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

const nullNote = SHUFFLE != null ? `// NULL BUILD (seed ${SHUFFLE}): tag distributions permuted across forms (eval/creole/SALIENCE-PREREG.md). NEVER SHIP.\n` : "";
const body = `${nullNote}// ${path.basename(OUT)} — GENERATED by scripts/build-salience-prior.mjs from a real
// POSPrior@1 (${(j.provenance && j.provenance.source) || "UD_English-EWT"}). Do not edit by hand; regenerate. Form -> salience 1..9, derived from
// each form's own UPOS distribution and the DECLARED weights {PROPN:9, NOUN:7, VERB:6, ADJ:4, ADV:1}.
// A form absent here is either a function word (see fold-chat-function-words.js) or unseen.
//
// giver: derived from ${path.basename(SRC)} (schema ${j.schema}); built ${j.builtAt || "n/a"}
export const SALIENCE_PRIOR_SCHEMA = "SaliencePrior@1";
export const SALIENCE_PRIOR_SOURCE = ${JSON.stringify(path.basename(SRC))};
export const SALIENCE_PRIOR = Object.freeze(${JSON.stringify(Object.fromEntries(rows))});
${CLOSED_OUT ? `// CLOSED_CLASS: forms with >= 5 tokens of which >= 50% are ADP/DET/PRON/AUX/CCONJ/SCONJ/PART in the same pack (the rule of
// scripts/build-function-words.mjs). Read through functionWordsOf(lang) (fold-chat-snippets.js) so a language with no FUNCTION_WORDS
// entry still has a closed class; never merged into fold-chat-function-words.js (junk/region/lang-facts union every language).
export const CLOSED_CLASS = Object.freeze(${JSON.stringify(closed.map((r) => r[0]))});
` : ""}`;

fs.writeFileSync(OUT, body);
console.log(`${rows.length} salient forms${CLOSED_OUT ? `, ${closed.length} closed-class forms` : ""} -> ${OUT} (${(body.length / 1024).toFixed(0)} KB)`);
