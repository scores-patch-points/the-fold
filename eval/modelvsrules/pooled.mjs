// eval/modelvsrules/pooled.mjs — EXPLORATORY, POST-HOC (PREREG Amendment A3, declared after all of the above): does the Fold's existing
// cross-source agreement rule repair a model's over-commitment? Per ask, pool every sentence's committed answer; commit only an answer
// given by >= 2 DISTINCT pages and strictly more pages than any rival. Scored at ask level against the gate's gold regex (loose; reported as such).
//   node eval/modelvsrules/pooled.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const rows = fs.readFileSync(path.join(HERE, "rows.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\b(the|a|an|of|in|on)\b/g, " ").replace(/\s+/g, " ").trim();
const same = (a, b) => a && b && (a === b || (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a))));
const asks = [...new Set(rows.map((r) => r.id))];
function pool(arm, need) {
  let correct = 0, wrong = 0, silent = 0;
  for (const id of asks) {
    const rs = rows.filter((r) => r.id === id), gold = new RegExp(rs[0].gold || ".", "i");
    const groups = [];                                            // { key, pages:Set, answers:[] }
    for (const r of rs) {
      const a = r[arm].ans; if (!a) continue;
      const k = norm(a); if (!k) continue;
      let g = groups.find((x) => same(x.key, k));
      if (!g) { g = { key: k, pages: new Set(), answers: [] }; groups.push(g); }
      g.pages.add(r.page); g.answers.push(a);
    }
    groups.sort((x, y) => y.pages.size - x.pages.size);
    const top = groups[0], second = groups[1];
    if (!top || top.pages.size < need || (second && second.pages.size >= top.pages.size)) { silent++; continue; }
    (top.answers.some((a) => gold.test(a)) ? correct++ : wrong++);
  }
  return { correct, wrong, silent };
}
// the gold regex is on the pair rows only via pairs.jsonl; join it in
const pairs = fs.readFileSync(path.join(HERE, "pairs.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
rows.forEach((r, i) => { r.gold = pairs[i].gold; });
console.log(`asks pooled: ${asks.length}`);
console.log("arm | need>=1 page: correct wrong silent | need>=2 distinct pages: correct wrong silent");
for (const arm of ["R", "M", "MV", "L"]) {
  const a = pool(arm, 1), b = pool(arm, 2);
  console.log(`${arm.padEnd(3)} | ${String(a.correct).padStart(18)} ${String(a.wrong).padStart(5)} ${String(a.silent).padStart(6)} | ${String(b.correct).padStart(26)} ${String(b.wrong).padStart(5)} ${String(b.silent).padStart(6)}`);
}
