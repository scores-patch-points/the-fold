// The judge battery as node:test. Rows live in eval/judge/cases.json; see docs/JUDGE-BATTERY.md.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { falsifyAnswer } from "./fold-chat-falsify-answer.js";
import { runRow } from "./scripts/judge-battery.mjs";

const table = JSON.parse(fs.readFileSync(new URL("./eval/judge/cases.json", import.meta.url), "utf8"));

test("table: unique ids, every control_of resolves, kinds are pass or todo", () => {
  const ids = new Set(table.rows.map((r) => r.id));
  assert.equal(ids.size, table.rows.length, "duplicate ids");
  for (const r of table.rows) {
    assert.ok(r.kind === "pass" || r.kind === "todo", r.id + " kind");
    if (r.control_of) assert.ok(ids.has(r.control_of), r.id + " control_of " + r.control_of + " does not resolve");
  }
});

test("every kind:pass row is satisfied by the repo judge", () => {
  const bad = table.rows.filter((r) => r.kind === "pass" && !runRow(falsifyAnswer, r).ok).map((r) => r.id);
  assert.deepEqual(bad, []);
});

for (const row of table.rows) {
  test(row.family + "/" + row.id, { todo: row.kind === "todo" }, () => {
    const r = runRow(falsifyAnswer, row);
    assert.ok(r.ok, "want " + JSON.stringify(row.expect) + " got " + JSON.stringify(r.got) + (r.error ? " threw " + r.error : ""));
  });
}
