import { test } from "node:test";
import assert from "node:assert/strict";
import { cutLines, cutText, abbreviationsOf, endsWithAbbreviation } from "./fold-chat-cut.js";

// The chat's one cut: khora's splitter told which dotted tokens are words by janus's measured and dotted-word priors.

test("a dotted word the priors know is kept whole; an ordinary word at a stop ends the sentence", () => {
  const t = "Dr. Lee met the board of Acme Inc. on Monday. Trade ran between the northern ports. The fleet sailed at dawn.";
  assert.deepEqual(cutText(t), [
    "Dr. Lee met the board of Acme Inc. on Monday.",
    "Trade ran between the northern ports.",
    "The fleet sailed at dawn.",
  ]);
});

test("ranges slice back exactly, across lines", () => {
  const t = "First line. It has two sentences.\r\nA second line with 8,848.86 metres in it.\n\nU.S. troops left. Then rain.";
  const cut = cutLines(t);
  for (const x of cut) assert.equal(t.slice(x.start, x.end), x.text);
  assert.deepEqual(cut.map((x) => x.text), [
    "First line.", "It has two sentences.", "A second line with 8,848.86 metres in it.", "U.S. troops left.", "Then rain.",
  ]);
});

test("a line break always ends a sentence, even without a stop", () => {
  assert.deepEqual(cutText("A heading\nThe body begins here. It goes on."), ["A heading", "The body begins here.", "It goes on."]);
});

test("the text's own dotted words count: a form it never writes bare is kept whole", () => {
  const set = abbreviationsOf("See the appendix, fig. 3, for the curve.");
  assert.ok(set.has("fig"));
  assert.deepEqual(cutText("See the appendix, fig. 3, for the curve. It rises."), ["See the appendix, fig. 3, for the curve.", "It rises."]);
});

test("endsWithAbbreviation: initials and dotted words yes, an ordinary word at a stop no", () => {
  for (const t of ["Dr.", "said J.", "the U.S.", "and so on, etc.", "(e.g.)"]) assert.equal(endsWithAbbreviation(t), true, t);
  for (const t of ["the northern ports.", "it was over.", "no stop here"]) assert.equal(endsWithAbbreviation(t), false, t);
});
