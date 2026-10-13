// fold-chat-typing.test.mjs — falsifiers for SURVIVE TYPING (fold-chat-typing.js; eval/omnilingual/PREREG.md §Version 4).
import test from "node:test";
import assert from "node:assert/strict";
import { readingOf } from "./fold-chat-typing.js";
import { askFrame } from "./fold-chat-frame.js";
import { functionWordsOf } from "./fold-chat-snippets.js";

const fw = functionWordsOf("en");
const read = (q) => readingOf(q, "en", { fw });
const door = (T) => async (xs) => new Map(xs.map((x) => { const t = T[String(x).toLowerCase()]; return [x, t ? { title: t, redirectedFrom: null, disambiguation: false } : null]; }));

test("leetspeak is decoded only in tokens that mix letters and digits; a number is never touched", () => {
  assert.equal(read("Wh3r3 was M0z4rt b0rn?").text, "Where was Mozart born?");
  assert.equal(read("When was Mozart born in 1756?").text, "When was Mozart born in 1756?");
  assert.equal(read("What is 1,082 plus 3?").changes.length, 0);
});

test("a typo is read as its UNIQUE one-edit neighbour in the received lexicon; a transposition is asked first", () => {
  assert.equal(read("Who dsicovered penicillin?").text, "Who discovered penicillin?");
  assert.equal(read("Wehre is the Taj Mahal?").text.startsWith("Where"), true, "a transposition keeps every typed letter: 'where', not 'were'");
  assert.equal(read("Who is the king of the United Knigdom?").text, "Who is the king of the United Kingdom?");
});

test("FALSIFIER: a word in the lexicon, or a name no lexicon knows, is never 'corrected'", () => {
  assert.equal(read("Where was Zelda born?").changes.length, 0, "a real name the lexicon does not know stays itself");
  assert.equal(read("Who wrote Hamlet?").changes.length, 0);
});

test("askFrame keeps what the person typed, discloses every reading, and a resolved name is protected", async () => {
  const f = await askFrame("Wh3r3 was M0z4rt b0rn?", { fw, lang: "en", resolveTitles: door({ mozart: "Wolfgang Amadeus Mozart" }) });
  assert.equal(f.ok, true);
  assert.equal(f.said, "Wh3r3 was M0z4rt b0rn?", "the person's words are never rewritten");
  assert.ok(Array.isArray(f.readAs) && f.readAs.some((c) => c.typed === "M0z4rt" && c.read === "Mozart"));
  assert.deepEqual(f.referents.map((r) => r.title), ["Wolfgang Amadeus Mozart"]);
  // a name the door resolves as typed is never touched by the second reading
  const z = await askFrame("Where was Zelda born?", { fw, lang: "en", resolveTitles: door({ zelda: "Zelda (name)" }) });
  assert.equal(z.readAs, undefined);
  // an ask that frames cleanly with nothing to read differently is returned exactly as before (additive)
  const clean = await askFrame("Where was Mozart born?", { fw, lang: "en", resolveTitles: door({ mozart: "Wolfgang Amadeus Mozart" }) });
  assert.equal(clean.readAs, undefined);
});
