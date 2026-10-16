// node --test fold-chat-pronoun-gender.test.mjs — CASTS.pronounGender is DERIVED from UD FEATS (scripts/gen-pronoun-gender.mjs), not typed.
import test from "node:test";
import assert from "node:assert/strict";
import { deriveGender } from "./scripts/gen-pronoun-gender.mjs";
import { PRONOUN_GENDER } from "./fold-chat-pronoun-gender.js";
import { CASTS, pronounOf } from "./fold-chat-casts.js";

// the table the hand-typed list was (a TEST INPUT: what the derivation must reproduce, not a system list)
const OLD = { he: "p", him: "p", his: "p", she: "p", her: "p", hers: "p", it: "n", its: "n" };

const pr = (n, o = {}) => ({ n, up: { PRON: n }, masc: 0, fem: 0, neut: 0, prsPerson3: n, reflex: 0, ...o });
const stats = (agree, forms) => ({ agree: { det: 100, detG: 0, adj: 100, adjG: 0, ...agree }, forms });

// the claims about the rule, written once so a broken derivation can be run through the same assertions
function claims(derive) {
  // natural gender: Masc/Fem -> p, Neut -> n
  const nat = derive(stats({}, { he: pr(50, { masc: 50 }), she: pr(40, { fem: 40 }), it: pr(90, { neut: 90 }), they: pr(60) }));
  assert.equal(nat.natural, true);
  assert.deepEqual(nat.forms, { he: "p", she: "p", it: "n" }, "no gender feature -> not listed (they)");
  // reflexive, hapax, non-dominant PRON and non-personal forms are not listed
  const neg = derive(stats({}, {
    himself: pr(10, { masc: 10, reflex: 10 }), zed: pr(1, { masc: 1 }),
    that: { n: 100, up: { SCONJ: 60, PRON: 40 }, masc: 0, fem: 0, neut: 40, prsPerson3: 0, reflex: 0 },
    lo: { n: 20, up: { PRON: 20 }, masc: 20, fem: 0, neut: 0, prsPerson3: 0, reflex: 0 },
  }));
  assert.deepEqual(neg.forms, {});
  // grammatical gender (a determiner agrees): the language contributes nothing, however gendered its pronouns
  const gram = derive(stats({ detG: 80, adjG: 40 }, { él: pr(150, { masc: 150 }), ella: pr(140, { fem: 140 }), ello: pr(80, { neut: 80 }) }));
  assert.equal(gram.natural, false);
  assert.deepEqual(gram.forms, {}, "grammatical gender says nothing about animacy");
}

test("the rule: natural gender -> person/thing; grammatical gender -> no table; reflexives, hapaxes and non-pronoun uses are out", () => claims(deriveGender));

test("the committed table reproduces the hand-typed one exactly, and only English is natural-gender among the treebanks", () => {
  assert.deepEqual(PRONOUN_GENDER.en.forms, OLD);
  assert.deepEqual(Object.keys(PRONOUN_GENDER), ["en"], "es fr de pt ca it pl ar he hi … are grammatical-gender: no filter");
  assert.deepEqual({ ...CASTS.pronounGender }, OLD);
});

test("pronounOf: he/she/it behave as before; a grammatical-gender pronoun is still not gendered", () => {
  const g = { kind: "pronoun" };
  assert.equal(pronounOf("say more about him losing the election", g), "him");
  assert.equal(pronounOf("what about it", g), "it");
  assert.equal(pronounOf("what did she discover", g), "she");
  for (const q of ["cuéntame más sobre él", "erzähl mehr darüber, wie er verlor", "parle-moi d'elle"]) assert.equal(pronounOf(q, g), null, q);
  assert.equal(pronounOf("say more about him", { kind: "standalone" }), null);
});

test("MUTATION: a derivation that ignores agreement (every language natural) or ignores PRON-dominance fails the rule's own claims", () => {
  const ignoreAgreement = (s) => deriveGender({ ...s, agree: { det: 0, detG: 0, adj: 0, adjG: 0 } });
  assert.throws(() => claims(ignoreAgreement), /grammatical gender|natural|deepEqual|Expected/i);
  const ignoreDominance = (s) => deriveGender({ ...s, forms: Object.fromEntries(Object.entries(s.forms).map(([w, f]) => [w, { ...f, up: { PRON: f.n }, prsPerson3: f.n }])) });
  assert.throws(() => claims(ignoreDominance));
  assert.doesNotThrow(() => claims(deriveGender));
});
