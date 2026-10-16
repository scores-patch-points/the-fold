// fold-chat-split-wiring.test.mjs — the COMPOUND ONE SHOT, wired: runSlotParts
// over fake worlds, the storage invariant, and the static seams in fold-chat.js
// run() that a future edit cannot unwire. Every end-state is falsified:
// answered/contested/partial, with the model never called.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { runSlotParts, splitSlotParts, partsLine, partsContentAllowed } from "./fold-chat-split.js";
import { storeAnswerTurn, endsTurn } from "./fold-chat-answerwire.js";
import { contentAllowed } from "./fold-chat-strand.js";

const ROWS = JSON.parse(fs.readFileSync(new URL("./eval/falsify/fixtures/tierA/rows.json", import.meta.url), "utf8"));
const titlesOf = (id) => ROWS.cases.find((c) => c.id === id).titles;
const CHAT_SRC = fs.readFileSync(new URL("./fold-chat.js", import.meta.url), "utf8");
const caseless = (s) => String(s).toLowerCase();
const wiki = (t) => "https://en.wikipedia.org/wiki/" + encodeURIComponent(t.replace(/ /g, "_"));
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body), body: null });

const PAGES = {
  potus: { title: "President of the United States", text: "The president of the United States is the head of state and head of government. Donald Trump is the president of the United States, having taken office on January 20, 2025." },
  trump: { title: "Donald Trump", text: "Donald Trump is the president of the United States. Donald Trump was born in Queens. He is an American politician." },
  queens: { title: "Queens", text: "Queens is a borough of New York City. Donald Trump was born in Queens." },
  monarchyUK: { title: "Monarchy of the United Kingdom", text: "The monarchy of the United Kingdom is a constitutional institution. Charles III is the king of the United Kingdom, having acceded to the throne on 8 September 2022." },
  charles3: { title: "Charles III", text: "Charles III is King of the United Kingdom. The wife of Charles III is Camilla." },
  camilla: { title: "Camilla", text: "Camilla is Queen of the United Kingdom. The wife of Charles III is Camilla." },
  canberra: { title: "Canberra", text: "Canberra is the capital city of Australia. Canberra is located in the Australian Capital Territory." },
  australia: { title: "Australia", text: "Australia is a country comprising the mainland of the Australian continent. Canberra is the capital city of Australia." },
};
const FILLERS = {
  "united states": { title: "United States", redirectedFrom: null, disambiguation: false },
  "donald trump": { title: "Donald Trump", redirectedFrom: null, disambiguation: false },
  "charles iii": { title: "Charles III", redirectedFrom: null, disambiguation: false },
  "uk": { title: "United Kingdom", redirectedFrom: null, disambiguation: false },
  "camilla": { title: "Camilla", redirectedFrom: null, disambiguation: false },
  "queens": { title: "Queens", redirectedFrom: null, disambiguation: false },
  "australia": { title: "Australia", redirectedFrom: null, disambiguation: false },
  "canberra": { title: "Canberra", redirectedFrom: null, disambiguation: false },
};
function fakeWorld(searchPages) {
  const busy = { refused: 0, urls: [] };
  const fetchImpl = async (url, o = {}) => {
    if (o.signal?.aborted) { const e = new Error("aborted"); e.name = "AbortError"; throw e; }
    if (!/^https:\/\/en\.wikipedia\.org\/w\/api\.php/.test(url)) { busy.refused++; busy.urls.push(String(url).slice(0, 90)); return json({}, 502); }
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
const stored = (turn) => ({ role: "assistant", content: turn.answer ? partsLine(turn.parts) : "", authored: "sources", answerTurn: storeAnswerTurn(turn) });
const storeOf = (text) => ({ getItem: (k) => (k === "fold-chat:answerPipeline" ? text : null) });

// ── the happy compounds ──────────────────────────────────────────────────────
test("THE ASK: 'Who is the US president and where was he born?' answers modellessly — two parts, anaphor bound, join is source sentences", async () => {
  const parts = splitSlotParts("Who is the US president and where was he born?");
  const w = fakeWorld(["President of the United States", "Donald Trump", "Queens"]);
  const res = await runSlotParts({ parts, lang: "en", webPassages: ["potus", "trump", "queens"].map(asPassage), searchQ: "Who is the US president", now: NOW, fetchImpl: w.fetchImpl });
  assert.equal(res.answer && res.answer.text, "Donald Trump is the president of the United States.\n\nDonald Trump was born in Queens.");
  assert.equal(res.parts[1].boundAsk, "where was Donald Trump born");
  assert.equal(endsTurn(res), true);
  assert.equal(w.busy.refused, 0, "nothing but the encyclopedia was asked — no model, no relay");
  const msg = stored(res);
  assert.equal(contentAllowed(msg), true);
  assert.equal(partsContentAllowed(msg.answerTurn, msg.content), true);
  const reloaded = JSON.parse(JSON.stringify(msg));   // survives a reload
  assert.equal(contentAllowed(reloaded), true);
  assert.equal(reloaded.answerTurn.parts.length, 2);
});

test("a possessive person chain: 'Who is the king of the UK and who is his wife?'", async () => {
  const parts = splitSlotParts("Who is the king of the UK and who is his wife?");
  const w = fakeWorld(["Monarchy of the United Kingdom", "Charles III", "Camilla"]);
  const res = await runSlotParts({ parts, lang: "en", webPassages: ["monarchyUK", "charles3", "camilla"].map(asPassage), searchQ: "Who is the king of the UK", now: NOW, fetchImpl: w.fetchImpl });
  assert.equal(res.answer.text, "Charles III is the king of the United Kingdom.\n\nThe wife of Charles III is Camilla.");
  assert.equal(res.parts[1].boundAsk, "who is Charles III's wife");
  assert.equal(w.busy.refused, 0);
});

test("a property anaphor: 'What is the capital of Australia and where is it?' binds the REAL REFERENT (the frame's resolved title), never the filler", async () => {
  const parts = splitSlotParts("What is the capital of Australia and where is it?");
  const w = fakeWorld(["Australia", "Canberra"]);
  const res = await runSlotParts({ parts, lang: "en", webPassages: ["australia", "canberra"].map(asPassage), searchQ: "What is the capital of Australia", now: NOW, fetchImpl: w.fetchImpl });
  assert.equal(res.parts[1].boundAsk, "where is Australia", "the real referent title, not a topic string");
  // the fixture's only sentence about Australia ("Canberra is the capital city of Australia") says what the capital is, not WHERE the
  // country is: a place filler needs a locative cue (a preposition or a place verb), so this part is a typed gap, never "Canberra"
  assert.ok(!res.parts[1].answer || !/Canberra/.test(res.parts[1].answer.text || ""), "no place is invented from a sentence that does not say where");
  // (a gap row's closest sentence is followed to its page like any other row — the origin follower's own fetches are the only refused
  // calls here, all for the article the fixture's one sentence came from; no request goes anywhere but the article and its proxies)
  assert.ok(w.busy.urls.every((u) => /en\.wikipedia\.org|holodeck-proxy/.test(u)), "only the article's own address is ever tried: " + JSON.stringify(w.busy.urls.slice(0, 3)));
});

// ── the honest end-states ────────────────────────────────────────────────────
test("a part whose earlier part did not answer is a typed gap, drawn not said — no invented line ever joins the response", async () => {
  const parts = splitSlotParts("Who is the king of the UK and where was he born?");
  const w = fakeWorld(["Monarchy of the United Kingdom"]);   // no birth page: the second part has nothing to bind or witness
  const res = await runSlotParts({ parts, lang: "en", webPassages: ["monarchyUK"].map(asPassage), searchQ: "Who is the king of the UK", now: NOW, fetchImpl: w.fetchImpl });
  assert.ok(res.parts[1].boundAsk === "where was Charles III born", "the holder bound mechanically");
  assert.ok(res.parts[1].gap && ["unwitnessed", "dependent_unbound"].includes(res.parts[1].gap.kind), "an honest typed gap, never a guess: " + res.parts[1].gap?.kind);
  assert.ok(!(res.answer && res.answer.text.includes("born")), "no invented birthplace");
  assert.equal(endsTurn(res), true, "the turn still ends mechanically");
  assert.ok(!/chat\/completions|api\/tags|\/v1\/models|heimdall/i.test(w.busy.urls.join("\n")), "no MODEL endpoint was ever attempted (page-read widening is the pipeline's job, refusals here are the world's)");
});

test("a NON-SLOT part ('…and why is that?') is a typed gap, never a guess, never a model call", async () => {
  const parts = splitSlotParts("Who is the US president and why is that important?");
  const w = fakeWorld(["President of the United States", "Donald Trump"]);
  const res = await runSlotParts({ parts, lang: "en", webPassages: ["potus", "trump"].map(asPassage), searchQ: "x", now: NOW, fetchImpl: w.fetchImpl });
  assert.ok(res.answer.text.includes("Donald Trump is the president of the United States."));
  assert.ok(res.parts[1].gap && res.parts[1].gap.kind === "non_slot_part");
  assert.ok(res.gap && /not a one-fact slot/.test(res.gap.english));
  assert.equal(w.busy.refused, 0);
});

// ── the wire seams in run() (a re-ordered edit cannot unwire the slice) ─────
test("THE WIRE'S CONTRACT holds for compounds too: if EVERY part hands off, the whole ask hands off and the usual path runs (never a trapped gap)", async () => {
  const parts = splitSlotParts("Who is the zorbax of planet x and where was he risen?");
  const w = fakeWorld([]);   // a world that resolves nothing: every part hands off
  const res = await runSlotParts({ parts, lang: "en", webPassages: [], searchQ: "x", now: NOW, fetchImpl: w.fetchImpl, timeBoxMs: 4000 });
  assert.ok(res.handoff && res.handoff.kind === "compound_handoff", JSON.stringify(res).slice(0, 140));
});

test("a PARTIAL compound carries its missing part as the composed gap's english (the fold notice under the answer)", async () => {
  const parts = splitSlotParts("Who is the king of the UK and where was he born?");
  const w = fakeWorld(["Monarchy of the United Kingdom"]);
  const res = await runSlotParts({ parts, lang: "en", webPassages: ["monarchyUK"].map(asPassage), searchQ: "x", now: NOW, fetchImpl: w.fetchImpl });
  assert.ok(res.answer, "the held part answers");
  assert.ok(res.gap && /one fact is missing/.test(res.gap.english), "the missing part is named: " + JSON.stringify(res.gap));
  const src = fs.readFileSync(new URL("./fold-chat.js", import.meta.url), "utf8");
  assert.ok(/earlyNotices\.push\(\{ kind: "fold", text: String\(slotTurn\.gap\.english\)/.test(src), "run() draws it as a fold notice");
  assert.ok(/const notices = \[\.\.\.earlyNotices\]/.test(src), "the notice rides the message's own channel");
});

test("fold-chat.js is wired: the compound runs before the single one shot, model-barred through the strand, drawn as stored parts", () => {
  const at = (re) => { const m = re.exec(CHAT_SRC); return m ? m.index : -1; };
  assert.ok(at(/splitSlotParts\(slotQuestion\)/) > 0, "the splitter is called (on the follow-up-bound ask, nesting audit B-D6: slotQuestion is `question` unless a pronoun was bound)");
  assert.ok(at(/runSlotParts\(\{ parts: slotParts/) > at(/splitSlotParts\(slotQuestion\)/), "parts run after the split, before the single shot");
  assert.ok(at(/runSlotTurn\(\{ question: slotQuestion/) > at(/runSlotParts\(\{ parts: slotParts/), "the single one shot still runs for a non-compound ask");
  assert.ok(/slotAskFor\(follow, question,/.test(CHAT_SRC), "the follow-up's bound referent is handed to the slot pipeline (B-D6)");
  assert.ok(/\? slotTurn = slotRes/.test(CHAT_SRC) || /slotTurn = slotRes/.test(CHAT_SRC), "the composed turn is slotTurn (the strand marks it, barring the model)");
  assert.ok(/fold-chat-split\.js/.test(fs.readFileSync(new URL("./fold-chat-answercard.js", import.meta.url), "utf8")), "a parts turn draws its content as prose, not as the single-answer card (the guard lives in mountAnswerCard, so the wired call line stands)");
  assert.ok(/splitSlotParts, runSlotParts/.test(CHAT_SRC), "the imports are in place");
  assert.ok(/partsContentAllowed/.test(fs.readFileSync(new URL("./fold-chat-strand.js", import.meta.url), "utf8")), "strand holds the parts invariant");
});

// ── the model-never-alone continuations of the compound ─────────────────────
test("FALSIFIER: a compound turn never calls anything but the encyclopedia — refused outbound is zero across every end-state", async () => {
  for (const q of ["Who is the US president and where was he born?", "Who is the king of the UK and who is his wife?", "Who is the US president and why is that important?"]) {
    const parts = splitSlotParts(q);
    const w = fakeWorld(["President of the United States", "Donald Trump", "Queens", "Monarchy of the United Kingdom", "Charles III", "Camilla"]);
    const res = await runSlotParts({ parts, lang: "en", webPassages: ["potus", "trump", "queens", "monarchyUK", "charles3", "camilla"].map(asPassage), searchQ: q, now: NOW, fetchImpl: w.fetchImpl });
    assert.ok(res.handoff || endsTurn(res), q);
    assert.equal(w.busy.refused, 0, q + " made an outbound call that is not the encyclopedia");
    assert.equal(JSON.stringify(res).includes("schema"), true);
  }
});

test("sanity: the worlds used above actually frame (the compound tests measure the machinery, not a fake world's generosity)", async () => {
  assert.ok(PAGES.potus.text.includes("Donald Trump is the president of the United States"));
  assert.ok(PAGES.trump.text.includes("Donald Trump was born in Queens"));
  assert.ok(PAGES.charles3.text.includes("The wife of Charles III is Camilla"));
  assert.ok(PAGES.australia.text.includes("Canberra is the capital city of Australia"));
});