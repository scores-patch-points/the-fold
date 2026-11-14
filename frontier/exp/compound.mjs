// exp/compound.mjs — H6 compounding: 200 related questions over one growing log. Arms: full, -writeBack, -writeBack-memo, shuffled
// traces (write-back on, each written value replaced by another value of the same relation: poisoned traces).
//   node frontier/exp/compound.mjs --model qwen3:4b --n 200 --size 1e5 --out runs/results/compound.csv
import { appendFileSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { makeLog } from "../log.mjs";
import { makeSurf } from "../surf.mjs";
import { makeGround } from "../shape.mjs";
import { makeMouth, ollamaTransport, budgetAudit } from "../mouth.mjs";
import { makeApparatus } from "../apparatus.mjs";
import { estimateTokens } from "../tokens.mjs";
import { rng, synthCut } from "../synth.mjs";
import { mixedWorld, score } from "./worlds.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, xs) => (a.startsWith("--") ? [a.slice(2), xs[i + 1]] : null)).filter(Boolean));
const MODEL = args.model ?? "qwen3:4b", N = Number(args.n ?? 200), SEED = Number(args.seed ?? 1), SIZE = Number(args.size ?? 1e5);
const OUT = fileURLToPath(new URL(`../${args.out ?? "runs/results/compound.csv"}`, import.meta.url));
const COLS = ["seed", "model", "arm", "i", "qtype", "status", "value", "truth", "correct", "gap", "calls", "max_ctx_est", "via", "engine_ms", "fold_sha", "janus_reads"];
mkdirSync(dirname(OUT), { recursive: true });
if (!existsSync(OUT)) writeFileSync(OUT, COLS.join(",") + "\n");
const SHA = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
const csv = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

function stream(w, n, seed) { // related questions: k-hop prefixes of the same chains, and cities/ages of the people on them
  const r = rng(seed), out = [];
  const onChain = w.chainHeads.flatMap((h) => { const xs = [h]; for (let i = 0; i < w.chainLen; i++) xs.push(w.truth.mentor.get(xs.at(-1))); return xs.slice(0, -1); });
  for (let i = 0; i < n; i++) {
    const u = r();
    if (u < 0.5) { const h = w.chainHeads[Math.floor(r() * w.chainHeads.length)], k = 1 + Math.floor(r() * 4); let x = h; for (let j = 0; j < k; j++) x = w.truth.mentor.get(x); out.push({ t: `chain${k}`, fields: { anchor: h, composition: "chain", kind: "entity", relation: `mentor^${k}`, dependency: Array(k).fill("mentor") }, truth: x }); }
    else { const p = onChain[Math.floor(r() * onChain.length)], rel = u < 0.75 ? "city" : "age"; out.push({ t: rel, fields: { anchor: p, relation: rel, kind: rel === "age" ? "value" : "entity" }, truth: String(w.truth[rel].get(p)) }); }
  }
  return out;
}

const ARMS = { full: {}, "-writeBack": { writeBack: false }, "-writeBack-memo": { writeBack: false, memo: false }, "shuffled-traces": "shuffle" };
for (const arm0 of String(args.arms ?? Object.keys(ARMS).join(",")).split(",")) { const arm = arm0;
  const w = mixedWorld({ people: 300, distractors: Math.round((SIZE - 300 * 20 - 8 * 12 * 9) / 9), seed: SEED });
  const log = makeLog();
  const surf = makeSurf({ log, read: synthCut });
  await surf.ingest(w.text, { source: `compound-s${SEED}` });
  const { ground } = makeGround({ giver: "experiment-author" }, { log });
  const pr = rng(SEED + 77);
  const pools = { mentor: w.names, city: [...new Set(w.truth.city.values())], age: [...new Set([...w.truth.age.values()].map(String))] };
  const switches = ARMS[arm] === "shuffle" ? { traceShuffle: (rel, v) => { const pool = (pools[rel] ?? [v]).filter((x) => x !== v); return pool[Math.floor(pr() * pool.length)] ?? v; } } : ARMS[arm];
  const base = args.base ? JSON.parse(args.base) : {};
  const sw2 = { ...base, ...switches };
  const app = makeApparatus({ log, mouth: sw2.janusOnly ? null : makeMouth({ log, B: 4000, transport: ollamaTransport({ model: MODEL }) }), ground, contentOf: surf.contentOf, switches: sw2 });
  const qs = stream(w, N, SEED + 9);
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i], from = log.size();
    let r; try { r = await app.ask(q.fields); } catch (e) { r = { status: "error", value: String(e.message).slice(0, 60) }; }
    const calls = log.byKind("call").filter((c) => c.seq >= from);
    const s = score(q, r.value, r.status);
    appendFileSync(OUT, [SEED, MODEL, arm, i, q.t, r.status, r.value, q.truth, s.correct ? 1 : 0, s.gap ? 1 : 0, calls.length, Math.max(0, ...calls.map((c) => c.body.ctxEstimate)), r.via, calls.reduce((n, c) => n + (c.body.engineMs ?? 0), 0), SHA, log.byKind("read").filter((e) => e.seq >= from).length].map(csv).join(",") + "\n");
  }
  console.log(`done ${arm}`, JSON.stringify(budgetAudit(log)), "corpus tokens", estimateTokens(w.text));
}
