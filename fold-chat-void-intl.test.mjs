// fold-chat-void-intl.test.mjs — the keyed door's language-general front end (eval/void/PREREG.md Amendment 16, Clarification 16.1).
// The title door and Wikidata are stubbed; segmentation (ICU), the open-class test, the anchor arbiter and the door are real.
import { test } from "node:test";
import assert from "node:assert/strict";
import { intlDoor, candidateRuns, segmentsOf } from "./fold-chat-void-intl.js";

const UPOS = { capital: "NOUN", australia: "PROPN", of: "ADP", what: "PRON", is: "AUX", the: "DET", place: "NOUN", birth: "NOUN", mozart: "PROPN", date: "NOUN", "수도는": "NOUN", "어디입니까": "PRON" };
const dominantOf = (w) => (UPOS[w] ? { upos: UPOS[w], lemma: w } : null);

const ITEMS = {
  Q408: { label: "Australia", claims: { P36: [{ rank: "normal", mainsnak: { datavalue: { type: "wikibase-entityid", value: { id: "Q3114" } } } }] } },
  Q3114: { label: "Canberra", claims: {} },
  Q254: { label: "Mozart", claims: {
    P569: [{ rank: "normal", mainsnak: { datavalue: { type: "time", value: { time: "+1756-01-27T00:00:00Z", precision: 11 } } } }],
    P19: [{ rank: "normal", mainsnak: { datavalue: { type: "wikibase-entityid", value: { id: "Q34713" } } } }] } },
  Q34713: { label: "Salzburg", claims: {} },
};
const PROPS = {
  P36: { datatype: "wikibase-item", label: "capital", aliases: [] },
  P569: { datatype: "time", label: "date of birth", aliases: [] },
  P19: { datatype: "wikibase-item", label: "place of birth", aliases: [] },
};
const stubJson = (pageToQ) => async (url) => {
  const u = new URL(url), a = u.searchParams;
  if (u.host.endsWith("wikipedia.org")) { const q = pageToQ[a.get("titles")]; return { query: { pages: { 1: q ? { pageprops: { wikibase_item: q } } : {} } } }; }
  const ents = {};
  for (const id of (a.get("ids") || "").split("|")) {
    if (ITEMS[id]) ents[id] = { labels: { en: { value: ITEMS[id].label } }, claims: ITEMS[id].claims };
    else if (PROPS[id]) ents[id] = { datatype: PROPS[id].datatype, labels: { en: { value: PROPS[id].label } }, aliases: { en: PROPS[id].aliases.map((v) => ({ value: v })) }, claims: {} };
  }
  return { entities: ents };
};
const titles = (map) => async (cands) => new Map(cands.map((c) => [c, map[c] ? { title: map[c], disambiguation: false } : null]));

test("ICU/CLDR segmentation splits an unspaced script into words", () => {
  const w = segmentsOf("オーストラリアの首都はどこですか。", "ja").filter((s) => s.word).map((s) => s.text);
  assert.deepEqual(w.slice(0, 3), ["オーストラリア", "の", "首都"]);
});

test("an agglutinative language also offers every prefix of a run (the title door is the witness)", () => {
  const runs = candidateRuns("Avustralya'nın başkenti", "tr", { closedOf: () => false });
  assert.ok([...runs.keys()].includes("Avustralya"), "the stem before the suffix is a candidate");
  const en = candidateRuns("Australia capital", "en", { closedOf: () => false });
  assert.ok(![...en.keys()].includes("Austral"), "a non-agglutinative language gets no prefix probing");
});

test("a longer run that REDIRECTS to another entity does not hide the anchor ('capital of Australia' → Canberra)", async () => {
  const r = await intlDoor({ ask: "What is the capital of Australia?", lang: "en", dominantOf,
    resolveTitles: titles({ "capital of Australia": "Canberra", Australia: "Australia" }), getJson: stubJson({ Canberra: "Q3114", Australia: "Q408" }) });
  assert.equal(r.verdict, "bound");
  assert.equal(r.anchor, "Australia");
  assert.equal(r.claim.values[0].qid, "Q3114");
});

test("two keys match the same word: the one whose label the ask covers wins, never the first ('place of birth' over 'date of birth')", async () => {
  const r = await intlDoor({ ask: "What is the place of birth of Mozart?", lang: "en", dominantOf,
    resolveTitles: titles({ Mozart: "Mozart" }), getJson: stubJson({ Mozart: "Q254" }) });
  assert.equal(r.verdict, "bound");
  assert.equal(r.claim.relation.property, "P19");
});

test("an equal-coverage tie between properties with different values is a contest, not a pick", async () => {
  const r = await intlDoor({ ask: "What is the birth of Mozart?", lang: "en", dominantOf,
    resolveTitles: titles({ Mozart: "Mozart" }), getJson: stubJson({ Mozart: "Q254" }) });
  assert.equal(r.verdict, "contested");
});

test("a suffix glued to the noun does not hide the key (ko: 수도는 = the label token 수도 + a particle)", async () => {
  PROPS.P36.label = "수도";
  const r = await intlDoor({ ask: "호주의 수도는 어디입니까?", lang: "ko", dominantOf: () => null,
    resolveTitles: async (cands) => new Map(cands.map((c) => [c, c === "호주" ? { title: "호주", disambiguation: false } : null])), getJson: stubJson({ "호주": "Q408" }) });
  PROPS.P36.label = "capital";
  assert.equal(r.verdict, "bound");
  assert.equal(r.claim.relation.property, "P36");
});
