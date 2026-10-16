// fold-chat-split.test.mjs — the COMPOUND ONE SHOT, pure layer: the splitter,
// the anaphor binder, the topic, the stored-parts invariant. Every claim is
// falsified: a split that is not a split, a bind that invents, an expansion
// that fires on non-asks.
import test from "node:test";
import assert from "node:assert/strict";
import { splitSlotParts, bindPartAsk, topicOfAsk, partsLine, partsContentAllowed } from "./fold-chat-split.js";
import { expandAskAbbreviations } from "./fold-chat-frame.js";

// ── the splitter ─────────────────────────────────────────────────────────────
test("a compound slot ask splits into parts in question order, the later part depending on the earlier", () => {
  const p = splitSlotParts("Who is the US president and where was he born?");
  assert.equal(p.length, 2);
  assert.equal(p[0].ask, "Who is the US president");
  assert.equal(p[1].ask, "where was he born", "the trailing interrogative is stripped from the clause");
  assert.equal(p[1].dependsOn, 0);
});

test("one slot is NOT a split — the single one shot runs exactly as before", () => {
  assert.equal(splitSlotParts("Who is the US president?"), null);
  assert.equal(splitSlotParts("What is the capital of Australia?"), null);
});

test("an 'and' WITHOUT its own wh-word is NOT a new part ('…and the capital is Canberra' rides the first slot)", () => {
  assert.equal(splitSlotParts("What is the capital of Australia and its largest city?"), null);
});

test("a NON-SLOT clause ('…and why is that?') is marked, never dropped and never treated as a slot", () => {
  const p = splitSlotParts("Who is the US president and why is that important?");
  assert.equal(p.length, 2);
  assert.equal(p[1].nonSlot, true);
});

test("a clause that names its own subject binds nothing ('where was Donald Trump born')", () => {
  const p = splitSlotParts("Who is the US president and where was Donald Trump born?");
  assert.equal(p[1].dependsOn, null);
});

test("more than the declared part ceiling is not compound machinery", () => {
  assert.equal(splitSlotParts("Who is A and who is B and who is C and who is D and who is E?"), null);
});

// ── omnilingual (declared tables; no case logic; no language = no split) ────
test("the compound splits in French, Spanish, German and Russian by their own declared connectors and anaphors", () => {
  const fr = splitSlotParts("Qui est le roi du Royaume-Uni et où est-il né ?", { lang: "fr" });
  assert.equal(fr.length, 2);
  assert.equal(fr[1].dependsOn, 0, "il est anaphorique");
  const es = splitSlotParts("¿Quién es el presidente de los Estados Unidos y quién fue su predecesor?", { lang: "es" });
  assert.equal(es.length, 2);
  assert.equal(es[1].dependsOn, 0, "su es posesivo");
  const de = splitSlotParts("Wer ist der Präsident der USA und wo wurde er geboren?", { lang: "de" });
  assert.equal(de.length, 2);
  assert.equal(de[1].dependsOn, 0);
  const ru = splitSlotParts("Кто президент США и где он родился?", { lang: "ru" });
  assert.equal(ru.length, 2);
  assert.equal(ru[1].dependsOn, 0);
});

test("FALSIFIER: a language with no declared table is NOT split (the single one shot runs; its own typed gaps still stand)", () => {
  assert.equal(splitSlotParts("Kto jest prezydentem USA i gdzie się urodził?", { lang: "pl" }), null);
  assert.equal(splitSlotParts("missä hän syntyi", { lang: "fi" }), null);
  assert.equal(splitSlotParts(undefined, { lang: "en" }), null);
});

test("FALSIFIER: an own-named clause never binds an earlier part, in any declared language", () => {
  const fr = splitSlotParts("Qui est le roi du Royaume-Uni et où est né Charles III ?", { lang: "fr" });
  assert.equal(fr[1].dependsOn, null, "Charles III names itself");
  const es = splitSlotParts("Quién es el presidente y dónde nació Donald Trump?", { lang: "es" });
  assert.equal(es[1].dependsOn, null);
});

test("a property anaphor binds the real referent: part-1 receipts carry the frame ('capital of Australia' case bends on the REFERENT title)", () => {
  assert.equal(bindPartAsk({ ask: "where is it?", dependsOn: 0 }, { filler: "Canberra", referent: "Australia", topic: "capital of Australia" }, "en"), "where is Australia?", "the binder preserves its own token's mark");
  assert.equal(bindPartAsk({ ask: "où se trouve-t-il ?", dependsOn: 0 }, { filler: "Paris", referent: "France", topic: "capitale de la France" }, "fr"), "où se trouve-t-il ?", "an anaphor outside the declared set is left for the part's own frame");
  assert.equal(bindPartAsk({ ask: "où est cela ?", dependsOn: 0 }, { filler: "Paris", referent: "France", topic: "x" }, "fr"), "où est France ?", "fr property anaphor binds the referent");
});

