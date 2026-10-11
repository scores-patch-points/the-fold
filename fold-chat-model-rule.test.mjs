// fold-chat-model-rule.test.mjs — THE RULE, falsified: each barred branch must name its rule; a turn the
// fold established (sources in hand, nothing standing on it) is the mouth's job (R0) — and the rule is
// ASYMMETRIC: a plan bars even with sources, a strand bars even with an available model.
import test from "node:test";
import assert from "node:assert/strict";
import { modelCallRule, MODEL_BAR_RULES, MODEL_ROLES } from "./fold-chat-model-rule.js";

test("R0: a turn with material established and nothing barred IS a mouth call, and the role is phrased", () => {
  const r = modelCallRule({});
  assert.equal(r.allowed, true);
  assert.equal(r.rule, "R0_MOUTH");
  assert.match(r.why, /phrases/);
});

test("R1: no source bars the model even when the ask is simple", () => {
  const r = modelCallRule({ plan: { gap: true } });
  assert.equal(r.allowed, false);
  assert.equal(r.rule, "R1_NO_SOURCE");
});

test("R2: a sources-only strand bars the model even when one is reachable", () => {
  const r = modelCallRule({ strand: { snips: [{ text: "their own words" }] } });
  assert.equal(r.allowed, false);
  assert.equal(r.rule, "R2_SOURCES_ONLY");
});

test("R5: a clarification bars the model — the machine asks WHICH, no model writes the options", () => {
  const r = modelCallRule({ clarify: { term: "president", senses: ["a", "b"] } });
  assert.equal(r.allowed, false);
  assert.equal(r.rule, "R5_CLARIFY");
});

test("R7: a refused output gate bars the model past it", () => {
  const r = modelCallRule({ gateRefused: true });
  assert.equal(r.allowed, false);
  assert.equal(r.rule, "R7_GATE");
});

test("R3: alone-barred on a written kind bars the model", () => {
  const r = modelCallRule({ aloneBarred: true });
  assert.equal(r.allowed, false);
  assert.equal(r.rule, "R3_ALONE_WRITTEN");
});

test("the bar rules and the mouth roles are all named and non-empty", () => {
  assert.ok(Object.keys(MODEL_BAR_RULES).length >= 6, "all bar rules named");
  assert.ok(Object.keys(MODEL_ROLES).length === 3, "steer / residue / prosify");
  for (const why of Object.values(MODEL_BAR_RULES)) assert.ok(why.trim().length > 10, "every bar rule says why");
});

test("FALSIFIER: a barred turn NEVER comes out allowed (every combination routes to a rule)", () => {
  const cases = [
    { plan: {}, strand: null, aloneBarred: false, clarify: null, gateRefused: false },
    { plan: null, strand: {}, aloneBarred: false, clarify: null, gateRefused: false },
    { plan: null, strand: null, aloneBarred: true, clarify: null, gateRefused: false },
    { plan: {}, strand: {}, aloneBarred: true, clarify: { x: 1 }, gateRefused: true },
  ];
  for (const c of cases) assert.equal(modelCallRule(c).allowed, false, JSON.stringify(c));
});