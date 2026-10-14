// scripts/build-work-cards.mjs — fold the MVP's works into cards, once, offline.  (2026-10-14)
//   node scripts/build-work-cards.mjs [--out mind/work-cards.json] [--per-lang 5]
// Discovers its own works (no arguments needed): the Republic in English and Greek always, plus a seeded sample per language. Writes the
// index the page loads. Never fetches anything; reads the local corpus only.
import fs from "node:fs"; import path from "node:path";
import { BUDGET, collectionOf, buildCard, serializeIndex } from "../work-card.js";
const args = process.argv.slice(2); const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt("--out", "mind/work-cards.json")), PER = Number(opt("--per-lang", 5));
const ZEN = "/Users/mlacy/Documents/3.0/Zenodotus/";
const SOURCES = [["en", "01-literature-books/gutenberg/"], ["grc", "11-multi-language/greek-originals/"], ["es", "24-global-literature/es/"], ["pt", "24-global-literature/pt/"], ["ca", "24-global-literature/ca/"], ["zh", "24-global-literature/zh/"]];
const FIXED = [{ lang: "en", file: ZEN + "01-literature-books/gutenberg/pg55201_The_Republic_by_Plato.txt", title: "The Republic by Plato" }, { lang: "grc", file: ZEN + "11-multi-language/greek-originals/plato-republic.txt", title: "Plato Republic Politeia" }];
const titleOf = (f) => path.basename(f).replace(/\.[^.]+$/, "").replace(/^(pg)?\d+[_-]/i, "").replace(/^[a-z]{2}-\d+-/i, "").replace(/[_-]+/g, " ").trim();
const works = [...FIXED];
for (const [lang, dir] of SOURCES) {
  const files = fs.readdirSync(ZEN + dir).filter((f) => f.endsWith(".txt")).map((f) => ZEN + dir + f).filter((f) => { const n = fs.statSync(f).size; return n >= 60_000 && n <= 3_000_000 && !FIXED.some((x) => x.file === f); }).sort();
  for (const f of files.slice(0, PER)) works.push({ lang, file: f, title: titleOf(f) });
}
for (const w of works) { w.text = fs.readFileSync(w.file, "utf8"); w.id = path.basename(w.file); }
const col = collectionOf(works.map((w) => ({ text: w.text, title: w.title, lang: w.lang })));
const LOG = "/Users/mlacy/Documents/3.0/khora/native/eval/the-fold/scene/republic-minds.log.jsonl";
const lanesFor = (w) => { if (!/Republic/i.test(w.title) || !fs.existsSync(LOG)) return []; const L = fs.readFileSync(LOG, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); const by = {}; for (const e of L) by[`${e.mind}/${e.op}`] = (by[`${e.mind}/${e.op}`] ?? 0) + 1; return [{ name: "minds-log", file: LOG, records: L.length, licensed: L.filter((e) => e.licensed).length, standing: "exploratory: only the Stephanus-aligned links are licensed", by }]; };
const cards = works.map((w) => buildCard({ id: w.id, lang: w.lang, title: w.title, file: w.file, text: w.text, col, lanes: lanesFor(w) }));
const idx = serializeIndex(cards, col);
fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(idx));
console.log(`${cards.length} cards · ${Object.keys(idx.df).length} terms in the lite collection · ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB → ${OUT}`);
