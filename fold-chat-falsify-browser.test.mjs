// D2 (nesting audit F/B, 2026-10-14): fold-chat-falsify-answer.js read `process.env.FCFA_TRACE` unguarded inside judge(); in a browser there is no
// `process`, so every falsify of a model-written answer threw "ReferenceError: process is not defined" (and, with D1, the turn vanished).
// The module runs here in a CHILD node with the `process` global deleted, which is what a browser tab gives it.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const MOD = fileURLToPath(new URL("./fold-chat-falsify-answer.js", import.meta.url));
const SCRIPT = `
const log = globalThis.console.log.bind(globalThis.console);
delete globalThis.process;
const had = typeof process !== "undefined";
const m = await import(${JSON.stringify("file://" + MOD)});
const sentences = ["The Eiffel Tower is 330 metres tall."];
const passages = [{ ref: "p1", url: "https://example.org/eiffel", text: "The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris. The Eiffel Tower is 330 metres (1,083 ft) tall." }];
const r = m.falsifyAnswer(sentences, passages);
log(JSON.stringify({ had, n: r.claims.length, verdict: r.claims[0] && r.claims[0].verdict }));
`;
const run = (env = {}) => spawnSync(process.execPath, ["--input-type=module", "-e", SCRIPT], { encoding: "utf8", env: { ...process.env, ...env } });

test("D2: falsifyAnswer runs where `process` is not defined (a browser tab)", () => {
  const r = run();
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout.trim().split("\n").pop());
  assert.equal(out.had, false, "control: the child really has no process global");
  assert.equal(out.n, 1);
  assert.ok(["held", "corroborated"].includes(out.verdict), "the claim is actually judged, not skipped: " + out.verdict);
});

test("D2: the trace still works under Node when FCFA_TRACE is set (the debug path is not removed)", () => {
  const r = run({ FCFA_TRACE: "1" });
  // `process` is deleted in the child, so the trace is off there by design: the answer must be the same and nothing throws
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout.trim().split("\n").pop()).n, 1);
});
