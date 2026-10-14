// eval/modelvsrules/rescore-strict.mjs — Amendment A2 of PREREG.md: re-score Experiment 1 on an independent second labeler's STATES / NOT labels.
//   node eval/modelvsrules/rescore-strict.mjs <pairs-labels.json>      (rows.jsonl is in the same order as pairs.jsonl, and the blind file's k)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const labels = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const rows = fs.readFileSync(path.join(HERE, "rows.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
if (labels.length !== rows.length) { console.error(`label count ${labels.length} != rows ${rows.length}`); process.exit(2); }
const lab = new Map(labels.map((x) => [x.k, x]));
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const overlaps = (a, b) => { const x = norm(a), y = norm(b); return x.length >= 2 && y.length >= 2 && (x.includes(y) || y.includes(x)); };
const lfact = (() => { const t = [0]; for (let i = 1; i < 2000; i++) t[i] = t[i - 1] + Math.log(i); return t; })();
const lchoose = (n, k) => lfact[n] - lfact[k] - lfact[n - k];
const mcnemar = (b, c) => { const n = b + c; if (!n) return 1; let p = 0; for (let k = b; k <= n; k++) p += Math.exp(lchoose(n, k) - n * Math.log(2)); return Math.min(1, p); };
const fisherMore = (a1, n1, a2, n2) => { const K = a1 + a2, N = n1 + n2; let p = 0; for (let x = a1; x <= Math.min(K, n1); x++) { if (K - x > n2) continue; p += Math.exp(lchoose(n1, x) + lchoose(n2, K - x) - lchoose(N, K)); } return Math.min(1, p); };

const items = rows.map((r, i) => ({ ...r, s: lab.get(i) }));
const S = items.filter((x) => x.s && x.s.label === "STATES"), N = items.filter((x) => x.s && x.s.label === "NOT");
console.log(`second labeler: STATES ${S.length}, NOT ${N.length} of ${items.length}`);
// agreement of the two labelings
const A = items.filter((x) => x.label === "ANSWER");
console.log(`agreement with the gold-regex labels: regex ANSWER ${A.length} → STATES ${A.filter((x) => x.s.label === "STATES").length}, NOT ${A.filter((x) => x.s.label === "NOT").length}; `
  + `regex NOT-ANSWER ${items.length - A.length} → STATES ${items.filter((x) => x.label === "NOT-ANSWER" && x.s.label === "STATES").length}`);
if (S.length < 20) { console.log("STATES set smaller than 20: no test run (PREREG A2)."); process.exit(0); }
const ok = (x, k) => !!(x[k].ans && overlaps(x[k].ans, x.s.answer));
console.log("\narm | STATES: correct wrong silent | NOT: false-commit");
for (const k of ["R", "M", "MV", "L", "N"]) {
  const c = S.filter((x) => ok(x, k)).length, w = S.filter((x) => x[k].ans && !ok(x, k)).length;
  console.log(`${k.padEnd(3)} | ${String(c).padStart(14)} ${String(w).padStart(5)} ${String(S.length - c - w).padStart(6)} | ${String(N.filter((x) => x[k].ans).length).padStart(8)} of ${N.length}`);
}
console.log("\nPre-registered tests on the independent labels (M or M+V against R):");
for (const k of ["M", "MV"]) {
  const b = S.filter((x) => ok(x, k) && !ok(x, "R")).length, c = S.filter((x) => ok(x, "R") && !ok(x, k)).length;
  const pC = mcnemar(b, c);
  const fcK = N.filter((x) => x[k].ans).length, fcR = N.filter((x) => x.R.ans).length;
  const pF = fisherMore(fcK, N.length, fcR, N.length);
  const wK = S.filter((x) => x[k].ans && !ok(x, k)).length, wR = S.filter((x) => x.R.ans && !ok(x, "R")).length;
  const pW = fisherMore(wK, S.length, wR, S.length);
  const better = pC < 0.05, fcOk = pF >= 0.05, wOk = pW >= 0.05;
  console.log(`${k} vs R: correct-only-${k} ${b}, correct-only-R ${c}, McNemar p=${pC.toFixed(4)} → ${better ? "BETTER" : "not better"}; false-commit ${fcK} vs ${fcR}, p(more)=${pF.toFixed(4)} → ${fcOk ? "not more" : "MORE"}; wrong ${wK} vs ${wR}, p(more)=${pW.toFixed(4)} → ${wOk ? "not more" : "MORE"}`);
  console.log(`   VERDICT (independent labels) for ${k}: ${better && fcOk && wOk ? "SUPPORTED" : (!better ? "FALSIFIED (not better)" : "FALSIFIED AS STATED (better only by being wrong / committing more)")}`);
}
