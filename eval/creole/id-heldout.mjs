// eval/creole/id-heldout.mjs — held-out check: does the Fold's language detector name the creole, or read it as its base language?
// Sentences come from CreoleVal files (not UDHR), creole side only; the detector is the Fold's own, imported from THIS checkout.
//   node eval/creole/id-heldout.mjs
// Buckets: right = named the creole; sibling = a different creole of the same lexifier; as-base = read as its lexifier (often
// tolerable: Nigerian Pidgin as English); other-wrong = confidently some unrelated language; abstain = said unknown.
// UDHR ids 052/055/056 are Morisyen / Jamaican Creole English / Saint Lucian Creole French (fold-chat-lang-priors NAMES).
// HELD-OUT FILES (never build a prior from these, or this measure is void): see eval/creole/BASELINE.md.
import fs from "node:fs";
import path from "node:path";
import { identify } from "../../fold-chat-langid.js";
const D = "/Users/mlacy/Documents/3.0/live_priors-latest/11-multi-language/dialects-pidgins-creoles/creoleval";
const tsv = (f, col) => fs.readFileSync(path.join(D, f), "utf8").split("\n").slice(1).map((l) => l.split("\t")[col]).filter(Boolean);
const trg = (f) => fs.readFileSync(path.join(D, f), "utf8").split("\n").map((l) => l.split("\t")[1]).filter(Boolean);
const jsonl = (f) => fs.readFileSync(path.join(D, f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).target);
const conllu = (f) => fs.readFileSync(path.join(D, f), "utf8").split("\n").filter((l) => l.startsWith("# text = ")).map((l) => l.slice(9));
const SETS = [
  { want: ["hat", "hatkreyol", "hatpopular", "ht"], sib: [], name: "Haitian", sents: [...trg("mt_mit_haiti/ht-en.trg"), ...tsv("tatoeba_sentence_mining/hat-fra_sample1.tsv", 0)], base: "fr" },
  { want: ["mfe", "052"], sib: [], name: "Mauritian", sents: [...jsonl("mt_kreolmorisien/en-cr_test.jsonl"), ...jsonl("mt_kreolmorisien/en-cr_dev.jsonl")], base: "fr" },
  { want: ["pcm"], sib: [], name: "Nigerian Pidgin", sents: [...conllu("pos_ud_naija_pcm/pcm_nsc-ud-test_sample.conllu"), ...conllu("pos_ud_naija_pcm/pcm_nsc-ud-dev_sample.conllu")], base: "en" },
  { want: ["tpi"], sib: [], name: "Tok Pisin", sents: tsv("tatoeba_sentence_mining/tpi-eng_sample1.tsv", 0), base: "en" },
  { want: ["pap"], sib: [], name: "Papiamentu", sents: tsv("tatoeba_sentence_mining/pap-eng_sample1.tsv", 0), base: "es" },
  { want: ["sag"], sib: [], name: "Sango", sents: tsv("tatoeba_sentence_mining/sag-eng_sample1.tsv", 0), base: "fr" },
  { want: ["gcf"], sib: ["056"], name: "Guadeloupean", sents: tsv("tatoeba_sentence_mining/gcf-fra.tsv", 0), base: "fr" },
  { want: ["jam", "055"], sib: [], name: "Jamaican", sents: tsv("tatoeba_sentence_mining/jam-eng.tsv", 0), base: "en" },
];
const clean = (s) => String(s).replace(/\s+/g, " ").trim();
const ok = (s) => s.length >= 25 && s.split(" ").length >= 5 && !/\d{3,}/.test(s) && !/https?:|www\./.test(s);
const N = 150;
const rows = [];
const tot = { n: 0, right: 0, sib: 0, base: 0, wrong: 0, abst: 0 };
for (const s of SETS) {
  const seen = new Set(), pool = [];
  for (const raw of s.sents) { const t = clean(raw); if (ok(t) && !seen.has(t)) { seen.add(t); pool.push(t); } }
  const pick = pool.filter((_, i) => i % Math.max(1, Math.floor(pool.length / N)) === 0).slice(0, N);
  const c = { right: 0, sib: 0, base: 0, other: 0, abst: 0 }; const wl = {};
  for (const t of pick) {
    const r = identify(t);
    if (!r.confident || r.lang === "unknown") c.abst++;
    else if (s.want.includes(r.lang)) c.right++;
    else if (s.sib.includes(r.lang)) c.sib++;
    else if (r.lang === s.base) { c.base++; wl[r.lang] = (wl[r.lang] || 0) + 1; }
    else { c.other++; wl[r.lang] = (wl[r.lang] || 0) + 1; }
  }
  const top = Object.entries(wl).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k + "x" + v).join(" ");
  rows.push([s.name, pick.length, c.right, c.sib, c.base, c.other, c.abst, top]);
  tot.n += pick.length; tot.right += c.right; tot.sib += c.sib; tot.base += c.base; tot.wrong += c.other; tot.abst += c.abst;
}
const pad = (x, n) => String(x).padStart(n);
console.log("language".padEnd(16) + pad("n", 5) + pad("right", 7) + pad("sibling", 9) + pad("as-base", 9) + pad("other-wrong", 13) + pad("abstain", 9) + "   top wrong labels");
for (const r of rows) console.log(String(r[0]).padEnd(16) + pad(r[1], 5) + pad(r[2], 7) + pad(r[3], 9) + pad(r[4], 9) + pad(r[5], 13) + pad(r[6], 9) + "   " + r[7]);
const pc = (x) => Math.round((100 * x) / tot.n) + "%";
console.log("ALL".padEnd(16) + pad(tot.n, 5) + "   right " + tot.right + " (" + pc(tot.right) + ")   sibling " + tot.sib + " (" + pc(tot.sib) + ")   as-base " + tot.base + " (" + pc(tot.base) + ")   other-wrong " + tot.wrong + " (" + pc(tot.wrong) + ")   abstain " + tot.abst + " (" + pc(tot.abst) + ")");
