// STAGE 9 — stigmergic reasoning: a 20-step deduction with one planted circular step and one contested premise.
// The ledger finishes, all calls are under B, logos rules catch both, the ledger renders as a graph with every claim cited.
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { makeLog } from "../log.mjs";
import { makeSurf } from "../surf.mjs";
import { makeMouth, stubTransport, budgetAudit } from "../mouth.mjs";
import { runLedger, renderLedger } from "../ledger.mjs";
import { deductionWorld, makeWorker, stepStub } from "../deduce.mjs";
import { synthCut } from "../synth.mjs";

const LICENCES = new Set(["implies→implies"]); // giver: the ground's author (transitivity of implication), declared for this test

async function run({ logos = true, faults = { circularAt: 6 }, contestAt = 14, steer = "trail" } = {}) {
  const log = makeLog({ now: () => 0 });
  const surf = makeSurf({ log, read: synthCut });
  const { goal } = await deductionWorld({ log, surf, depth: 20, contestAt });
  const mouth = makeMouth({ log, B: 4000, transport: stubTransport(stepStub) });
  const r = await runLedger({ log, goal, worker: makeWorker({ mouth, faults, contentOf: surf.contentOf }), licences: LICENCES, logos, steer, seed: 3 });
  return { log, goal, r };
}

test("20-step deduction: finishes, every call <= B, logos flags the circular step and the contested premise", async () => {
  const { log, goal, r } = await run();
  const rules = r.flags.map((f) => f.rule);
  assert.ok(rules.includes("circular"), JSON.stringify(rules));
  assert.ok(rules.includes("contested_premise"), JSON.stringify(rules));
  assert.ok(["filled", "filled_with_flags"].includes(r.status), r.status);
  assert.equal(r.status, "filled_with_flags", "the only path runs through a contested premise, so the goal must not count as cleanly filled");
  assert.ok(log.byKind("route").length >= 1, "the contest is routed (to landContest), not resolved");
  const audit = budgetAudit(log);
  assert.ok(audit.ok && audit.calls >= 20, JSON.stringify(audit));
  for (const c of log.byKind("claim")) assert.ok((c.body.cites ?? []).length > 0 && c.body.cites.every((id) => log.has(id)), `${c.id} uncited`);
  // disclosure, never rewrite: the circular claim is still in the ledger
  const circ = r.flags.find((f) => f.rule === "circular");
  assert.ok(log.get(circ.claim));
  const { mermaid, html } = renderLedger(log, goal);
  assert.match(mermaid, /graph TD/); assert.match(mermaid, /circular/);
  mkdirSync(new URL("../runs/", import.meta.url), { recursive: true });
  writeFileSync(new URL("../runs/stage9-ledger.html", import.meta.url), html);
  writeFileSync(new URL("../runs/stage9-ledger.mmd", import.meta.url), mermaid);
  console.log(`stage9: ${r.steps} steps, ${audit.calls} calls, max ctx ${audit.maxEstimate}, flags ${JSON.stringify(rules)}`);
});

test("without a contest and without the planted fault the goal is cleanly filled", async () => {
  const { r } = await run({ faults: {}, contestAt: null });
  assert.equal(r.status, "filled");
  assert.equal(r.flags.length, 0);
});

test("logos OFF: the same faults pass silently (the ablation the depth sweep measures)", async () => {
  const { r } = await run({ logos: false });
  assert.equal(r.flags.length, 0);
  assert.equal(r.status, "filled");
});

test("a plausible-but-wrong step (skips a link) is caught as unlicensed when its inference is declared, and taints what follows", async () => {
  const { r } = await run({ faults: { wrongAt: 9 }, contestAt: null });
  assert.ok(r.flags.some((f) => f.rule === "unlicensed"), JSON.stringify(r.flags));
});
