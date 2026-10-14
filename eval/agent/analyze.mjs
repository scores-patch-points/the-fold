// eval/agent/analyze.mjs — apply PREREG.md's tests mechanically.
//   node eval/agent/analyze.mjs [--base B-held] [--arm A-held] [--null N-held] [--q1 B-dev,B-held]
// Q1 (how often is Held true?) from the base runs; the verdict from the held-out units, paired A vs B, with the null guard B vs N.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d; };
const load = (tag) => { const f = path.join(HERE, "results", tag + ".jsonl"); if (!fs.existsSync(f)) return []; const rows = new Map(); for (const l of fs.readFileSync(f, "utf8").split("\n").filter(Boolean)) { const r = JSON.parse(l); rows.set(r.id + "#" + r.seed, r); } return [...rows.values()]; };

// ── exact tests, as eval/modelvsrules/run.mjs ────────────────────────────────────────────────────────────────────────
const lfact = (() => { const t = [0]; for (let i = 1; i < 2000; i++) t[i] = t[i - 1] + Math.log(i); return t; })();
const lchoose = (n, k) => lfact[n] - lfact[k] - lfact[n - k];
export const mcnemarOneSided = (b, c) => { const n = b + c; if (!n) return 1; let p = 0; for (let k = b; k <= n; k++) p += Math.exp(lchoose(n, k) - n * Math.log(2)); return Math.min(1, p); };
export function fisherMore(a1, n1, a2, n2) { const K = a1 + a2, N = n1 + n2; let p = 0; for (let x = a1; x <= Math.min(K, n1); x++) { if (K - x > n2) continue; p += Math.exp(lchoose(n1, x) + lchoose(n2, K - x) - lchoose(N, K)); } return Math.min(1, p); }

const ok = (r) => r && r.settled && !r.error;
const pct = (a, b) => (b ? `${(100 * a / b).toFixed(0)}%` : "—");
function q1(rows) {
  const m = rows.filter(ok);
  const held = m.filter((r) => r.held), fh = m.filter((r) => r.falseHeld), th = m.filter((r) => r.trueHeld), fo = m.filter((r) => !r.held && r.pass);
  return { n: m.length, unsettled: rows.length - m.length, held: held.length, falseHeld: fh.length, trueHeld: th.length, falseOpen: fo.length, pass: m.filter((r) => r.pass).length,
    line: `units ${m.length} (unsettled ${rows.length - m.length}) · Held ${held.length} · false-Held ${fh.length} (${pct(fh.length, m.length)} of units, ${pct(fh.length, held.length)} of Held) · true-Held ${th.length} (${pct(th.length, m.length)} of units, ${pct(th.length, held.length)} of Held) · hidden test passed ${m.filter((r) => r.pass).length} · false-open ${fo.length}` };
}
export function paired(Brows, Xrows, label) {
  const X = new Map(Xrows.map((r) => [r.id + "#" + r.seed, r]));
  const pairs = Brows.map((b) => [b, X.get(b.id + "#" + b.seed)]).filter(([b, x]) => x);
  const both = pairs.filter(([b, x]) => ok(b) && ok(x)), dropped = pairs.length - both.length;
  const b1 = both.filter(([b, x]) => b.falseHeld && !x.falseHeld).length, c1 = both.filter(([b, x]) => !b.falseHeld && x.falseHeld).length;
  const p1 = mcnemarOneSided(b1, c1);
  const b2 = both.filter(([b, x]) => b.trueHeld && !x.trueHeld).length, c2 = both.filter(([b, x]) => !b.trueHeld && x.trueHeld).length;
  const p2m = mcnemarOneSided(b2, c2);
  const thB = both.filter(([b]) => b.trueHeld).length, thX = both.filter(([, x]) => x.trueHeld).length;
  const fhB = both.filter(([b]) => b.falseHeld).length, fhX = both.filter(([, x]) => x.falseHeld).length;
  const p2f = fisherMore(thB, both.length, thX, both.length);   // "X has FEWER true-Held" = B has more
  const drop = p1 < 0.05, guard = p2m >= 0.05 && p2f >= 0.05;
  const verdict = drop && guard ? "SUPPORTED" : !drop ? "FALSIFIED (not better)" : "FALSIFIED AS STATED (lowers false-Held only by holding less of what is true)";
  return { label, n: both.length, dropped, fhB, fhX, thB, thX, b1, c1, p1, b2, c2, p2m, p2f, drop, guard, verdict,
    line: `${label}: paired units ${both.length} (dropped ${dropped}) · false-Held ${fhB} → ${fhX} (B-only ${b1}, ${label.split(" ")[0]}-only ${c1}, McNemar one-sided p=${p1.toFixed(4)} → ${drop ? "DROPS" : "does not drop"}) · true-Held ${thB} → ${thX} (lost ${b2}, gained ${c2}, McNemar p(fewer)=${p2m.toFixed(4)}, Fisher p(fewer)=${p2f.toFixed(4)} → ${guard ? "not fewer" : "FEWER"})${thX < thB ? " · RAW true-Held fell" : ""}` };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const q1tags = opt("q1", "B-dev,B-held").split(",");
  const Q = q1tags.flatMap((t) => load(t));
  console.log(`Q1 — how often is Held true? (base runs: ${q1tags.join(" + ")})\n  ${q1(Q).line}`);
  for (const t of q1tags) { const r = load(t); if (r.length) console.log(`  ${t}: ${q1(r).line}`); }
  const B = load(opt("base", "B-held")), A = load(opt("arm", "A-held")), N = load(opt("null", "N-held"));
  if (A.length) {
    const a = paired(B, A, "A vs B");
    console.log(`\nVerdict (held-out, paired):\n  ${a.line}\n  ${opt("arm", "A-held")}: ${q1(A).line}`);
    let uninterpretable = false;
    if (N.length) { const n = paired(B, N, "N vs B"); uninterpretable = n.drop; console.log(`  null guard — ${n.line}${n.drop ? "  → the null alone 'drops' false-Held: UNINTERPRETABLE" : "  → noise does not mimic the effect"}`); }
    console.log(`\n  VERDICT: ${uninterpretable ? "UNINTERPRETABLE (" + a.verdict + " on its face)" : a.verdict}`);
  }
}
