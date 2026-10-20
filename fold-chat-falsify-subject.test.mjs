// A claim's SUBJECT name opens the claim. A name that follows the verb ("outside Asia", "of the Seven Summits") is an object:
// it is never required to sit at the start of the source's matched region (the Aconcagua false "unsupported").
import test from "node:test";
import assert from "node:assert/strict";
import { falsifyAnswer } from "./fold-chat-falsify-answer.js";

const SRC = [{ ref: "w", title: "w", url: "", text: "Aconcagua is the tallest mountain in South America at 6,961 m. Located in Mendoza Province, Argentina, near the Chilean border. It is the highest peak outside Asia and one of the Seven Summits." }];
const verdictOf = (s) => falsifyAnswer([s], SRC).claims[0].verdict;

test("a true sentence whose only capitalised names are objects of prepositions is held", () => {
  assert.equal(verdictOf("It's the highest mountain outside Asia and one of the Seven Summits (the highest peak on each continent)."), "held");
  assert.equal(verdictOf("Aconcagua is the highest mountain outside Asia."), "held");
});
// the Trump-won guard (a subject that opens the claim must open the match) is held by fold-chat-falsify.test.mjs, which still passes.
