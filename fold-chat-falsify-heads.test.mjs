// fold-chat-falsify-heads.test.mjs — two false alarms found by the grounding battery (khora opencode-battery.mjs, 2026-10-19):
//   1. "Nobel Prizes" vs "Nobel Prize" is one being, not a rival substituted for another (heads compare by stem);
//   2. a negated sentence that gives a DIFFERENT year ("did not win … in 1900") is no denial of a claim about another event.
// Each has its control: a real rival still contests, and a negation about the SAME year still contests.
import test from "node:test";
import assert from "node:assert/strict";
import { falsifyAnswer } from "./fold-chat-falsify-answer.js";

const MAT = [{ ref: "curie.md", title: "curie.md", text: "Marie Curie won the Nobel Prize in Physics in 1903 and the Nobel Prize in Chemistry in 1911. Marie Curie did not win a Nobel Prize in 1900. Marie Curie died in 1934 of aplastic anemia." }];
const verdictOf = (claim) => falsifyAnswer([claim], MAT).claims[0].verdict;

test("FALSIFIER: a plural of the same noun is the same being, not a substituted rival", () => {
  assert.notEqual(verdictOf("Marie Curie won two Nobel Prizes."), "contested");
});
test("FALSIFIER: a surname shared with another given name is not the claim's person", () => {
  // the source only ever says "Marie Curie"; "Pierre Curie died in 1934 of aplastic anemia" must not be held on the shared surname
  assert.ok(!["held", "corroborated"].includes(verdictOf("Pierre Curie died in 1934 of aplastic anemia.")));
});
test("CONTROL: the right given name is still held", () => {
  assert.ok(["held", "corroborated"].includes(verdictOf("Marie Curie died in 1934 of aplastic anemia.")));
});
test("CONTROL: a real rival substituted into the same role still contests", () => {
  const withPierre = [{ ref: "c.md", title: "c.md", text: MAT[0].text + " Pierre Curie died in 1906 when a wagon ran him over." }];
  assert.equal(falsifyAnswer(["Pierre Curie died in 1934 of aplastic anemia."], withPierre).claims[0].verdict, "contested");
});
test("FALSIFIER: a negation about a different year does not contest a claim about another year", () => {
  assert.notEqual(verdictOf("Marie Curie won a Nobel Prize in 1903."), "contested");
});
test("CONTROL: a negation about the SAME year still contests", () => {
  assert.equal(verdictOf("Marie Curie won a Nobel Prize in 1900."), "contested");
});
