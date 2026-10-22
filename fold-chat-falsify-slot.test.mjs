// A claim word that the source writes in ANOTHER event's sentence, where the claim's own event fills that slot with a rival:
// "the 1911 Nobel Prize in Physics" against a source giving 1903 to Physics and 1911 to Chemistry. Was held, by a pair-joined
// window that took 1911 from one sentence and Physics from the other.
import test from "node:test";
import assert from "node:assert/strict";
import { falsifyAnswer } from "./fold-chat-falsify-answer.js";

const CURIE = [{ ref: "c", title: "c", url: "", text: "In 1903 she shared the Nobel Prize in Physics with Pierre Curie and Henri Becquerel. In 1911 she was awarded the Nobel Prize in Chemistry." }];
const claim = (c, src = CURIE) => falsifyAnswer([c], src).claims[0];
const HELD = ["held", "corroborated"];

test("a figure bound to a rival slot filler is contested, witnessed by that figure's own sentence", () => {
  for (const [c, witness] of [["She won the 1911 Nobel Prize in Physics.", "In 1911 she was awarded the Nobel Prize in Chemistry."], ["She won the 1903 Nobel Prize in Chemistry.", "In 1903 she shared the Nobel Prize in Physics with Pierre Curie and Henri Becquerel."]]) {
    const r = claim(c);
    assert.equal(r.verdict, "contested", c);
    assert.equal(r.witnesses[0].sentence, witness, c);
    assert.equal(r.witnesses[0].kind, "slot", c);
  }
});
test("CONTROL: the true pairings are held", () => {
  for (const c of ["She won the 1911 Nobel Prize in Chemistry.", "She won the 1903 Nobel Prize in Physics."]) assert.ok(HELD.includes(claim(c).verdict), c);
});
test("CONTROL: without a figure the slot is not exclusive (one person may win both)", () => {
  for (const c of ["She won the Nobel Prize in Physics.", "She won the Nobel Prize in Chemistry."]) assert.ok(HELD.includes(claim(c).verdict), c);
});
test("CONTROL: a source that never writes the claim's word has said less, not contradicted it", () => {
  const src = [{ ref: "f", title: "f", url: "", text: "In 2004 he founded the company in Cambridge with four classmates." }];
  assert.notEqual(claim("In 2004 he founded the company in Massachusetts.", src).verdict, "contested");
});
test("CONTROL: a claim that genuinely spans two sentences still holds", () => {
  const src = [{ ref: "q", title: "q", url: "", text: "The bond-buying programme began in 2008. It started when the central bank cut rates to zero." }];
  assert.ok(HELD.includes(claim("The bond-buying programme began in 2008, when the central bank cut rates to zero.", src).verdict));
});
