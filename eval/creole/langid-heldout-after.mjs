// eval/creole/langid-heldout-after.mjs — before/after of the creole tier on the SAME held-out sentences as id-heldout.mjs.
//   node eval/creole/langid-heldout-after.mjs [--json out.json]
// before = identify(text, { creole: false })  (exactly the pre-tier code path; checked byte-identical to commit 59d8264 by langid-unchanged.mjs)
// after  = identify(text)                     (the shipped tier, MU pooled over each lexifier family)
// pair   = the same tier with MU_PAIR (the cutoff of LANGID-PREREG.md as first written: the pair's own cross-validated lead)
// Buckets: right = the creole; family = the label of the creole's own lexifier family (cpf/cpe/…; not wrong, not specific);
//          sibling = a different specific creole; as-base = its lexifier (fr/en/es); other-wrong = any other language; abstain.
import fs from "node:fs";
import path from "node:path";
import { identify, CREOLE_CTX, DECLARED } from "../../fold-chat-langid.js";
import { makeScorer, decide, FAMILY_CODE } from "../../fold-chat-langid-creole.js";
import { PRIORS, TAU, MU, MU_PAIR, META } from "../../fold-chat-creole-priors.js";

const D = "/Users/mlacy/Documents/3.0/live_priors-latest/11-multi-language/dialects-pidgins-creoles/creoleval";
const tsv = (f, col) => fs.readFileSync(path.join(D, f), "utf8").split("\n").slice(1).map((l) => l.split("\t")[col]).filter(Boolean);
const trg = (f) => fs.readFileSync(path.join(D, f), "utf8").split("\n").map((l) => l.split("\t")[1]).filter(Boolean);
const jsonl = (f) => fs.readFileSync(path.join(D, f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).target);
const conllu = (f) => fs.readFileSync(path.join(D, f), "utf8").split("\n").filter((l) => l.startsWith("# text = ")).map((l) => l.slice(9));
// the same sets, order and sampling as id-heldout.mjs (so the numbers are comparable cell for cell)
export const SETS = [
  { code: "hat", want: ["hat", "hatkreyol", "hatpopular", "ht"], name: "Haitian", sents: [...trg("mt_mit_haiti/ht-en.trg"), ...tsv("tatoeba_sentence_mining/hat-fra_sample1.tsv", 0)], base: "fr" },
  { code: "mfe", want: ["mfe", "052"], name: "Mauritian", sents: [...jsonl("mt_kreolmorisien/en-cr_test.jsonl"), ...jsonl("mt_kreolmorisien/en-cr_dev.jsonl")], base: "fr" },
  { code: "pcm", want: ["pcm"], name: "Nigerian Pidgin", sents: [...conllu("pos_ud_naija_pcm/pcm_nsc-ud-test_sample.conllu"), ...conllu("pos_ud_naija_pcm/pcm_nsc-ud-dev_sample.conllu")], base: "en" },
  { code: "tpi", want: ["tpi"], name: "Tok Pisin", sents: tsv("tatoeba_sentence_mining/tpi-eng_sample1.tsv", 0), base: "en" },
  { code: "pap", want: ["pap"], name: "Papiamentu", sents: tsv("tatoeba_sentence_mining/pap-eng_sample1.tsv", 0), base: "es" },
  { code: "sag", want: ["sag"], name: "Sango", sents: tsv("tatoeba_sentence_mining/sag-eng_sample1.tsv", 0), base: "fr" },
  { code: "gcf", want: ["gcf"], name: "Guadeloupean", sents: tsv("tatoeba_sentence_mining/gcf-fra.tsv", 0), base: "fr" },
  { code: "jam", want: ["jam", "055"], name: "Jamaican", sents: tsv("tatoeba_sentence_mining/jam-eng.tsv", 0), base: "en" },
];
const clean = (s) => String(s).replace(/\s+/g, " ").trim();
const ok = (s) => s.length >= 25 && s.split(" ").length >= 5 && !/\d{3,}/.test(s) && !/https?:|www\./.test(s);
const N = 150;
export function sample(s) {
  const seen = new Set(), pool = [];
  for (const raw of s.sents) { const t = clean(raw); if (ok(t) && !seen.has(t)) { seen.add(t); pool.push(t); } }
  return pool.filter((_, i) => i % Math.max(1, Math.floor(pool.length / N)) === 0).slice(0, N);
}
// every label a creole can wear: the creole codes, their UDHR keys, and the family collectives
const CREOLE_LABELS = new Set([...Object.keys(META), "hatkreyol", "hatpopular", "ht", "052", "055", "056", "008", "kri", "ktu", "cri", ...Object.values(FAMILY_CODE)]);
const lexOf = (code) => (META[code] ? META[code].lexifier : null);
export function bucket(set, lang, confident) {
  if (!confident || lang === "unknown") return "abstain";
  if (set.want.includes(lang)) return "right";
  if (lang === FAMILY_CODE[lexOf(set.code)]) return "family";
  if (CREOLE_LABELS.has(lang) && !Object.values(FAMILY_CODE).includes(lang)) return "sibling";
  if (lang === set.base) return "as-base";
  return "other-wrong";
}
const KEYS = ["right", "family", "sibling", "as-base", "other-wrong", "abstain"];
const scorer = makeScorer(CREOLE_CTX, PRIORS);
const P = { wordWeight: DECLARED.wordWeight, gramWeight: DECLARED.gramWeight };
function pairVariant(text) {
  const d = decide(scorer.readings(text, P), { tau: TAU, mu: MU_PAIR, meta: META });
  return d ? { lang: d.lang, confident: d.lang !== "unknown" } : null;
}
const out = { rows: [], total: {}, N };
for (const v of ["before", "after", "pair"]) out.total[v] = Object.fromEntries(KEYS.map((k) => [k, 0]));
const wrongs = {};
for (const set of SETS) {
  const pick = sample(set);
  const row = { language: set.name, n: pick.length };
  for (const v of ["before", "after", "pair"]) row[v] = Object.fromEntries(KEYS.map((k) => [k, 0]));
  for (const t of pick) {
    const b = identify(t, { creole: false }), a = identify(t);
    const pv = pairVariant(t);
    const cells = { before: b, after: a, pair: pv ? { lang: pv.lang, confident: pv.confident } : a };
    for (const [v, r] of Object.entries(cells)) {
      const k = bucket(set, r.lang, r.confident);
      row[v][k]++; out.total[v][k]++;
      if (v === "after" && (k === "other-wrong" || k === "sibling")) { const key = `${set.name}: ${r.lang}`; wrongs[key] = (wrongs[key] || 0) + 1; }
    }
  }
  out.rows.push(row);
}
out.after_wrong_labels = wrongs;
const pad = (x, n) => String(x).padStart(n);
const line = (name, n, c) => name.padEnd(16) + pad(n, 5) + KEYS.map((k) => pad(c[k], 13)).join("");
console.log("language".padEnd(16) + pad("n", 5) + KEYS.map((k) => pad(k, 13)).join(""));
for (const r of out.rows) for (const v of ["before", "after", "pair"]) console.log(line((v === "before" ? r.language : "  " + v).slice(0, 16), v === "before" ? r.n : "", r[v]));
const n = out.rows.reduce((a, r) => a + r.n, 0);
for (const v of ["before", "after", "pair"]) console.log(line("ALL " + v, n, out.total[v]));
console.log("\nafter: labels in sibling/other-wrong:", JSON.stringify(wrongs));
const ji = process.argv.indexOf("--json");
if (ji > 0) fs.writeFileSync(process.argv[ji + 1], JSON.stringify(out, null, 1));
