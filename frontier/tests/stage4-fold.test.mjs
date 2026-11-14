// STAGE 4 — question shape and wave fold: per-branch stops are logged events with frontier and reason; a repeated question hits the memo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeLog } from "../log.mjs";
import { makeShape, makeGround } from "../shape.mjs";
import { wave, makeMemo } from "../fold.mjs";

const setup = () => {
  const log = makeLog({ now: () => 0 });
  const { ground } = makeGround({ giver: "test-author", timeRegime: "latest" }, { log });
  return { log, ground };
};
const fact = (log, anchor, relation, value, at) => log.append({ kind: "fact", by: "src", body: { anchor, relation, value, at } });

test("latest-wins stops the branch at the newest valid value, logs frontier and reason", () => {
  const { log, ground } = setup();
  for (let i = 0; i < 50; i++) fact(log, "Alice", "city", i < 49 ? "Lyon" : "Paris", i);
  const { shape } = makeShape({ anchor: "Alice", relation: "city", kind: "value" }, { log });
  const r = wave({ log, shape, ground });
  assert.deepEqual(r.answer, { status: "ok", value: "Paris" });
  assert.equal(r.walked, 1);
  const stop = log.get(r.stops[0]);
  assert.equal(stop.kind, "stop");
  assert.match(stop.body.reason, /cannot change/);
  assert.equal(stop.body.frontier, r.support[0]);
});

test("a retraction (newer) reopens the branch: the stop is by difference, not by count", () => {
  const { log, ground } = setup();
  fact(log, "Alice", "city", "Rome", 0);
  for (let i = 1; i < 30; i++) fact(log, "Alice", "mood", "fine", i); // trivial edits on another relation
  const wrong = fact(log, "Alice", "city", "Oslo", 31);
  log.append({ kind: "retract", by: "editor", deps: [wrong.id], body: { target: wrong.id } });
  const { shape } = makeShape({ anchor: "Alice", relation: "city", kind: "value" }, { log });
  assert.deepEqual(wave({ log, shape, ground }).answer, { status: "ok", value: "Rome" });
});

test("count walks to the root (nothing older is inert) and says so", () => {
  const { log, ground } = setup();
  for (let i = 0; i < 7; i++) fact(log, `p${i}`, "voted_no", true, i);
  const { shape } = makeShape({ relation: "voted_no", kind: "count", cardinality: "many" }, { log });
  const r = wave({ log, shape, ground });
  assert.equal(r.answer.value, 7);
  assert.ok(r.stops.every((id) => log.get(id).body.frontier === "root"));
});

test("repeated question hits the memo; a new fact on the branch misses it", () => {
  const { log, ground } = setup();
  fact(log, "Bob", "job", "baker", 0);
  const memo = makeMemo();
  const { shape } = makeShape({ anchor: "Bob", relation: "job", kind: "value" }, { log });
  assert.equal(wave({ log, shape, ground, memo }).memoHit, false);
  assert.equal(wave({ log, shape, ground, memo }).memoHit, true);
  assert.equal(log.byKind("memo_hit").length, 1);
  fact(log, "Bob", "job", "pilot", 1);
  const r = wave({ log, shape, ground, memo });
  assert.equal(r.memoHit, false);
  assert.equal(r.answer.value, "pilot");
});

test("identity: a contested sameness stays plural; an uncontested one merges", () => {
  const { log, ground } = setup();
  fact(log, "J. Smith", "employer", "Acme", 0);
  fact(log, "John Smith", "employer", "Globex", 1);
  log.append({ kind: "same", by: "clerk", body: { a: "J. Smith", b: "John Smith" } });
  const { shape } = makeShape({ anchor: "John Smith", relation: "employer", kind: "value" }, { log });
  assert.equal(wave({ log, shape, ground }).answer.status, "both");
  log.append({ kind: "cannot_link", by: "auditor", body: { a: "J. Smith", b: "John Smith" } });
  assert.equal(wave({ log, shape, ground }).answer.status, "plural");
});

test("an unmet shape is a typed gap event, not a guess", () => {
  const log = makeLog({ now: () => 0 });
  const r = makeShape({ kind: "value", relation: "city" }, { log });
  assert.deepEqual(r.missing, ["anchor"]);
  assert.equal(r.event.body.gap, "unmet_shape");
});

test("open absence is a gap; closed absence (declared by a giver) is zero", () => {
  const log = makeLog({ now: () => 0 });
  const { shape } = makeShape({ relation: "x", kind: "count", cardinality: "many" }, { log });
  assert.equal(wave({ log, shape, ground: makeGround({ giver: "t" }, { log }).ground }).answer.status, "gap");
  assert.equal(wave({ log, shape, ground: makeGround({ giver: "t", absence: "closed" }, { log }).ground }).answer.value, 0);
});
