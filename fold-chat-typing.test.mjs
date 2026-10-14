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

test("a misspelled NAME no lexicon knows takes the encyclopedia's own spelling — only at out-of-lexicon words, confirmed by the exact title door", async () => {
  // the live suggestion observed 2026-10-13 (en.wikipedia list=search&srinfo=suggestion): "Where was Mzoart born" → "where was mozart born"
  const calls = [];
  const suggestQuery = async (q) => { calls.push(q); return /mzoart/i.test(q) ? "where was mozart born" : /ciare/i.test(q) ? "where is le ciara" : null; };
  const T = { mozart: "Wolfgang Amadeus Mozart", "le caire": "Le Caire" };
  const f = await askFrame("Where was Mzoart born?", { fw, lang: "en", resolveTitles: door(T), suggestQuery });
  assert.equal(f.ok, true);
  assert.deepEqual(f.referents.map((r) => r.title), ["Wolfgang Amadeus Mozart"]);
  assert.ok(f.readAs.some((c) => c.typed === "Mzoart" && c.read === "mozart" && c.how === "suggested"), JSON.stringify(f.readAs));
  assert.equal(f.said, "Where was Mzoart born?");
  // FALSIFIER: a suggestion the exact title door does not confirm ("le ciara") changes nothing — the ask stays as typed
  const g = await askFrame("Where is Le Ciare?", { fw, lang: "en", resolveTitles: door(T), suggestQuery });
  assert.ok(!g.ok || !(g.readAs || []).some((c) => c.how === "suggested"), JSON.stringify(g.readAs));
  // an ask that resolves as typed never asks for a suggestion (no extra request)
  const n0 = calls.length;
  await askFrame("Where was Mozart born?", { fw, lang: "en", resolveTitles: door(T), suggestQuery });
  assert.equal(calls.length, n0);
});
