// STAGE 7 — witnesses and honest failure: unsupported-claim rate reported; planted unanswerables return typed gaps.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeLog } from "../log.mjs";
import { makeSurf } from "../surf.mjs";
import { makeGround } from "../shape.mjs";
import { makeMouth, stubTransport } from "../mouth.mjs";
import { makeApparatus } from "../apparatus.mjs";
import { witness } from "../witness.mjs";
import { chainWorld, synthCut, patternReader } from "../synth.mjs";

async function setup({ lie = 0, witnesses = true } = {}) {
  const w = chainWorld({ hops: 40, distractors: 600, seed: 11 });
  const log = makeLog({ now: () => 0 });
  const surf = makeSurf({ log, read: synthCut });
  await surf.ingest(w.text, { source: "w11" });
  const { ground } = makeGround({ giver: "test-author" }, { log });
  const mouth = makeMouth({ log, B: 4000, transport: stubTransport(patternReader({ lie, seed: 5 })) });
  return { w, log, app: makeApparatus({ log, mouth, ground, contentOf: surf.contentOf, switches: { witnesses } }) };
}

test("planted unanswerables (relation never stated) return typed gaps, never a value", async () => {
  const { w, app } = await setup();
  let gaps = 0;
  for (let i = 0; i < 20; i++) { const r = await app.ask({ anchor: w.chain[i], relation: "dentist", kind: "entity" }); if (r.status === "gap") gaps++; else assert.fail(`answered ${r.value}`); }
  assert.equal(gaps, 20);
});

test("a lying mouth: witnesses turn fabrications into gaps; without witnesses they pass. Rates reported.", async () => {
  const rate = async (witnesses) => {
    const { w, log, app } = await setup({ lie: 0.3, witnesses });
    let wrong = 0, right = 0, gap = 0;
    for (let i = 0; i < 40; i++) { const r = await app.ask({ anchor: w.chain[i], relation: "mentor", kind: "entity" }); if (r.status !== "ok") gap++; else if (r.value === w.chain[i + 1]) right++; else wrong++; }
    return { wrong, right, gap, verdicts: log.byKind("verdict").length };
  };
  const on = await rate(true), off = await rate(false);
  console.log(`stage7 unsupported-claim rate: witnesses on ${on.wrong}/40 wrong, ${on.gap} gaps; off ${off.wrong}/40 wrong`);
  assert.equal(on.wrong, 0);
  assert.ok(off.wrong > 0);
});

test("witness: supported / contradicted / unknown on cited spans", () => {
  const log = makeLog({ now: () => 0 });
  const s = log.append({ kind: "fact", by: "t", body: { text: "The vote was 7 to 2." } });
  assert.equal(witness(log, { value: "7 to 2", cites: [s.id] }).verdict, "supported");
  assert.equal(witness(log, { value: "9", cites: [s.id] }).verdict, "contradicted");
  assert.equal(witness(log, { value: "Paris", cites: [s.id] }).verdict, "unknown");
  assert.equal(witness(log, { value: "7", cites: ["ev999"] }).verdict, "contradicted");
});

test("fix 2: a value that merely occurs in a cited span is not support; the span must state the slot", () => {
  const log = makeLog({ now: () => 0 });
  const s = log.append({ kind: "fact", by: "t", body: { text: "Orkadra's mentor is Marmarten." } });
  const slot = (anchor, relation) => ({ anchors: [anchor], relation });
  assert.equal(witness(log, { value: "Marmarten", cites: [s.id], slot: slot("Orkadra", "mentor") }).verdict, "supported");
  assert.equal(witness(log, { value: "Marmarten", cites: [s.id], slot: slot("Marmarten", "mentor") }).verdict, "unknown", "self-loop: the value is the anchor");
  assert.equal(witness(log, { value: "Marmarten", cites: [s.id], slot: slot("Orkadra", "dentist") }).verdict, "unknown", "the span does not state the relation");
});
