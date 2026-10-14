// fold-chat-channel.test.mjs — DISCOURSE AWARENESS (live English gate, 2026-10-13): all four follow-up scripts failed because a pronoun bound to
// the last question's TOPIC and to PAGE TITLES — "Where was he born?" after "Who composed the Moonlight Sonata?" pointed back to "Moonlight Sonata"
// and "Symphony No.". The channel is what the person said and what the Fold itself answered; fetched pages vouch for a name but are never an
// antecedent. A reference that is not unique is ASKED, with the candidates as options; a person pronoun with no person in the channel says so.
import test from "node:test";
import assert from "node:assert/strict";
import { admitReferents, emptyReferents, resolveQuestion } from "./fold-chat-mind.js";
import { followUp, turnPlan, referenceQuestion } from "./fold-chat-thread.js";

const HINTS = { personalPronouns: ["he", "she", "him", "her", "his"], carryTriggers: ["it", "its", "that", "this", "they", "them"], titles: ["Mr", "Mrs", "Dr"] };
const GATE = { carry: true, decided: true, kind: "pronoun" };
const turn = (o) => ({ sources: [], answer: "", creative: false, ...o });

const BEETHOVEN = turn({
  question: "Who composed the Moonlight Sonata?", slot: "person",
  answer: "Beethoven composed the Moonlight Sonata during a particularly productive period of his life.",
  filler: { text: "Beethoven", slot: "person" },
  sources: [{ title: "Moonlight Sonata" }, { title: "Symphony No. 5" }, { title: "Ludwig van Beethoven" }],
});
const KENYA = turn({
  question: "What is the capital of Kenya?", slot: "thing",
  answer: "Kenya's capital and largest city is Nairobi.", filler: { text: "Nairobi", slot: "thing" },
  sources: [{ title: "Kenya" }, { title: "List of capitals in Africa" }],
});
const FOUNDERS = turn({
  question: "Who founded Nashville?", slot: "person",
  answer: "Nashville was founded in 1779 by James Robertson and John Donelson.",
  sources: [{ title: "Nashville, Tennessee" }],
});
const GAP = turn({ question: "Who wrote Pride and Prejudice?", slot: "person", answer: "", sources: [{ title: "Pride and Prejudice" }] });

const record = (...turns) => turns.reduce((rec, t) => admitReferents(rec, t), emptyReferents());
const resolve = (q, rec, gate = GATE) => resolveQuestion(q, rec, { hints: HINTS, gate });

test("LIVE: 'Where was he born?' after 'Who composed the Moonlight Sonata?' is Beethoven — the person who was the answer, not the work, not a page title", () => {
  const r = resolve("Where was he born?", record(BEETHOVEN));
  assert.equal(r.reason, "carried", JSON.stringify(r));
  // the fetched title "Ludwig van Beethoven" VOUCHES for the channel's "Beethoven" (it fills out the name); it did not make him the antecedent
  assert.deepEqual(r.carried.map((c) => c.surface), ["Ludwig van Beethoven"]);
});

test("a fetched TITLE never beats a candidate the channel has, and is never a PERSON: 'it' stays the sonata, 'he' is not the page", () => {
  // the sources also returned "Symphony No. 5": it must not waylay "it"
  const r = resolve("When was it written?", record(BEETHOVEN));
  assert.deepEqual(r.carried.map((c) => c.surface), ["Moonlight Sonata"]);
  // a record whose ONLY names are fetched titles: "he" has no person — a page title is not who he is
  const rec = record(turn({ question: "tell me about that", answer: "", sources: [{ title: "Nashville, Tennessee" }, { title: "Music City" }] }));
  const he = resolve("What did he do?", rec);
  assert.equal(he.reason, "no-person-to-carry", JSON.stringify(he));
  // …while a non-personal ask with NO channel name at all may use the page that answered, as the topic (fills an empty pool, never overrides)
  const it = resolve("What about it?", rec);
  assert.equal(it.reason, "carried", JSON.stringify(it));
});

