// fold-chat-which.test.mjs — which sense did the person mean? Real Wikipedia search results for "Mercury" (captured 2026-10-22) as the fixture.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { whichSense, whichLine, DECLARED_ASSERT_AT } from "./fold-chat-which.js";
import { senseTerm } from "./fold-chat-senses.js";

const RESULTS = JSON.parse(fs.readFileSync(new URL("./fold-chat-which.mercury.fixture.json", import.meta.url), "utf8"));

test("the bare term is ambiguous and with nothing else said the answer is a typed gap: the senses come back in the encyclopedia's own order (no behaviour change)", () => {
  const w = whichSense({ term: senseTerm("tell me about mercury"), results: RESULTS, ask: "tell me about mercury", context: "" });
  assert.equal(w.decision, "gap");
  assert.deepEqual(w.options.map((o) => o.label), RESULTS.filter((r) => /^Mercury|Mercury$/.test(r.title) && r.title !== "Mercury").map((r) => r.title).filter((t) => w.options.some((o) => o.label === t)));
  assert.ok(w.options.length >= 2);
});

test("a thread about the solar system chooses the planet", () => {
  const w = whichSense({ term: "mercury", results: RESULTS, ask: "tell me about mercury", context: "We were talking about the planets of the Solar System, their orbits and how far each is from the Sun." });
  assert.equal(w.decision === "assert" || w.decision === "ask", true);
  assert.equal(w.options[0].label, "Mercury (planet)");
});

test("a thread about chemistry chooses the element", () => {
  const w = whichSense({ term: "mercury", results: RESULTS, ask: "tell me about mercury", context: "Earlier we compared metals: the chemical element with atomic number 80, its symbol and why it is liquid." });
  assert.equal(w.options[0].label, "Mercury (element)");
});

test("a thread about music leads with a music sense, not the planet", () => {
  const w = whichSense({ term: "mercury", results: RESULTS, ask: "tell me about mercury", context: "I am looking for a record label and a music prize, an annual award for albums." });
  assert.notEqual(w.options[0].label, "Mercury (planet)");
  assert.match(w.options[0].label, /Records|Prize|Freddie/);
});

test("a wrong silent choice is never made on thin evidence: a vague context asks, it does not assert", () => {
  const w = whichSense({ term: "mercury", results: RESULTS, ask: "tell me about mercury", context: "it was interesting and important and well known" });
  assert.notEqual(w.decision, "assert");
});

test("the lens is the surface's own number: a looser assertAt asserts what the declared one asks about", () => {
  const ctx = "We were talking about the planets of the Solar System.";
  const strict = whichSense({ term: "mercury", results: RESULTS, ask: "tell me about mercury", context: ctx, assertAt: 0.9999 });
  const loose = whichSense({ term: "mercury", results: RESULTS, ask: "tell me about mercury", context: ctx, assertAt: 0.05 });
  assert.notEqual(strict.decision, "assert");
  assert.equal(loose.decision, "assert");
  assert.equal(DECLARED_ASSERT_AT, 0.9);
});

test("a term the encyclopedia does not call ambiguous returns null (nothing to choose)", () => {
  assert.equal(whichSense({ term: "mars", results: [{ title: "Mars", url: "u", snippet: "Mars is the fourth planet from the Sun." }], ask: "mars", context: "x" }), null);
});

test("deterministic, and the lines are app-authored text", () => {
  const args = { term: "mercury", results: RESULTS, ask: "tell me about mercury", context: "the planets of the Solar System and their orbits" };
  assert.deepEqual(whichSense(args), whichSense(args));
  assert.equal(whichLine(null), "");
  assert.match(whichLine({ decision: "assert", chosen: { label: "Mercury (planet)" }, p: 0.93, options: [] }), /likely Mercury \(planet\) \(93%\)/);
});

test("every sense in hand is weighed, not only the first few the surface would show: a spaceflight thread finds Project Mercury, a car thread finds a Mercury car", () => {
  const space = whichSense({ term: "mercury", results: RESULTS, ask: "tell me about mercury", context: "Earlier we talked about the first human spaceflight program, the astronauts and their capsules." });
  assert.equal(space.options[0].label, "Project Mercury");
  const cars = whichSense({ term: "mercury", results: RESULTS, ask: "tell me about mercury", context: "Earlier I was shopping for a medium-priced car brand and its older models." });
  assert.match(cars.options[0].label, /automobile|Cougar|Marauder|Marquis/);
});

test("the vendored copy of janus's organ is byte-identical to its pin (and imports nothing a static page cannot run)", () => {
  const out = execFileSync("node", ["scripts/vendor-janus.mjs", "--check"], { cwd: new URL(".", import.meta.url).pathname, encoding: "utf8" });
  assert.match(out, /1 file\(s\) match the pin/);
  assert.doesNotMatch(fs.readFileSync(new URL("./vendor/janus/identity/resolve.mjs", import.meta.url), "utf8"), /^\s*import\s/m);
});

test("centred (opt-in): a thread the plain reading only asks about becomes an assertion on the right sense; a vague thread stays an ask; the default is unchanged", () => {
  const planets = { term: "mercury", results: RESULTS, ask: "tell me about mercury", context: "We were talking about the planets of the Solar System, their orbits and how far each is from the Sun." };
  const plain = whichSense(planets), cen = whichSense({ ...planets, centered: true });
  assert.equal(plain.decision, "ask");
  assert.equal(cen.decision, "assert");
  assert.equal(cen.chosen.label, "Mercury (planet)");
  assert.deepEqual(whichSense({ ...planets, centered: false }), plain, "centered: false is the default path");
  const cars = whichSense({ term: "mercury", results: RESULTS, ask: "tell me about mercury", context: "Earlier I was shopping for a medium-priced car brand and its older models.", centered: true });
  assert.equal(cars.decision, "assert");
  assert.match(cars.chosen.label, /automobile/);
  const vague = whichSense({ term: "mercury", results: RESULTS, ask: "tell me about mercury", context: "it was interesting and important and well known", centered: true });
  assert.notEqual(vague.decision, "assert");
});
