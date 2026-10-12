// falsify-split-battery.test.mjs — THE FALSIFYING BATTERY for the compound one
// shot (fold-chat-split.js). Each claim is attacked with an adversarially
// constructed ask or world; a control that HITS a hole fails, and every hole it
// has found so far is pinned here as a regression (see the history at the
// bottom of this file). Anything still standing stands because it held under
// attack, not because it was not tried.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { runSlotParts, splitSlotParts, bindPartAsk, partsLine, partsContentAllowed } from "./fold-chat-split.js";
import { contentAllowed } from "./fold-chat-strand.js";
import { storeAnswerTurn, runSlotTurn } from "./fold-chat-answerwire.js";

const ROWS = JSON.parse(fs.readFileSync(new URL("./eval/falsify/fixtures/tierA/rows.json", import.meta.url), "utf8"));
const titlesOf = (id) => ROWS.cases.find((c) => c.id === id).titles;
const caseless = (s) => String(s).toLowerCase();
const wiki = (t) => "https://en.wikipedia.org/wiki/" + encodeURIComponent(t.replace(/ /g, "_"));
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body), body: null });

const PAGES = {
  potus1: { title: "President of the United States", text: "The president of the United States is the head of state and head of government. Donald Trump is the president of the United States, having taken office on January 20, 2025." },
  potus: { title: "President of the United States", text: "The president of the United States is the head of state and head of government. Donald Trump is the president of the United States, having taken office on January 20, 2029. Kamala Harris is the first female president of the United States, having taken office on January 20, 2029." },
  kamala: { title: "Kamala Harris", text: "Kamala Harris is the president of the United States, having taken office on January 20, 2029. Kamala Harris was born in Oakland." },
  trump: { title: "Donald Trump", text: "Donald Trump is the president of the United States. Donald Trump was born in Queens. He is an American politician." },
  queens: { title: "Queens", text: "Queens is a borough of New York City. Donald Trump was born in Queens." },
  monarchyUK: { title: "Monarchy of the United Kingdom", text: "The monarchy of the United Kingdom is a constitutional institution. Charles III is the king of the United Kingdom, having acceded to the throne on 8 September 2022." },
  charles3: { title: "Charles III", text: "Charles III is King of the United Kingdom. The wife of Charles III is Camilla." },
  camilla: { title: "Camilla", text: "Camilla is Queen of the United Kingdom. The wife of Charles III is Camilla. Camilla was born in London." },
  london: { title: "London", text: "London is the capital of the United Kingdom. Camilla was born in London." },
  canberra: { title: "Canberra", text: "Canberra is the capital city of Australia. Canberra is located in the Australian Capital Territory." },
  australia: { title: "Australia", text: "Australia is a country comprising the mainland of the Australian continent. Canberra is the capital city of Australia." },
};
const FILLERS = {
  "united states": { title: "United States", redirectedFrom: null, disambiguation: false },
  "donald trump": { title: "Donald Trump", redirectedFrom: null, disambiguation: false },
  "kamala harris": { title: "Kamala Harris", redirectedFrom: null, disambiguation: false },
  "charles iii": { title: "Charles III", redirectedFrom: null, disambiguation: false },
  "camilla": { title: "Camilla", redirectedFrom: null, disambiguation: false },
  "queens": { title: "Queens", redirectedFrom: null, disambiguation: false },
  "australia": { title: "Australia", redirectedFrom: null, disambiguation: false },
  "canberra": { title: "Canberra", redirectedFrom: null, disambiguation: false },
  "uk": { title: "United Kingdom", redirectedFrom: null, disambiguation: false },
  "united kingdom": { title: "United Kingdom", redirectedFrom: null, disambiguation: false },
  "london": { title: "London", redirectedFrom: null, disambiguation: false },
  "trinidad and tobago": { title: "Trinidad and Tobago", redirectedFrom: null, disambiguation: false },
  "trinidad": { title: "Trinidad", redirectedFrom: null, disambiguation: false },
};
function fakeWorld(searchPages) {
  const busy = { urls: [] };
  const fetchImpl = async (url, o = {}) => {
    if (o.signal?.aborted) { const e = new Error("aborted"); e.name = "AbortError"; throw e; }
    if (!/^https:\/\/en\.wikipedia\.org\/w\/api\.php/.test(url)) { busy.urls.push(String(url).slice(0, 90)); return json({}, 502); }
    if (/list=search/.test(url)) {
      const q = decodeURIComponent((url.match(/srsearch=([^&]*)/) || [])[1] || "").replace(/\+/g, " ");
      const first = q.split(/\s+/)[0] || "";
      const hit = searchPages.filter((t) => { const p = PAGES[t]; return p && (first ? new RegExp(first, "i").test(p.text) : true); });
      return json({ query: { search: hit.map((t) => ({ title: t, snippet: PAGES[t].text.slice(0, 120), wordcount: 5000 })) } });
    }
    if (/prop=extracts/.test(url)) {
      const t = decodeURIComponent((url.match(/titles=([^&]*)/) || [])[1] || "");
      const p = PAGES[t];
      return json({ query: { pages: { 1: { title: t, extract: p ? p.text : "" } } } });
    }
    if (/prop=pageprops/.test(url)) {
      const cands = decodeURIComponent((url.match(/titles=([^&]*)/) || [])[1] || "").split("|");
      const redirects = [], normalized = [], pgs = [];
      for (const c of cands) {
        const e = titlesOf("A1")[caseless(c)] ?? FILLERS[caseless(c)] ?? null;
        if (!e) { pgs.push({ title: c, ns: 0, missing: "" }); continue; }
        if (e.redirectedFrom) redirects.push({ from: c, to: e.title }); else if (c !== e.title) normalized.push({ from: c, to: e.title });
        pgs.push({ title: e.title, ns: 0, ...(e.disambiguation ? { pageprops: { disambiguation: "" } } : {}) });
      }
      return json({ query: { normalized, redirects, pages: pgs } });
    }
    return json({});
  };
  return { fetchImpl, busy };
}
const asPassage = (t) => ({ ref: "en.wikipedia.org — " + t, source: wiki(t), url: wiki(t), text: PAGES[t].text, via: "direct" });
const NOW = new Date("2026-10-11T12:00:00Z");
const k = (arr) => arr.map(asPassage);
const ALL = ["potus", "kamala", "trump", "queens", "monarchyUK", "charles3", "camilla", "london", "canberra", "australia"];
const noModel = (busy, label) => assert.ok(!/chat\/completions|api\/tags|\/v1\/models|heimdall/i.test(busy.urls.join("\n")), label);

