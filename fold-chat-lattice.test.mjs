// fold-chat-lattice.test.mjs — the abstraction-lattice scaffolding for the
// allowed model turn: the ground/lens/paradigm ladder, nested-reasoning
// instruction, and its honesty law (a scaffold may lead, never invent).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { climbLattice, lensOf, paradigmOf, latticePrompt, scaffoldWithoutInvention } from "./fold-chat-lattice.js";

const S = [
  "The president of the United States is the head of state and head of government of the United States.",
  "Donald Trump is the 47th and current president of the United States, having taken office on January 20, 2025.",
];
const CRUES = ["the ask names an incumbent office", "a change of holder is a rare, newsworthy event"];

test("the ladder climbs: ground quotes the material, lens is the ask's own words, paradigm the declared shape", () => {
  const l = climbLattice({ question: "Who is the current president of the United States and what party is he in?", referents: ["president of the United States"], sentences: S, cues: CRUES, slot: "person" });
  assert.ok(l.steps[0].lines.length === 2, "L1 quotes the material");
  assert.ok(l.steps[0].lines[1].includes("Donald Trump is the 47th"));
  assert.ok(l.steps[1].lines[0].includes("current president"), "L2 keeps the ask's content words");
  assert.ok(l.steps[2].lines[0].includes("incumbent"), "L3 names the declared shape");
  assert.equal(lensOf("Who is the current king of Sweden and what year was he born?").includes("king"), true);
  assert.equal(paradigmOf({ slot: "quantity" }).includes("number"), true);
});

test("no material, no ladder — a turn with nothing read is not given a ladder to climb", () => {
  assert.equal(climbLattice({ question: "Who is the king of the UK?", sentences: [] }), null);
  assert.equal(latticePrompt({ question: "x", sentences: [] }), null);
  assert.equal(climbLattice({ question: "x", sentences: ["a very short line"] }), null, "a quote must carry at least a sentence");
});

test("the prompt is nested reasoning: climb before reply, restate L1 with its address, thinking stays private", () => {
  const p = latticePrompt({ question: "Who is the current president of the United States?", sentences: S, cues: CRUES, slot: "person" });
  assert.match(p, /REASON IN THE LATTICE BEFORE YOU REPLY/);
  assert.match(p, /L1 · GROUND/);
  assert.match(p, /L2 · LENS/);
  assert.match(p, /L3 · PARADIGM/);
  assert.match(p, /must restate an L1 quote/);
  assert.match(p, /Nothing the ladder said is spoken — only what the ground holds/);
});

test("FALSIFY: the scaffold never invents a word — every content word is the ask's, a quote's, a cue's, or the declared rung vocabulary", () => {
  const p = latticePrompt({ question: "Who is the current president of the United States?", sentences: S, cues: CRUES, slot: "person" });
  const check = scaffoldWithoutInvention(p, { question: "Who is the current president of the United States?", quotes: S, cues: CRUES });
  assert.equal(check.ok, true, "foreign words: " + JSON.stringify(check.foreign));
});

test("FALSIFY: a pretend claim smuggled into the rungs is caught — try to make the ladder assert a date none of the quotes hold", () => {
  const sneaky = "The current president took office in 1776 and was born before the republic.";
  const l = climbLattice({ question: "Who is the current president of the United States?", sentences: S });
  l.steps[0].lines.push(`“${sneaky}”`);
  const p = ["L1 · GROUND", ...l.steps[0].lines].join("\n");
  const check = scaffoldWithoutInvention(p, { question: "Who is the current president of the United States?", quotes: S });
  assert.equal(check.ok, false, "a sentence the material never carried is a foreign word, refused");
  assert.ok(check.foreign.includes("1776"), "the invented figure is named");
});

test("the wiring seam exists: the lattice rides ONLY an allowed model turn — imported, gated, appended last — and reads flowInfo only AFTER its declaration (the live TDZ, pinned)", () => {
  const src = fs.readFileSync(new URL("./fold-chat.js", import.meta.url), "utf8");
  assert.ok(/import \{ latticePrompt \} from "\.\/fold-chat-lattice\.js"/.test(src), "the lattice is imported");
  assert.ok(/const latticePromptText = \(\(\) => \{/.test(src), "computed in one guarded pass");
  assert.ok(/if \(!modelRule\.allowed \|\| !webPassages\.length\) return null/.test(src), "only an allowed turn with material");
  assert.ok(/latticePromptText && Array\.isArray\(msgs\)/.test(src), "the scaffold rides the doorway");
  assert.ok(/salientSentences\(String\(p\.text/.test(src), "L1 comes from the turn's own salient read sentences");
  const iFlow = src.indexOf("let flowInfo = null");
  const iLat = src.indexOf("const latticePromptText = (() => {");
  assert.ok(iFlow > 0 && iLat > iFlow, "ORDER GUARD: the lattice reads flowInfo only after its declaration — no TDZ crash");
  const iDoor = src.indexOf("if (latticePromptText && Array.isArray(msgs)");
  assert.ok(iDoor > 0 && iDoor < iLat, "the doorway reads it at CALL time (closure), declared before the first call");
});