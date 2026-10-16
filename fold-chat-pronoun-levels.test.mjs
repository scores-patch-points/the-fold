// node --test fold-chat-pronoun-levels.test.mjs — the pronoun stack may only get better.
//
// eval/pronoun/baseline.json is the floor. A measurement worse than the floor FAILS; one better than the floor passes and says so (run
// `node scripts/pronoun-baseline.mjs` to raise the floor, and review the diff). Levels, bottom up: L0 does the gate see an anaphor, L2
// is each referent given its kind, L4 does the binding use them; S is the stem matcher L4 stands on. Fixtures are committed
// (eval/pronoun/ud-fixture.json: real Universal Dependencies sentences), so this needs no local corpus and runs in CI.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { measure } from "./eval/pronoun/measure.mjs";

const base = JSON.parse(fs.readFileSync(new URL("./eval/pronoun/baseline.json", import.meta.url), "utf8")).measured;
const cur = measure();
const improved = [];

test("L0: no language sees fewer anaphors, or carries more on non-anaphors, than the baseline", () => {
  for (const l of Object.keys(base.L0)) {
    assert.ok(cur.L0[l], `${l} disappeared from the fixture`);
    for (const [k, better] of [["recall", (c, b) => c >= b], ["falseCarryNoPronoun", (c, b) => c <= b], ["falseCarryNonPointing", (c, b) => c <= b]]) {
      assert.ok(better(cur.L0[l][k], base.L0[l][k]), `L0 regression [${l}] ${k}: ${cur.L0[l][k]} vs baseline ${base.L0[l][k]}`);
      if (cur.L0[l][k] !== base.L0[l][k]) improved.push(`L0 ${l} ${k} ${base.L0[l][k]} → ${cur.L0[l][k]}`);
    }
  }
});

test("L2: each language still tells a name from a thing", () => {
  for (const l of Object.keys(base.L2)) for (const k of Object.keys(base.L2[l])) if (base.L2[l][k]) assert.equal(cur.L2[l][k], true, `L2 regression [${l}] ${k}`);
});

test("L4: the binding still holds in every language it held in", () => {
  for (const l of Object.keys(base.L4)) for (const k of Object.keys(base.L4[l])) if (base.L4[l][k]) assert.equal(cur.L4[l][k], true, `L4 regression [${l}] ${k}`);
});

test("S: the stem matcher matches no more unrelated words than the baseline", () => {
  for (const l of Object.keys(base.S)) assert.ok(cur.S[l].falseStemRate <= base.S[l].falseStemRate, `S regression [${l}]: ${cur.S[l].falseStemRate} vs ${base.S[l].falseStemRate}`);
});

test("report: what improved over the baseline (raise the floor with scripts/pronoun-baseline.mjs)", () => {
  if (improved.length) console.log("IMPROVED over baseline:\n  " + improved.join("\n  "));
  assert.ok(true);
});