// ── the binder ───────────────────────────────────────────────────────────────
test("a person pronoun binds the earlier part's FILLER; a possessive keeps its apostrophe; a property anaphor binds the real REFERENT (title), topic only as fallback", () => {
  assert.equal(bindPartAsk({ ask: "who is his wife", dependsOn: 0 }, { filler: "Charles III", referent: "United Kingdom", topic: "king of the uk" }), "who is Charles III's wife");
  assert.equal(bindPartAsk({ ask: "where was he born", dependsOn: 0 }, { filler: "Donald Trump", referent: "United States", topic: "the us president" }), "where was Donald Trump born");
  assert.equal(bindPartAsk({ ask: "where is it?", dependsOn: 0 }, { filler: "Canberra", referent: "Australia", topic: "capital of Australia" }), "where is Australia?", "the REAL referent title wins over the topic");
});

test("FALSIFIER: a part with no dependency is NEVER rewritten by the binder", () => {
  assert.equal(bindPartAsk({ ask: "where was he born?", dependsOn: null }, { filler: "Donald Trump", topic: "x" }), "where was he born?");
});

test("the topic of an ask is its content tail, mechanically cut", () => {
  assert.equal(topicOfAsk("what is the capital of Australia"), "capital of Australia");
  assert.equal(topicOfAsk("who is the US president"), "US president");
});

// ── the ask-side abbreviation expansion ──────────────────────────────────────
test("'the US president' expands so the frame can bind the country ('us' is a function word)", () => {
  assert.equal(expandAskAbbreviations("Who is the US president?"), "Who is the United States president?");
  assert.equal(expandAskAbbreviations("what is the capital of the us"), "what is the capital of the United States");
});

test("FALSIFIER: expansion never corrupts a non-ask, a verbed 'us', or a bare statement", () => {
  assert.equal(expandAskAbbreviations("tell us who is the president?"), "tell us who is the president?", "verb-guarded, byte-preserved");
  assert.equal(expandAskAbbreviations("The US is big."), "The US is big.");
  assert.equal(expandAskAbbreviations("us"), "us");
});

// ── the stored-parts invariant ───────────────────────────────────────────────
const R = (text, rowSentence) => ({ answer: { text, row: { sentence: rowSentence || text, source: { title: "T", url: "https://e.org/p" } } } });
const both = () => ({ parts: [R("Donald Trump is the president of the United States."), R("Donald Trump was born in Queens.")] });

test("the join is the deterministic order of the answered parts; gaps contribute no line", () => {
  assert.equal(partsLine(both().parts), "Donald Trump is the president of the United States.\n\nDonald Trump was born in Queens.");
  assert.equal(partsLine([{ ...both().parts[0] }, { gap: { kind: "x" } }]), "Donald Trump is the president of the United States.");
  assert.equal(partsLine([]), "");
});

test("partsContentAllowed: the content IS the join and every line is its own part's source sentence", () => {
  const t = both();
  assert.equal(partsContentAllowed(t, partsLine(t.parts)), true);
});

test("FALSIFIERS: a tampered line, an off-sentence word, or content that is not the join are REFUSED", () => {
  const t = both();
  const join = partsLine(t.parts);
  assert.equal(partsContentAllowed(t, join + "\n\nImagined by a model."), false, "an extra line is refused");
  assert.equal(partsContentAllowed({ parts: [{ ...t.parts[0], answer: { ...t.parts[0].answer, text: "Donald Trump is the emperor of Mars." } }, t.parts[1]] }, join), false, "a word the source lacks is refused");
  assert.equal(partsContentAllowed(t, join.replace("Queens", "Mars")), false, "content that is not the join is refused");
  assert.equal(partsContentAllowed(t, "not the join at all"), false);
  assert.equal(partsContentAllowed({ parts: [] }, join), false);
  assert.equal(partsContentAllowed(null, join), false);
  const line2 = t.parts[1];
  assert.equal(partsContentAllowed({ parts: [{ ...line2, answer: { ...line2.answer, row: null } }] }, partsLine([line2])), false, "an answer with no source sentence is refused");
});