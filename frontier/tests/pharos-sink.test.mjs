// The pharos mirror: with no pointer the sink is OFF and says why; with a pointer to the pharos lib every event is woven, deps as `of`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { makeLog } from "../log.mjs";
import { openPharosSink } from "../pharos-sink.mjs";

test("no pointer: sink off, the log still works", async () => {
  const s = await openPharosSink({ pointer: "/nonexistent/pharos.json" });
  assert.equal(s.status().on, false);
  const log = makeLog({ now: () => 0, sink: s.sink });
  log.append({ kind: "fact", by: "t", body: {} });
  assert.equal(log.size(), 1);
});

const LIB = process.env.PHAROS_LIB ?? "/Users/mlacy/Documents/claude code/pharos/lib/pharos.mjs";
test("with a pointer: every event lands in pharos with its deps as `of`", { skip: !existsSync(LIB) && "pharos lib not on this machine" }, async () => {
  const d = mkdtempSync(join(tmpdir(), "frontier-pharos-"));
  const ptr = join(d, "pharos.json");
  writeFileSync(ptr, JSON.stringify({ lib: LIB, sha256: createHash("sha256").update(readFileSync(LIB)).digest("hex") }));
  const s = await openPharosSink({ pointer: ptr, dir: join(d, "log"), run: "t1" });
  assert.equal(s.status().on, true, s.status().why);
  const log = makeLog({ now: () => 0, sink: s.sink });
  const a = log.append({ kind: "span", by: "reader", body: { text: "x" } });
  log.append({ kind: "claim", by: "worker", deps: [a.id], body: { end1: "a", label: "b", end2: "c" } });
  const st = s.status();
  assert.equal(st.woven, 2, st.lastError);
  const claims = s.fold({ kind: "frontier-claim" }).entries;
  assert.equal(claims.length, 1);
  assert.equal(claims[0].of.length, 1);
});
