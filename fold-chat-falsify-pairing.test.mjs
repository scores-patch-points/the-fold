// Figures given to the other names: the sentence pairs 1.7 m with the dolphins and 8 m with the orcas.
import test from "node:test";
import assert from "node:assert/strict";
import { falsifyAnswer } from "./fold-chat-falsify-answer.js";

const SRC = [{ ref: "a", title: "a", url: "", text: "Dolphins are a diverse group of animals, ranging from the small Māui’s dolphins ( 1.7 m ) to large Orcas ( 8 m )." }];
const verdict = (c) => falsifyAnswer([c], SRC).claims[0].verdict;
test("swapped figures are contested", () => {
  assert.equal(verdict("Māui’s dolphins reach 8 m and orcas only 1.7 m."), "contested");
});
test("the right pairing, in any order or wording, is held", () => {
  for (const c of ["Māui’s dolphins reach 1.7 m and orcas 8 m.", "Dolphins vary in size, from Māui’s dolphins at 1.7 m to orcas at 8 m.", "Orcas at 8 m and Māui’s dolphins at 1.7 m differ greatly in size."]) assert.ok(["held", "corroborated"].includes(verdict(c)), c);
});
