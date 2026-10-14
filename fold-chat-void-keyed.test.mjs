// fold-chat-void-keyed.test.mjs — the keyed door (eval/void/PREREG.md Amendment 14, Clarification 14.1) and its out-grammar (the user's principle:
// any grammar in → EOT → any grammar out). Wikidata and Wikipedia are STUBBED; every organ above them is real.
import { test } from "node:test";
import assert from "node:assert/strict";
import { keyedFill, renderTimeFor, realizeClaim } from "./fold-chat-void-keyed.js";

const QID = "Q45178";   // the Sydney Opera House
// a tiny Wikidata: the item, its class, and the properties; labels in en / de / ja
const PROPS = {
  P1619: { datatype: "time", labels: { en: "date of official opening", de: "Datum der offiziellen Eröffnung", ja: "公式開館日" }, aliases: { en: ["opened", "opening date"] } },
  P84: { datatype: "wikibase-item", labels: { en: "architect", de: "Architekt", ja: "建築家" }, aliases: { en: [] } },
  P31: { datatype: "wikibase-item", labels: { en: "instance of" }, aliases: { en: [] } },
  P580: { datatype: "time", labels: { en: "start time" }, aliases: { en: ["when"] } },   // an alias that is an interrogative word
};
const stub = (log = []) => async (url) => {
  log.push(url);
  const u = new URL(url), a = u.searchParams;
  if (u.host.endsWith("wikipedia.org")) return { query: { pages: { 1: { pageprops: { wikibase_item: QID } } } } };
  const ids = (a.get("ids") || "").split("|");
  const langs = (a.get("languages") || "en").split("|");
  const lab = (labels) => Object.fromEntries(langs.filter((l) => labels[l]).map((l) => [l, { language: l, value: labels[l] }]));
  const ents = {};
  for (const id of ids) {
    if (id === QID) ents[id] = { labels: lab({ en: "Sydney Opera House", de: "Sydney Opera House", ja: "シドニー・オペラハウス" }), claims: {
      P31: [{ mainsnak: { datavalue: { type: "wikibase-entityid", value: { id: "Q1" } } } }],
      P1619: [{ rank: "normal", mainsnak: { datavalue: { type: "time", value: { time: "+1973-10-20T00:00:00Z", precision: 11 } } } }],
      P580: [{ rank: "normal", mainsnak: { datavalue: { type: "time", value: { time: "+1959-03-02T00:00:00Z", precision: 11 } } } }],
      P84: [{ rank: "normal", mainsnak: { datavalue: { type: "wikibase-entityid", value: { id: "Q2" } } } }] } };
    else if (id === "Q1") ents[id] = { labels: lab({ en: "opera house" }), claims: { P1963: [{ mainsnak: { datavalue: { value: { id: "P1619" } } } }, { mainsnak: { datavalue: { value: { id: "P84" } } } }, { mainsnak: { datavalue: { value: { id: "P580" } } } }] } };
    else if (id === "Q2") ents[id] = { labels: lab({ en: "Jørn Utzon", de: "Jørn Utzon", ja: "ヨーン・ウツソン" }) };
    else if (PROPS[id]) ents[id] = { datatype: PROPS[id].datatype, labels: lab(PROPS[id].labels), aliases: Object.fromEntries(Object.entries(PROPS[id].aliases).map(([l, xs]) => [l, xs.map((v) => ({ value: v }))])), claims: {} };
  }
  return { entities: ents };
};
const fields = { slot: "time", admits: "date", anchor: "Sydney Opera House" };
const anchor = { title: "Sydney Opera House", surface: "Sydney Opera House" };
const run = (over = {}) => keyedFill({ fields, anchor, relationWords: ["opened"], askWords: ["opened"], getJson: stub(), lang: "en", ...over });

test("the date is CLDR for the language, in that language's own order and script", () => {
  const t = { time: "+1973-10-20T00:00:00Z", precision: 11 };
  assert.equal(renderTimeFor(t, "en"), "20 October 1973");
  assert.equal(renderTimeFor(t, "de"), "20. Oktober 1973");
  assert.equal(renderTimeFor(t, "ja"), "1973年10月20日");
  assert.equal(renderTimeFor(t, "ko"), "1973년 10월 20일");
});

