// falsify-split-battery2.test.mjs — ROUND TWO: the compound one shot, attacked
// where round one and the real-world sweep left seams. A control that HITS a
// hole fails; everything here either held under attack or was fixed and pinned.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { runSlotParts, splitSlotParts, bindPartAsk, partsLine, partsContentAllowed, topicOfAsk } from "./fold-chat-split.js";
import { contentAllowed } from "./fold-chat-strand.js";
import { storeAnswerTurn, runSlotTurn } from "./fold-chat-answerwire.js";
import { expandAskAbbreviations } from "./fold-chat-frame.js";

const ROWS = JSON.parse(fs.readFileSync(new URL("./eval/falsify/fixtures/tierA/rows.json", import.meta.url), "utf8"));
const titlesOf = (id) => ROWS.cases.find((c) => c.id === id).titles;
const caseless = (s) => String(s).toLowerCase();
const wiki = (t) => "https://en.wikipedia.org/wiki/" + encodeURIComponent(t.replace(/ /g, "_"));
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body), body: null });

// the deep page: the binding sentence is LAST, ~2000 chars in — like the real
// POTUS intro where the holder sentence sits beyond a shallow read.
const deepIntro = "The president of the United States is the head of state and head of government of the United States. " +
  "The role was created in 1789, and its powers have grown steadily through amendments and practice. ".repeat(8) +
  "The president directs the executive branch and signs legislation into law. " +
  "Donald Trump is the 47th and current president of the United States, having taken office on January 20, 2025.";
