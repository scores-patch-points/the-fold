// B-D6 (nesting audit, 2026-10-14): the follow-up referent planTurn bound ("he" -> Emmanuel Macron) never reached the slot pipeline, whose own title
// door read "born" as a page ("Charles III") and answered about that. B-stagemap t03 shape: "Who is the president of France?" then "Where was he born?".
// The slot turns are the REAL runSlotTurn over eval/modelless/fetch-world.mjs (the model-free battery's deterministic encyclopedia, as a node fetch).
import test from "node:test";
import assert from "node:assert/strict";
import { runSlotTurn, frameReferentsOf } from "./fold-chat-answerwire.js";
import { splitSlotParts, bindFollowUp, slotAskFor } from "./fold-chat-split.js";
import { planTurn } from "./fold-chat-flow.js";
import { admitReferents, emptyReferents } from "./fold-chat-mind.js";
import { hintsFor } from "./fold-chat-hints.js";
import { fetchImpl, passage, NOW } from "./eval/modelless/fetch-world.mjs";

const slot = (question, webPassages, searchQ = question) => runSlotTurn({ question, lang: "en", webPassages, searchQ, now: NOW, fetchImpl });

// the thread of t01 -> t03, exactly as run() holds it
const Q1 = "Who is the president of France?";
const A1 = "Emmanuel Macron (born 21 December 1977 in Amiens) is a French politician who has served as president of France since 14 May 2017.";
const record1 = admitReferents(emptyReferents(), { question: Q1, slot: "person", filler: { text: "Emmanuel Macron", slot: "person" }, candidates: [], creative: false, answer: A1, sources: [{ title: "Emmanuel Macron" }] });
const prior = [{ role: "user", content: Q1 }, { role: "assistant", content: A1, mode: "chat" }];
const follow = planTurn("Where was he born?", prior, { referents: record1, lang: "en", hints: hintsFor("en") });

test("t03 setup: planTurn binds the pronoun to exactly one referent (the carry notice's own read)", () => {
  assert.equal(follow.kind, "carried");
  assert.deepEqual(follow.carried, ["Emmanuel Macron"]);
  assert.equal(follow.gate.kind, "pronoun");
});

test("B-D6: handed the raw ask the slot pipeline answers about the wrong referent (the defect, kept as the baseline)", async () => {
  const t = await slot("Where was he born?", [passage("Emmanuel Macron")], follow.search);
  assert.deepEqual(frameReferentsOf(t).map((r) => r.title), ["Charles III"], "'born' was read as a page");
  assert.equal(t.answer, null);
});

test("B-D6: the follow-up's bound referent reaches the slot pipeline: right referent, answered from the right page", async () => {
  const b = slotAskFor(follow, "Where was he born?", "en");
  assert.equal(b.bound, true);
  assert.equal(b.ask, "Where was Emmanuel Macron born?");
  const t = await slot(b.ask, [passage("Emmanuel Macron")], follow.search);
  assert.deepEqual(frameReferentsOf(t).map((r) => r.title), ["Emmanuel Macron"]);
  assert.ok(t.answer, "answered");
  assert.equal(t.answer.filler.text, "Amiens");
  assert.match(t.answer.text, /Amiens/);
  assert.equal(t.answer.row.source.title, "Emmanuel Macron");
});

test("B-D6 negative controls: not determined -> the ask is returned unchanged, exactly as today", () => {
  assert.equal(slotAskFor({ kind: "standalone", carried: [] }, "Where was he born?").bound, false);
  assert.equal(slotAskFor({ ...follow, carried: ["Emmanuel Macron", "France"] }, "Where was he born?").bound, false, "two referents carried: not guessed");
  assert.equal(slotAskFor({ ...follow, gate: { kind: "connective" } }, "Where was he born?").bound, false, "no pronoun, no bind");
  assert.equal(bindFollowUp("Who painted the Mona Lisa?", { surface: "Emmanuel Macron" }).bound, false, "an ask with no anaphor token is untouched");
  assert.equal(bindFollowUp("Where was he born?", { surface: "" }).bound, false);
  assert.equal(bindFollowUp("Where was he born?", { surface: "Emmanuel Macron", lang: "ja" }).bound, false, "a language with no declared table is untouched");
  assert.equal(bindFollowUp("Where was he born?", { surface: "Emmanuel Macron" }).ask, "Where was Emmanuel Macron born?", "positive control");
  assert.equal(bindFollowUp("When did his term start?", { surface: "Emmanuel Macron" }).ask, "When did Emmanuel Macron's term start?");
  assert.equal(bindFollowUp("How tall is it?", { surface: "Eiffel Tower" }).ask, "How tall is Eiffel Tower?");
});

test("B-D6: a compound follow-up binds before it is split", async () => {
  const b = slotAskFor(follow, "Where was he born and when did he take office?", "en");
  assert.equal(b.ask, "Where was Emmanuel Macron born and when did Emmanuel Macron take office?");
  assert.ok(splitSlotParts(b.ask), "and it still splits");
});

