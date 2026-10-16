// eval/void/null-void.mjs — the void-null for L1 (PREREG): each ask carries ANOTHER ask's declared void (a seeded derangement, 200 shuffles).
// It reads the replayed L1 results and re-scores the GAP rows' informativeness against the shuffled voids. Answers are untouched.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BATTERY } from "./battery.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ARM = process.argv[2] || "L1";   // which arm's replayed results to score against shuffled voids
const rows = [...JSON.parse(fs.readFileSync(path.join(HERE, `results-${ARM}.json`))).rows, ...JSON.parse(fs.readFileSync(path.join(HERE, `results-${ARM}.held.json`))).rows];
const gold = new Map(BATTERY.map((r) => [r.id, r]));
const fold = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const inf = (g, v) => !!v && v.slot === g.void.slot && v.admits === g.void.admits && fold(v.anchor) === fold(g.void.anchor);
let s = 20261014 >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const useful = (voids, set) => rows.reduce((n, r, i) => { const g = gold.get(r.id); if (set && r.set !== set) return n; if (r.tier === "RIGHT") return n + 1; if (r.tier !== "GAP") return n; return n + ((g.neg || inf(g, voids[i])) ? 1 : 0); }, 0);
const real = rows.map((r) => r.raw.void || null);
const out = { real: { dev: useful(real, "dev"), held: useful(real, "held") }, null: { dev: [], held: [] } };
for (let k = 0; k < 200; k++) {
  const idx = rows.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const sh = idx.map((j) => real[j]);
  out.null.dev.push(useful(sh, "dev")); out.null.held.push(useful(sh, "held"));
}
const q = (xs, p) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))];
for (const set of ["dev", "held"]) out.null[set] = { p50: q(out.null[set], 0.5), p95: q(out.null[set], 0.95), max: Math.max(...out.null[set]) };
console.log(JSON.stringify(out));
