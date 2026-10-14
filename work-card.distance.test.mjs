// work-card.distance.test.mjs — A META COMMAND THAT MOVES THE DISTANCE ADJUSTS THE FOLD, AND NESTS.  (2026-10-14)
//   node work-card.distance.test.mjs   (exits 1 on a failed claim)
// D1 NESTED: for every work and every distance d, the spans and terms at d+1 are a subset of those at d (farther never adds).
// D2 MONOTONE: span counts are non-increasing in d, and the nearest distance holds at least as many as the default.
// D3 ONE FOLD: changing distance does not change the route (same work, same score) — the command moves along the fold, it does not re-ask.
// D4 CLAMP: applyDistance never leaves the ladder; set and shift agree.
// D5 INSTANT: a packet at any distance in < 5 ms at p95.
import fs from "node:fs"; import path from "node:path";
import { BUDGET, termsOf, collectionOf, buildCard, indexCards, packetFor, applyDistance, DISTANCES } from "./work-card.js";
const ZEN = "/Users/mlacy/Documents/3.0/Zenodotus/";
// a clean checkout has no local corpus: skip, loudly, instead of failing `npm test` for everyone
if (!fs.existsSync(ZEN)) { console.log(`SKIP: corpus not present at ${ZEN} (this test measures routing over the local Zenodotus texts)`); process.exit(0); }
const SRC = [["en", "01-literature-books/gutenberg/"], ["grc", "11-multi-language/greek-originals/"], ["es", "24-global-literature/es/"], ["pt", "24-global-literature/pt/"], ["zh", "24-global-literature/zh/"]];
const works = [];
for (const [lang, dir] of SRC) for (const f of fs.readdirSync(ZEN + dir).filter((x) => x.endsWith(".txt")).sort().filter((x) => { const n = fs.statSync(ZEN + dir + x).size; return n >= 60_000 && n <= 3e6; }).slice(0, 6)) works.push({ lang, file: ZEN + dir + f, id: f, title: f.replace(/\.txt$/, "").replace(/^(pg)?\d+[_-]/i, "").replace(/^[a-z]{2}-\d+-/i, "").replace(/[_-]+/g, " ") });
for (const w of works) w.text = fs.readFileSync(w.file, "utf8");
const col = collectionOf(works.map((w) => ({ text: w.text, title: w.title, lang: w.lang })));
const index = indexCards(works.map((w) => buildCard({ id: w.id, lang: w.lang, title: w.title, file: w.file, text: w.text, col })), col);
let fail = 0; const claim = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n} — ${d}`); if (!ok) fail += 1; };
let nestBad = 0, monoBad = 0, routeBad = 0, nearBad = 0, checked = 0; const lat = [];
for (const w of works) {
  for (const q of [`so what's the deal with ${w.title}?`, w.title]) {
    const ps = DISTANCES.map((D) => packetFor(q, index, { distance: D.d })); if (ps[0].refusal) continue; checked += 1; ps.forEach((p) => lat.push(p.ms));
    for (let d = 0; d + 1 < ps.length; d++) {
      const a = new Set(ps[d].keySpans.map((s) => s.byteStart)), b = ps[d + 1].keySpans.map((s) => s.byteStart);
      if (!b.every((x) => a.has(x))) nestBad += 1;
      const ta = new Set(ps[d].characteristic); if (!ps[d + 1].characteristic.every((t) => ta.has(t))) nestBad += 1;
      if (ps[d + 1].keySpans.length > ps[d].keySpans.length) monoBad += 1;
    }
    if (new Set(ps.map((p) => p.work.id)).size !== 1 || new Set(ps.map((p) => p.route.score)).size !== 1) routeBad += 1;
    if (ps[0].keySpans.length < ps[1].keySpans.length) nearBad += 1;
  }
}
claim("D1 farther distances are nested subsets", nestBad === 0 && checked > 0, `${checked} questions × ${DISTANCES.length} distances, ${nestBad} violations`);
claim("D2 span counts non-increasing in distance", monoBad === 0 && nearBad === 0, `${monoBad + nearBad} violations`);
claim("D3 distance does not change the route", routeBad === 0, `${routeBad} questions changed work or score`);
const ok4 = [applyDistance(1, { op: "shift", value: +1 }) === 2, applyDistance(3, { op: "shift", value: +5 }) === 3, applyDistance(0, { op: "shift", value: -2 }) === 0, applyDistance(2, { op: "set", value: 0 }) === 0, applyDistance(undefined, { op: "set", value: 9 }) === 3, applyDistance(1, { op: "set", value: NaN }) === 1].every(Boolean);
claim("D4 applyDistance clamps; set and shift agree", ok4, "ladder 0..3");
lat.sort((a, b) => a - b); const p95 = lat[Math.floor(lat.length * 0.95)];
claim("D5 packet at any distance < 5 ms at p95", p95 < 5, `p50 ${lat[Math.floor(lat.length / 2)].toFixed(2)} ms · p95 ${p95.toFixed(2)} ms`);
console.log(fail ? `\n${fail} FAILED` : "\nall held"); process.exit(fail ? 1 : 0);
