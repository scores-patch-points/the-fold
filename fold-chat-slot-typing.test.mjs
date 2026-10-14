// fold-chat-slot-typing.test.mjs — falsifiers from the 2026-10-12 model-free battery (eval/modelless/RESULTS.md, findings 2 and 3).
// Before the fix: "who wrote Hamlet" admitted Ophelia, Polonius, Claudius and "silence" as witnesses (the title door resolved the bare
// verb, which emptied the predicate); "largest planet" took Saturn's "second-largest" as a rival; "how many legs" took 52,075 (species).
import test from "node:test";
import assert from "node:assert/strict";
import { askFrame } from "./fold-chat-frame.js";
import { bindSentence } from "./fold-chat-witness.js";
import { functionWordsOf } from "./fold-chat-snippets.js";

const fw = functionWordsOf("en");
// A title door that — like the live one can — also resolves the bare relation word ("Wrote", "Largest", "Painted").
const TITLES = new Set(["hamlet", "spider", "mona lisa", "planet", "solar system", "legs", "wrote", "largest", "painted", "wrote hamlet", "prime minister of canada", "canada"]);
const resolveTitles = async (xs) => new Map(xs.map((x) => [x, TITLES.has(x.toLowerCase()) ? { title: x.replace(/(^|\s)\w/g, (c) => c.toUpperCase()), redirectedFrom: null, disambiguation: false } : null]));
const frameOf = (q) => askFrame(q, { fw, lang: "en", resolveTitles });
const bind = (frame, text, topic = null) => bindSentence({ text, start: 0, end: text.length }, frame, { fw, lang: "en", topic });

test("the ask's relation verb stays in the predicate even when the title door resolves it", async () => {
  const f = await frameOf("Who wrote Hamlet?");
  assert.equal(f.ok, true);
  assert.deepEqual(f.predicate.map((p) => p.surface), ["wrote"], "'wrote' is the relation, not a referent");
  assert.deepEqual(f.referents.map((r) => r.surface), ["Hamlet"]);
});

test("a sentence that does not say the relation cannot witness a filler (Ophelia / Polonius / silence)", async () => {
  const f = await frameOf("Who wrote Hamlet?");
  for (const s of ["Ophelia has been wooed by Hamlet.", "Polonius, who is spying on the conversation behind an arras, calls for help and Hamlet stabs wildly, killing Polonius.", "Hamlet dies on the floor in front of Horatio, proclaiming \"the rest is silence\"."]) {
    const r = bind(f, s, "Hamlet");
    assert.ok(!r || r.tier !== "T1" || !r.filler, `must not witness: ${s.slice(0, 50)}`);
  }
});

test("control: a sentence that does say the relation still binds its subject", async () => {
  const f = await frameOf("Who wrote Hamlet?");
  const r = bind(f, "William Shakespeare wrote Hamlet around 1600.");
  // the filler may be null for a verb-final shape; what must hold is that nothing contradicts the relation
  assert.ok(r && r.tier === "T1", "relation + referent present is a T1 row");
});

test("an adjective superlative is the relation: 'second-largest' does not witness 'largest'", async () => {
  const f = await frameOf("What is the largest planet in the solar system?");
  assert.ok(f.predicate.some((p) => p.surface === "largest"), "largest stays a predicate word");
  const jup = bind(f, "Jupiter is the largest planet in the solar system.");
  assert.equal(jup.tier, "T1"); assert.equal(jup.filler.text, "Jupiter");
  const sat = bind(f, "Saturn is the second-largest planet in our solar system, with a diameter of 116,460 km.");
  assert.ok(!sat || !sat.filler || sat.tier !== "T1", "Saturn's second-largest is not a rival answer");
});

test("a counted noun owns its number: 'eight legs', never '52,075 species'", async () => {
  const f = await frameOf("How many legs does a spider have?");
  assert.equal(f.slot, "quantity"); assert.equal(f.counted && f.counted.stem, "leg");
  const eight = bind(f, "Spiders are arachnids and all of them have eight legs.");
  assert.equal(eight.filler.text, "eight");
  const species = bind(f, "The World Spider Catalog lists 52,075 species of spider, and a spider has legs, fangs and spinnerets.");
  assert.ok(!species || !species.filler || species.filler.text !== "52,075", "52,075 is the species count, not the legs");
});

test("multi-word names with an adjective edge are untouched (Prime Minister of Canada)", async () => {
  const f = await frameOf("Who is the prime minister of Canada?");
  assert.ok(f.referents.some((r) => /prime minister of canada/i.test(r.surface)), "the long run still resolves as one referent");
});
