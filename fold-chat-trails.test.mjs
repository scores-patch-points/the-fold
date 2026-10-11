// fold-chat-trails.test.mjs — the stigmergic trails, falsified: the decay rate differs by SOURCE
// and by SIGN, a soured source is retried, a held source persists, and nothing runs away.
import test from "node:test";
import assert from "node:assert/strict";
import { DECAY, DEFAULT_DECAY, FLOOR, CAP, sourceOf, rateFor, halfLife, evaporate, deposit, pheromone, follow } from "./fold-chat-trails.js";

test("a trail's source is its key prefix", () => {
  assert.equal(sourceOf("src:example.com"), "src");
  assert.equal(sourceOf("rung:SYN"), "rung");
  assert.equal(sourceOf("chat:hint"), "chat");
  assert.equal(sourceOf("loose"), "loose");          // an unknown class falls to the default rate
  assert.equal(sourceOf(""), "default");
});

test("THE FAILURE THIS FIXES — one global rate is wrong; the rate varies by source and sign", () => {
  assert.notEqual(rateFor("src:x", 1), rateFor("rung:x", 1));      // web ground and climb decay differently
  assert.notEqual(rateFor("src:x", 1), rateFor("src:x", -1));      // a soured trail fades faster than a held one
  assert.ok(rateFor("src:x", -1) < rateFor("src:x", 1));
  assert.ok(rateFor("rung:x", 1) < rateFor("src:x", 1));           // the climb fades before the ground
});

test("half-life is reported from the declared rate, not asserted", () => {
  assert.ok(halfLife("src:x", 1) > 6 && halfLife("src:x", 1) < 7);     // 0.90 -> ~6.58 deposits
  assert.ok(halfLife("src:x", -1) < 2);                                // 0.55 -> ~1.16 — a failure is provisional
  assert.equal(halfLife("src:x", 1), Math.log(0.5) / Math.log(DECAY.src.pos));
  assert.equal(halfLife("nope", 1), Math.log(0.5) / Math.log(DEFAULT_DECAY.pos));
  assert.equal(halfLife("xx", 1, ), halfLife("xx", 1));
});

test("FALSIFIER — a soured source is retried within a few deposits; a held one is not", () => {
  // One failure on a host, then the hunt deposits elsewhere: the bad mark is gone within 4 turns.
  let t = deposit({}, ["src:bad.com"], -0.6);
  assert.ok(pheromone(t, "src:bad.com") < 0);
  for (let i = 0; i < 4; i++) t = deposit(t, ["src:other.com"], 1);
  assert.equal(pheromone(t, "src:bad.com"), 0);                   // forgotten -> the ground is retried
  // A host that HELD survives the same three turns.
  let h = deposit({}, ["src:good.com"], 1);
  for (let i = 0; i < 3; i++) h = deposit(h, ["src:other.com"], 1);
  assert.ok(pheromone(h, "src:good.com") > 0.6);                 // still leads
});

test("FALSIFIER — the climb fades before the web ground (source-specific rate)", () => {
  let t = deposit({}, ["rung:SYN", "src:held.com"], 1);
  for (let i = 0; i < 5; i++) t = deposit(t, ["src:probe.com"], 1);   // 5 more deposits, no reinforcement of either
  assert.ok(pheromone(t, "src:held.com") > pheromone(t, "rung:SYN"), "the held ground outlives the rung");
});

test("a positive trail saturates (bounded), never runs away", () => {
  let t = {};
  for (let i = 0; i < 200; i++) t = deposit(t, ["src:always.com"], 1);
  assert.ok(pheromone(t, "src:always.com") <= CAP);
  assert.ok(pheromone(t, "src:always.com") > CAP - 0.5);          // reaches, does not exceed
});

test("evaporate forgets a trail below the floor", () => {
  const t = evaporate({ "src:tiny.com": FLOOR / 2, "src:big.com": 1 });
  assert.equal(t["src:tiny.com"], undefined);
  assert.ok(t["src:big.com"] > 0);
});

test("evaporate is pure and tolerates junk", () => {
  const before = { "src:a.com": 1 };
  const after = evaporate(before);
  assert.deepEqual(before, { "src:a.com": 1 });                  // not mutated
  assert.notEqual(after, before);
  assert.deepEqual(evaporate({ "src:a.com": NaN, "src:b.com": 1 }), { "src:b.com": 1 * DECAY.src.pos });
  assert.deepEqual(evaporate(null), {});
});

test("follow orders keys strongest-first (the hunt's 'follow the trail')", () => {
  let t = deposit({}, ["src:a.com"], 1);
  t = deposit(t, ["src:b.com"], 1);
  t = deposit(t, ["src:b.com"], 1);
  assert.deepEqual(follow(t, ["src:a.com", "src:b.com"]), ["src:b.com", "src:a.com"]);
  assert.deepEqual(follow({}, ["x", "y"]), ["x", "y"]);          // no trails -> input order kept
});
