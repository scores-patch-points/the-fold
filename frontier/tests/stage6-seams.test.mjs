// STAGE 6 — seam decomposition: a 100-hop synthetic chain answered with every call under B.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeLog } from "../log.mjs";
import { makeSurf } from "../surf.mjs";
import { makeGround } from "../shape.mjs";
import { makeMouth, stubTransport, budgetAudit, OverBudget } from "../mouth.mjs";
import { makeApparatus } from "../apparatus.mjs";
import { chainWorld, synthCut, patternReader } from "../synth.mjs";
import { estimateTokens } from "../tokens.mjs";

test("100 hops through 2,100 sentences: answered, one seam per hop, every call <= B", { timeout: 120000 }, async () => {
  const w = chainWorld({ hops: 100, distractors: 2000, seed: 7 });
  const log = makeLog({ now: () => 0 });
  const surf = makeSurf({ log, read: synthCut });
  await surf.ingest(w.text, { source: "chain-world-seed7" });
  const corpusTokens = estimateTokens(w.text);
  const { ground } = makeGround({ giver: "test-author" }, { log });
  const mouth = makeMouth({ log, B: 4000, transport: stubTransport(patternReader()) });
  const app = makeApparatus({ log, mouth, ground, contentOf: surf.contentOf });
  const r = await app.ask({ anchor: w.chain[0], composition: "chain", kind: "entity", relation: "mentor^100", dependency: Array(100).fill("mentor") });
  assert.equal(r.status, "ok");
  assert.equal(r.value, w.chain[100]);
  const audit = budgetAudit(log);
  assert.ok(audit.ok, JSON.stringify(audit));
  assert.ok(audit.calls >= 100 && audit.calls <= 200, `calls ${audit.calls}`);
  assert.ok(corpusTokens > 4000 * 5, `corpus ${corpusTokens} tokens must dwarf B`);
  console.log(`stage6: corpus ${corpusTokens} est. tokens, ${audit.calls} calls, max ctx ${audit.maxEstimate} <= B 4000`);
});

test("the same question as ONE call over the whole corpus is refused, not truncated", async () => {
  const w = chainWorld({ hops: 100, distractors: 2000, seed: 7 });
  const log = makeLog({ now: () => 0 });
  const mouth = makeMouth({ log, B: 4000, transport: stubTransport(() => "x") });
  await assert.rejects(mouth.ask({ user: w.text, seam: "whole-corpus" }), OverBudget);
  assert.equal(log.byKind("call").length, 0);
});
