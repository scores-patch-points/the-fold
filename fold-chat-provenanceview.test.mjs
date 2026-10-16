// Falsification: the provenance spread.
//
// Claims under test:
//   1. STANDING CHIPS — grounded → S# (with its address), asserted → S#·asserted, everything else → M.
//   2. PROVENANCE IS APP-WORDED — the narration's app parts are text; its quote parts are the sources' verbatim slices.
//   3. A ZERO IS PRINTED — the record line never returns empty/silent (silence must not read as clean).
//   4. THE CELL IS NAMED — a failed claim carries the cube cell it is owed to; a reply names where it stands.
//   5. NOTHING BECOMES MARKUP — hostile content in a sentence, a quote, or a flag is escaped, never rendered.
import test from "node:test";
import assert from "node:assert/strict";
import { sentenceChip, sentencesHtml, narrationHtml, recordLine, standingHtml, standingText, flagText, flagsHtml, provenanceHtml } from "./fold-chat-provenanceview.js";

test("chip: grounded S# with its address, asserted S#·asserted, else M", () => {
  assert.equal(sentenceChip({ type: "grounded", ref: "gov.uk#12-40" }, 1), "S1 gov.uk#12-40");
  assert.equal(sentenceChip({ type: "asserted", ref: "bbc" }, 2), "S2 bbc·asserted");
  assert.equal(sentenceChip({ type: "self:model" }, 3), "M");
  assert.equal(sentenceChip({}, 4), "M");
});

test("sentencesHtml: chips in order, content escaped", () => {
  const h = sentencesHtml([
    { type: "grounded", ref: "x", text: "a <script>alert(1)</script>" },
    { type: "self:model", text: "b" },
  ]);
  assert.match(h, /\[S1 x\]/);
  assert.match(h, /\[M\]/);
  assert.doesNotMatch(h, /<script>/);
});

test("narrationHtml: app parts are spans, quotes are verbatim <q>, both escaped", () => {
  const h = narrationHtml({ parts: [
    { kind: "app", text: "I checked this on " },
    { kind: "quote", text: "“Andy Burnham became PM.”", host: "gov.uk" },
  ] });
  assert.match(h, /<span class="pv-app">I checked this on <\/span>/);
  assert.match(h, /<q class="pv-quote" title="gov.uk">“Andy Burnham became PM.”<\/q>/);
});

test("recordLine prints a zero, never silence", () => {
  assert.equal(recordLine({ grounded: 5, asserted: 2, selfModel: 1, flagged: 1 }), "5 grounded · 2 asserted · 1 self-model · 1 flagged");
  assert.equal(recordLine(null, []), "0 grounded · 0 asserted · 0 self-model · 0 flagged");
  assert.equal(recordLine({ grounded: 3 }, [{ kind: "unverified_pass" }]), "3 grounded · 0 asserted · 0 self-model · 1 flagged");
});

test("the cell is named: standing carries the cell, a flag carries its owed cell", () => {
  assert.match(standingHtml({ cell: "EVA·Figure", watched: ["inconclusive", "insufficient"] }), /standing · EVA·Figure — watched inconclusive, insufficient/);
  assert.equal(standingHtml(null), "");
  assert.match(flagsHtml([{ kind: "unknown_path", cell: "SIG·Figure", detail: "src/lexer.js" }]), /⚠ unknown_path → SIG·Figure — src\/lexer\.js/);
  assert.match(flagsHtml([{ kind: "unverified_pass" }]), /⚠ unverified_pass/);
});

test("plain-text forms (for DOM consumers that render via textContent)", () => {
  assert.equal(standingText({ cell: "EVA·Figure", watched: ["inconclusive", "insufficient"] }), "standing · EVA·Figure — watched inconclusive, insufficient");
  assert.equal(standingText(null), "");
  assert.equal(flagText({ kind: "unknown_path", cell: "SIG·Figure", detail: "src/lexer.js" }), "⚠ unknown_path → SIG·Figure — src/lexer.js");
  // the HTML forms are the same text, escaped
  assert.match(standingHtml({ cell: "EVA·Figure" }), /standing · EVA·Figure/);
  assert.match(flagsHtml([{ kind: "unverified_pass", cell: "EVA·Figure" }]), /⚠ unverified_pass → EVA·Figure/);
});

test("provenanceHtml composes the spread and escapes hostile input", () => {
  const h = provenanceHtml({
    sentences: [{ type: "self:model", text: "<img src=x onerror=alert(1)>" }],
    summary: { selfModel: 1 },
    flags: [{ kind: "unverified_pass", cell: "EVA·Figure", detail: "<b>no green</b>" }],
    standing: { cell: "EVA·Pattern", watched: ["unlicensed"] },
  });
  assert.match(h, /class="provenance-spread"/);
  assert.match(h, /pv-flag/);
  assert.match(h, /standing · EVA·Pattern/);
  assert.doesNotMatch(h, /<img|<b>no green/);
  assert.equal(provenanceHtml({}), "", "nothing to say draws nothing");
});
