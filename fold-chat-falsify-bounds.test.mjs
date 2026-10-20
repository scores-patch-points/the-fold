// "higher than 15,000 feet" bounds a value; it is no rival to the claim's own figure.
import test from "node:test";
import assert from "node:assert/strict";
import { falsifyAnswer } from "./fold-chat-falsify-answer.js";

test("a bound in another sentence of the same source is not a figure clash", () => {
  const text = "Seven of the tallest mountains reach elevations higher than 15,000 feet: Denali, Mount Saint Elias, Mount Bona. The tenth tallest mountain in North America is Mount Bona, reaching 5,044 meters (16,550 feet).";
  const v = falsifyAnswer(["The tenth tallest mountain in North America is Mount Bona, reaching 5,044 meters (16,550 feet)."], [{ ref: "a", title: "a", url: "", text }]).claims[0].verdict;
  assert.notEqual(v, "contested");
});

test("another peak's figure in a sentence with the same frame is no rival to the claim's subject", () => {
  const claim = "Aconcagua is the highest mountain in South America and the Andes, reaching about 22,837 ft (6,961 m) above sea level in Mendoza, Argentina.";
  const src = [
    { ref: "a", title: "a", url: "", text: claim },
    { ref: "b", title: "b", url: "", text: "Cerro Bonete is a peak in the Andes of Argentina, reaching about 6,793 m above sea level in La Rioja." },
  ];
  assert.notEqual(falsifyAnswer([claim], src).claims[0].verdict, "contested");
});
test("the subject's own rival figure is still caught", () => {
  const src = [{ ref: "a", title: "a", url: "", text: "Aconcagua is the highest mountain in South America, reaching about 5,000 m above sea level in Mendoza." }];
  assert.equal(falsifyAnswer(["Aconcagua is the highest mountain in South America, reaching about 6,961 m above sea level in Mendoza."], src).claims[0].verdict, "contested");
});
