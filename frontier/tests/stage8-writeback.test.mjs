// STAGE 8 — write-back and compounding: a read fact lands in the log; the same question later costs zero calls; ablating write-back does not.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeLog } from "../log.mjs";
import { makeSurf } from "../surf.mjs";
import { makeGround } from "../shape.mjs";
import { makeMouth, stubTransport } from "../mouth.mjs";
import { makeApparatus } from "../apparatus.mjs";
import { chainWorld, synthCut, patternReader } from "../synth.mjs";

async function run(writeBack) {
  const w = chainWorld({ hops: 30, distractors: 300, seed: 2 });
  const log = makeLog({ now: () => 0 });
  const surf = makeSurf({ log, read: synthCut });
  await surf.ingest(w.text, { source: "w2" });
  const { ground } = makeGround({ giver: "test-author" }, { log });
  const mouth = makeMouth({ log, B: 4000, transport: stubTransport(patternReader()) });
  const app = makeApparatus({ log, mouth, ground, contentOf: surf.contentOf, switches: { writeBack } });
  const q = { anchor: w.chain[0], composition: "chain", kind: "entity", relation: "mentor^10", dependency: Array(10).fill("mentor") };
  await app.ask(q); const first = log.byKind("call").length;
  await app.ask(q); const second = log.byKind("call").length - first;
  const deeper = { ...q, relation: "mentor^20", dependency: Array(20).fill("mentor") };
  await app.ask(deeper); const third = log.byKind("call").length - first - second;
  return { first, second, third, facts: log.byKind("fact").length, readerTurns: app.readerState().turns };
}

test("write-back: second ask costs 0 calls, an extended chain pays only for new hops", async () => {
  const on = await run(true), off = await run(false);
  console.log("stage8", JSON.stringify({ on, off }));
  assert.equal(on.second, 0);
  assert.equal(on.third, 10);
  assert.equal(off.second, on.first);
  assert.equal(on.facts, 20);
  assert.equal(on.readerTurns, 3);
});
