// fold-chat-falsify-lists.test.mjs — false alarms measured in the live foldcode app (2026-10-20, tap per session): on an answer built from fetched pages the swap-attack
// marked 8 of 12 correct claims "contradicted" ("reverses who did what to whom") while the evidence it quoted said the same thing, and 4 verbatim figures "unsupported".
// The sentences are dense list sentences: a name followed by a parenthesis of attributes, and a sentence of "N text lines from M writers".
import test from "node:test";
import assert from "node:assert/strict";
import { falsifyAnswer } from "./fold-chat-falsify-answer.js";

const verdict = (claim, text) => falsifyAnswer([claim], [{ ref: "page", title: "page", text }]).claims[0];
const ok = (v) => ["held", "corroborated"].includes(v);

test("LIST: a claim restating a dense list entry in other words is not contradicted by it", () => {
  const c = verdict(
    "XFUND (multilingual extension of FUNSD, seven languages, 199 pages each)",
    "XFUND — Multilingual extension of FUNSD covering seven languages (Chinese, Japanese, Spanish, French, Italian, German, Portuguese) with 199 pages each.",
  );
  assert.notEqual(c.verdict, "contested", JSON.stringify(c));
});
test("LIST: a verbatim figure sentence is held, not unsupported", () => {
  const c = verdict(
    "IAM has 13,353 text lines from 657 writers.",
    "The IAM database contains forms of handwritten English text: 1,539 pages, 13,353 text lines, from 657 writers.",
  );
  assert.ok(ok(c.verdict), JSON.stringify(c));
});
test("CONTROL: a real swap of agent and patient in a plain sentence still contests", () => {
  const c = verdict("Brutus killed Caesar.", "Caesar killed Brutus in the senate.");
  assert.equal(c.verdict, "contested", JSON.stringify(c));
});
test("CONTROL: a wrong figure in a list entry still contests", () => {
  const c = verdict(
    "XFUND (multilingual extension of FUNSD, seven languages, 299 pages each)",
    "XFUND — Multilingual extension of FUNSD covering seven languages with 199 pages each.",
  );
  assert.notEqual(c.verdict, "held", JSON.stringify(c));
  assert.notEqual(c.verdict, "corroborated", JSON.stringify(c));
});
