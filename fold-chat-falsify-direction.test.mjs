// "into" has a direction: the same two phrases in the other order are a different claim.
import test from "node:test";
import assert from "node:assert/strict";
import { falsifyAnswer } from "./fold-chat-falsify-answer.js";

const SRC = [{ ref: "a", title: "a", url: "", text: "The light reaction converts solar energy into chemical energy; the reaction also produces ATP." }];
const verdict = (c) => falsifyAnswer([c], SRC).claims[0].verdict;
test("the reversed conversion is contested", () => {
  assert.equal(verdict("The light reaction converts chemical energy into solar energy."), "contested");
});
test("the stated direction, in other words, is held", () => {
  for (const c of ["The light reaction converts solar energy into chemical energy.", "The light reaction converts solar energy into chemical energy and produces ATP."]) assert.ok(["held", "corroborated"].includes(verdict(c)), c);
});
