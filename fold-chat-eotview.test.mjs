import test from "node:test";
import assert from "node:assert/strict";
import { spineHtml, lanesOf, changesOf, noteHtml } from "./fold-chat-eotview.js";

const ev = [
  { id: "evt_1", ts: 1, stage: "edit", agent: "a", standing: "witnessed", path: "x.js", op: "create" },
  { id: "evt_2", ts: 2, stage: "mark", agent: "a", standing: "asserted" },
  { id: "evt_3", ts: 3, stage: "edit", agent: "b", standing: "witnessed", path: "x.js", op: "edit" },
];
test("lanes: one per writer, first-seen order", () => assert.deepEqual(lanesOf(ev).map((l) => [l.agent, l.evs.length]), [["a", 2], ["b", 1]]));
test("spine: said marks are hollow-classed, observed are not; the cursor mark is flagged; Now appears only with a cursor", () => {
  const h = spineHtml({ total: 3, events: ev }, { cursor: "evt_3" });
  assert.match(h, /fs-mk said"[^>]*data-evt="evt_2"/);
  assert.match(h, /fs-mk cur" data-evt="evt_3"/);
  assert.match(h, /data-evt="">Now/);
  assert.doesNotMatch(spineHtml({ total: 3, events: ev }), />Now</);
});
test("spine escapes ids and paths", () => assert.doesNotMatch(spineHtml({ total: 1, events: [{ id: '"><x>', stage: "edit", agent: "<u>", standing: "w", path: "<i>" }] }), /<x>|<i>|<u>/));
test("changesOf shapes edits for the Log view", () => assert.deepEqual(changesOf({ path: "p", changes: [{ id: "e", at: 1, by: "a", op: "edit", tool: "edit", standing: "witnessed", before: null, after: "z" }] }), [{ id: "e", at: 1, path: "p", op: "edit", by: "a", label: "edit · witnessed", before: "", after: "z" }]));
test("noteHtml shows drift and worktrees", () => assert.match(noteHtml({ drift: [{ path: "s.txt", last: "b" }], worktrees: ["/w"] }), /⚠ s\.txt[\s\S]*\/w/));
