// D2 (nesting audit F, 2026-10-14): a MECHANICAL turn (the slot answer, the sources strand) wrote nothing into the claim store: the Pivot has no units
// and turnRecord("") has no sources, so claimsOfTurn made 0 claims and recallOf / freshnessOf read an empty store (3 of 3 live sessions: `claims: []`).
// Promoted from nesting-audit-2026-10-14/F-probes/slot-claims.mjs and strand-claims.mjs. The slot turn is the REAL runSlotTurn over a stub encyclopedia
// (no network, no model); the strand is the real snipsOf.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { runSlotTurn, answerLine } from "./fold-chat-answerwire.js";
import * as ground from "./fold-chat-ground.js";
import { claimsOfTurn, appendClaims, mechanicalUnits, citedAt } from "./fold-chat-record.js";
import { recallOf } from "./fold-chat-recall.js";
import { freshnessOf } from "./fold-chat-freshness.js";
import { snipsOf } from "./fold-chat-strand.js";
import { functionWordsOf } from "./fold-chat-snippets.js";
import { caseless } from "./fold-chat-frame.js";

const ROWS = JSON.parse(fs.readFileSync(new URL("./eval/falsify/fixtures/tierA/rows.json", import.meta.url), "utf8"));
const titles = ROWS.cases.find((c) => c.id === "A6").titles;      // capital of Australia (control)
const PAGE = { title: "Australia", text: "Australia, officially the Commonwealth of Australia, is a country comprising the mainland of the Australian continent. The capital city of Australia is Canberra. Canberra is located in the Australian Capital Territory." };
const CAN = { title: "Canberra", text: "Canberra is the capital city of Australia. Founded following the federation of the colonies of Australia as the seat of government for the new nation, it is Australia's largest inland city. Canberra is located in the Australian Capital Territory." };
const json = (b) => ({ ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b), body: null });
const fetchImpl = async (url) => {
  const u = String(url);
  if (!/^https:\/\/en\.wikipedia\.org\/w\/api\.php/.test(u)) return { ok: false, status: 502, json: async () => ({}), text: async () => "" };
  if (/list=search/.test(u)) return json({ query: { search: [PAGE, CAN].map((p) => ({ title: p.title, snippet: p.text.slice(0, 100), wordcount: 3000 })) } });
  if (/prop=extracts/.test(u)) { const t = decodeURIComponent((u.match(/titles=([^&]*)/) || [])[1] || ""); const p = [PAGE, CAN].find((x) => x.title === t); return json({ query: { pages: { 1: { title: t, extract: p ? p.text : "" } } } }); }
  if (/prop=pageprops/.test(u)) { const cands = decodeURIComponent((u.match(/titles=([^&]*)/) || [])[1] || "").split("|"); return json({ query: { pages: cands.map((c) => { const e = titles[caseless(c)] || (caseless(c) === "canberra" ? { title: "Canberra" } : null); return e ? { title: e.title, ns: 0 } : { title: c, ns: 0, missing: "" }; }) } }); }
  return json({});
};
const wiki = (t) => "https://en.wikipedia.org/wiki/" + encodeURIComponent(t.replace(/ /g, "_"));
const webPassages = [PAGE].map((p) => ({ ref: "en.wikipedia.org — " + p.title, source: wiki(p.title), url: wiki(p.title), text: p.text, via: "direct" }));
const material = webPassages.map((p) => ({ ref: p.ref, source: p.source, text: String(p.text).slice(0, 12000) }));
const question = "What is the capital of Australia?";
const slotTurn = await runSlotTurn({ question, lang: "en", webPassages, searchQ: question, now: new Date("2026-10-06T12:00:00Z"), fetchImpl });

test("D2 control: the real slot turn answers and carries a span into its page", () => {
  assert.ok(slotTurn.answer, "the slot pipeline answered");
  assert.equal(answerLine(slotTurn), "The capital city of Australia is Canberra.");
  assert.ok(Array.isArray(slotTurn.answer.row.span));
});

