// fold-chat-heal.test.mjs — the fold repairs its own misreadings from past lessons (self-healing, not compensation).
import test from "node:test";
import assert from "node:assert/strict";
import { HEAL_KEY, healedCorrections, addHealedRule, healQuestion } from "./fold-chat-heal.js";

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

test("a confirmed lesson is stored append-only and read back", () => {
  const s = mem();
  assert.deepEqual(healedCorrections(s), []);
  addHealedRule(s, { from: "meam", to: "mean" });
  const a = healedCorrections(s);
  assert.equal(a.length, 1);
  assert.equal(a[0].from, "meam");
  assert.equal(a[0].to, "mean");
  assert.equal(a[0].schema, "HealedRule@1");
  addHealedRule(s, { from: "itnow", to: "it now" });
  assert.equal(healedCorrections(s).length, 2);
});

test("healQuestion applies the longest learned match to the ask, and leaves others alone", () => {
  const rules = [{ from: "meam", to: "mean" }, { from: "i meam", to: "i mean" }];
  const h = healQuestion("no i meam the gone of the wind book", rules);
  assert.equal(h.healed, true);
  assert.equal(h.from, "i meam");                        // the LONGEST match wins
  assert.equal(h.question, "no i mean the gone of the wind book");
  const none = healQuestion("what is the capital of france", rules);
  assert.equal(none.healed, false);
});

test("pure: no learned rule means the question is returned untouched", () => {
  const q = "explain photosynthesis";
  assert.deepEqual(healQuestion(q, []), { question: q, healed: false, from: null, to: null });
});

test("a healed ask feeds a corrected murmur — the fold reads the healed wording, not the typo", async () => {
  const { murmurOf, murmurSay } = await import("./fold-chat-murmur.js");
  const h = healQuestion("no i meam the gone of the wind quotes", [{ from: "meam", to: "mean" }]);
  const m = murmurOf({ question: h.question });
  const say = murmurSay(m).join(" ");
  assert.ok(!/meam/.test(say), "the typo is gone from the read");
  assert.ok(/mean/.test(say), "the healed word is what it reads");
});