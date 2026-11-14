// exp/depth.mjs — H7 stigmergic depth sweep with a real local model.
//   node frontier/exp/depth.mjs --model qwen3:4b --depths 2,5,10,20,50 --seed 1 --out runs/results/depth.csv
// Instances per depth: clean (derivable), broken (one link withheld: NOT derivable), faulted (derivable, plus a planted circular step and a
// contested premise). Arms: onecall, stepcall (chain-of-thought in one call), ledger (logos + step-witness, trail-steered), ledger-random
// (same, random item pick), ledger-nologos (logos and witness off). The frontier-alone arm is a typed gap (no frontier model sanctioned).
import { appendFileSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { makeLog } from "../log.mjs";
import { makeSurf } from "../surf.mjs";
import { makeMouth, ollamaTransport, budgetAudit } from "../mouth.mjs";
import { runLedger } from "../ledger.mjs";
import { deductionWorld, makeWorker, stepWitness } from "../deduce.mjs";
import { synthCut } from "../synth.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, xs) => (a.startsWith("--") ? [a.slice(2), xs[i + 1]] : null)).filter(Boolean));
const MODEL = args.model ?? "qwen3:4b", SEED = Number(args.seed ?? 1), B = Number(args.B ?? 4000);
const OUT = fileURLToPath(new URL(`../${args.out ?? "runs/results/depth.csv"}`, import.meta.url));
const COLS = ["seed", "model", "depth", "instance", "arm", "status", "answer", "truth", "correct", "flags", "planted_circular_caught", "planted_contest_caught", "model_step_faults", "calls", "steps", "max_ctx_est", "max_ctx_engine", "wall_ms", "engine_ms", "fold_sha"];
mkdirSync(dirname(OUT), { recursive: true });
if (!existsSync(OUT)) writeFileSync(OUT, COLS.join(",") + "\n");
const SHA = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
const csv = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const row = (o) => appendFileSync(OUT, COLS.map((c) => csv(o[c])).join(",") + "\n");
const LICENCES = new Set(["implies→implies"]);
const callStats = (log) => { const c = log.byKind("call"); return { calls: c.length, max_ctx_est: Math.max(0, ...c.map((x) => x.body.ctxEstimate)), max_ctx_engine: Math.max(0, ...c.map((x) => x.body.ctxEngine ?? 0)), engine_ms: c.reduce((n, x) => n + (x.body.engineMs ?? 0), 0) }; };

async function instance(depth, kind) {
  const log = makeLog();
  const surf = makeSurf({ log, read: synthCut });
  const mid = Math.max(1, Math.floor(depth / 2));
  const w = await deductionWorld({ log, surf, depth, seed: SEED * 100 + depth, decoys: depth, breakAt: kind === "broken" ? mid : null, contestAt: kind === "faulted" ? Math.max(1, Math.floor((3 * depth) / 4)) : null });
  return { log, surf, ...w, truth: kind === "broken" ? "no" : "yes", faults: kind === "faulted" && depth >= 3 ? { circularAt: Math.ceil(depth / 2) } : {} };
}

const ONE = { type: "object", properties: { answer: { type: "string", enum: ["yes", "no"] } }, required: ["answer"] };
const STEP = { type: "object", properties: { chain: { type: "array", items: { type: "string" } }, answer: { type: "string", enum: ["yes", "no"] } }, required: ["chain", "answer"] };

for (const depth of String(args.depths ?? "2,5,10,20,50").split(",").map(Number)) {
  for (const kind of ["clean", "broken", "faulted"]) {
    for (const arm of String(args.arms ?? "onecall,stepcall,ledger,ledger-random,ledger-nologos").split(",")) {
      if ((arm === "onecall" || arm === "stepcall") && kind === "faulted") continue; // faults are planted in the ledger's steps; a one-call arm has none to plant
      if (arm === "ledger-random" && kind !== "clean") continue;
      if (arm === "ledger-nologos" && kind === "broken") continue;
      const inst = await instance(depth, kind);
      const { log, surf, goal } = inst;
      const mouth = makeMouth({ log, B, transport: ollamaTransport({ model: MODEL }) });
      const t0 = Date.now();
      let r = {}, answer;
      try {
        if (arm === "onecall" || arm === "stepcall") {
          const q = `RULES:\n${inst.text.split(". ").join(".\n")}\n\nQUESTION: Using only these rules, does P0 imply P${depth}?${arm === "stepcall" ? " First list the chain of atoms from P0, one step at a time, then answer." : ""}`;
          const res = await mouth.ask({ system: "You decide whether a conclusion follows from rules by chaining 'If X then Y'. Reply JSON.", user: q, schema: arm === "stepcall" ? STEP : ONE, seam: arm });
          answer = res.value?.answer ?? null; r.status = "answered";
        } else {
          r = await runLedger({ log, goal, worker: makeWorker({ mouth, faults: inst.faults, contentOf: surf.contentOf }), licences: LICENCES, logos: arm !== "ledger-nologos", witness: arm === "ledger-nologos" ? null : stepWitness, steer: arm === "ledger-random" ? "random" : "trail", seed: SEED, maxSteps: 3 * depth + 12, B });
          answer = r.status === "filled" ? "yes" : r.status === "filled_with_flags" ? "yes-conditional" : "no";
        }
      } catch (e) { r.status = "error"; answer = String(e.message).slice(0, 60); }
      const flags = (r.flags ?? []).map((f) => f.rule).filter((x) => x !== "unrouted_contest");
      const plantedCirc = (log.byKind("claim").find((c) => c.by === "worker:planted-fault")?.id) ?? null;
      const circCaught = plantedCirc ? flags.length && (r.flags ?? []).some((f) => f.rule === "circular" && f.claim === plantedCirc) : null;
      const contCaught = kind === "faulted" ? (r.flags ?? []).some((f) => f.rule === "contested_premise") : null;
      const truth = kind === "faulted" ? "yes-conditional" : inst.truth;
      const correct = kind === "faulted" && arm === "ledger-nologos" ? (answer === "yes-conditional" ? 1 : 0) : answer === truth ? 1 : 0;
      const a = budgetAudit(log);
      row({ seed: SEED, model: MODEL, depth, instance: kind, arm, status: r.status, answer, truth, correct, flags: flags.join("|"), planted_circular_caught: circCaught == null ? "" : circCaught ? 1 : 0, planted_contest_caught: contCaught == null ? "" : contCaught ? 1 : 0, model_step_faults: (r.flags ?? []).filter((f) => f.rule === "step_contradicted").length, steps: r.steps ?? "", wall_ms: Date.now() - t0, fold_sha: SHA, ...callStats(log) });
      if (!a.ok) console.error("BUDGET VIOLATION", depth, kind, arm, JSON.stringify(a));
      console.log(`depth ${depth} ${kind} ${arm}: ${r.status} ${answer} (truth ${truth}) calls ${a.calls}`);
    }
  }
}
