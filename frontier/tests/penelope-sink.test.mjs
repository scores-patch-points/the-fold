// Through Penelope: with no URL the sink is off and the log still works; with a door every event is posted as a mark with a byline and a
// witness; refusals and an unreachable door are counted, never written by another path.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { makeLog } from "../log.mjs";
import { makePenelopeSink } from "../penelope-sink.mjs";

test("no URL: off, counted as skipped, log unaffected", () => {
  const s = makePenelopeSink({ url: null });
  const log = makeLog({ now: () => 0, sink: s.sink });
  log.append({ kind: "fact", by: "t", body: {} });
  assert.equal(s.status().on, false); assert.equal(s.status().skipped, 1); assert.equal(log.size(), 1);
});

test("non-loopback door is refused", () => assert.equal(makePenelopeSink({ url: "https://example.com" }).status().on, false));

test("a fake door on loopback receives marks with byline, witness, declare-once and of", async () => {
  const got = [];
  const srv = createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { const j = JSON.parse(b); got.push(j); const refuse = j.kind === "frontier-refusal"; res.writeHead(refuse ? 422 : 200, { "content-type": "application/json" }); res.end(JSON.stringify(refuse ? { refused: "test" } : { id: `m${got.length}` })); }); });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const s = makePenelopeSink({ url: `http://127.0.0.1:${srv.address().port}`, run: "t" });
  const log = makeLog({ now: () => 0, sink: s.sink });
  const a = log.append({ kind: "span", by: "reader", body: { text: "x" } });
  await s.flush();
  log.append({ kind: "claim", by: "worker", deps: [a.id], body: {} });
  log.append({ kind: "claim", by: "worker", deps: [a.id], body: {} });
  log.append({ kind: "refusal", by: "mouth", body: {} });
  await s.flush(); srv.close();
  assert.equal(got.length, 4);
  assert.ok(got.every((m) => m.by && m.witness?.how));
  assert.ok(got[1].declare && !got[2].declare, "a kind is declared once");
  assert.deepEqual(got[1].of, ["m1"]);
  assert.equal(s.status().sent, 3); assert.equal(s.status().refused, 1);
});
