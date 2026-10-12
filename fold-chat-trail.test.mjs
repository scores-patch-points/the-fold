// fold-chat-trail.test.mjs — the trail in plain language (user, 2026-10-11): mechanically known facts,
// spoken like the record line; NO jargon (no "relation · want · baton · gate"), and the trail from one
// turn to the next is unmissable (continues / new ask / cold — each names the prior turn).
import test from "node:test";
import assert from "node:assert/strict";
import { trailOf } from "./fold-chat-trail.js";

const prior = { turn: 2, ask: "who is the president?", record: { line: "On record · turn 2 · 3 addresses checked · nothing unsupported · every sentence grounded", sources: [{ address: "a" }, { address: "b" }, { address: "c" }], grounded: true, unsupported: 0 } };

test("first turn: no prior — no trail (there is nothing to track)", () => {
  assert.equal(trailOf({ now: "hello", prior: null }), null);
});

test("a follow-up names the prior turn, its ask, its grounding, and the carried sources — plainly, no jargon", () => {
  const t = trailOf({ now: "the us president", prior, follow: { mode: "thread" }, carriedCount: 3 });
  assert.match(t, /Turn 2/);
  assert.match(t, /who is the president/);
  assert.match(t, /3 address/);
  assert.match(t, /every sentence grounded/);
  assert.match(t, /continues it/);
  assert.match(t, /3 source\(s\) that turn read are carried, no new search/);
  for (const no of ["relation", "want:", "baton", "gate:", "nudge"]) assert.ok(!t.includes(no), `no jargon: ${no}`);
});

test("a new ask says exactly that — the prior turn is not carried", () => {
  const t = trailOf({ now: "what is a widget?", prior, follow: { mode: "web" } });
  assert.match(t, /A new ask/);
  assert.match(t, /Turn 2 \(“who is the president\?”\) is not carried/);
  assert.match(t, /searches and reads fresh sources/);
});

test("a cold follow-up: nothing was written to follow — plain, and nothing is asked", () => {
  const t = trailOf({ now: "and then?", prior, follow: { mode: "cold-gap" } });
  assert.match(t, /cold follow-up/);
  assert.match(t, /wrote nothing to follow/);
  assert.match(t, /neither the model nor the sources are asked/);
});

test("a flag is spoken as a plain tail, never as a code", () => {
  const t = trailOf({ now: "the us president", prior, follow: { mode: "thread" }, carriedCount: 1, flags: ["searched_when_none_expected"] });
  assert.match(t, /searched when none expected/);
  assert.ok(!t.includes("_"), "the flag is not shown as a code");
});