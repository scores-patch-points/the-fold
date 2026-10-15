// node --test fold-chat-anaphora-classes.test.mjs — the English `wh` class of fold-chat-anaphora.js is DERIVED from UD PronType=Int|Rel.
import test from "node:test";
import assert from "node:assert/strict";
import { deriveWh } from "./scripts/gen-anaphora-classes.mjs";
import { ANAPHORA_DERIVED } from "./fold-chat-anaphora-classes.js";
import { anaphoraOf, classesOf } from "./fold-chat-anaphora.js";

// what the typed list was (a TEST INPUT: the derivation must cover it; extras are allowed and listed below)
const OLD_EN_WH = "who whom whose which what when where why how".split(" ");

const f = (n, up, intRel) => ({ n, up, intRel });
function claims(derive) {
  const got = derive({ forms: {
    who: f(354, { PRON: 354 }, 354), why: f(65, { ADV: 65 }, 65), which: f(10, { DET: 10 }, 9),
    that: f(2036, { SCONJ: 994, PRON: 851, DET: 176 }, 556),          // SCONJ dominates: not a wh word
    this: f(1148, { DET: 711, PRON: 431 }, 40),                        // pronominal, but Int|Rel is a small minority of its uses
    were: f(397, { AUX: 397 }, 397),                                  // AUX is not pronominal/adverbial, whatever its feature
    wtf: f(1, { PRON: 1 }, 1),                                        // a hapax
    cat: f(50, { NOUN: 50 }, 0),
  } });
  assert.deepEqual(got, ["which", "who", "why"]);
}

test("the rule: dominant UPOS PRON|ADV|DET|ADJ and a majority of Int|Rel; hapaxes and other parts of speech are out", () => claims(deriveWh));

test("the committed English wh covers every word the typed list had; the extras are listed", () => {
  const en = ANAPHORA_DERIVED.en.wh;
  assert.deepEqual(OLD_EN_WH.filter((w) => !en.includes(w)), [], "recall 10/10 of the typed list");
  assert.deepEqual(en.filter((w) => !OLD_EN_WH.includes(w)).sort(), ["whatever", "whenever", "wherever"]);
  assert.deepEqual([...classesOf("en").wh].sort(), [...en].sort(), "the class the gate reads IS the derived one");
});

test("behaviour is unchanged: a connective followed by a question word opens a clause of its own", () => {
  assert.equal(anaphoraOf("and who painted the Mona Lisa", { lang: "en" }).carry, false);
  assert.equal(anaphoraOf("then who was king?", { lang: "en" }).carry, false);
  assert.equal(anaphoraOf("so what is dna", { lang: "en" }).carry, false);
  assert.equal(anaphoraOf("and in 1999", { lang: "en" }).carry, true);
});

test("es and fr stay declared (their treebank questions are sparse): their classes are not the derived ones", () => {
  assert.ok(classesOf("es").wh.has("cómo") && classesOf("fr").wh.has("quand"), "declared forms the UD rule would miss are still read");
  assert.ok(!ANAPHORA_DERIVED.es.wh.includes("cómo") && !ANAPHORA_DERIVED.fr.wh.includes("quand"));
});

test("MUTATION: dropping the Int|Rel majority test or the UPOS test breaks the rule's claims", () => {
  const noMajority = (s) => deriveWh({ forms: Object.fromEntries(Object.entries(s.forms).map(([w, x]) => [w, { ...x, intRel: x.n }])) });
  assert.throws(() => claims(noMajority));
  const noUpos = (s) => deriveWh({ forms: Object.fromEntries(Object.entries(s.forms).map(([w, x]) => [w, { ...x, up: { PRON: x.n } }])) });
  assert.throws(() => claims(noUpos));
  assert.doesNotThrow(() => claims(deriveWh));
});
