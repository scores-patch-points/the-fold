// scripts/gen-pronoun-fixture.mjs — real treebank sentences, by language, for the pronoun ratchet.  (2026-10-14)
//   node scripts/gen-pronoun-fixture.mjs [--ud /Users/mlacy/Documents/data/ud] [--per 30]
// For every UD treebank with a train split, a licence of CC BY / CC BY-SA, and enough material, keep PER short sentences that contain a
// third-person PERSONAL pronoun (UD: UPOS=PRON, PronType=Prs, Person=3, and that form is PRON in the majority of its occurrences) and PER
// short sentences with no PRON at all. These are the positives and negatives for Level 0 of the pronoun stack: does the gate SEE an
// anaphor. No sentence is composed here; the selection is deterministic (first matching sentences in file order).
import fs from "node:fs"; import path from "node:path";
const args = process.argv.slice(2); const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const UD = opt("--ud", "/Users/mlacy/Documents/data/ud"), PER = Number(opt("--per", 30)), OUT = new URL("../eval/pronoun/ud-fixture.json", import.meta.url);
const out = { schema: "PronounFixture@1", per: PER, note: "Sentences from Universal Dependencies treebanks (CC BY / CC BY-SA per UD documentation); selection is deterministic.", languages: {} };
for (const dir of fs.readdirSync(UD).sort()) {
  const p = path.join(UD, dir); const train = fs.existsSync(p) && fs.readdirSync(p).find((f) => /train\.conllu$/.test(f)); if (!train) continue;
  // The treebank directories on disk carry no README, so a licence cannot be read here. Only treebanks UD documents as CC BY / CC BY-SA are
  // committed as fixtures; the list is declared, and the licence string says it was not verifiable from the files.
  const ALLOWED = { en_ewt: "CC BY-SA 4.0", es_gsd: "CC BY-SA 4.0", pt_bosque: "CC BY-SA 4.0", de_gsd: "CC BY-SA 4.0", ca_ancora: "CC BY 4.0" };
  if (!ALLOWED[dir] && !args.includes("--all-local")) continue;       // --all-local: a LOCAL run over every treebank, never committed
  const lic = ALLOWED[dir] ? `${ALLOWED[dir]} (per UD documentation; no README on disk to verify)` : "unverified: local run only";
  const lang = dir.split("_")[0];
  if (out.languages[lang]) continue;                                          // one treebank per language: the first in directory order
  const sents = []; let cur = null;
  for (const line of fs.readFileSync(path.join(p, train), "utf8").split("\n")) {
    if (line.startsWith("# text = ")) { cur = { text: line.slice(9), toks: [] }; continue; }
    if (!line) { if (cur && cur.toks.length) sents.push(cur); cur = null; continue; }
    if (line[0] === "#" || !cur) continue; const c = line.split("\t"); if (c.length < 6 || /[-.]/.test(c[0])) continue; cur.toks.push({ form: c[1], upos: c[3], feats: c[5], rel: c[7] ?? "" });
  }
  // majority-PRON forms among the personal 3rd-person ones
  const cnt = new Map(); for (const s of sents) for (const t of s.toks) { const m = cnt.get(t.form.toLowerCase()) ?? { pron: 0, other: 0 }; (t.upos === "PRON" ? m.pron++ : m.other++); cnt.set(t.form.toLowerCase(), m); }
  // a pronoun that can POINT BACK: personal, 3rd person, not reflexive ("se", "sich"), not an expletive subject ("es gibt", "it rains": UD rel expl*), and PRON in the majority of its uses
  const isPers = (t) => t.upos === "PRON" && /PronType=Prs/.test(t.feats) && /Person=3/.test(t.feats) && !/Reflex=Yes/.test(t.feats) && !/^expl/.test(t.rel) && cnt.get(t.form.toLowerCase()).pron > cnt.get(t.form.toLowerCase()).other;
  const pos = [], neg = [], neg2 = [];
  // sentences that contain pronouns, none of which can point back (reflexive, expletive, relative, interrogative): the precision set
  const nonPoint = (t) => t.upos === "PRON" && (/Reflex=Yes/.test(t.feats) || /^expl/.test(t.rel) || /PronType=(Rel|Int)/.test(t.feats) || !/PronType=Prs/.test(t.feats));
  for (const s of sents) {
    if (s.toks.length < 4 || s.toks.length > 14 || /^\p{Lu}+$/u.test(s.text)) continue;
    const idx = s.toks.findIndex(isPers);
    if (idx >= 0 && idx < 8 && pos.length < PER) pos.push({ text: s.text, pron: s.toks[idx].form });
    else if (!s.toks.some((t) => t.upos === "PRON") && neg.length < PER) neg.push({ text: s.text });
    else if (idx < 0 && s.toks.some((t) => t.upos === "PRON") && s.toks.filter((t) => t.upos === "PRON").every(nonPoint) && neg2.length < PER) neg2.push({ text: s.text, prons: s.toks.filter((t) => t.upos === "PRON").map((t) => t.form) });
    if (pos.length >= PER && neg.length >= PER && neg2.length >= PER) break;
  }
  if (pos.length >= 10 && neg.length >= 10) out.languages[lang] = { treebank: dir, license: lic.trim(), pos, neg, neg2 };
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(`${Object.keys(out.languages).length} languages: ${Object.keys(out.languages).join(" ")} · ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
