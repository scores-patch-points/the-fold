// STAGE 2 — budget enforcement. Fails the build if any logged model call exceeded B, or any call went uncounted.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { makeLog } from "../log.mjs";
import { makeMouth, stubTransport, budgetAudit, OverBudget, B_DEFAULT } from "../mouth.mjs";

test("B is recorded at 4000 for the gemma2:2b class", () => assert.equal(B_DEFAULT, 4000));

test("a call over B is refused before it is sent, logged as a typed gap, never truncated", async () => {
  const log = makeLog({ now: () => 0 });
  let sent = 0;
  const mouth = makeMouth({ log, transport: stubTransport(() => { sent++; return "x"; }), B: 100 });
  await mouth.ask({ user: "short", seam: "ok" });
  await assert.rejects(mouth.ask({ user: "w ".repeat(400), seam: "big" }), OverBudget);
  assert.equal(sent, 1);
  assert.equal(log.byKind("refusal")[0].body.gap, "over_budget");
  assert.ok(budgetAudit(log).ok);
});

test("an engine count over B is caught after the fact and fails the audit", async () => {
  const log = makeLog({ now: () => 0 });
  const t = { model: "lying", send: async () => ({ value: "x", promptTokens: 5000, outTokens: 1, ms: 1 }) };
  const mouth = makeMouth({ log, transport: t, B: 4000 });
  await assert.rejects(mouth.ask({ user: "tiny", seam: "s" }), OverBudget);
  assert.equal(budgetAudit(log).ok, false);
});

test("the log is hash-chained and refuses unbylined or out-of-order events", () => {
  const log = makeLog({ now: () => 0 });
  const a = log.append({ kind: "input", by: "test", body: { t: 1 } });
  assert.throws(() => log.append({ kind: "x", body: {} }));
  assert.throws(() => log.append({ kind: "x", by: "t", deps: ["ev99"] }));
  log.append({ kind: "y", by: "t", deps: [a.id] });
  assert.deepEqual(log.verify(), { ok: true });
});

// THE BUILD GATE: every token log any run left under frontier/runs must be within B, every line counted.
test("every recorded model call across all runs is within B", () => {
  const dir = new URL("../runs/", import.meta.url);
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".jsonl") && f.includes("token")) : [];
  let n = 0;
  for (const f of files) for (const line of readFileSync(new URL(f, dir), "utf8").split("\n").filter(Boolean)) {
    const r = JSON.parse(line); n++;
    assert.ok(Number.isFinite(r.ctxEstimate), `${f}: uncounted call`);
    if (r.refused) continue; // refused before sending: the invariant held
    assert.ok(r.ctxEstimate <= r.B, `${f}: estimate ${r.ctxEstimate} > B ${r.B}`);
    assert.ok(r.ctxEngine == null || r.ctxEngine <= r.B, `${f}: engine count ${r.ctxEngine} > B ${r.B}`);
  }
  console.log(`token logs: ${files.length} files, ${n} calls checked`);
});
