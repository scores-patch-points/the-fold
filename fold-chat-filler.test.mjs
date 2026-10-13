// fold-chat-filler.test.mjs — FILLER and ANCHOR discipline, from live English gate runs (2026-10-13).
//   • "Who founded Nashville?" was ANSWERED "Confederate veteran" (the Klan chapter's founder, John W. Morton): a descriptive run in front of a name
//     was settled on its longest page-confirmed PREFIX, which ends in a common noun — a description, not a name — and the sentence is about the
//     Nashville CHAPTER, not Nashville. Worse than a gap: a confident wrong answer.
//   • The same prefix rule left "English author Jane Austen" and "Capital punishment" as rivals in a contest.
// Table- and prior-driven (the language's own closed class and POS prior): no word lists. A candidate that cannot be a name is a typed gap.
import test from "node:test";
import assert from "node:assert/strict";
import { runAnswerTurn } from "./fold-chat-answerturn.js";
import { functionWordsOf } from "./fold-chat-snippets.js";

const FW = functionWordsOf("en");
// a title door that behaves like the live one: the descriptive phrase "Confederate veteran" IS a page of its own
const PAGES = {
  "confederate veteran": "Confederate States Army", nashville: "Nashville, Tennessee",
  "john w. morton": "John W. Morton", "james robertson": "James Robertson (explorer)", "alexander fleming": "Alexander Fleming",
  "jane austen": "Jane Austen", kenya: "Kenya", "kenya airways": "Kenya Airways", nairobi: "Nairobi",
};
const door = (extra = {}) => async (cands) => new Map(cands.map((x) => { const t = ({ ...PAGES, ...extra })[String(x).toLowerCase()]; return [x, t ? { title: t, redirectedFrom: null, disambiguation: false } : null]; }));
const P = (title, text, host = "en.wikipedia.org") => ({ ref: "S", title, url: "https://" + host + "/wiki/" + title.replace(/ /g, "_"), host, lang: "en", text });
const turnOf = (ask, passages, resolveTitles = door()) => runAnswerTurn({ question: ask, lang: "en", passages, now: { year: 2026 }, deps: { fw: FW, resolveTitles, fetchLead: async () => null, searchPassages: async () => [] } });
const names = (t) => [t.answer && t.answer.filler.text, ...(t.contest || []).map((r) => r.filler && r.filler.text)].filter(Boolean);

const KLAN = "In 1868, three years after the end of the Civil War, the Nashville chapter of the Ku Klux Klan was founded by Confederate veteran John W. Morton.";
const TRUE_FOUNDER = "Nashville was founded by James Robertson and a party of settlers in 1779.";

test("LIVE Klan: a sentence about the Nashville CHAPTER is not about founding Nashville — a typed gap, never 'Confederate veteran'", async () => {
  const t = await turnOf("Who founded Nashville?", [P("Nashville, Tennessee", KLAN)]);
  assert.equal(t.answer, null, JSON.stringify(names(t)));
  assert.deepEqual(t.contest, []);
});

test("LIVE Klan + the true founder: the chapter's row is no rival — James Robertson stands, no contest with a description", async () => {
  const t = await turnOf("Who founded Nashville?", [P("Nashville, Tennessee", KLAN), P("History of Nashville", TRUE_FOUNDER)]);
  assert.equal(t.answer && t.answer.filler.text, "James Robertson", JSON.stringify(names(t)));
  assert.deepEqual(t.contest, []);
});

test("a descriptive run in front of a NAME: the name is the tail ('Confederate veteran John W. Morton' is John W. Morton)", async () => {
  const t = await turnOf("Who founded Nashville?", [P("History of Nashville", "Nashville was founded by Confederate veteran John W. Morton in 1779.")]);
  assert.equal(t.answer && t.answer.filler.text, "John W. Morton", JSON.stringify({ names: names(t), gap: t.gap }));
});

test("…and when the door knows no page for the name, the description is NOT settled for: a gap, never 'Confederate veteran'", async () => {
  const t = await turnOf("Who founded Nashville?", [P("History of Nashville", "Nashville was founded by Confederate veteran John W. Morton in 1779.")], door({ "john w. morton": null }));
  assert.equal(t.answer, null, JSON.stringify(names(t)));
});

test("CONTROL: a leading descriptor of KNOWN common words still gives the name ('the Scottish physician Alexander Fleming')", async () => {
  const t = await turnOf("Who discovered penicillin?", [P("Penicillin", "Penicillin was discovered by the Scottish physician Alexander Fleming in 1928.")],
    door({ penicillin: "Penicillin" }));
  assert.equal(t.answer && t.answer.filler.text, "Alexander Fleming", JSON.stringify({ names: names(t), gap: t.gap }));
});

test("CONTROL: a title that is a name stays whole — a proper name is never trimmed by its final word", async () => {
  const t = await turnOf("Who founded Nashville?", [P("History of Nashville", "Nashville was founded by James Robertson in 1779.")]);
  assert.equal(t.answer && t.answer.filler.text, "James Robertson");
});

test("an occurrence that is a MODIFIER of another thing ('Kenya Airways') is not Kenya — the airline's founder is not Kenya's", async () => {
  const t = await turnOf("Who founded Kenya?", [P("Kenya Airways", "The Kenya airline was founded by Jomo Kenyatta in 1977.")], door({ "jomo kenyatta": "Jomo Kenyatta" }));
  assert.equal(t.answer, null, JSON.stringify(names(t)));
});

test("CONTROL: the ASK's own word after the name is not a modifier of something else ('the Nashville mayor' for 'who is the mayor of Nashville')", async () => {
  const t = await turnOf("Who is the mayor of Nashville?", [P("Nashville, Tennessee", "The Nashville mayor is John Cooper.")], door({ "john cooper": "John Cooper (mayor)" }));
  assert.equal(t.answer && t.answer.filler.text, "John Cooper", JSON.stringify({ names: names(t), gap: t.gap }));
});
