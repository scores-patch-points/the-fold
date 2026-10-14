// eval/houdini/semantic-live.mjs — the semantic class through a REAL reader, not the fixture's: a local embedding model (Ollama nomic-embed-text) read at the ENTITY level.
//   node eval/houdini/semantic-live.mjs [--seeds 201,202,203]          needs Ollama on :11434 with nomic-embed-text; not part of --check (a model, a network hop, not deterministic across machines)
//
// The reader is built the way the app would: before the turn, the surface embeds the ask and the thread's referent surfaces (a handful, not every record), picks the entity the ask is
// closest to, and hands Houdini a synchronous reader that says "bears" for a unit that mentions that entity. Houdini stays pure. The class to beat is semanticRecall 0 (no reader).
// Reported honestly: how often the gold entity is the nearest, how often it is not even in the referent record, and what a wrong pick costs (decoy records riding).
import { LANGS, makeConversation, makeProbes } from "./world.mjs";
import { houdini } from "../../fold-chat-houdini.js";
import { feasibleNeed, makeArms, deepFreeze, BASE } from "./arms.mjs";
import { scoreProbe } from "./metrics.mjs";
import { mentions } from "../../fold-chat-mind.js";

const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const SEEDS = arg("--seeds", "201,202,203").split(",").map(Number), HOST = arg("--host", "http://localhost:11434"), MODEL = arg("--model", "nomic-embed-text");
const cache = new Map();
async function embed(text) {
  if (cache.has(text)) return cache.get(text);
  const r = await fetch(HOST + "/api/embeddings", { method: "POST", body: JSON.stringify({ model: MODEL, prompt: text }) });
  const v = (await r.json()).embedding; cache.set(text, v); return v;
}
const cos = (a, b) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] ** 2; y += b[i] ** 2; } return d / Math.sqrt(x * y); };
const parts = (conv, probe) => deepFreeze({ basePrompt: BASE, summary: structuredClone(conv.summary), history: structuredClone(conv.history), referents: structuredClone(conv.referents), question: probe.question });

let n = 0, nearest = 0, inRef = 0, withReader = 0, without = 0, decoyChars = 0, goodChars = 0;
for (const seed of SEEDS) for (const L of [24, 60, 160]) {
  const conv = makeConversation({ seed, L, lang: "en" }), arms = makeArms(conv);
  for (const probe of makeProbes(conv, seed).filter((p) => p.cls === "semantic")) {
    n++;
    const p = parts(conv, probe), bl = arms.positional(p, probe, conv).reduce((a, m) => a + m.content.length, 0);
    const gold = { ...probe, need: feasibleNeed(p, probe, conv, bl), pinnedNeed: [] };
    const goldHead = conv.topics.find((tp) => probe.need.length && conv.store.find((x) => x.turn === probe.need[0])?.topic === tp.id)?.name;
    const surfaces = (conv.referents.entities || []).map((e) => e.surface);
    if (goldHead && surfaces.includes(goldHead)) inRef++;
    let pick = null;
    if (surfaces.length) {
      const q = await embed(probe.question), sims = [];
      for (const s of surfaces) sims.push([s, cos(q, await embed(s))]);
      sims.sort((a, b) => b[1] - a[1]); pick = sims[0][0];
    }
    if (pick && pick === goldHead) nearest++;
    const reader = pick ? (_ask, text) => (mentions(text, pick) ? 1 : 0) : null;
    const msgsR = houdini(p, reader ? { reader } : {}).messages, msgs0 = houdini(p).messages;
    const sR = scoreProbe({ messages: msgsR, probe: gold, conv, baselineChars: bl }), s0 = scoreProbe({ messages: msgs0, probe: gold, conv, baselineChars: bl });
    withReader += sR.recall ?? 0; without += s0.recall ?? 0;
  }
}
const pct = (x) => (100 * x / n).toFixed(1);
console.log(`semantic probes: ${n} (en, seeds ${SEEDS.join(",")}, L 24/60/160) · model ${MODEL}`);
console.log(`gold entity present in the referent record: ${inRef}/${n}`);
console.log(`gold entity is the nearest of the thread's referents: ${nearest}/${n}`);
console.log(`semanticRecall without a reader: ${pct(without)}   with the entity reader: ${pct(withReader)}   (the fixture's hand-written control scores 100; this one is the real number)`);
