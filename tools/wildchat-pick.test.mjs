// The WildChat runner's "follow-up" must be the turn that followed `prev` (nesting audit F, 2026-10-14). Uses the real battery.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { pickPair } from "./wildchat-pick.mjs";

const battery = JSON.parse(fs.readFileSync(new URL("./wildchat-battery.json", import.meta.url), "utf8"));
const byId = new Map(battery.asks.map((a) => [a.id, a]));
const num = (id) => Number(String(id).split("-")[1]);

test("every pair the runner can draw is a first ask and the follow-up that actually followed it", () => {
  const n = battery.followups.length;
  for (let i = 0; i < n * 2; i++) {
    const { first, follow } = pickPair(i, battery);
    assert.equal(follow.prev, first.id, `i=${i}: the follow-up's prev is the first ask`);
    assert.equal(num(follow.id), num(first.id) + 1, `i=${i}: it came right after it in its conversation`);
    assert.equal(byId.get(first.id).isFollowUp, false, `i=${i}: the first ask is not itself a follow-up text`);
    assert.equal(byId.get(follow.id).isFollowUp, true, `i=${i}: the second is a battery follow-up`);
    assert.equal(follow.text, byId.get(follow.id).text);
  }
});

test("control: the old independent strides almost never paired a follow-up with its own first ask (the defect)", () => {
  const n = battery.followups.length;
  let paired = 0;
  for (let i = 0; i < n; i++) {
    const first = battery.asks[(i * 17) % battery.asks.length];
    const f = battery.followups[(i * 11) % n];
    if (f.prev === first.id) paired++;
  }
  assert.ok(paired / n < 0.05, `old rule paired ${paired}/${n}`);
});

test("a follow-up whose prev is not in the battery is a typed error, never a guessed first ask", () => {
  assert.throws(() => pickPair(0, { asks: [], followups: [{ id: "wc-2", prev: "wc-1", text: "and?" }] }), /not in the battery/);
  assert.throws(() => pickPair(0, { asks: [], followups: [] }), /no followups/);
});
