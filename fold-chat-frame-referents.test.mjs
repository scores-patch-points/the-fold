// F-D3 (nesting audit, 2026-10-14): the chat's referent record re-read the question by capitalisation (casedRuns) and never took the slot layer's own
// resolved referents (`frame.referents`: what the title door says the ask's names ARE), so a lower-case ask named nothing.
import test from "node:test";
import assert from "node:assert/strict";
import { runSlotTurn, frameReferentsOf } from "./fold-chat-answerwire.js";
import { runSlotParts, splitSlotParts } from "./fold-chat-split.js";
import { admitReferents, emptyReferents } from "./fold-chat-mind.js";
import { fetchImpl, passage, NOW } from "./eval/modelless/fetch-world.mjs";

const slot = (question, webPassages, searchQ = question) => runSlotTurn({ question, lang: "en", webPassages, searchQ, now: NOW, fetchImpl });

const A1 = "Emmanuel Macron (born 21 December 1977 in Amiens) is a French politician who has served as president of France since 14 May 2017.";

test("F-D3: the slot layer's resolved referents are admitted; before, a lower-case ask named nothing", () => {
  const ask = "who is the president of france?";
  const without = admitReferents(emptyReferents(), { question: ask, slot: "person", filler: null, candidates: [], creative: false, answer: "", sources: [] });
  assert.equal(without.entities.length, 0, "capitalisation alone reads nothing from this ask (the defect)");
  const frame = [{ surface: "president of france", title: "President of France", aliases: [] }];
  const withFrame = admitReferents(emptyReferents(), { question: ask, slot: "person", filler: null, candidates: [], creative: false, answer: "", sources: [], frame });
  assert.equal(withFrame.entities.length, 1);
  const e = withFrame.entities[0];
  assert.equal(e.surface, "President of France");
  assert.ok(e.roles.includes("question") && e.roles.includes("frame"));
  assert.ok(e.kinds.includes("anchor"), "a who-ask's own names are anchors, never the person asked after");
});

test("F-D3 controls: no frame / an empty frame leaves the record exactly as before; a frame with no title admits nothing", () => {
  const turn = { question: "Who is the president of France?", slot: "person", filler: { text: "Emmanuel Macron", slot: "person" }, candidates: [], creative: false, answer: A1, sources: [{ title: "Emmanuel Macron" }] };
  const a = admitReferents(emptyReferents(), turn);
  assert.deepEqual(admitReferents(emptyReferents(), { ...turn, frame: [] }), a);
  assert.deepEqual(admitReferents(emptyReferents(), { ...turn, frame: [{ surface: "x", title: "" }, null] }), a);
  const f = admitReferents(emptyReferents(), { ...turn, frame: [{ surface: "France", title: "President of France", aliases: ["president of france"] }] });
  assert.ok(f.entities.find((x) => x.surface === "President of France"));
});

test("F-D3: frameReferentsOf reads a single turn, a compound's every part, and nothing from a handoff", async () => {
  const single = await slot("Who is the president of France?", [passage("President of France")]);
  assert.ok(frameReferentsOf(single).some((r) => r.title === "President of France"));
  assert.deepEqual(frameReferentsOf({ handoff: { kind: "not_a_slot_ask" } }), []);
  assert.deepEqual(frameReferentsOf(null), []);
  const parts = splitSlotParts("Who is the president of France and where was he born?");
  assert.ok(parts && parts.length === 2);
  const t = await runSlotParts({ parts, lang: "en", webPassages: [passage("President of France"), passage("Emmanuel Macron")], searchQ: "president of France", now: NOW, fetchImpl });
  const titles = frameReferentsOf(t).map((r) => r.title);
  assert.ok(titles.includes("President of France") && titles.includes("Emmanuel Macron"), JSON.stringify(titles));
});

