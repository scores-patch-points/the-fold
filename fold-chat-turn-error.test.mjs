// D1 (nesting audit B/F, 2026-10-14): the inner `catch (err) {` of run() had its body inside a `//` comment (the statement shared the comment's
// line), so any exception inside the turn ended it with no message, no notice, no retry. run() needs a DOM, so the EXECUTION witness is
// eval/nesting/turns-e2e.mjs (arm throw: "Hello there!" must end in a stored typed notice; recorded in nesting-fix-2026-10-14/fold.md). What
// runs in the unit suite is (1) the typed notice a dead turn is stored as, and (2) a source pin that the catch body is code, not comment.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { errorNotice } from "./fold-chat-gaps.js";

const SRC = fs.readFileSync(new URL("./fold-chat.js", import.meta.url), "utf8");

test("D1: a turn that threw is stored as a typed, retry-able, visible notice (never empty)", () => {
  const n = errorNotice(new Error("the pipeline broke"));
  assert.equal(n.kind, "error");
  assert.equal(n.retry, true);
  assert.match(n.text, /the pipeline broke/);
  assert.match(n.text, /Nothing was written/);
  assert.equal(errorNotice(new TypeError("process is not defined")).kind, "error");
  assert.equal(errorNotice(null).kind, "error", "no error object: still a typed notice");
});

test("D1: the turn's catch body is a statement on its own line, not the tail of a comment", () => {
  assert.match(SRC, /^\s*if \(ac\.signal\.aborted\) stopped\(\); else failTurn\(err\);\s*$/m, "stopped-or-failTurn is code");
  const swallowed = SRC.split("\n").filter((l) => /\/\/[^\n]*;\s*(?:if|else)\b[^\n]*\b(?:stopped|failTurn)\(/.test(l));
  assert.deepEqual(swallowed, [], "no line carries a stopped()/failTurn() call inside a // comment");
  const i = SRC.indexOf("} catch (err) {      // A stop is a stop;");
  assert.ok(i > 0, "the inner catch is where the turn's exit lives");
  const body = SRC.slice(i, i + 700);
  assert.ok(/failTurn\(err\)[\s\S]*\} finally \{/.test(body), "the catch body reaches failTurn before its finally");
});
