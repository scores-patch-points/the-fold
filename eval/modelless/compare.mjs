// compare.mjs — per-prompt stability between two runs (live web varies). node eval/modelless/compare.mjs run1-calibration run2
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const load = (n) => JSON.parse(fs.readFileSync(path.join(HERE, "results", n + ".table.json"), "utf8"));
const [a, b] = [load(process.argv[2]), load(process.argv[3])];
const key = (r) => `${r.cat}#${r.idx}`; const B = new Map(b.map((r) => [key(r), r]));
let same = 0, n = 0; const diff = [];
for (const r of a) { const o = B.get(key(r)); if (!o) continue; n++; if (r.bucket === o.bucket) same++; else diff.push(`${key(r)} ${JSON.stringify(r.ask).slice(0, 52)}: ${r.bucket} → ${o.bucket}`); }
console.log(`same bucket in both runs: ${same}/${n} (${Math.round(100 * same / n)}%)`); diff.forEach((d) => console.log("  " + d));
