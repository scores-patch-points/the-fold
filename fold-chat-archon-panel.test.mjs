// fold-chat-archon-panel.test.mjs — the archon panel's reproduced must-fix findings (2026-10-13), each pinned as a falsifier.
// The panel (83 compendium archons + Champollion + the revision-grid editors + Kelsen; Gebser's arrival; independent reproductions)
// found that the referent fix decided by the STRING where it should decide by the referent, the clause and the stance. Every case
// below failed on commit 0320a6e (pre-panel) and is the panel's own input, or a minimal form of it.
import test from "node:test";
import assert from "node:assert/strict";
import { askFrame, stemOf } from "./fold-chat-frame.js";
import { bindSentence } from "./fold-chat-witness.js";
import { runAnswerTurn } from "./fold-chat-answerturn.js";
import { askTense } from "./fold-chat-falsify.js";
import { evaluate, answerKeeps } from "./fold-chat-compute.js";
import { functionWordsOf } from "./fold-chat-snippets.js";

const fw = functionWordsOf("en");
const titleCase = (x) => x.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
const doorOf = (titles) => async (xs) => new Map(xs.map((x) => { const t = titles[x.toLowerCase()]; return [x, t ? { title: t, redirectedFrom: null, disambiguation: false } : null]; }));
const frameOf = (q, titles) => askFrame(q, { fw, lang: "en", resolveTitles: doorOf(titles) });
const bind = (f, text, topic = null) => bindSentence({ text, start: 0, end: text.length }, f, { fw, lang: "en", topic });
// a whole slot turn over hand-built pages: the referent pages are what the reader reads; the door knows exactly `titles`
async function turn(q, pages, titles) {
  const pass = Object.entries(pages).map(([title, text], i) => ({ ref: "S" + (i + 1), title, url: "https://en.wikipedia.org/wiki/" + title.replace(/ /g, "_"), host: "en.wikipedia.org", lang: "en", text }));
  const deps = { fw: functionWordsOf, resolveTitles: doorOf(titles), fetchLead: async (name) => { const t = titles[String(name).toLowerCase()]; return t && pages[t] ? { title: t, extract: pages[t], url: "u" } : null; }, searchPassages: async () => [] };
  return runAnswerTurn({ question: q, lang: "en", passages: pass, now: { year: 2026 }, deps });
}
const filler = (t) => (t && t.answer && t.answer.filler ? t.answer.filler.text : null);
const fillersOf = (t) => [filler(t), ...((t && t.contest) || []).map((c) => c.filler && c.filler.text)].filter(Boolean);

test("MF1 Dignaga/Panini: a preposition is not a direct object — 'wrote ABOUT Hamlet', 'painted OVER the Mona Lisa' author nothing", async () => {
  const titles = { hamlet: "Hamlet", voltaire: "Voltaire", "mona lisa": "Mona Lisa", vandals: "Vandals" };
  const t1 = await turn("Who wrote Hamlet?", { Hamlet: "Voltaire wrote about Hamlet in 1768. Hamlet is a tragedy." }, titles);
  assert.ok(!fillersOf(t1).includes("Voltaire"), JSON.stringify(fillersOf(t1)));
  const t2 = await turn("Who painted the Mona Lisa?", { "Mona Lisa": "Vandals painted over the Mona Lisa in 1956." }, titles);
  assert.ok(!fillersOf(t2).includes("Vandals"), JSON.stringify(fillersOf(t2)));
  const ok = await turn("Who wrote Hamlet?", { Hamlet: "Voltaire wrote Hamlet in 1768." }, titles);          // control: a real direct object still binds
  assert.equal(filler(ok), "Voltaire");
});

test("MF2 Roberts/Scheherazade/Wigmore: a hedged, conditional or asking sentence is no witness", async () => {
  const titles = { penicillin: "Penicillin", "howard florey": "Howard Florey" };
  for (const s of ["Penicillin might have been discovered by Howard Florey.", "If penicillin had been discovered by Howard Florey, history would differ.", "A popular legend says penicillin was discovered by Howard Florey.", "Was penicillin discovered by Howard Florey?"]) {
    const t = await turn("Who discovered penicillin?", { Penicillin: s }, titles);
    assert.ok(!t.answer, s + " → " + JSON.stringify(filler(t)));
  }
});

