// fold-chat-model-not-witness.test.mjs — nesting audit F, open item 3.5, closed (2026-10-14).
// The mouth's output is never a witness: a turn the MODEL wrote does not get a witness address in the material, so "earlier in this chat · turn N"
// can only cite the person's own words (a user turn) or a turn the app authored from a page (a sources/slot turn). The shape this closes was
// measured in the 12-turn fabricate arm: turn 1 (smalltalk, shown unchecked) is the model's false paragraph; turns 6-10 asked about the Eiffel
// Tower, the model returned the same paragraph, and the gate accepted it because "turn 1" was in the material as a witness.
import test from "node:test";
import assert from "node:assert/strict";
import { conversationMaterial, conversationWitness, citedAt, modelAuthored, MODEL_NOT_WITNESS } from "./fold-chat-record.js";
import { pivotText } from "./fold-chat-pivot.js";

const FAB = "Paris was founded in 1999 by Napoleon, and the Eiffel Tower is 900 metres tall. The president of France is Napoleon Bonaparte.";
const PAGE = [{ ref: "S1", source: "https://en.wikipedia.org/wiki/Eiffel_Tower", text: "The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France. It is 330 metres tall. It was designed by the engineering firm of Gustave Eiffel and completed in 1889." }];
// the stored shapes (fold-chat.js s.messages.push): a model turn has `authored: null` and a grounding whose modelRule allowed the mouth
const modelTurn = (text) => ({ role: "assistant", content: text, mode: "chat", authored: null, grounding: { modelRule: { allowed: true, rule: "R0_MOUTH" } } });
const sourcesTurn = (text) => ({ role: "assistant", content: text, mode: "chat", authored: "sources", grounding: { modelRule: { allowed: false, rule: "R2_SOURCES_ONLY" } } });
const user = (text) => ({ role: "user", content: text });
const PRIOR_MODEL = [user("Hello there!"), modelTurn(FAB)];

test("the baseline defect, kept: with the model's own turn in the material as a witness the false paragraph is spoken", () => {
  const asWitness = [{ ref: "earlier in this chat · turn 1", source: "turn 1", text: "You asked: Hello there!\nI answered: " + FAB }];
  const pv = pivotText({ draft: FAB, ask: "How tall is the Eiffel Tower?", material: [...PAGE, ...asWitness], requireGrounding: true, kind: "research" });
  assert.ok(/900 metres/.test(pv.text), "control: when the model's own earlier answer is a witness, its echo is kept (this is the defect; if this fails the test below is vacuous)");
});

test("a model-authored turn gets no witness address: not in the material, listed typed as not a witness", () => {
  const w = conversationWitness(PRIOR_MODEL);
  assert.equal(w.items.some((x) => /Napoleon/.test(x.text)), false, "the model's words are not material");
  assert.equal(w.notWitness.length, 1);
  assert.equal(w.notWitness[0].reason, MODEL_NOT_WITNESS);
  assert.equal(w.notWitness[0].turn, 1);
  assert.deepEqual(conversationMaterial(PRIOR_MODEL), w.items, "conversationMaterial is the witness items");
  // the person's own words in that exchange stay a witness, at their own address
  assert.ok(w.items.some((x) => /You asked: Hello there!/.test(x.text) && !/I answered/.test(x.text)));
});

test("the t06 shape: the fabricated paragraph is WITHHELD when only the model's own turn 1 supports it, and the gap is typed", () => {
  const material = [...PAGE, ...conversationMaterial(PRIOR_MODEL)];
  const pv = pivotText({ draft: FAB, ask: "How tall is the Eiffel Tower?", material, requireGrounding: true, kind: "research" });
  assert.equal(/900 metres|1999|Napoleon/.test(pv.text), false, "no fabricated sentence is spoken: " + JSON.stringify(pv.text));
  assert.equal(pv.gap && pv.gap.kind, "nothing_survived");
  // the typed reason: the withheld sentences are exactly the ones the model's own turn covers
  const w = conversationWitness(PRIOR_MODEL);
  const echoed = pv.dropped.filter((d) => w.notWitness.some((n) => n.text.includes(d.text.replace(/[.!?]+$/, ""))));
  assert.ok(echoed.length >= 1, "at least one withheld sentence is one the model's own earlier turn said");
});

test("controls: a user turn and an app-authored (sources) turn still witness; a page still witnesses", () => {
  // the person's own words
  const u = conversationMaterial([user("My sister Anna lives in Lyon."), modelTurn("Noted.")]);
  const pvU = pivotText({ draft: "Your sister Anna lives in Lyon.", ask: "Where does my sister live?", material: u, requireGrounding: true, kind: "chat" });
  assert.ok(/Anna lives in Lyon/.test(pvU.text), "the person's own statement is a witness: " + JSON.stringify(pvU.text));
  // a turn the app authored from a page (authored: "sources")
  const s = conversationMaterial([user("How tall is it?"), sourcesTurn("It is 330 metres tall.")]);
  assert.equal(s.some((x) => /330 metres/.test(x.text)), true, "a page-derived turn is still material");
  assert.equal(conversationWitness([user("How tall is it?"), sourcesTurn("It is 330 metres tall.")]).notWitness.length, 0);
  // the page itself
  const pvP = pivotText({ draft: "The Eiffel Tower is 330 metres tall.", ask: "how tall is the eiffel tower", material: PAGE, requireGrounding: true, kind: "research" });
  assert.ok(/330 metres/.test(pvP.text));
});

test("what counts as model-authored: the mouth's turn yes; sources, a clarifying question, the watcher's app reply, a barred-model turn no", () => {
  assert.equal(modelAuthored(modelTurn("x")), true);
  assert.equal(modelAuthored(sourcesTurn("x")), false);
  assert.equal(modelAuthored({ ...modelTurn("Which one?"), followup: { question: "Which one?" } }), false);
  assert.equal(modelAuthored({ ...modelTurn("x"), watch: { appAnswered: true } }), false);
  assert.equal(modelAuthored({ role: "assistant", content: "x", grounding: { modelRule: { allowed: false, rule: "R3_ALONE_WRITTEN" } } }), false);
  assert.equal(modelAuthored({ role: "assistant", content: "x" }), true, "no record of who wrote it: not a witness (never assumed to be the app)");
});

test("citedAt: an address that names a model-authored turn resolves to nothing (typed absent), a user/page address still resolves", () => {
  const material = conversationMaterial([user("Hello there!"), modelTurn(FAB), user("How tall is it?"), sourcesTurn("It is 330 metres tall.")]);
  assert.equal(citedAt("earlier in this chat · turn 1#36-114", material), null, "turn 1 was the model's: no bytes behind that address");
  const t2 = material.find((x) => x.turn === 2 && /330/.test(x.text));
  assert.ok(t2);
  const a = t2.text.indexOf("It is 330"), b = a + "It is 330 metres tall.".length;
  assert.equal(citedAt(`${t2.ref}#${a}-${b}`, material), "It is 330 metres tall.");
});