// ── F1: determinism under repetition and interleaved worlds ─────────────────
test("FALSIFY F1: five runs of the compound in one process, interleaved with another world — byte-identical joins", async () => {
  const q = "Who is the US president and where was he born?";
  const joins = [];
  for (let i = 0; i < 5; i++) {
    if (i === 2) { const kp = splitSlotParts("Who is the king of the UK and who is his wife?"); await runSlotParts({ parts: kp, lang: "en", webPassages: k(["monarchyUK", "charles3", "camilla"]), searchQ: "x", now: NOW, fetchImpl: fakeWorld(["monarchyUK", "charles3", "camilla"]).fetchImpl }); }
    const parts = splitSlotParts(q);
    const w = fakeWorld(["potus1", "trump", "queens"]);
    const res = await runSlotParts({ parts, lang: "en", webPassages: k(["potus1", "trump", "queens"]), searchQ: q, now: NOW, fetchImpl: w.fetchImpl });
    joins.push(res.answer ? res.answer.text : null);
    noModel(w.busy, "F1");
  }
  assert.equal(new Set(joins.filter(Boolean)).size, 1, "five runs, one answer: " + JSON.stringify(joins));
  assert.ok(joins[0].includes("Donald Trump") && joins[0].includes("Queens"));
});

// ── F2: a country NAME that contains the connector must never be split ─────
test("FALSIFY F2: 'Trinidad and Tobago and who is its prime minister' splits ONCE, at the REAL connector, never inside the name", () => {
  const p = splitSlotParts("What is the capital of Trinidad and Tobago and who is its prime minister?");
  assert.equal(p.length, 2);
  assert.equal(p[0].ask, "What is the capital of Trinidad and Tobago", "the name stays whole");
  assert.equal(p[1].dependsOn, 0, "its → the previous part");
});

// ── F3: a CONTEST in part one forbids binding part two on a loser ───────────
test("FALSIFY F3: when part one is a CONTEST (two equally-dated holders), part two never binds onto one side and the whole turn is contested", async () => {
  const parts = splitSlotParts("Who is the president of the United States and where was she born?");
  const w = fakeWorld(["potus", "kamala", "trump"]);
  const res = await runSlotParts({ parts, lang: "en", webPassages: k(["potus", "kamala", "trump"]), searchQ: "x", now: NOW, fetchImpl: w.fetchImpl });
  const p1 = res.parts[0];
  assert.ok(p1.contest || p1.gap, "part one is contested or honestly unresolved: " + JSON.stringify(p1.contest ? "contest" : p1.gap?.kind));
  if (p1.contest) {
    assert.ok(res.contest && res.contest.length, "both holders are on the record");
    assert.ok(!(res.answer && res.answer.text.includes("born")), "no part two line rests on a contested filler — she never binds a loser");
  }
  noModel(w.busy, "F3");
});

