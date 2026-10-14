// fold-chat-rehearse.test.mjs — the rehearsal witness: the SATISFY sentence turned mechanically into actions + an expectation.
import test from "node:test";
import assert from "node:assert/strict";
import { planRehearsal, judgeRehearsal, regressionFinding, tokensOf, rehearsalScript, PROBE } from "./fold-chat-rehearse.js";

const obs = (labels, inputs = []) => ({ controls: labels.map((label, i) => ({ i, label })), inputs: inputs.map((kind, i) => ({ i, kind })) });

test("tokensOf: words are stemmed, numbers and symbols kept as written", () => {
  const t = tokensOf("Pressing 7 + 3 = shows 1,000 converts");
  assert.deepEqual(t.map((x) => x.k), ["press", "7", "+", "3", "=", "show", "1000", "convert"]);
});

test("planRehearsal: no sentence is a named gap, never a pass", () => {
  assert.match(planRehearsal(null, obs(["Add"])).gap, /no SATISFY/);
  assert.match(planRehearsal("", obs(["Add"])).gap, /no SATISFY/);
});

test("planRehearsal: a sentence that names nothing the page offers (no named control, no input) is a gap", () => {
  const p = planRehearsal("It shows a pleasant greeting.", obs(["Home", "About"]));
  assert.ok(p.gap); assert.match(p.gap, /names nothing/);
});

test("planRehearsal: controls the sentence names are pressed in the sentence's order (stems join: adds ~ Add, converts ~ Convert)", () => {
  const p = planRehearsal("The user types a task and adds it, then can clear the list.", obs(["Clear", "Add task"], ["text"]));
  assert.deepEqual(p.actions, [{ fill: 0, value: PROBE }, { click: 1, label: "Add task" }, { click: 0, label: "Clear" }]);
  assert.equal(p.expect.respond, true);
});

test("planRehearsal: a keypad sequence in the sentence is pressed key by key; the number after it is expected", () => {
  const p = planRehearsal("Pressing 7 + 3 = would display 10.", obs(["7", "8", "3", "+", "="]));
  assert.deepEqual(p.actions.map((a) => a.label), ["7", "+", "3", "="]);
  assert.deepEqual(p.expect.values, ["10"]);
});

test("planRehearsal: the sentence's numbers fill the inputs in order; the rest are expected; a duration is waited, not expected", () => {
  const p = planRehearsal("Entering 5 kilometres and pressing Convert shows 5000 metres.", obs(["Convert"], ["number"]));
  assert.deepEqual(p.actions, [{ fill: 0, value: "5" }, { click: 0, label: "Convert" }]);
  assert.deepEqual(p.expect.values, ["5000"]);
  const t = planRehearsal("Clicking Start counts down from 10 seconds.", obs(["Start", "Reset"]));
  assert.equal(t.wait, 10000); assert.deepEqual(t.expect.values, []);
  assert.deepEqual(t.actions, [{ click: 0, label: "Start" }]);
});

test("planRehearsal: a sentence that names no control, on a page with exactly one, presses that one", () => {
  const p = planRehearsal("The tool takes a Celsius temperature as input and outputs the equivalent Fahrenheit temperature.", obs(["Convert"], ["number"]));
  assert.deepEqual(p.actions, [{ fill: 0, value: PROBE }, { click: 0, label: "Convert" }]);
  assert.ok(planRehearsal("It shows the time.", obs(["Start", "Reset"])).gap, "two unnamed controls: which one is not known — a gap");
});

test("planRehearsal: function-word labels do not join (a 'To' link is not named by 'to')", () => {
  const p = planRehearsal("It converts miles to kilometres.", obs(["To", "Of"]));
  assert.ok(p.gap);
});

const snap = (text, sig = "s") => ({ text, sig });
test("judgeRehearsal: a page that responds and shows the expected value passes", () => {
  const plan = planRehearsal("Pressing 7 + 3 = would display 10.", obs(["7", "+", "3", "="]));
  const r = judgeRehearsal(plan, { err: [], before: snap("0"), snaps: [snap("7"), snap("7+"), snap("7+3"), snap("10"), snap("10")], missing: [] });
  assert.equal(r.ok, true);
});

