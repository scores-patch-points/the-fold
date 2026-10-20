// A two- or three-word claim is "stated" by overlap only when its words come in its order: "Dolphins are fish." is not stated by a sentence
// that holds both words and says the opposite.
import test from "node:test";
import assert from "node:assert/strict";
import { falsifyAnswer } from "./fold-chat-falsify-answer.js";

const verdict = (claim, text) => falsifyAnswer([claim], [{ ref: "a", title: "a", url: "", text }]).claims[0].verdict;
test("'Dolphins are fish.' is not held by sentences that name both words in another order", () => {
  assert.notEqual(verdict("Dolphins are fish.", "Dolphins are aquatic mammals within the infraorder Cetacea. They feed on fish and squid. Unlike fish, dolphins breathe air."), "held");
  assert.notEqual(verdict("Dolphins are fish.", "Many fish are prey of dolphins. Dolphins are highly intelligent."), "held");
});
test("a short claim the source states in order is still held", () => {
  assert.equal(verdict("Dolphins are mammals.", "Dolphins are mammals that live in the sea."), "held");
});
