// fold-chat-void-declare.test.mjs — L1: the void an ask declares (eval/void/PREREG.md). The title door is stubbed; everything else is real.
import { test } from "node:test";
import assert from "node:assert/strict";
import { declareAskVoid, voidLine } from "./fold-chat-void-declare.js";
import { functionWordsOf } from "./fold-chat-snippets.js";

const TITLES = { "Eiffel Tower": "Eiffel Tower", "Mount Everest": "Mount Everest", "Hamlet": "Hamlet", "Australia": "Australia", "Sydney Opera House": "Sydney Opera House", "Mona Lisa": "Mona Lisa" };
const resolveTitles = async (cands) => new Map(cands.map((c) => [c, TITLES[c] ? { title: TITLES[c], disambiguation: false } : null]));
const fw = functionWordsOf("en");
const read = (q) => declareAskVoid(q, { fw, lang: "en", resolveTitles });
const cell = (r, f) => r.decl.cells.find((c) => c.field === f).declared;

test("the slot is read wherever the interrogative stands, not only at the front", async () => {
  const r = await read("The Eiffel Tower was finished in what year?");
  assert.equal(cell(r, "slot"), "time");
  assert.equal(cell(r, "admits"), "date");
  assert.equal(r.anchor.title, "Eiffel Tower");
});

test("'how' + a measure word is a quantity, admitting that measure's dimension", async () => {
  const r = await read("How tall is Mount Everest?");
  assert.equal(cell(r, "slot"), "quantity");
  assert.equal(cell(r, "admits"), "length");
});

test("with no interrogative, the role noun declares the void (an agent noun is a person)", async () => {
  const r = await read("Hamlet author");
  assert.equal(cell(r, "slot"), "person");
  assert.equal(cell(r, "admits"), "person");
  // KNOWN L1 GAP (found by this test, 2026-10-14, after L1 was scored): a bare "<Name> <role>" has no question frame, the probe's position
  // rule reads "Hamlet" as the relation, and the perceiver offers no sentence-initial single-word surface, so the anchor is a typed gap.
  // The referent universe (L2) is where it must close; this assertion flips when it does.
  assert.equal(r.anchor, null);
  assert.ok(r.decl.undeclared.some((u) => u.field === "anchor"), "the missing anchor is a typed gap on the void itself");
});

test("a role noun's KIND is not guessed from a table: 'capital' admits 'capital' until the universe says it is a city", async () => {
  const r = await read("capital of Australia?");
  assert.equal(cell(r, "slot"), "thing");
  assert.equal(cell(r, "admits"), "capital");
  assert.notEqual(cell(r, "admits"), "city");
});

test("pathos: every declared void is held for someone, at a real address of what they said", async () => {
  const q = "When was the Sydney Opera House opened?";
  const r = await read(q);
  assert.deepEqual(r.experiencer, { who: "the person asking", read: `ask#0-${q.length}`, revision: null });
});

test("perception: the khora's own surface reading of the ask witnesses the anchor beside the title door", async () => {
  const r = await read("When was the Sydney Opera House opened?");
  assert.ok(r.perceived.includes("Sydney Opera House"));
  assert.deepEqual(r.anchor.by, ["title-door", "perceiver"]);
});

test("fields the grammar cannot state stay typed gaps, never defaults", async () => {
  const r = await read("When was the Sydney Opera House opened?");
  const undeclared = r.decl.undeclared.map((u) => u.field);
  for (const f of ["composition", "admission", "reopensOn"]) assert.ok(undeclared.includes(f), f + " is a typed gap");
  assert.equal(r.decl.standing, "under-specified");
});

test("a language with no table is a typed gap, not an English guess", async () => {
  const r = await declareAskVoid("Wann wurde das Opernhaus eröffnet?", { fw: new Set(["wann", "das"]), lang: "de", resolveTitles });
  assert.equal(r.decl, null);
  assert.equal(r.gap.kind, "no_grammar_for_language");
});

test("the void reads as plain words for a gap card", async () => {
  assert.equal(voidLine(await read("When was the Sydney Opera House opened?")), "the date (open) of Sydney Opera House");
});