test("MF3 Panini/Thymus: the agent is THIS verb's, in THIS clause, and somebody — not 'by accident', 'by 1930' or a later verb's agent", async () => {
  const titles = { penicillin: "Penicillin", "howard florey": "Howard Florey", accident: "Accident", pfizer: "Pfizer" };
  for (const s of ["Penicillin was discovered by accident in 1928.", "Penicillin was discovered by 1930.", "Penicillin was discovered in 1928 and later developed by Howard Florey.", "Penicillin was discovered in 1928 and is now produced by Pfizer."]) {
    const t = await turn("Who discovered penicillin?", { Penicillin: s }, titles);
    assert.ok(!t.answer, s + " → " + JSON.stringify(filler(t)));
  }
});

test("MF4 Zhengming/Bukhari: co-agents do not collapse to the LAST conjunct", async () => {
  const titles = { penicillin: "Penicillin", "alexander fleming": "Alexander Fleming", "howard florey": "Howard Florey" };
  const t = await turn("Who discovered penicillin?", { Penicillin: "Penicillin was discovered in 1928 by Alexander Fleming and Howard Florey." }, titles);
  assert.notEqual(filler(t), "Howard Florey");
  assert.equal(filler(t), "Alexander Fleming");
});

test("MF5 Houdini/Goffman: the name keeps its head — no surname, trailing word or market replaces the person", async () => {
  const titles = { widget: "Widget", smithfield: "Smithfield", "alexander fleming": "Alexander Fleming", frs: "Fellow of the Royal Society", penicillin: "Penicillin", paris: "Paris" };
  const w = await turn("Who invented the Widget?", { Widget: "The Widget was invented in 1931 by the engineer John Smithfield." }, titles);
  assert.ok(!fillersOf(w).includes("Smithfield"), JSON.stringify(fillersOf(w)));
  const p = await turn("Who discovered penicillin?", { Penicillin: "Penicillin was discovered in 1928 by the retired plumber Jane Paris." }, titles);
  assert.ok(!fillersOf(p).includes("Paris"), JSON.stringify(fillersOf(p)));
  const f = await turn("Who discovered penicillin?", { Penicillin: "Penicillin was discovered in 1928 by Alexander Fleming FRS at St Mary's." }, titles);
  assert.equal(filler(f), "Alexander Fleming");
});

test("MF6 Thrax/Mozi: a name in argument position is a name, whatever the prior says of the word ('Nice', 'Hope Solo', 'Cook Islands')", async () => {
  const titles = { nice: "Nice", up: "Up (2009 film)", "hope solo": "Hope Solo", "cook islands": "Cook Islands" };
  assert.deepEqual((await frameOf("Where is Nice?", titles)).referents.map((r) => r.title), ["Nice"]);
  // "Who directed Up?" stays disclosed: a title made only of function words is never a referent (the frame's pinned doctrine)
  assert.deepEqual((await frameOf("Who is Hope Solo?", titles)).referents.map((r) => r.title), ["Hope Solo"]);
  assert.deepEqual((await frameOf("Where are the Cook Islands?", titles)).referents.map((r) => r.title), ["Cook Islands"]);
});

test("MF7 Sullivan/Meyer: a relation verb the prior never saw is still the relation ('penned', 'choreographed')", async () => {
  const titles = { penned: "Pen", hamlet: "Hamlet", choreographed: "Choreography", "swan lake": "Swan Lake" };
  const f = await frameOf("Who penned Hamlet?", titles);
  assert.deepEqual(f.referents.map((r) => r.title), ["Hamlet"]);
  assert.ok(f.predicate.some((p) => p.surface === "penned" && p.rel), JSON.stringify(f.predicate));
  const g = await frameOf("Who choreographed Swan Lake?", titles);
  assert.deepEqual(g.referents.map((r) => r.title), ["Swan Lake"]);
});

test("MF8 KleeneUp/Khaldun: a date that does not exist is refused, never computed", () => {
  for (const q of ["How many days between 30 February 2026 and 1 March 2026?", "How many days between 31 April 2026 and 1 May 2026?", "How many days between 29 February 2027 and 1 March 2027?", "How many days between 2026-02-30 and 2026-03-01?", "How many days between 1 January 0099 and 1 January 0100?"]) {
    assert.equal(evaluate(q).ok, false, q);
  }
  assert.equal(evaluate("How many days between 29 February 2028 and 1 March 2028?").value, 1, "a real leap day is a real day");
});

