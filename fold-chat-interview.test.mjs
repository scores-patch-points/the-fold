// fold-chat-interview.test.mjs — the interview asks, in order, and every answer becomes one memory.
import test from "node:test";
import assert from "node:assert/strict";
import { QUESTIONS, nextQuestion, entryFor, progress } from "./fold-chat-interview.js";

test("every question says WHY it is asked and what the person gets", () => {
  for (const q of QUESTIONS) { assert.ok(q.why && q.help, q.id); assert.equal(typeof q.mem, "function"); }
});

test("nextQuestion walks the set in order and skips answered ones", () => {
  assert.equal(nextQuestion([]).id, "name");
  assert.equal(nextQuestion(["name"]).id, "place");
  assert.equal(nextQuestion(["name", "place"]).id, "work");
  assert.equal(nextQuestion(QUESTIONS.map((q) => q.id)), null);
});

test("an answer becomes one first-person memory about the person", () => {
  assert.deepEqual(entryFor("name", "Ada", { at: "2026-10-11" }), { text: "my name is Ada", source: "stated", at: "2026-10-11" });
  assert.equal(entryFor("place", "Nashville").text, "I am based in Nashville");
  assert.equal(entryFor("place", "   "), null);       // a pass stores nothing
  assert.equal(entryFor("nope", "x"), null);
});

test("the interview keeps a WHOLE name, where auto-learning is conservative (its declared division of labour)", () => {
  assert.equal(entryFor("name", "María José").text, "my name is María José");
  assert.equal(entryFor("name", "عبد الله").text, "my name is عبد الله");
});

test("progress is honest about how far the interview got", () => {
  assert.deepEqual(progress([]), { asked: 0, total: QUESTIONS.length, done: false });
  const all = progress(QUESTIONS.map((q) => q.id));
  assert.equal(all.done, true);
  assert.equal(all.asked, QUESTIONS.length);
});
