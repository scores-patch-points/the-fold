import test from "node:test";
import assert from "node:assert/strict";
import { routeOrderFor, deposit } from "./stigmergy-src.mjs";
import { depositFromWitness, orderRoutes, statsFor, fitBudget, scoutShare } from "./wilson-adapter.mjs";

const DAY = 86400000, NOW = 100 * DAY, R = ["wiki", "web", "local"];
const never = () => 0.99; // rng that never scouts
const always = () => 0;   // rng that always scouts

test("finding in stigmergy.js: a route that only ever failed outranks a never-tried one", () => {
  let t = {};
  for (let i = 0; i < 5; i++) t = deposit(t, { head: "mayor", route: "web", ok: false, ms: 10, at: NOW });
  const order = routeOrderFor(t, "mayor", { now: NOW, routes: R, explore: 0 });
  assert.deepEqual(order, ["web", "wiki", "local"]); // the dead trail is walked first
});

test("adapter: a dead route sorts after never-tried routes", () => {
  let t = {};
  for (let i = 0; i < 5; i++) t = depositFromWitness(t, { head: "mayor", route: "web", verdict: "unknown", tokens: 10, at: NOW });
  assert.deepEqual(orderRoutes(t, "mayor", { now: NOW, routes: R, explore: 0 }).order, ["wiki", "local", "web"]);
});

test("supported deposits earn order; tie broken by tokens per supported answer", () => {
  let t = {};
  t = depositFromWitness(t, { head: "h", route: "wiki", verdict: "supported", tokens: 900, at: NOW });
  t = depositFromWitness(t, { head: "h", route: "local", verdict: "supported", tokens: 300, at: NOW });
  assert.deepEqual(orderRoutes(t, "h", { now: NOW, routes: R, explore: 0 }).order, ["local", "wiki", "web"]);
});

test("veto switch: a contradiction demotes when on, is weightless when off", () => {
  let on = {}, off = {};
  for (const [opts, ref] of [[{ veto: true }, "on"], [{ veto: false }, "off"]]) {
    let t = {};
    t = depositFromWitness(t, { head: "h", route: "wiki", verdict: "supported", tokens: 100, at: NOW }, opts);
    t = depositFromWitness(t, { head: "h", route: "wiki", verdict: "contradicted", tokens: 100, at: NOW }, opts);
    t = depositFromWitness(t, { head: "h", route: "wiki", verdict: "contradicted", tokens: 100, at: NOW }, opts);
    if (ref === "on") on = t; else off = t;
  }
  assert.deepEqual(orderRoutes(on, "h", { now: NOW, routes: R, explore: 0 }).order, ["web", "local", "wiki"]);
  assert.deepEqual(orderRoutes(off, "h", { now: NOW, routes: R, explore: 0 }).order, ["wiki", "web", "local"]);
});

test("half-life switch: with evaporation an old strong trail loses to a fresh one; with Infinity it does not", () => {
  let t = {};
  for (let i = 0; i < 3; i++) t = depositFromWitness(t, { head: "h", route: "wiki", verdict: "supported", tokens: 100, at: NOW - 60 * DAY });
  t = depositFromWitness(t, { head: "h", route: "web", verdict: "supported", tokens: 100, at: NOW });
  assert.equal(orderRoutes(t, "h", { now: NOW, routes: R, explore: 0, halfLifeDays: 7 }).order[0], "web");
  assert.equal(orderRoutes(t, "h", { now: NOW, routes: R, explore: 0, halfLifeDays: Infinity }).order[0], "wiki");
});

test("scouts keep probing after every route is tried (stigmergy.js stops: the mill condition)", () => {
  let t = {};
  t = depositFromWitness(t, { head: "h", route: "wiki", verdict: "supported", tokens: 1, at: NOW });
  t = depositFromWitness(t, { head: "h", route: "web", verdict: "unknown", tokens: 1, at: NOW - DAY });
  t = depositFromWitness(t, { head: "h", route: "local", verdict: "unknown", tokens: 1, at: NOW - 2 * DAY });
  assert.deepEqual(routeOrderFor(t, "h", { now: NOW, routes: R, rng: always }), ["wiki", "web", "local"]); // no scout possible
  const r = orderRoutes(t, "h", { now: NOW, routes: R, rng: always });
  assert.equal(r.scout, "local"); // least recently tried
  assert.equal(r.order[0], "local");
  assert.equal(orderRoutes(t, "h", { now: NOW, routes: R, explore: 0, rng: always }).scout, null); // switch off
});

test("deterministic with rng that never fires", () => {
  assert.equal(orderRoutes({}, "h", { now: NOW, routes: R, rng: never }).scout, null);
});

test("fitBudget keeps what fits in order, skipping an oversized item without stopping", () => {
  const r = fitBudget([{ id: 1, tokens: 2500 }, { id: 2, tokens: 2000 }, { id: 3, tokens: 1000 }], 4000);
  assert.deepEqual(r.kept.map((x) => x.id), [1, 3]);
  assert.equal(r.used, 3500); assert.equal(r.dropped, 1);
});

test("stats and scout share are plain readings", () => {
  const s = statsFor({}, "h", { routes: R });
  assert.equal(s.length, 3); assert.equal(s[0].tokensPerHit, null);
  assert.equal(scoutShare([{ scout: "a" }, { scout: null }, { scout: null }, { scout: "b" }]), 0.5);
  assert.equal(scoutShare([]), null);
});

// ── A8 DMD evaporation ──
import { shadowSample, savingOf, dmdKeep } from "./wilson-adapter.mjs";

test("A8 U5: shadow sample is deterministic and about 5%", () => {
  const ids = Array.from({ length: 20000 }, (_, i) => `q${i}`);
  const a = ids.filter(shadowSample), b = ids.filter(shadowSample);
  assert.deepEqual(a, b);
  assert.ok(a.length / ids.length > 0.04 && a.length / ids.length < 0.06, `share ${a.length / ids.length}`);
});

test("A8 U1: savings subtract verification and deposit cost; failed hint is pure loss", () => {
  assert.equal(savingOf({ coldTokens: 1000, trailTokens: 600, verifyTokens: 300, depositTokens: 200 }), -100);
  assert.equal(savingOf({ coldTokens: 1000, trailTokens: 600, verified: false }), -600);
});

test("A8 U4: a never-used trail evaporates", () => {
  assert.equal(dmdKeep([]).keep, false);
});

test("A8 U2/U3: one zero-saving use does not kill a trail with a positive record (window widens)", () => {
  const r = dmdKeep([400, 300, 500, 0]);
  assert.equal(r.keep, true); assert.ok(r.window > 1);
});

test("A8: a trail that saves nothing over its window evaporates", () => {
  assert.equal(dmdKeep([0, 0, -20, 0, 0, 0]).keep, false);
});

test("A8 U7: a failed verification drops the trail despite a good past", () => {
  assert.equal(dmdKeep([900, 900, -300], { failedLast: true }).keep, false);
});
