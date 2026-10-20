// The claim's own subject noun, repeated, is not "the verb" of a role swap: "Dolphins vary in size, from Māui’s dolphins …" (plural -s read as a verb).
import test from "node:test";
import assert from "node:assert/strict";
import { falsifyAnswer } from "./fold-chat-falsify-answer.js";

test("a repeated plural subject noun is no shared verb", () => {
  const src = [
    { ref: "a", title: "a", url: "", text: "Dolphins are a diverse group of animals, ranging from the small Māui’s dolphins ( 1.7 m ) to large Orcas ( 8 m )." },
    { ref: "b", title: "b", url: "", text: "This includes the Yangtze River dolphin, the Maui dolphin, the Ganges River dolphin, and the short-beaked common dolphin." },
  ];
  const v = falsifyAnswer(["Dolphins vary in size, from Māui’s dolphins at 1.7 m to orcas at 8 m."], src).claims[0].verdict;
  assert.notEqual(v, "contested");
});