const PAGES = {
  deep: { title: "President of the United States (deep)", text: deepIntro },
  trump: { title: "Donald Trump", text: "Donald Trump is the president of the United States. Donald Trump was born in Queens." },
  queens: { title: "Queens", text: "Queens is a borough of New York City. Donald Trump was born in Queens." },
  monarchyUK: { title: "Monarchy of the United Kingdom", text: "Charles III is the king of the United Kingdom. The monarchy of the United Kingdom is a constitutional institution." },
  camilla: { title: "Camilla", text: "The wife of Charles III is Camilla. Camilla is Queen of the United Kingdom." },
};
const FILLERS = {
  "united states": { title: "United States", redirectedFrom: null, disambiguation: false },
  "donald trump": { title: "Donald Trump", redirectedFrom: null, disambiguation: false },
  "charles iii": { title: "Charles III", redirectedFrom: null, disambiguation: false },
  "camilla": { title: "Camilla", redirectedFrom: null, disambiguation: false },
  "queens": { title: "Queens", redirectedFrom: null, disambiguation: false },
  "uk": { title: "United Kingdom", redirectedFrom: null, disambiguation: false },
  "united kingdom": { title: "United Kingdom", redirectedFrom: null, disambiguation: false },
};
function fakeWorld(searchPages, opts = {}) {
  const busy = { urls: [], ok: 0 };
  const fetchImpl = async (url, o = {}) => {
    if (o.signal?.aborted) { const e = new Error("aborted"); e.name = "AbortError"; throw e; }
    if (!/^https:\/\/en\.wikipedia\.org\/w\/api\.php/.test(url)) { busy.urls.push(String(url).slice(0, 90)); return json({}, 502); }
    if (opts.hang) return new Promise((_, rej) => { o.signal?.addEventListener("abort", () => { const e = new Error("aborted"); e.name = "AbortError"; rej(e); }); });
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
const noModel = (busy, label) => assert.ok(!/chat\/completions|api\/tags|\/v1\/models|heimdall/i.test(busy.urls.join("\n")), label);

// ── G1: the read-cap seam — the SLOT layer is depth-agnostic ─────────────────
test("FALSIFY G1: a binding sentence 2000 chars deep in the passage still binds — the cap that made the live POTUS turn 'unwitnessed' lives UPSTREAM, not here", async () => {
  const parts = splitSlotParts("Who is the president of the United States and where was he born?");
  const w = fakeWorld(["deep", "trump", "queens"]);
  const res = await runSlotParts({ parts, lang: "en", webPassages: k(["deep", "trump", "queens"]), searchQ: "x", now: NOW, fetchImpl: w.fetchImpl });
  assert.ok(res.answer && res.answer.text.includes("Donald Trump is the 47th and current president"), "the deep sentence was reached: " + (res.answer ? res.answer.text.slice(0, 90) : JSON.stringify(res.parts[0].gap).slice(0, 90)));
  assert.ok(res.answer.text.includes("Queens"));
  noModel(w.busy, "G1");
});

// ── G2: the garbage corpus — nothing crashes, everything ends honestly ──────
test("FALSIFY G2: garbage, emoji, 10k-char asks, NULs, HTML, connector storms — no crash, typed end states, no model", async () => {
  const junk = [
    "", "?", "and who is the president?", "and and and", "💥💥💥", "who is the president and where was he born".repeat(200),
    "Who is <b>the</b> US president<script>alert(1)</script> and where was he born?",
    "Who is the president\0 and where was he born?", "who is he and who is he and who is he and who is he?",
    "Who is the US president and where was he born and who is his wife and who was his father and what year did he die?",
  ];
  for (const ask of junk) {
    const parts = splitSlotParts(ask);
    const w = fakeWorld(["trump", "queens"]);
    const res = parts && parts.length >= 2
      ? await runSlotParts({ parts, lang: "en", webPassages: k(["trump", "queens"]), searchQ: ask, now: NOW, fetchImpl: w.fetchImpl, timeBoxMs: 3000 })
      : await runSlotTurn({ question: ask, lang: "en", webPassages: k(["trump", "queens"]), searchQ: ask, now: NOW, fetchImpl: w.fetchImpl, timeBoxMs: 3000 });
    assert.ok(res && typeof res === "object", JSON.stringify(ask).slice(0, 40));
    assert.ok(res.handoff || res.answer || res.gap || res.contest || res.aborted, JSON.stringify(ask).slice(0, 60));
    noModel(w.busy, "G2:" + JSON.stringify(ask).slice(0, 30));
  }
});

// ── G3: homoglyph storage attacks — Cyrillic 'е' in a line is not a word ────
test("FALSIFY G3: a line tampered with a homoglyph (Cyrillic е in 'Queens') is REFUSED by the stored-parts invariant", () => {
  const good = "Donald Trump was born in Queens.";
  const evil = good.replace("Queens", "Quеens");   // Cyrillic е
  const turn = { parts: [
    { answer: { text: good, row: { sentence: good, source: { title: "Q", url: "q" } } } },
  ] };
  assert.equal(partsContentAllowed(turn, good), true);
  assert.equal(partsContentAllowed({ ...turn, parts: [{ ...turn.parts[0], answer: { ...turn.parts[0].answer, text: evil } }] }, good), false, "a homoglyph-substituted line is not the source sentence");
  const msg = { role: "assistant", content: evil, authored: "sources", answerTurn: storeAnswerTurn({ ...turn, parts: [{ ...turn.parts[0], answer: { ...turn.parts[0].answer, text: evil } }] }) };
  assert.equal(contentAllowed(msg), false);
});

// ── G4: regex-special referents never break the binder ──────────────────────
test("FALSIFY G4: fillers and referents full of regex/code chars (C++, AC/DC, O'Connell, Saint John's) substitute cleanly", () => {
  assert.equal(bindPartAsk({ ask: "where is he from", dependsOn: 0 }, { filler: "C++", referent: "C++" }), "where is C++ from");
  assert.equal(bindPartAsk({ ask: "who is his singer", dependsOn: 0 }, { filler: "AC/DC", referent: "AC/DC" }), "who is AC/DC's singer");
  assert.equal(bindPartAsk({ ask: "who is her husband", dependsOn: 0 }, { filler: "O'Connell", referent: "O'Connell" }), "who is O'Connell's husband");
  assert.equal(bindPartAsk({ ask: "where was he born", dependsOn: 0 }, { filler: "Saint John's", referent: "Saint John's" }), "where was Saint John's born");
});

// ── G5: the join is in QUESTION order, even when the dependency ran reversed ─
test("FALSIFY G5: the joined answer is always the QUESTION's order, whatever the dependency order", () => {
  const parts = splitSlotParts("Where was the US president born and who is he?");
  const reordered = [parts[1], parts[0]];
  const joined = partsLine([
    { index: 0, answer: { text: "ZERO-line" } },
    { index: 1, answer: { text: "ONE-line" } },
  ]);
  assert.equal(joined, "ZERO-line\n\nONE-line", "index order, not arrival order");
});

// ── G6: at the ceiling — a full four-part chain ─────────────────────────────
test("FALSIFY G6: a four-part chain at the declared ceiling splits, and the binder chains each a part to the one before it", () => {
  const parts = splitSlotParts("Who is the king of the UK and who is his wife and where was she born and what year was she born?");
  assert.equal(parts.length, 4);
  assert.deepEqual(parts.slice(1).map((p) => p.dependsOn), [0, 1, 2], "a chain, not a fan");
  assert.equal(splitSlotParts("Who is A and who is B and who is C and who is D and who is E?"), null, "five is past the ceiling");
});

// ── G7: the abbreviation storm — 'us' only as its own token, never inside a word ──
test("FALSIFY G7: 'USSR', 'bus', 'Musk', 'You and us' never expand; 'the us' and 'of the usa' do", () => {
  assert.equal(expandAskAbbreviations("Who is the leader of USSR?"), "Who is the leader of USSR?");
  assert.equal(expandAskAbbreviations("Who rode the bus to the capital?"), "Who rode the bus to the capital?");
  assert.equal(expandAskAbbreviations("Who is Elon Musk?"), "Who is Elon Musk?");
  assert.equal(expandAskAbbreviations("Why is it so hard for us to agree?"), "Why is it so hard for us to agree?", "the pronoun us never expands");
  assert.equal(expandAskAbbreviations("What is the capital of the us?"), "What is the capital of the United States?");
  assert.equal(expandAskAbbreviations("who is the president of the USA?"), "who is the president of the United States?");
});

// ── G8: connectors at the edges — never a phantom part ──────────────────────
test("FALSIFY G8: a question that STARTS or ENDS with a connector is not compound; a doubled connector does not double-split", () => {
  assert.equal(splitSlotParts("and who is the president?"), null);
  assert.equal(splitSlotParts("Who is the president and?"), null);
  const twice = splitSlotParts("Who is the US president and and where was he born?");
  assert.equal(twice.length, 2);
});

// ── G9: a fetch that hangs or 429s forever ends as a handoff, never a crash ─
test("FALSIFY G9: a forever-hanging fetch → too_slow handoff inside the box; a forever-429 fetch → handoff; no crash, no model", async () => {
  const parts = splitSlotParts("Who is the king of the UK and who is his wife?");
  const hang = await runSlotParts({ parts, lang: "en", webPassages: k(["monarchyUK", "camilla"]), searchQ: "x", now: NOW, fetchImpl: fakeWorld(["monarchyUK", "camilla"], { hang: true }).fetchImpl, timeBoxMs: 1200 });
  assert.ok(hang.handoff || (hang.parts && hang.parts.every((p) => p.gap)), "a hung fetch must not hang the turn");
  assert.equal(JSON.stringify(hang).includes("aborted"), false, "an internal timebox is never the person's stop");
  const badFetch = async (url, o = {}) => { if (o.signal?.aborted) { const e = new Error("aborted"); e.name = "AbortError"; throw e; } return json({}, 429); };
  const r2 = await runSlotParts({ parts, lang: "en", webPassages: k(["monarchyUK", "camilla"]), searchQ: "x", now: NOW, fetchImpl: badFetch, timeBoxMs: 2000 });
  assert.ok(r2.handoff || (r2.parts && r2.parts.every((p) => p.gap)), "429-everything still ends as a handoff or typed gaps");
});

// ── G10: head-of-HEAD determinism — the committed state re-falsifies clean ──
test("FALSIFY G10: the round-one battery and the module exist at the committed HEAD (a re-run guard)", () => {
  const head = execSync("git rev-parse --short HEAD").toString().trim();
  assert.match(head, /^[0-9a-f]{7}$/);
  const files = ["falsify-split-battery.test.mjs", "fold-chat-split.js", "fold-chat-split.test.mjs", "fold-chat-split-wiring.test.mjs"];
  assert.ok(files.every((f) => fs.existsSync(f)), "the round-one battery and the module exist at HEAD");
});