test("a surface with a digit is not a person: 'he' after the Moon landing is Armstrong, not 'Apollo 11'", () => {
  const MOON = turn({ question: "Who was the first man on the moon?", slot: "person", answer: "Neil Armstrong was the first person to walk on the moon, on 20 July 1969, during the Apollo 11 mission, with Buzz Aldrin.",
    filler: { text: "Neil Armstrong", slot: "person" }, sources: [{ title: "Neil Armstrong" }, { title: "Apollo 11" }] });
  const r = resolve("was he the first?", record(MOON));
  assert.equal(r.reason, "carried", JSON.stringify(r));
  assert.deepEqual(r.carried.map((c) => c.surface), ["Neil Armstrong"]);
  // and without the filler (a prose answer), the digit still keeps the mission out of the people
  const PROSE = turn({ question: "Who was the first man on the moon?", answer: "Neil Armstrong was the first person to walk on the moon, during the Apollo 11 mission.", sources: [{ title: "Neil Armstrong" }, { title: "Apollo 11" }] });
  assert.deepEqual(resolve("what did he say when he landed?", record(PROSE)).carried.map((c) => c.surface), ["Neil Armstrong"]);
});

test("a name the PERSON typed in lowercase is theirs: 'tell me about mars' makes Mars the topic, ahead of the moons the answer lists", () => {
  const MARS = turn({ question: "tell me about mars", answer: "Mars is the fourth planet from the sun. It has two small moons, Phobos and Deimos, and the tallest volcano, Olympus Mons.", sources: [{ title: "Mars" }] });
  const r = resolve("how big are they", record(MARS));
  assert.equal(r.reason, "carried", JSON.stringify(r));
  assert.equal(r.carried[0].surface, "Mars");
});

test("LIVE gap: 'Who wrote Pride and Prejudice?' found no one — 'she' has no person in the channel, and a BOOK is not read as one", () => {
  const r = resolve("When was she born?", record(GAP));
  assert.equal(r.reason, "no-person-to-carry", JSON.stringify(r));
  assert.deepEqual(r.carried, []);
});

test("a non-personal 'it' after a who-ask is the work, never the person who answered", () => {
  const r = resolve("When was it written?", record(BEETHOVEN));
  assert.equal(r.reason, "carried", JSON.stringify(r));
  assert.deepEqual(r.carried.map((c) => c.surface), ["Moonlight Sonata"]);
});

test("LIVE Kenya: 'What is its population?' — Kenya leads (the person's own subject, the answer's, the page's) and is carried, not asked", () => {
  const r = resolve("What is its population?", record(KENYA));
  assert.equal(r.reason, "carried", JSON.stringify(r));
  assert.equal(r.carried[0].surface, "Kenya");
});

test("an EXACT TIE for a pronoun is ASKED: two co-founders, 'him' — both offered, nothing guessed", () => {
  const r = resolve("What happened to him later in life?", record(FOUNDERS));
  assert.equal(r.reason, "ambiguous", JSON.stringify(r));
  assert.deepEqual(r.options.slice().sort(), ["James Robertson", "John Donelson"]);
  assert.deepEqual(r.carried, []);
});

test("an elliptical ask with no pronoun is never asked 'which one': 'what else' carries as before", () => {
  const r = resolve("what else", record(FOUNDERS), { carry: true, decided: true, kind: "elliptical" });
  assert.notEqual(r.reason, "ambiguous");
});

test("RECENCY: the latest turn's person wins — 'he' after Beethoven and then Van Gogh is Van Gogh", () => {
  const VG = turn({ question: "Who painted The Starry Night?", slot: "person", answer: "Vincent van Gogh painted The Starry Night.", filler: { text: "Vincent van Gogh", slot: "person" }, sources: [{ title: "The Starry Night" }] });
  const r = resolve("Where was he born?", record(BEETHOVEN, VG));
  assert.equal(r.reason, "carried", JSON.stringify(r));
  assert.deepEqual(r.carried.map((c) => c.surface), ["Vincent van Gogh"]);
});