test("the kind's keys license the relation; the value is typed by the property's own datatype (a date, not an item)", async () => {
  const r = await run();
  assert.equal(r.verdict, "bound");
  assert.equal(r.property.id, "P1619");
  assert.equal(r.claim.values[0].kind, "time");
  assert.equal(r.answer.text, "Sydney Opera House — date of official opening: 20 October 1973.");
});

test("the result is a LANGUAGE-FREE claim; the same claim realizes in any grammar asked for", async () => {
  const en = await run(), de = await run({ lang: "de", relationWords: ["Eröffnung"], askWords: ["Eröffnung"] }), ja = await run({ lang: "ja", relationWords: ["公式開館日"], askWords: ["公式開館日"] });
  assert.deepEqual(en.claim.relation.property, de.claim.relation.property);
  assert.deepEqual(en.claim.values, ja.claim.values);
  assert.equal(de.answer.text, "Sydney Opera House — Datum der offiziellen Eröffnung: 20. Oktober 1973.");
  assert.equal(ja.answer.text, "シドニー・オペラハウス — 公式開館日： 1973年10月20日。");
});

test("a modifier is not a relation, and a declared interrogative never names a key", async () => {
  const r = await run({ relationWords: ["when", "opened"], askWords: ["when"], skipWords: new Set(["when"]) });
  assert.equal(r.verdict, "bound");
  const none = await run({ relationWords: ["when"], askWords: ["when"], skipWords: new Set(["when"]) });
  assert.equal(none.verdict, "unbound");
  assert.equal(none.refused, "no_matching_key");
});

test("a key of the wrong datatype is refused, never answered", async () => {
  const r = await keyedFill({ fields: { slot: "person", admits: "date", anchor: "x" }, anchor, relationWords: ["architect"], askWords: ["architect"], getJson: stub(), lang: "en" });
  assert.equal(r.verdict, "unbound");
  assert.equal(r.refused, "datatype_mismatch");
});

test("the identity witness is the question's own edition", async () => {
  const log = [];
  await keyedFill({ fields, anchor, relationWords: ["opened"], askWords: [], getJson: stub(log), lang: "de" });
  assert.ok(log.some((u) => u.startsWith("https://de.wikipedia.org/")), "pageprops is asked of the de edition");
});

test("the typed void: the kind declares the key, this instance has no value", async () => {
  const getJson = async (url) => { const r = await stub()(url); for (const e of Object.values(r.entities || {})) if (e.claims && e.claims.P1619) { delete e.claims.P1619; } return r; };
  const r = await keyedFill({ fields, anchor, relationWords: ["opened"], askWords: [], getJson, lang: "en" });
  assert.equal(r.verdict, "unbound");
  assert.equal(r.refused, "kind_has_key_no_value");
  assert.deepEqual(r.void.declaredNoValue, ["date of official opening"]);
});

// the open-class test needs a POS prior; this stub is the shape of ewt().dominantOf
const UPOS = { of: "ADP", instance: "NOUN", when: "ADV", opened: "VERB", architect: "NOUN", opening: "NOUN", date: "NOUN", start: "NOUN", time: "NOUN" };
const dominantOf = (w) => (UPOS[w] ? { upos: UPOS[w], lemma: w } : null);

test("a closed-class word never names a key, even when it equals a label token ('of' in 'instance of')", async () => {
  const r = await keyedFill({ fields: { slot: "thing", admits: "thing", anchor: "x" }, anchor, relationWords: ["of"], askWords: ["of"], getJson: stub(), lang: "en", dominantOf });
  assert.equal(r.verdict, "unbound");
  assert.equal(r.refused, "no_matching_key");
});

test("the ask grammar's declared interrogatives never name a key, even when an alias is one ('when' aliases 'start time')", async () => {
  const withSkip = await keyedFill({ fields, anchor, relationWords: ["when"], askWords: ["when"], getJson: stub(), lang: "en", dominantOf, skipWords: new Set(["when"]) });
  assert.equal(withSkip.verdict, "unbound");
  const without = await keyedFill({ fields, anchor, relationWords: ["when"], askWords: ["when"], getJson: stub(), lang: "en", dominantOf });
  assert.equal(without.verdict, "bound", "control: without the declared skip the alias DOES license the key");
  assert.equal(without.property.id, "P580");
});