test("judgeRehearsal: NaN appearing, a throw, a dead control and a missing value are each a FINDING", () => {
  const plan = planRehearsal("Entering 5 kilometres and pressing Convert shows 5000 metres.", obs(["Convert"], ["number"]));
  assert.match(judgeRehearsal(plan, { err: [], before: snap("Result:"), snaps: [snap("Result:"), snap("Result: NaN m")], missing: [] }).finding, /NaN/);
  assert.match(judgeRehearsal(plan, { err: ["x is not defined"], before: snap(""), snaps: [snap("")], missing: [] }).finding, /throw/);
  assert.match(judgeRehearsal(plan, { err: [], before: snap("Result:"), snaps: [snap("Result:"), snap("Result:")], missing: [] }).finding, /changed nothing/);
  assert.match(judgeRehearsal(plan, { err: [], before: snap("Result:"), snaps: [snap("Result: 500 m")], missing: [] }).finding, /never showed “5000”/);
  const dice = { actions: [{ click: 0, label: "Roll" }], expect: { values: ["1", "6"], respond: true }, named: ["Roll"], wait: 0 };
  assert.equal(judgeRehearsal(dice, { err: [], before: snap("?"), snaps: [snap("4")], missing: [] }).ok, true, "a number inside the named range is an outcome the sentence names");
  assert.match(judgeRehearsal(dice, { err: [], before: snap("?"), snaps: [snap("9")], missing: [] }).finding, /any of 1, 6/);
  assert.equal(judgeRehearsal(plan, { err: [], before: snap("Result:"), snaps: [snap("Result: 5,000 m")], missing: [] }).ok, true);
});

test("judgeRehearsal: a form submit the page does not prevent reloads the page for the person — a finding", () => {
  const plan = { actions: [{ fill: 0, value: "7" }, { click: 0, label: "Convert" }], expect: { values: [], respond: true }, named: ["Convert"], wait: 0 };
  assert.match(judgeRehearsal(plan, { err: [], before: snap(""), snaps: [snap("3.18 kg")], missing: [], reloads: ["Convert"] }).finding, /reloads the page/);
});

test("judgeRehearsal: '0' is not found inside '10'; NaN already on the page before acting is not the rehearsal's doing", () => {
  const plan = { actions: [{ click: 0, label: "Go" }], expect: { values: ["0"], respond: true }, named: ["Go"], wait: 0 };
  assert.equal(judgeRehearsal(plan, { err: [], before: snap("10"), snaps: [snap("9"), snap("10")], missing: [] }).ok, false);
  const plan2 = { actions: [{ click: 0, label: "Go" }], expect: { values: [], respond: true }, named: ["Go"], wait: 0 };
  assert.equal(judgeRehearsal(plan2, { err: [], before: snap("NaN"), snaps: [snap("NaN 1")], missing: [] }).ok, true);
});

test("judgeRehearsal: inputs filled with no named control and no response is a GAP, not a failure", () => {
  const plan = planRehearsal("It turns a temperature into Fahrenheit.", obs(["Calculate", "Reset"], ["number"]));
  const r = judgeRehearsal(plan, { err: [], before: snap("F:"), snaps: [snap("F:"), snap("F:")], missing: [] });
  assert.equal(r.ok, null); assert.match(r.gap, /names no control/);
});

test("judgeRehearsal: a style-only response (a theme toggle) counts as responding", () => {
  const plan = planRehearsal("Clicking the toggle switches the page to dark mode.", obs(["Toggle dark mode"]));
  assert.equal(judgeRehearsal(plan, { err: [], before: snap("Hi", "white"), snaps: [snap("Hi", "black")], missing: [] }).ok, true);
});

test("regressionFinding: a later version that loses an atom or a passing rehearsal is a finding; holding them is not", () => {
  const held = { atoms: new Set(["Convert"]), rehearsed: ["Convert"] };
  assert.match(regressionFinding(held, { shown: "km", rehearsal: { ok: true } }), /lost “Convert”/);
  assert.match(regressionFinding(held, { shown: "convert km", rehearsal: { ok: null, gap: "no SATISFY line" } }), /earlier version passed its rehearsal/);
  assert.equal(regressionFinding(held, { shown: "convert km", rehearsal: { ok: true } }), null);
  assert.equal(regressionFinding(null, { shown: "", rehearsal: null }), null);
});

test("rehearsalScript: the plan rides as data inside the injected script, never as markup", () => {
  const s = rehearsalScript({ actions: [{ click: 0, label: "</script><b>" }], wait: 0 });
  assert.ok(s.startsWith("<script>") && s.endsWith("<\/script>"));
  assert.equal(s.indexOf("</script><b>"), -1);
});
