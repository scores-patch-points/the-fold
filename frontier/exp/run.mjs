// exp/run.mjs — H1/H2 scaling and ablations over the mixed synthetic world, with a real local model.
//   node frontier/exp/run.mjs scaling --model qwen3:4b --sizes 1e3,1e4,1e5,1e6 --n 24 --arms apparatus,retrieval,longctx --out runs/results/scaling.csv
//   node frontier/exp/run.mjs ablate  --model qwen3:4b --size 1e5 --n 24 --out runs/results/ablations.csv
// NULL / BASELINE, declared before the run (RESULTS.md §pre-registration): plain retrieval (BM25 top-8, one call) and plain long context
// (whole corpus, one call, only where it fits the model window). Every row: seed, model, arm, size, question type, status, value, truth,
// correct, gap, calls, max/sum context tokens (estimate and engine), wall ms, engine ms. Every model call also lands in a token log.
import { appendFileSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeLog } from "../log.mjs";
import { makeSurf } from "../surf.mjs";
import { makeGround } from "../shape.mjs";
import { makeMouth, ollamaTransport, budgetAudit } from "../mouth.mjs";
import { makeApparatus } from "../apparatus.mjs";
import { makeIndex } from "../index.mjs";
import { estimateTokens } from "../tokens.mjs";
import { synthCut } from "../synth.mjs";
import { mixedWorld, questions, score } from "./worlds.mjs";
import { engineCheck } from "../contract.mjs";
import { execFileSync } from "node:child_process";

const args = Object.fromEntries(process.argv.slice(3).map((a, i, xs) => (a.startsWith("--") ? [a.slice(2), xs[i + 1]] : null)).filter(Boolean));
const MODEL = args.model ?? "qwen3:4b", N = Number(args.n ?? 24), SEED = Number(args.seed ?? 1), B = Number(args.B ?? 4000);
const OUT = fileURLToPath(new URL(`../${args.out ?? "runs/results/out.csv"}`, import.meta.url));
const TOKLOG = OUT.replace(/\.csv$/, ".token-log.jsonl");
const COLS = ["seed", "model", "arm", "size_tokens", "qtype", "q", "status", "value", "truth", "correct", "gap", "calls", "max_ctx_est", "max_ctx_engine", "sum_ctx_est", "wall_ms", "engine_ms", "fold_sha", "khora_sha"];
mkdirSync(dirname(OUT), { recursive: true });
if (!existsSync(OUT)) writeFileSync(OUT, COLS.join(",") + "\n");
const FOLD_SHA = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
const KHORA_SHA = engineCheck().head.slice(0, 7);
const csv = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const row = (o) => appendFileSync(OUT, COLS.map((c) => csv(o[c])).join(",") + "\n");
const tok = (log, from) => { for (const c of log.byKind("call").filter((c) => c.seq >= from)) appendFileSync(TOKLOG, JSON.stringify({ arm: c.body.seam, B: c.body.B, ctxEstimate: c.body.ctxEstimate, ctxEngine: c.body.ctxEngine, model: c.body.model }) + "\n"); };

const ANSWER_SCHEMA = { type: "object", properties: { value: { type: ["string", "number", "null"] } }, required: ["value"] };
const ONE_CALL_SYSTEM = "Answer the question from the text only. Reply JSON {\"value\": the shortest exact answer (a name or a number), or null if the text does not say}.";

// the corpus size is set by distractor count: ~9 tokens per distractor sentence (estimator), plus the fixed facts
// people scale with size so the smallest world is really ~1e3 tokens; ~20 estimator tokens of fixed facts per person
const peopleFor = (size) => Math.max(14, Math.min(300, Math.floor(size / 60)));
const chainsFor = (size) => (size < 5000 ? 1 : 8);
const distractorsFor = (size) => Math.max(0, Math.round((size - peopleFor(size) * 20 - chainsFor(size) * 12 * 9) / 9));

async function world(size, seed) {
  const w = mixedWorld({ people: peopleFor(size), chains: chainsFor(size), chainLen: size < 5000 ? Math.min(12, peopleFor(size) - 2) : 12, distractors: distractorsFor(size), seed });
  const log = makeLog();
  const surf = makeSurf({ log, read: synthCut });
  await surf.ingest(w.text, { source: `mixed-s${seed}-${size}`, retrievedAt: "2026-11-14T00:00:00Z" });
  for (const [alias, p] of w.truth.alias) log.append({ kind: "same", by: "registry", body: { a: alias, b: p } });
  const { ground } = makeGround({ giver: "experiment-author", timeRegime: "latest", absence: "open" }, { log });
  return { w, log, surf, ground, sizeTokens: estimateTokens(w.text) };
}

