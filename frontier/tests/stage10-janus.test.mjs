// STAGE 10 (added 2026-11-14 at the user's ask: "pull the thinking out of the model, Janus and Penelope can answer this").
// The read seam without a model: Janus reads retrieved spans into facts, the fold answers. NO mouth is given at all.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeLog } from "../log.mjs";
import { makeSurf } from "../surf.mjs";
import { makeGround } from "../shape.mjs";
import { makeApparatus } from "../apparatus.mjs";
import { synthCut } from "../synth.mjs";
import { mixedWorld, questions, score } from "../exp/worlds.mjs";

test("Janus + fold answer chains, lookups, aliases, sums and unanswerables with zero model calls", { timeout: 600000 }, async () => {
  const w = mixedWorld({ people: 60, chains: 2, chainLen: 12, distractors: 300, seed: 3 });
  const log = makeLog({ now: () => 0 });
  const surf = makeSurf({ log, read: synthCut });
  await surf.ingest(w.text, { source: "janus-world-s3" });
  for (const [a, p] of w.truth.alias) log.append({ kind: "same", by: "registry", body: { a, b: p } });
  const { ground } = makeGround({ giver: "test-author" }, { log });
  const app = makeApparatus({ log, mouth: null, ground, contentOf: surf.contentOf, switches: { janus: true, janusOnly: true } });
  const by = {};
  for (const q of questions(w, { n: 24, seed: 9 })) {
    const r = await app.ask(q.fields);
    const s = score(q, r.value, r.status);
    (by[q.t] ??= { n: 0, right: 0, wrong: [] }).n++;
    if (s.correct) by[q.t].right++; else by[q.t].wrong.push({ q: q.nl, got: r.value ?? r.gap, truth: q.truth });
  }
  console.log("stage10", JSON.stringify(by));
  assert.equal(log.byKind("call").length, 0, "no model call");
  for (const [t, v] of Object.entries(by)) assert.equal(v.right, v.n, `${t}: ${JSON.stringify(v.wrong)}`);
});
