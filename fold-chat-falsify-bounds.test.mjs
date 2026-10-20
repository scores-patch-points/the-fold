// "higher than 15,000 feet" bounds a value; it is no rival to the claim's own figure.
import test from "node:test";
import assert from "node:assert/strict";
import { falsifyAnswer } from "./fold-chat-falsify-answer.js";

test("a bound in another sentence of the same source is not a figure clash", () => {
  const text = "Seven of the tallest mountains reach elevations higher than 15,000 feet: Denali, Mount Saint Elias, Mount Bona. The tenth tallest mountain in North America is Mount Bona, reaching 5,044 meters (16,550 feet).";
  const v = falsifyAnswer(["The tenth tallest mountain in North America is Mount Bona, reaching 5,044 meters (16,550 feet)."], [{ ref: "a", title: "a", url: "", text }]).claims[0].verdict;
  assert.notEqual(v, "contested");
});
