// fold-chat-salience-infer.test.mjs — the salience inference, falsified: where the real prior works, where it breaks.
import test from "node:test";
import assert from "node:assert/strict";
import { salienceOf, isName, salientTerms, rankBySalience } from "./fold-chat-salience-infer.js";

test("salience is read from the real POSPrior: names high, content middle, function absent", () => {
  assert.equal(salienceOf("france"), 1);            // PROPN 22/22
  assert.equal(salienceOf("nashville"), 1);
  assert.ok(Math.abs(salienceOf("president") - 8 / 9) < 1e-9);   // PROPN 57 / NOUN 32
  assert.ok(salienceOf("founded") < salienceOf("president"));    // VERB below a name
  assert.equal(salienceOf("the"), null);            // DET: absent from the prior, never a salience
  assert.equal(salienceOf("who"), null);            // PRON
  assert.equal(salienceOf("is"), null);             // AUX
});

test("isName: the prior's own verdict, no hand-typed list", () => {
  assert.equal(isName("nashville"), true);
  assert.equal(isName("president"), true);          // treebank: PROPN more than NOUN
  assert.equal(isName("band"), false);              // NOUN
  assert.equal(isName("founded"), false);           // VERB
});

test("WORKS: 'Who is the president?' -> the ask's matter is 'president', with NO hand-typed FRAME list", () => {
  const { terms, measured, unmeasured } = salientTerms("Who is the president?");
  assert.equal(measured, true);
  assert.deepEqual(terms.map((t) => t.form), ["president"]);
  assert.deepEqual(unmeasured, []);                 // who/the/is are known function words, not "unmeasured"
});

test("WORKS: a named+scoped ask ranks the right page first by prior salience", () => {
  const ask = "Who is the president of France?";
  const cands = [
    { title: "President (band)", snippet: "an anonymous English alternative metal band" },
    { title: "List of actors who have played the president of the United States", snippet: "a list" },
    { title: "President of France", snippet: "The president of France is the head of state." },
  ];
  const { ranked, scores, measured } = rankBySalience(cands, ask);
  assert.equal(measured, true);
  assert.equal(ranked[0].title, "President of France");   // france (1.0) beats the others
  assert.ok(scores[0] > scores[1]);
});

test("BREAKS: a bare-term ask cannot be disambiguated by salience — every candidate ties", () => {
  const ask = "Who is the president?";
  const cands = [
    { title: "President (band)", snippet: "a band" },
    { title: "List of actors who have played the president of the United States", snippet: "a list" },
    { title: "List of presidents of the United States", snippet: "The incumbent president is ..." },
  ];
  const { scores, terms } = rankBySalience(cands, ask);
  assert.deepEqual(terms.map((t) => t.form), ["president"]);
  assert.equal(new Set(scores).size, 1);            // all equal: the prior alone cannot pick a sense
});

test("BREAKS: a name the prior never saw is UNMEASURED, not guessed", () => {
  const { terms, unmeasured } = salientTerms("Who is Ada Lovelace?");
  assert.ok(terms.some((t) => t.form === "ada"));    // 'ada' is in the treebank (NOUN)
  assert.ok(unmeasured.includes("lovelace"));        // the actual subject is OOV -> disclosed, not dropped
  assert.ok(!terms.some((t) => t.form === "lovelace"));   // never claimed as a measured term
});

test("FALSIFIER: without the prior, the old content/function split needs the hand-typed FRAME; the prior needs no list", () => {
  // The prior already reads the interrogatives and determiners as non-salient, so a function-word
  // ("how", "the", "did") is never listed as an ask's matter, with NO FRAME membership test.
  const { terms } = salientTerms("How did the band form?");
  const forms = terms.map((t) => t.form);
  assert.ok(forms.includes("band") && forms.includes("form"));   // both are content (NOUN/VERB)
  for (const fn of ["how", "did", "the"]) assert.ok(!forms.includes(fn), fn + " must not be salient");
});

test("IDENTITY (referent-first 2026-10-11): unmeasured forms are exposed as candidate referent surfaces, still not salience terms", () => {
  const r = salientTerms("Make my login code better with PyQt5");
  assert.ok(!r.terms.some((t) => t.form === "pyqt5"), "still UNMEASURED, never guessed as salience");
  assert.ok(r.identity.includes("pyqt5"), "but present as an identity surface to resolve by identity");
  assert.deepEqual(r.identity, r.unmeasured);
});

test("IDENTITY: a title bearing the ask's unresolved referent outranks generic salience matches", () => {
  const ask = "Make my login code better with PyQt5";
  const cands = [
    { title: "HTML login forms", snippet: "make a login code form" },
    { title: "PyQt5 login dialog", snippet: "a dialog" },
  ];
  const { ranked, identityHits, measured } = rankBySalience(cands, ask);
  assert.equal(ranked[0].title, "PyQt5 login dialog");   // the referent decides, not login/code/make
  assert.equal(identityHits[0].title, 1);
  assert.equal(identityHits[1].title, 0);
  assert.ok(measured, "measured stays true (login/code measured); identity only orders");
});

test("IDENTITY: measured:false still orders by identity — no prior coverage is never a refusal", () => {
  const cands = [
    { title: "Unrelated page", snippet: "nothing" },
    { title: "Xylophonia", snippet: "a thing" },
  ];
  const r = rankBySalience(cands, "Xylophonia?");
  assert.equal(r.measured, false, "the prior covers nothing: honestly disclosed");
  assert.deepEqual(r.identity, ["xylophonia"]);
  assert.equal(r.ranked[0].title, "Xylophonia", "resolved by identity anyway");
});