// ── F4: the REVERSED compound (where... and who...) ends honestly, never invents ──
test("FALSIFY F4: a reversed compound ('where was the US president born and who is he?') ends as typed gaps, never a guess", async () => {
  const parts = splitSlotParts("Where was the US president born and who is he?");
  assert.equal(parts.length, 2);
  const w = fakeWorld(ALL);
  const res = await runSlotParts({ parts, lang: "en", webPassages: k(ALL), searchQ: "x", now: NOW, fetchImpl: w.fetchImpl });
  assert.ok(!(res.answer && res.answer.text.includes("born")), "no invented birthplace line");
  assert.ok(parts[1].dependsOn === 0 || !res.answer, "the dependent part never answers off a missing filler");
  noModel(w.busy, "F4");
});

// ── F5: three parts, two dependencies, a chain that binds at the end ───────
test("FALSIFY F5: a THREE-part chain ('...and who is his wife and where was she born?') binds twice and answers all three", async () => {
  const parts = splitSlotParts("Who is the king of the UK and who is his wife and where was she born?");
  assert.equal(parts.length, 3);
  assert.equal(parts[1].dependsOn, 0);
  assert.equal(parts[2].dependsOn, 1, "she → the wife");
  const w = fakeWorld(["monarchyUK", "charles3", "camilla", "london"]);
  const res = await runSlotParts({ parts, lang: "en", webPassages: k(["monarchyUK", "charles3", "camilla", "london"]), searchQ: "x", now: NOW, fetchImpl: w.fetchImpl });
  assert.equal(res.answer.text, "Charles III is the king of the United Kingdom.\n\nThe wife of Charles III is Camilla.\n\nCamilla was born in London.");
  noModel(w.busy, "F5");
});

// ── F6: storage tampering ───────────────────────────────────────────────────
test("FALSIFY F6: tampered storage is REFUSED — a swapped row, an off-line word, a non-join content", () => {
  const ans = { text: "A1text" }, ans2 = { text: "B1text" };
  const turn = { parts: [{ answer: { text: "Donald Trump is the president of the United States.", row: { sentence: "Donald Trump is the president of the United States.", source: { title: "T", url: "u" } } } }, { answer: { text: "Donald Trump was born in Queens.", row: { sentence: "Donald Trump was born in Queens.", source: { title: "Q", url: "q" } } } }] };
  const join = partsLine(turn.parts);
  assert.equal(partsContentAllowed(turn, join), true);
  assert.equal(partsContentAllowed({ ...turn, parts: [{ ...turn.parts[0], answer: { ...turn.parts[0].answer, row: { ...turn.parts[0].answer.row, sentence: turn.parts[1].answer.row.sentence } } }, turn.parts[1]] }, join), false, "a row swapped between parts is refused");
  assert.equal(partsContentAllowed(turn, join + "\n\nImagined."), false);
  assert.equal(partsContentAllowed(turn, join.replace("Queens", "Mars")), false);
  const msg = { role: "assistant", content: join, authored: "sources", answerTurn: storeAnswerTurn(turn) };
  assert.equal(contentAllowed(msg), true);
  assert.equal(contentAllowed({ ...msg, content: join + " extra" }), false);
});

// ── F7: punctuation storms and case storms never break the split ────────────
test("FALSIFY F7: 'Who is the US president?? and where was he born?' and 'WHO IS THE US PRESIDENT AND WHERE WAS HE BORN?' split identically", () => {
  const a = splitSlotParts("Who is the US president?? and where was he born?");
  const b = splitSlotParts("WHO IS THE US PRESIDENT AND WHERE WAS HE BORN?");
  assert.equal(a[1].dependsOn, 0);
  assert.equal(b[1].dependsOn, 0);
  assert.equal(a[0].ask.toLowerCase(), b[0].ask.toLowerCase());
});

// ── F8: a self-naming part never binds, in any order ───────────────────────
test("FALSIFY F8: an own-named clause never binds a previous part ('...and where was Donald Trump born?')", () => {
  const p = splitSlotParts("Who is the king of the UK and where was Donald Trump born?");
  assert.equal(p[1].dependsOn, null);
});

// ── F9: the binder never touches a non-dependency ───────────────────────────
test("FALSIFY F9: bindPartAsk on an independent part returns the ask byte-for-byte", () => {
  assert.equal(bindPartAsk({ ask: "where is the capital of Australia?", dependsOn: null }, { filler: "X", referent: "Y" }), "where is the capital of Australia?");
});

// ── F10: the single one shot is untouched: non-compound asks never reach the parts path ──
test("FALSIFY F10: the single-slot path stays intact — a non-compound ask splits to null and runSlotTurn still answers it", async () => {
  assert.equal(splitSlotParts("Who is the king of the UK?"), null);
  const w = fakeWorld(["monarchyUK", "charles3"]);
  const r = await runSlotTurn({ question: "Who is the king of the UK?", lang: "en", webPassages: k(["monarchyUK", "charles3"]), searchQ: "q", now: NOW, fetchImpl: w.fetchImpl });
  assert.ok(r.answer && r.answer.text.includes("Charles III"), "the single one shot answers");
});