test("MF9 Liu Hui: a faithful wording that restates the dates is kept — the derivation's operands are the dates' own numbers", () => {
  const c = evaluate("How many days between 1 January 2026 and 1 March 2026?");
  const k = answerKeeps("There are 59 days between 1 January 2026 and 1 March 2026.", c);
  assert.equal(k.ok, true, JSON.stringify(k));
});

test("MF10 Kelsen/Tungara: an -e verb meets its inflections, so a denial in the base form is seen", async () => {
  assert.equal(stemOf("composed"), stemOf("compose"));
  assert.equal(stemOf("creating"), stemOf("create"));
  assert.notEqual(stemOf("rose"), stemOf("ros"));
  const titles = { hamlet: "Hamlet", "william shakespeare": "William Shakespeare" };
  const t = await turn("Who composed Hamlet?", { Hamlet: "William Shakespeare composed Hamlet. Some Baconians claim that William Shakespeare did not compose Hamlet." }, titles);
  assert.notEqual(t.answer && t.answer.standing, "survived", "a source says otherwise: never 'survived'");
});

test("MF12 Berge/Mahavira: a sentence that gives the role another anchor is about that anchor, even beside a mention of ours", async () => {
  const f = await frameOf("What is the capital of Australia?", { australia: "Australia", capital: "Capital" });
  assert.equal(bind(f, "Ottawa is the capital of Canada, while Australia is far away."), null);
  assert.equal(bind(f, "Canberra is the capital of Australia.").filler.text, "Canberra", "control");
});

test("MF13 Clark/Meerkat: a title anchors an attribute only when it IS the role page", async () => {
  const f = await frameOf("Who is the president of France?", { president: "President", france: "France" });
  assert.equal(bind(f, "The president is Philippe Diallo.", "France national football team"), null);
  const r = bind(f, "The president is Emmanuel Macron.", "President of France");
  assert.ok(r && r.filler && r.filler.text === "Emmanuel Macron", "control: the role page itself");
});

test("MF16 Shizhen: 'the second largest' is not the largest, hyphen or no hyphen", async () => {
  const f = await frameOf("What is the largest planet in the solar system?", { planet: "Planet", "solar system": "Solar System" });
  const r = bind(f, "Saturn is the second largest planet in the Solar System.");
  assert.ok(!r || r.tier !== "T1" || !r.filler, JSON.stringify(r && r.filler));
  assert.equal(bind(f, "Jupiter is the largest planet in the Solar System.").filler.text, "Jupiter");
});

test("MF17 Partee: a present-tense VERB ask is present, so a dead holder can be refuted", () => {
  assert.equal(askTense({ said: "Who leads the United Nations?", lang: "en" }), "present");
  assert.equal(askTense({ said: "Who did lead the United Nations?", lang: "en" }), "past");
});

test("MF18 Alhazen: an encyclopedia's qualifier is not the referent's word ('Jaws (film)')", async () => {
  const f = await frameOf("Who directed Jaws?", { jaws: "Jaws (film)", "steven spielberg": "Steven Spielberg" });
  const r = bind(f, "Jaws is a 1975 American thriller film directed by Steven Spielberg.", "Jaws (film)");
  assert.ok(r && r.filler && /Steven Spielberg/.test(r.filler.text), JSON.stringify(r));
});

test("MF20 Saltzer: an unresolved name of the ask must be said ('where was ZELDA born in France')", async () => {
  const f = await frameOf("Where was Zelda born in France?", { france: "France" });
  const r = bind(f, "Jean Dupont was born in France.");
  assert.ok(!r || r.tier !== "T1", JSON.stringify(r));
});

test("MF21 Arokin: the receipt keeps what was asked — attributes and the counted noun ride the frame", async () => {
  const t = await turn("Who is the king of the UK?", { "Monarchy of the United Kingdom": "Charles III is the king of the United Kingdom." }, { uk: "United Kingdom", king: "King", "charles iii": "Charles III" });
  assert.ok(Array.isArray(t.frame.attributes) && t.frame.attributes.some((a) => a.surface === "king"), JSON.stringify(t.frame));
});
