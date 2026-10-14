// fold-chat-wald-ledger.test.mjs — Wald's turn ledger: what it keeps, what it never keeps, how a turn is closed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ledgerEntry, nextActOf, closeLast, appendEntry, LEDGER_CAP } from "./fold-chat-wald-ledger.js";
import { waldShadow } from "./fold-chat-wald.js";
import { WALD_CALIBRATION } from "./fold-chat-wald-calibration.js";

const ASK_WORDS = "eiffel tower";
const shadow = () => ({
  ...waldShadow({ signals: { kind: "research", follow: { mode: "web", kind: "standalone" }, lookup: { warranted: true, measured: true, why: `the ask names ${ASK_WORDS}` } }, calibration: WALD_CALIBRATION, gateNow: true }),
  turnMs: 3498, webTaken: true, passagesKept: 3, decideMs: 0.4123,
});

test("an entry keeps the decision and never the ask's words (no why survives)", () => {
  const e = ledgerEntry({ sid: "s1", turn: 1, at: "t", head: "research:-", wald: shadow(), usedBy: "sources" });
  assert.equal(e.schema, "WaldLedger@1");
  assert.ok(e.votes.length > 0);
  assert.ok(e.votes.every((v) => Object.keys(v).sort().join() === "pull,vote,witness"));
  assert.ok(!JSON.stringify(e).includes("eiffel"), "the ask's words are not in the ledger");
  assert.equal(e.used, true);
  assert.equal(e.usedBy, "sources");
  assert.equal(e.next, null);
  assert.equal(e.webTaken, true);
  assert.equal(e.turnMs, 3498);
});

test("the next act is the planner's own reading", () => {
  assert.equal(nextActOf({ kind: "retry" }), "reask");
  assert.equal(nextActOf({ kind: "source-ask" }), "sourceAsk");
  assert.equal(nextActOf({ kind: "move", act: "escalation" }), "challenge");
  assert.equal(nextActOf({ kind: "standalone", act: "question" }), "moveOn");
  assert.equal(nextActOf(null), "moveOn");
});

test("closing touches only that session's last OPEN entry, and never re-closes", () => {
  let led = [];
  led = appendEntry(led, ledgerEntry({ sid: "a", turn: 1, wald: shadow() }));
  led = appendEntry(led, ledgerEntry({ sid: "b", turn: 1, wald: shadow() }));
  led = closeLast(led, "a", "reask");
  assert.equal(led[0].next, "reask");
  assert.equal(led[1].next, null, "another session's entry is untouched");
  const again = closeLast(led, "a", "moveOn");
  assert.equal(again[0].next, "reask", "a closed entry is never edited (append-only)");
});

test("an unknown act is refused, not stored", () => {
  const led = appendEntry([], ledgerEntry({ sid: "a", wald: shadow() }));
  assert.equal(closeLast(led, "a", "lol")[0].next, null);
});

test("the storage cap drops the oldest, keeping the newest", () => {
  let led = [];
  for (let i = 0; i < 5; i++) led = appendEntry(led, { turn: i }, { cap: 3 });
  assert.deepEqual(led.map((e) => e.turn), [2, 3, 4]);
  assert.ok(LEDGER_CAP > 0);
});

test("a pull is used when the answer cites it OR is its own words; nothing else counts (Clarification 1)", () => {
  assert.equal(ledgerEntry({ wald: shadow(), usedBy: "cited" }).used, true);
  assert.equal(ledgerEntry({ wald: shadow(), usedBy: "sources" }).used, true);
  assert.equal(ledgerEntry({ wald: shadow(), usedBy: null }).used, false);
  assert.equal(ledgerEntry({ wald: shadow(), usedBy: "vibes" }).used, false, "an unknown use is not a use");
});

test("a lost write is never silent: the next entry carries how many were dropped (chorus: Feynman)", () => {
  assert.equal(ledgerEntry({ wald: shadow() }).droppedBefore, 0);
  assert.equal(ledgerEntry({ wald: shadow(), droppedBefore: 2 }).droppedBefore, 2);
  assert.equal(ledgerEntry({ wald: shadow(), droppedBefore: -1 }).droppedBefore, 0);
});
