// A copula claim ("Dolphins are fish.") is stated only where the sentence's own be-verb links its two sides. Cases from the door's live
// research (2026-10-21). RADIUM is a written passage, not the real article (which never says blue): the colour cases test the judge, not the article.
import test from "node:test";
import assert from "node:assert/strict";
import { falsifyAnswer } from "./fold-chat-falsify-answer.js";

const verdict = (claim, text) => falsifyAnswer([claim], [{ ref: "a", title: "a", url: "", text }]).claims[0].verdict;
const HELD = ["held", "corroborated"];
const RADIUM = "Radium is a radioactive element. Pure radium is silvery-white, and it reacts with nitrogen in the air, producing a faint blue glow.";

test("'Dolphins are fish.' is not held where the be-verb links dolphins to something else and fish is what they eat", () => {
  assert.notEqual(verdict("Dolphins are fish.", "Like most nektonic animals, dolphins are carnivorous, feed largely on fish and squid."), "held");
});
test("CONTROL: a copula the sentence states is held, plain or behind a pronoun", () => {
  for (const [c, t] of [
    ["Dolphins are mammals.", "Dolphins are mammals that live in the sea."],
    ["Canberra is the capital of Australia.", "Canberra is the capital city of Australia."],
    ["Canberra is the capital of Australia.", "Located in the Australian Capital Territory, it is the capital of Australia. Canberra was founded in 1913."],
  ]) assert.ok(HELD.includes(verdict(c, t)), c);
});
test("a rival colour in the same slot is a contradiction", { todo: "needs meaning relations (green and blue are sibling terms); the slot rule needs a figure" }, () => {
  assert.notEqual(verdict("Radium glows faintly green.", RADIUM), "held");
});
test("CONTROL: the glow the source states is held", () => {
  assert.ok(HELD.includes(verdict("The element radium glows faintly blue in the dark.", RADIUM)));
});
