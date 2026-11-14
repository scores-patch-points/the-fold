// STAGE 5 — instruments first: zero model arithmetic/counting calls on numeric and date questions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeLog } from "../log.mjs";
import { makeGround } from "../shape.mjs";
import { makeMouth, stubTransport } from "../mouth.mjs";
import { makeApparatus } from "../apparatus.mjs";

function world() {
  const log = makeLog({ now: () => 0 });
  const { ground } = makeGround({ giver: "test-author" }, { log });
  const f = (anchor, relation, value) => log.append({ kind: "fact", by: "src", body: { anchor, relation, value } });
  f("Project A", "budget", "1,250,000"); f("Project B", "budget", "975000");
  f("Project A", "start", "2024-03-01"); f("Project A", "end", "2025-01-15");
  for (let i = 0; i < 9; i++) f(`member${i}`, "voted_yes", true);
  let modelCalls = 0;
  const mouth = makeMouth({ log, transport: stubTransport(() => { modelCalls++; return { value: null, cite: [] }; }) });
  return { log, app: makeApparatus({ log, mouth, ground }), calls: () => modelCalls };
}

test("sum, diff, ratio, compare, count, days-between: all answered with zero model calls", async () => {
  const { log, app, calls } = world();
  const A = { anchor: "Project A", relation: "budget", kind: "value" }, Bq = { anchor: "Project B", relation: "budget", kind: "value" };
  assert.equal((await app.ask({ kind: "sum", dependency: [A, Bq], composition: "aggregate", relation: "budget" })).value, 2225000);
  assert.equal((await app.ask({ kind: "diff", dependency: [A, Bq], composition: "aggregate", relation: "budget" })).value, 275000);
  assert.equal((await app.ask({ kind: "compare", dependency: [A, Bq], composition: "aggregate", relation: "budget" })).value, true);
  assert.equal((await app.ask({ relation: "voted_yes", kind: "count", cardinality: "many" })).value, 9);
  const days = await app.ask({ kind: "daysBetween", composition: "aggregate", relation: "duration", dependency: [{ anchor: "Project A", relation: "start", kind: "date" }, { anchor: "Project A", relation: "end", kind: "date" }] });
  assert.equal(days.value, 320);
  assert.equal(calls(), 0, "the model was asked to do arithmetic or counting");
  assert.equal(log.byKind("call").length, 0);
  assert.ok(log.byKind("instrument").length >= 5);
});

test("arithmetic reuses fold-chat-compute's parser (no eval) and a bad expression is a typed gap", async () => {
  const { log } = world();
  const { runInstrument } = await import("../instruments.mjs");
  assert.equal(runInstrument(log, "arith", ["15% of 240"]).ok || runInstrument(log, "arith", ["0.15*240"]).value === 36, true);
  assert.equal(runInstrument(log, "arith", ["process.exit()"]).gap, "instrument_failed");
});
