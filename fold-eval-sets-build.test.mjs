// fold-eval-sets-build.test.mjs — the English-set builder: the quote is taken from the page, never guessed; an absent
// answer is reported; a 429 is waited out, never read as "no such page". The network is stubbed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { takeQuote, sentencesOf, build, fetchPlain } from "./eval/sets/build-from-wikipedia.mjs";
import { verifyQuotes } from "./eval/sets/verify-quotes.mjs";

const PAGES = {
  "Mount Example": "Mount Example is a mountain in Nowhere. Its summit stands at 4,321 m above sea level.\n\n== History ==\nIt was first climbed in 1901 by a party of three.",
  "Quark": "A quark is an elementary particle. There are six flavours of quark. Quarks combine into hadrons.",
};
const api = (pages, { limited = 0 } = {}) => {
  let n = 0;
  return async (url) => {
    const title = decodeURIComponent(new URL(url).searchParams.get("titles"));
    if (n++ < limited) return { ok: false, status: 429, headers: { get: () => "0" }, json: async () => ({}) };
    const t = pages[title];
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ query: { pages: { 1: t ? { title, extract: t } : { title, missing: "" } } } }) };
  };
};

test("sentencesOf: a heading is not a sentence, a single line break is a space, and an abbreviation or initial does not end one", () => {
  assert.deepEqual(sentencesOf(PAGES["Mount Example"]), ["Mount Example is a mountain in Nowhere.", "Its summit stands at 4,321 m above sea level.", "It was first climbed in 1901 by a party of three."]);
  assert.deepEqual(sentencesOf("Kemal Atat\u00fcrk (c. 19 May 1881 \u2013 10 November 1938) was a leader. He met Mr. Smith and J. S. Bach at St. Peter's."),
    ["Kemal Atat\u00fcrk (c. 19 May 1881 \u2013 10 November 1938) was a leader.", "He met Mr. Smith and J. S. Bach at St. Peter's."]);
  assert.deepEqual(sentencesOf("A person (born 1900;\n31 July 1944) was a writer.\n\n=== Apple story ===\nThe apple fell."), ["A person (born 1900; 31 July 1944) was a writer.", "The apple fell."]);
});

test("sentencesOf survives a boundary with nothing before it, an empty text and a lone full stop", () => {
  assert.deepEqual(sentencesOf(""), []);
  assert.deepEqual(sentencesOf(". Hello there. Next one."), [".", "Hello there.", "Next one."]);
  assert.deepEqual(sentencesOf("."), ["."]);
});

test("takeQuote returns the FIRST sentence with the answer, verbatim, case-insensitively matched; none when absent", () => {
  assert.equal(takeQuote(PAGES["Quark"], { answers: ["six flavours"] }).quote, "There are six flavours of quark.");
  assert.equal(takeQuote(PAGES["Quark"], { answers: ["QUARKS"] }).quote, "Quarks combine into hadrons.");
  assert.equal(takeQuote(PAGES["Quark"], { answers: ["seven"] }), null);
  assert.equal(takeQuote(PAGES["Quark"], { answers: ["quark"], with: "elementary" }).quote, "A quark is an elementary particle.");
  assert.equal(takeQuote("x ".repeat(400) + ".", { answers: ["x"] }).tooLong > 500, true);
});

test("build: a quote contains its answer by construction; an answer the page lacks is reported, never guessed", async () => {
  const seeds = [
    { part: "factual", title: "Mount Example", ask: "How high is Mount Example?", answers: ["4,321"] },
    { part: "factual", title: "Mount Example", ask: "What colour is Mount Example?", answers: ["purple"] },
    { part: "factual", title: "No Such Page", ask: "?", answers: ["x"] },
    { part: "trap", title: "Quark", ask: "How many colours of quark are there in the last row?", flag: "false-premise" },
  ];
  const { set, absent } = await build(seeds, { lang: "en", fetchImpl: api(PAGES) });
  assert.equal(set.items.length, 1);
  assert.equal(set.items[0].id, "en-factual-01");
  assert.equal(set.items[0].gold.source.quote, "Its summit stands at 4,321 m above sea level.");
  assert.ok(set.items[0].gold.source.quote.includes(set.items[0].gold.answers[0]));
  assert.deepEqual(absent.map((a) => a.why), ["no sentence on the page has the answer", "no such page", "a trap seed needs `with`, the phrase that shows the truth"]);
  assert.match(set.labeledBy, /not yet reviewed by a second labeler/);
});

test("build: an entity seed whose native-script name is not on the page is refused", async () => {
  const seeds = [{ part: "entity", title: "Quark", ask: "?", answers: ["quark"], keep: ["Quärk"] }];
  const { set, absent } = await build(seeds, { lang: "en", fetchImpl: api(PAGES) });
  assert.equal(set.items.length, 0);
  assert.match(absent[0].why, /name to keep/);
});

test("fetchPlain waits out a 429 and then succeeds; a persistent 429 is an error, not 'no such page'", async () => {
  const slept = [];
  const ok = await fetchPlain("Quark", "en", api(PAGES, { limited: 2 }), { sleepImpl: async (ms) => slept.push(ms) });
  assert.equal(ok.title, "Quark");
  assert.equal(slept.length, 2);
  await assert.rejects(() => fetchPlain("Quark", "en", api(PAGES, { limited: 99 }), { retries: 2, sleepImpl: async () => {} }), /HTTP 429/);
});

test("verifyQuotes: a present quote passes; an edited quote and a missing page are named", async () => {
  const set = { lang: "en", items: [
    { id: "a", gold: { source: { title: "Quark", quote: "There are six flavours of quark." } } },
    { id: "b", gold: { source: { title: "Quark", quote: "There are seven flavours of quark." } } },
    { id: "c", gold: { source: { title: "Gone", quote: "x" } } },
    { id: "d", gold: {} },
  ] };
  const bad = await verifyQuotes(set, { fetchImpl: api(PAGES) });
  assert.deepEqual(bad, ['b: the quote is not on "Quark"', 'c: the page "Gone" does not exist', "d: no gold source"]);
});