test("a chosen referent, marked '(about: …)', resolves — and cannot ask again (no loop)", () => {
  const r = resolve("What is its population? (about: Kenya)", record(KENYA));
  assert.equal(r.reason, "carried");
  assert.deepEqual(r.carried.map((c) => c.surface), ["Kenya"]);
  assert.equal(r.carried[0].by, "chosen");
});

test("a language with no personal-pronoun prior is unchanged: it does not ask, it does not carry a person", () => {
  const r = resolveQuestion("Where was he born?", record(BEETHOVEN), { hints: null, gate: GATE });
  assert.notEqual(r.reason, "no-person-to-carry");
});

// ── the planner: the question and the clickable choices ───────────────────────────
const msgs = (q, a) => [{ role: "user", content: q }, { role: "assistant", content: a, mode: "chat" }];

test("followUp: a tied 'him' becomes a clarify-reference with a plain question and choices that resend the ask marked with the pick", () => {
  const prior = msgs("Who founded Nashville?", "Nashville was founded in 1779 by James Robertson and John Donelson.");
  const f = followUp("What happened to him later in life?", prior, { referents: record(FOUNDERS), hints: HINTS });
  assert.equal(f.kind, "clarify-reference", JSON.stringify(f));
  assert.equal(f.reason, "ambiguous-reference");
  const labels = f.choices.map((c) => c.label).sort();
  assert.deepEqual(labels, ["James Robertson", "John Donelson"]);
  for (const c of f.choices) assert.equal(c.ask, `What happened to him later in life? (about: ${c.label})`);
  assert.match(f.question, /“him”/);
  assert.match(f.question, /James Robertson or John Donelson|John Donelson or James Robertson/);
});

test("turnPlan: a clarify-reference is mode 'clarify' — nothing is searched, no model is asked", () => {
  const prior = msgs("Who founded Nashville?", "Nashville was founded in 1779 by James Robertson and John Donelson.");
  const p = turnPlan("What happened to him later in life?", prior, { referents: record(FOUNDERS), hints: HINTS });
  assert.equal(p.mode, "clarify");
  assert.equal(p.search, null);
  assert.equal(p.modelMay, false);
});

test("followUp: the gap case says there is no person yet, with no options and never a search of the book's title", () => {
  const prior = msgs("Who wrote Pride and Prejudice?", "No source I read says who holds this.");
  const f = followUp("When was she born?", prior, { referents: record(GAP), hints: HINTS });
  assert.equal(f.kind, "clarify-reference", JSON.stringify(f));
  assert.equal(f.reason, "no-person-in-channel");
  assert.deepEqual(f.choices, []);
  assert.match(f.question, /“she”/);
  assert.match(f.question, /Who do you mean/);
});

test("followUp: the Beethoven follow-up is carried, searched as the name the title vouched for", () => {
  const prior = msgs("Who composed the Moonlight Sonata?", "Beethoven composed the Moonlight Sonata.");
  const f = followUp("Where was he born?", prior, { referents: record(BEETHOVEN), hints: HINTS });
  assert.equal(f.kind, "carried", JSON.stringify(f));
  assert.deepEqual(f.carried, ["Ludwig van Beethoven"]);
  assert.match(f.query, /^Ludwig van Beethoven /);
});

test("referenceQuestion words it plainly, for two and for three candidates", () => {
  assert.equal(referenceQuestion({ pronoun: "its", options: ["Nairobi", "Kenya"] }), "By “its” do you mean Nairobi or Kenya?");
  assert.equal(referenceQuestion({ pronoun: "he", options: ["A", "B", "C"] }), "By “he” do you mean A, B or C?");
});

