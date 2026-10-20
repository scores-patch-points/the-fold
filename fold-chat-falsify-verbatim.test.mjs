// A line a source states word for word is never a role swap ("known as", "was born": the passive verb made the names look reversed).
import test from "node:test";
import assert from "node:assert/strict";
import { falsifyAnswer } from "./fold-chat-falsify-answer.js";

const LINES = [
  "Augusta Ada Byron King, Countess of Lovelace, born on 10 December 1815 in London, was the daughter of the poet George Gordon Byron, known as Lord Byron.",
  "Augusta Ada Byron is born 10th December 1815, as the daughter of Anne Isabella Noel-Byron (known as Annabella) and famous English poet Lord Byron.",
  "The woman most often known as 'Ada Lovelace' was born Ada Gordon in 1815, sole child of the brief marriage of the erratic poet George Gordon, Lord Byron.",
];
// the first line sits beside the other sources the gather read for the same ask: a verbatim witness must not be outvoted by a passive "born" or a naming "known as" read as a swap
test("a line one source states verbatim is not contested by the other sources' passive and naming verbs", () => {
  const src = [...LINES.map((text, i) => ({ ref: "s" + i, title: "s" + i, url: "", text })), { ref: "c", title: "c", url: "", text: "Ada Lovelace was born Ada Byron. Her father Lord Byron was known as a poet. Annabella was known as the mother of Ada." }];
  for (const c of falsifyAnswer(LINES, src).claims) assert.notEqual(c.verdict, "contested", c.s.slice(0, 50));
});
test("a real swap is still caught", () => {
  const src = [{ ref: "w", title: "w", url: "", text: "Brutus killed Caesar in 44 BC." }];
  assert.equal(falsifyAnswer(["Caesar killed Brutus in 44 BC."], src).claims[0].verdict, "contested");
});

test("a buried role reading from another source does not outvote a word-for-word statement", () => {
  const claim = "The tallest building in Canada outside of Toronto is Stantec Tower in Edmonton, which has a height of 249 m (817 ft).";
  const src = [
    { ref: "a", title: "a", url: "", text: claim },
    { ref: "b", title: "b", url: "", text: "TD Tower, which is connected to the Pacific Centre shopping mall, overtook the Hotel Vancouver to briefly become the tallest building in Vancouver." },
  ];
  assert.notEqual(falsifyAnswer([claim], src).claims[0].verdict, "contested");
});
