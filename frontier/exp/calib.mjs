// Calibrate the token estimator against the engine's own prompt count on real prompts (not test sets): synthetic chain-world seam prompts.
import { makeLog } from "../log.mjs";
import { makeMouth, ollamaTransport } from "../mouth.mjs";
import { makeSurf } from "../surf.mjs";
import { makeGround } from "../shape.mjs";
import { makeApparatus } from "../apparatus.mjs";
import { chainWorld, synthCut } from "../synth.mjs";
const model = process.argv[2] ?? "qwen3:4b";
const w = chainWorld({ hops: 10, distractors: 400, seed: 101 });
const log = makeLog();
const surf = makeSurf({ log, read: synthCut });
await surf.ingest(w.text, { source: "calib" });
const { ground } = makeGround({ giver: "calibration" }, { log });
const mouth = makeMouth({ log, B: 4000, transport: ollamaTransport({ model }) });
const app = makeApparatus({ log, mouth, ground, contentOf: surf.contentOf });
const r = await app.ask({ anchor: w.chain[0], composition: "chain", kind: "entity", relation: "mentor^5", dependency: Array(5).fill("mentor") });
console.log("answer", r.status, r.value, "truth", w.chain[5]);
for (const c of log.byKind("call")) console.log(c.body.seam, "est", c.body.ctxEstimate, "engine", c.body.ctxEngine, "ms", c.body.ms, JSON.stringify(c.body.value));
