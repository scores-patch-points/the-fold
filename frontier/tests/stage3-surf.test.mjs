// STAGE 3 — Surf into the log. Every span the model sees traces to an event with source and hash.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeLog } from "../log.mjs";
import { makeSurf, traceSpan } from "../surf.mjs";
import { assemble } from "../assemble.mjs";
import { makeMouth, stubTransport, budgetAudit } from "../mouth.mjs";

const DOC = "The council met on 3 March 2025. It approved a budget of 450 million dollars. Ms. Rivera voted against it. The vote was 7 to 2.";

test("canonical reader cuts addressed spans; each traces to its source by hash", { timeout: 180000 }, async () => {
  const log = makeLog({ now: () => 0 });
  const surf = makeSurf({ log });
  const { source, spans } = await surf.ingest(DOC, { source: "minutes-2025-03-03.txt", retrievedAt: "2026-11-14T00:00:00Z" });
  assert.ok(spans.length >= 3, `reader cut ${spans.length} spans`);
  assert.match(source.body.sha256, /^[0-9a-f]{64}$/);
  for (const s of spans) assert.equal(traceSpan(log, s.id, surf.contentOf).ok, true);

  // the model sees only traced spans: every [evN] in every prompt is a span event that traces
  const seen = [];
  const mouth = makeMouth({ log, B: 4000, transport: stubTransport(({ user }) => { seen.push(...[...user.matchAll(/\[(ev\d+)\]/g)].map((m) => m[1])); return "ok"; }) });
  const { calls, refused } = assemble({ log, B: 4000, seam: "read", spanIds: spans.map((s) => s.id), contentOf: surf.contentOf });
  assert.equal(refused.length, 0);
  for (const c of calls) await mouth.ask({ user: c.user, seam: c.seam, deps: c.spanIds });
  assert.ok(seen.length >= 3);
  for (const id of seen) assert.equal(traceSpan(log, id, surf.contentOf).ok, true, `${id} untraced`);
  assert.ok(budgetAudit(log).ok);
  assert.deepEqual(log.verify(), { ok: true });
});

test("a forged span (bytes not in the source) is refused by the assembler", async () => {
  const log = makeLog({ now: () => 0 });
  const surf = makeSurf({ log, read: async (t) => ({ sentences: [{ start: 0, end: t.length, text: t }], gaps: [] }) });
  const { source } = await surf.ingest("real text here.", { source: "s" });
  const forged = log.append({ kind: "span", by: "attacker", deps: [source.id], body: { sha256: source.body.sha256, start: 0, end: 4, text: "fake" } });
  const { refused } = assemble({ log, B: 4000, seam: "x", spanIds: [forged.id], contentOf: surf.contentOf });
  assert.equal(refused[0].gap, "untraced_span");
});

test("over B the assembler splits into several calls, each within B; nothing is truncated", async () => {
  const log = makeLog({ now: () => 0 });
  const text = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} says that item ${i} weighs ${i * 3} kilograms in the warehouse ledger.`).join(" ");
  const surf = makeSurf({ log, read: async (t) => ({ sentences: [...t.matchAll(/[^.]+\./g)].map((m) => ({ start: m.index, end: m.index + m[0].length, text: m[0] })), gaps: [] }) });
  const { spans } = await surf.ingest(text, { source: "big" });
  const { calls } = assemble({ log, B: 300, seam: "read", spanIds: spans.map((s) => s.id), contentOf: surf.contentOf });
  assert.ok(calls.length > 1);
  assert.equal(calls.flatMap((c) => c.spanIds).length, spans.length);
  const mouth = makeMouth({ log, B: 300, transport: stubTransport(() => "ok") });
  for (const c of calls) await mouth.ask({ user: c.user, seam: c.seam });
  assert.ok(budgetAudit(log).ok);
});

test("surf with no egress records a typed miss, opens no network path", async () => {
  const log = makeLog({ now: () => 0 });
  const surf = makeSurf({ log });
  const g = log.append({ kind: "gap", by: "t", body: { gap: "absent_fact", slot: "x" } });
  assert.equal(await surf.surfForGap(g), null);
  assert.equal(log.byKind("surf_miss").length, 1);
});