async function runApparatus(env, qs, switches, arm, { twice = false } = {}) {
  const { log, surf, ground } = env;
  const mouth = switches.janusOnly ? null : makeMouth({ log, B, transport: ollamaTransport({ model: MODEL }) });
  const app = makeApparatus({ log, mouth, ground, contentOf: surf.contentOf, switches });
  for (const pass of twice ? [1, 2] : [1]) for (const q of qs) {
    const from = log.size(), t0 = Date.now();
    let r; try { r = await app.ask(q.fields); } catch (e) { r = { status: "error", gap: String(e.message).slice(0, 80) }; }
    const calls = log.byKind("call").filter((c) => c.seq >= from);
    const s = score(q, r.value, r.status);
    row({ seed: SEED, model: MODEL, arm: twice ? `${arm}#pass${pass}` : arm, size_tokens: env.sizeTokens, qtype: q.t, q: q.nl, status: r.status, value: r.value, truth: q.truth, correct: s.correct ? 1 : 0, gap: s.gap ? 1 : 0, calls: calls.length,
      max_ctx_est: Math.max(0, ...calls.map((c) => c.body.ctxEstimate)), max_ctx_engine: Math.max(0, ...calls.map((c) => c.body.ctxEngine ?? 0)), sum_ctx_est: calls.reduce((n, c) => n + c.body.ctxEstimate, 0), wall_ms: Date.now() - t0, engine_ms: calls.reduce((n, c) => n + (c.body.engineMs ?? 0), 0), fold_sha: FOLD_SHA, khora_sha: KHORA_SHA });
    tok(log, from);
  }
  return budgetAudit(log);
}

async function runOneCall(env, qs, arm) {
  const { log, w } = env;
  const index = makeIndex(log);
  const wholeB = estimateTokens(w.text) + 400;
  if (arm === "longctx" && wholeB > 32000) { for (const q of qs) row({ seed: SEED, model: MODEL, arm, size_tokens: env.sizeTokens, qtype: q.t, q: q.nl, status: "gap", value: "exceeds_model_window_32k", truth: q.truth, correct: 0, gap: 1, calls: 0, fold_sha: FOLD_SHA, khora_sha: KHORA_SHA }); return; }
  const mouth = makeMouth({ log, B: arm === "longctx" ? wholeB : B, transport: ollamaTransport({ model: MODEL }) });
  for (const q of qs) {
    const from = log.size(), t0 = Date.now();
    const evidence = arm === "longctx" ? w.text : index.search(q.nl, 8).map((id) => log.get(id).body.text).join("\n");
    let r;
    try { const res = await mouth.ask({ system: ONE_CALL_SYSTEM, user: `TEXT:\n${evidence}\n\nQUESTION: ${q.nl}`, schema: ANSWER_SCHEMA, seam: arm }); const v = res.value?.value; r = { status: v == null || v === "" ? "gap" : "ok", value: v ?? null }; }
    catch (e) { r = { status: "error", value: String(e.message).slice(0, 60) }; }
    const calls = log.byKind("call").filter((c) => c.seq >= from);
    const s = score(q, r.value, r.status);
    row({ seed: SEED, model: MODEL, arm, size_tokens: env.sizeTokens, qtype: q.t, q: q.nl, status: r.status, value: r.value, truth: q.truth, correct: s.correct ? 1 : 0, gap: s.gap ? 1 : 0, calls: calls.length,
      max_ctx_est: Math.max(0, ...calls.map((c) => c.body.ctxEstimate)), max_ctx_engine: Math.max(0, ...calls.map((c) => c.body.ctxEngine ?? 0)), sum_ctx_est: calls.reduce((n, c) => n + c.body.ctxEstimate, 0), wall_ms: Date.now() - t0, engine_ms: calls.reduce((n, c) => n + (c.body.engineMs ?? 0), 0), fold_sha: FOLD_SHA, khora_sha: KHORA_SHA });
    tok(log, from);
  }
}

const mode = process.argv[2];
if (mode === "scaling") {
  for (const size of String(args.sizes ?? "1e3,1e4,1e5").split(",").map(Number)) {
    const env = await world(size, SEED);
    const qs = questions(env.w, { n: N, seed: SEED + 4 });
    for (const arm of String(args.arms ?? "apparatus,retrieval,longctx").split(",")) {
      if (arm === "apparatus") { const label = args.label ?? "apparatus"; const a = await runApparatus(env, qs, args.switches ? JSON.parse(args.switches) : {}, label); console.log(size, label, JSON.stringify(a)); }
      else await runOneCall(env, qs, arm);
      console.log(`done size=${size} (${env.sizeTokens} tok) arm=${arm}`);
    }
  }
} else if (mode === "ablate") {
  const ARMS = { full: {}, "-stopRule": { stopRule: false }, "-memo": { memo: false }, "-instruments": { instruments: false }, "-witnesses": { witnesses: false }, "-identity": { identity: false }, "-writeBack": { writeBack: false } };
  const only = args.arms ? args.arms.split(",") : Object.keys(ARMS);
  for (const arm of only) {
    const env = await world(Number(args.size ?? 1e5), SEED); // a fresh log per arm: no arm inherits another's write-back
    const qs = questions(env.w, { n: N, seed: SEED + 4 });
    const a = await runApparatus(env, qs, ARMS[arm], arm, { twice: true });
    console.log(`done ablation ${arm}`, JSON.stringify(a));
  }
}
