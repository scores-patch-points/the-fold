// fold-chat-licence.test.mjs — English held-out gate, 2026-10-13: contests between sources that AGREE. A junk filler counted as a rival
// (the kind word "city", the pronoun "These"), and a sentence about something else counted as a negation. The fixes are language-general
// (closed-class table, the language's own POS prior, the declared place nouns); each is pinned by the live shape that exposed it.
import test from "node:test";
import assert from "node:assert/strict";
import { runAnswerTurn, makeLicense, setAsideJunk } from "./fold-chat-answerturn.js";
import { functionWordsOf } from "./fold-chat-snippets.js";

const FW = functionWordsOf("en");
const titles = (m) => async (cands) => new Map(cands.map((x) => [x, m[String(x).toLowerCase()] ? { title: m[String(x).toLowerCase()], redirectedFrom: null, disambiguation: false } : null]));
const P = (title, text, host = "example.org") => ({ ref: "S", title, url: "https://" + host + "/" + title.replace(/ /g, "_"), host, lang: "en", text });
const turnOf = (ask, t, passages) => runAnswerTurn({ question: ask, lang: "en", passages, now: { year: 2026 }, deps: { fw: FW, resolveTitles: titles(t), fetchLead: async () => null, searchPassages: async () => [] } });
const say = (turn) => turn.trace.map((l) => l.say).join("\n");

test("LIVE Kenya: 'city' (a page of its own) is a kind of place, not a second capital — Nairobi stands, and the set-aside is said", async () => {
  const turn = await turnOf("What is the capital of Kenya?", { kenya: "Kenya", nairobi: "Nairobi", city: "City" }, [
    P("What Is The Capital Of Kenya? - WorldAtlas", "Nairobi is the capital of Kenya."),
    P("Kenya - mappr", "Nairobi, the most populous city of Kenya and the country’s established hub for business and culture, is the capital city.")]);
  assert.equal(turn.answer && turn.answer.filler.text, "Nairobi", JSON.stringify({ contest: turn.contest, gap: turn.gap }));
  assert.deepEqual(turn.contest, []);
  assert.match(say(turn), /set aside “city”/i, say(turn));
});

test("LIVE Japan: a sentence about 'These' that cannot be used in Japan says no word of 'currency' — it is not a negation of the yen", async () => {
  const turn = await turnOf("What currency is used in Japan?", { japan: "Japan", yen: "Japanese yen" }, [
    P("Japanese yen", "The yen (Japanese: 円; symbol: ¥; code: JPY) is the official currency of Japan.", "en.wikipedia.org"),
    P("Japan vacation", "These must remain sealed in a special tax-free bag and cannot be opened or used inside Japan before departure.")]);
  assert.equal(turn.answer && turn.answer.filler.text, "yen", JSON.stringify({ contest: turn.contest.map((r) => r.filler), gap: turn.gap }));
});

test("LIVE Washington: 'was unanimously elected the first president' binds the SUBJECT, not the adverb — never John Hanson by default", async () => {
  const turn = await turnOf("Who was the first president of the United States?",
    { "united states": "United States", "george washington": "George Washington", "john hanson": "John Hanson" }, [
      P("Before the White House", "After leading the Continental Army to victory in the Revolutionary War, George Washington was unanimously elected the first president of the United States in 1789."),
      P("John Hanson", "John Hanson was the first to serve in a position called President of the United States in Congress Assembled.", "en.wikipedia.org")]);
  const names = [turn.answer && turn.answer.filler.text, ...turn.contest.map((r) => r.filler && r.filler.text)];
  assert.ok(names.includes("George Washington"), JSON.stringify(names));
  assert.notEqual(turn.answer && turn.answer.filler.text, "John Hanson", "a confident wrong answer from a mis-bound row");
});

test("makeLicense: single-token closed class, numeral, adverb and kind-of-place noun are set aside; a title that BEGINS with 'The' is not", () => {
  const lic = (slot) => makeLicense({ slot }, "en", FW);
  assert.equal(lic("thing")("These"), "closed");
  assert.equal(lic("person")("it"), "closed");
  assert.equal(lic("person")("The Who"), null, "two tokens: a title, not a function word");
  assert.equal(lic("place")("4"), "numeral");
  assert.equal(lic("person")("unanimously"), "adverb");
  assert.equal(lic("place")("city"), "kind");
  assert.equal(lic("thing")("city"), null, "a thing ask may be answered by a common noun");
  assert.equal(lic("thing")("yen"), null);
  assert.equal(lic("place")("Nairobi"), null);
  // "What is the capital of Kenya?" has slot THING: the place is asked by the relation word "capital"
  assert.equal(makeLicense({ slot: "thing", predicate: [{ surface: "capital", stem: "capital" }] }, "en", FW)("city"), "kind");
});

test("makeLicense: a quantity ask keeps 'no' and numerals — 'Venus has no moons' and '4,700' are answers", () => {
  const lic = makeLicense({ slot: "quantity" }, "en", FW);
  assert.equal(lic("no"), null);
  assert.equal(lic("none"), null);
  assert.equal(lic("4"), null);
  assert.equal(lic("seven"), null);
});

test("GUARD setAsideJunk: junk is set aside only when a row at least as strong survives — a STRONGER junk row is never allowed to leave a weaker one to be committed", () => {
  const e = (name, b) => ({ row: { filler: { text: name } }, b });
  const junk = (name) => name === "unanimously" || name === "city";
  // survivor stronger → junk dropped
  let r = setAsideJunk([e("Nairobi", [2, 1, 1, 0]), e("city", [1, 1, 0, 0])], junk);
  assert.equal(r.applied, true);
  assert.deepEqual(r.kept.map((x) => x.row.filler.text), ["Nairobi"]);
  assert.deepEqual(r.set.map((x) => x.row.filler.text), ["city"]);
  // equal bearing → still dropped (a name beats a kind word on equal evidence)
  r = setAsideJunk([e("Nairobi", [1, 1, 1, 0]), e("city", [1, 1, 1, 0])], junk);
  assert.equal(r.applied, true);
  // junk STRONGER than the survivor → nothing changes
  r = setAsideJunk([e("unanimously", [3, 2, 1, 0]), e("John Hanson", [1, 1, 0, 0])], junk);
  assert.equal(r.applied, false);
  assert.equal(r.kept.length, 2);
  // nothing survives → nothing changes
  r = setAsideJunk([e("city", [1, 1, 0, 0])], junk);
  assert.equal(r.applied, false);
  // no junk → untouched
  r = setAsideJunk([e("Nairobi", [1, 0, 0, 0])], junk);
  assert.equal(r.applied, false);
});