// ── "again" and "that one" ─────────────────────────────────────────────────────────
test("'again' is a REPEAT of the last ask — never a topic carried, never the word searched (en, es, fr)", () => {
  const prior = msgs("Who composed the Moonlight Sonata?", "Beethoven composed the Moonlight Sonata.");
  for (const [ask, lang] of [["again", "en"], ["do that again", "en"], ["and again?", "en"], ["try again", "en"], ["once more", "en"], ["otra vez", "es"], ["de nuevo", "es"], ["encore", "fr"], ["encore une fois", "fr"]]) {
    const f = followUp(ask, prior, { referents: record(BEETHOVEN), hints: HINTS, lang });
    assert.equal(f.kind, "retry", `${ask}: ${JSON.stringify(f)}`);
    assert.equal(f.retry, "Who composed the Moonlight Sonata?", ask);
    assert.equal(f.query, "Who composed the Moonlight Sonata?", ask);
    assert.equal(f.said, ask, "the person's words are never rewritten");
  }
});

test("'again' inside a real ask is not a repeat: it keeps its own content", () => {
  const prior = msgs("Who composed the Moonlight Sonata?", "Beethoven composed the Moonlight Sonata.");
  const f = followUp("Where was he born again?", prior, { referents: record(BEETHOVEN), hints: HINTS, lang: "en" });
  assert.notEqual(f.kind, "retry", JSON.stringify(f));
});

test("a repeat with nothing earlier to repeat is the cold gap, not a search of the word", () => {
  const f = followUp("again", [], { referents: emptyReferents(), hints: HINTS, lang: "en" });
  assert.notEqual(f.kind, "retry");
  assert.notEqual(f.reason, "carried-referent");
});

test("'that one' after a CONTEST is asked among the contested answers — the Fold's own banner is never the antecedent", () => {
  const TEL = turn({ question: "Who invented the telephone?", slot: "person",
    answer: "THESE SOURCES GIVE DIFFERENT ANSWERS. Antonio Meucci. Alexander Graham Bell. Elisha Gray.",
    candidates: ["Antonio Meucci", "Alexander Graham Bell", "Elisha Gray"], sources: [] });
  const r = resolve("tell me about that one", record(TEL));
  assert.equal(r.reason, "ambiguous", JSON.stringify(r));
  assert.deepEqual(r.options.slice().sort(), ["Alexander Graham Bell", "Antonio Meucci", "Elisha Gray"]);
  assert.ok(!r.options.some((o) => /DIFFERENT ANSWERS/.test(o)), "the app's own banner is not a referent");
  // and "he" after the same contest is asked the same way
  const he = resolve("when was he born?", record(TEL));
  assert.equal(he.reason, "ambiguous", JSON.stringify(he));
});

// ── the two gates a fixture must isolate (mutation survivors, 2026-10-13) ─────────────────
test("a title-only name never joins a PERSON pronoun's tie: 'him' is asked between the founders, 'Music City' is not offered or carried", () => {
  const rec = record(turn({ question: "Who founded Nashville?", slot: "person", answer: "Nashville was founded in 1779 by James Robertson and John Donelson.", sources: [{ title: "Music City" }] }));
  assert.ok(rec.entities.some((e) => e.surface === "Music City" && !e.roles.some((r) => r === "question" || r === "answer" || r === "filler")), "fixture: Music City is title-only");
  const r = resolve("What happened to him later in life?", rec);
  assert.equal(r.reason, "ambiguous", JSON.stringify(r));
  assert.deepEqual(r.options.slice().sort(), ["James Robertson", "John Donelson"]);
});

test("a name typed ONLY in the question, in lowercase, is channel: 'tell me about mars', an answer that never says the word", () => {
  const rec = record(turn({ question: "tell me about mars", answer: "It is the fourth planet from the sun and has two small moons, Phobos and Deimos.", sources: [{ title: "Mars" }] }));
  const mars = rec.entities.find((e) => e.surface === "Mars");
  assert.ok(mars && mars.roles.includes("question"), JSON.stringify(rec.entities));
  const r = resolve("how big is it", rec);
  assert.equal(r.reason, "carried", JSON.stringify(r));
  assert.equal(r.carried[0].surface, "Mars");
});