test("D2: a slot turn's claims are the span it carried, at its address, with the page's own bytes as cited", () => {
  const line = answerLine(slotTurn);
  const mech = mechanicalUnits({ slotTurn, strand: { snips: [], dropped: [], slotTurn }, webPassages, line });
  assert.equal(mech.length, 1);
  const [a, b] = slotTurn.answer.row.span;
  assert.equal(mech[0].address, `${webPassages[0].ref}#${a}-${b}`, "chat's own ref namespace, not the pipeline's S1");
  // the turn as run() makes it: strand ? "" : text, so the record has no sources of its own
  const rec = ground.turnRecord("", material, { turn: 1, question, model: "x", sealed: false, effort: "balanced" });
  assert.equal(rec.sources.length, 0, "the record by itself is empty (the defect's lower half)");
  const claims = claimsOfTurn({ turn: 1, pivot: null, record: rec, material, mechanical: mech });
  assert.equal(claims.length, 1);
  assert.equal(claims[0].roles.ARG1, line);
  assert.equal(claims[0].rel, "showed");
  assert.equal(claims[0].basis.support, mech[0].address);
  assert.equal(claims[0].basis.cited, PAGE.text.slice(a, b));
  assert.equal(claims[0].basis.cited, slotTurn.answer.row.sentence, "cited = the source sentence's exact bytes");
  assert.equal(claims[0].ground, "/t1/c1", "an address in the claim store");
});

test("D2: what was empty is now read: recallOf finds the mechanical turn; freshnessOf checks it against the page", () => {
  const mech = mechanicalUnits({ slotTurn, webPassages, line: answerLine(slotTurn) });
  const store = appendClaims([], claimsOfTurn({ turn: 1, pivot: null, record: null, material, mechanical: mech }));
  assert.equal(store.length, 1);
  const r = recallOf({ question: "what did you tell me about Australia earlier?", claims: store, fw: functionWordsOf("en") });
  assert.ok(r && r.turn === 1 && /Canberra/.test(r.text), "recall reads the store back");
  const f = freshnessOf({ claims: store, pages: material });
  assert.equal(f.checked, 1);
  assert.equal(f.counts.exact, 1, "the page still carries the span: exact");
  const moved = freshnessOf({ claims: store, pages: [{ ref: webPassages[0].ref, text: "Changed. " + PAGE.text }] });
  assert.equal(moved.counts.exact, 0, "and a page that moved the span is NOT exact (the read is not vacuous)");
});

test("D2: a strand's claims are its snips' byte ranges at their pages; citedAt returns the snip's bytes", () => {
  const wp = [{ ref: "en.wikipedia.org — Australia", source: wiki("Australia"), url: wiki("Australia"), text: PAGE.text + " The country has a population of about twenty six million people and a long coastline." }];
  const st = snipsOf(wp, "capital of Australia", {});
  assert.ok(st.snips.length >= 1);
  const mat = wp.map((p) => ({ ref: p.ref, source: p.source, text: p.text }));
  const mech = mechanicalUnits({ strand: st, webPassages: wp });
  assert.equal(mech.length, st.snips.filter((s) => s.range).length);
  const claims = claimsOfTurn({ turn: 4, pivot: null, record: ground.turnRecord("", mat, { turn: 4 }), material: mat, mechanical: mech });
  assert.equal(claims.length, mech.length);
  const r = st.snips[0].range;
  assert.equal(claims[0].basis.cited, wp[0].text.slice(r.start, r.end));
  assert.equal(citedAt(mech[0].address, mat), claims[0].basis.cited);
});

test("D2 negative controls: a gap, a contest, a handoff, a rangeless snip or a span that does not fit are NO claim", () => {
  const wp = webPassages;
  assert.deepEqual(mechanicalUnits({ slotTurn: { answer: null, gap: { kind: "unwitnessed" } }, webPassages: wp }), []);
  assert.deepEqual(mechanicalUnits({ slotTurn: { handoff: { kind: "not_a_slot_ask" } }, webPassages: wp }), []);
  assert.deepEqual(mechanicalUnits({ strand: { snips: [{ kind: "card", text: "x", source: wp[0].url, range: null }] }, webPassages: wp }), []);
  assert.deepEqual(mechanicalUnits({ strand: { snips: [{ kind: "lead", text: "x", source: wp[0].url, range: { start: 0, end: 99999 } }] }, webPassages: wp }), [], "a span past the page's end is not carried");
  assert.deepEqual(mechanicalUnits({ strand: { snips: [{ kind: "lead", text: "x", source: "https://other.example/", range: { start: 0, end: 5 } }] }, webPassages: wp }), [], "a source with no passage is not guessed");
  assert.equal(claimsOfTurn({ turn: 1, pivot: null, record: null, material, mechanical: [] }).length, 0, "no units, no sources: still no claim (nothing is invented)");
});

test("D2 positive control: a model turn's claims are unchanged by the mechanical lane", () => {
  const pivot = { units: [{ kind: "sentence", text: "Canberra is the capital.", support: `${webPassages[0].ref}#119-161` }] };
  const cs = claimsOfTurn({ turn: 2, pivot, material });
  assert.equal(cs.length, 1);
  assert.equal(cs[0].rel, "said");
  assert.equal(cs[0].basis.cited, PAGE.text.slice(119, 161));
});
