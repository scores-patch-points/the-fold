// Fast checks for Houdini (fold-chat-houdini.js). The scored battery is `node eval/houdini/run.mjs --check` (about 2.5 minutes; kept out of the default test run).
import test from "node:test";
import assert from "node:assert/strict";
import { houdini } from "./fold-chat-houdini.js";
import { makeConversation, makeProbes } from "./eval/houdini/world.mjs";
import { makeArms, deepFreeze, BASE } from "./eval/houdini/arms.mjs";
import { observe } from "./eval/houdini/metrics.mjs";
import { buildRecordSystemMessage, charCount } from "./vendor/the-fold/fold.js";

const conv = makeConversation({ seed: 3, L: 160, lang: "en" }), probes = makeProbes(conv, 3), arms = makeArms(conv);
const parts = (p) => deepFreeze({ basePrompt: BASE, summary: structuredClone(conv.summary), history: structuredClone(conv.history), question: p.question, referents: structuredClone(conv.referents) });
const partsFor = (c, question) => deepFreeze({ basePrompt: BASE, summary: structuredClone(c.summary), history: structuredClone(c.history), question, referents: structuredClone(c.referents) });
const chars = (m) => m.reduce((n, x) => n + x.content.length, 0);
const of = (cls) => probes.find((p) => p.cls === cls);
const run = (p) => houdini(parts(p));

test("never mutates its inputs (frozen inputs do not throw)", () => { for (const p of probes) assert.doesNotThrow(() => run(p)); });
test("never exceeds the positional projection's size", () => { for (const p of probes) assert.ok(chars(run(p).messages) <= chars(arms.positional(parts(p), p, conv)), p.cls); });
test("deterministic", () => { for (const p of probes) assert.deepEqual(run(p).messages, run(p).messages); });
test("a callback reaches records beyond the positional window", () => {
  const p = probes.find((x) => /^callback-far/.test(x.cls)) || of("callback-far");
  const o = observe(run(p).messages, conv);
  assert.ok(p.need.some((t) => o.turns.has(t)), "a needed old record rides");
  assert.ok(p.need.some((t) => !observe(arms.positional(parts(p), p, conv), conv).turns.has(t)), "and the fold today does not carry it");
});
test("a fresh ask carries no old records and states the true hidden count", () => {
  const p = of("fresh"), o = observe(run(p).messages, conv);
  assert.equal(o.turns.size, 0);
  assert.equal(o.notShown, conv.summary.records.length - o.turns.size);
});
test("records that name an unsupported claim or an open item ride when the ask bears on their topic", () => {
  const p = of("callback-near"); const o = observe(run(p).messages, conv);
  assert.ok(p.pinnedNeed.length > 0);
  assert.ok(o.turns.has(p.pinnedNeed[0]), "the first pinned record rides (the rest may be shed with a typed gap when the budget is full)");
});
test("the record block is fold.js's own rendering, never reworded", () => {
  const p = of("callback-mid"), o = observe(run(p).messages, conv);
  const shown = [...o.turns].sort((a, b) => a - b).map((t) => conv.summary.records.find((r) => r.turn === t));
  assert.ok(o.block.startsWith(buildRecordSystemMessage({ records: shown }, { window: shown.length })));
});
test("the last few exchanges ride on every ask (the brief: it should likely get the last few in general)", () => {
  const raw = (p) => observe(run(p).messages, conv).exch.size;
  for (const p of probes) assert.ok(raw(p) >= 1, p.cls);                                  // never none
  for (const cls of ["thin", "fresh", "coincidence"]) assert.equal(raw(of(cls)), 2, cls);   // two where the budget is not squeezed by records the ask needs
  assert.ok(raw(of("verbatim")) >= 2, "verbatim: the last few and the recalled old exchange");
});
test("Terry Gross's reading decides what a tight budget may cut: an ask about the thread keeps the last few, one that stands alone keeps the last", () => {
  const tight = (c, q, kind) => { const p = partsFor(c, q); const base = houdini({ ...p, turn: { kind } }).plan.chars.baseline; return observe(houdini({ ...p, turn: { kind }, budget: { chars: Math.floor(base * 0.45) } }).messages, c).exch.size; };
  const q = of("thin").question;
  assert.equal(tight(conv, q, "carried"), 2, "a carried ask keeps both");
  assert.ok(tight(conv, of("fresh").question, "standalone") <= 2);
  assert.ok(tight(conv, of("fresh").question, "standalone") >= 1, "never none");
});
test("Terry's reading is not trusted where she cannot read the language: standalone + the ask's own lean keeps the last few", () => {
  for (const lang of ["el", "zh", "ar"]) {
    const c = makeConversation({ seed: 5, L: 60, lang }), ps = makeProbes(c, 5), thin = ps.find((p) => p.cls === "thin");
    const p = partsFor(c, thin.question), base = houdini({ ...p, turn: { kind: "standalone" } }).plan.chars.baseline;
    const got = observe(houdini({ ...p, turn: { kind: "standalone" }, budget: { chars: Math.floor(base * 0.45) } }).messages, c).exch.size;
    assert.equal(got, 2, lang);
  }
});
test("an ask about the thread that names nothing of its own bears on what the last exchange was about (carry)", () => {
  const p = partsFor(conv, of("thin").question);
  const { plan } = houdini({ ...p, turn: { kind: "carried" } });
  assert.equal(plan.need.carried, true);
  assert.ok(plan.records.some((r) => r.included), "records of the carried topic ride");
});
test("an injected reader moves bearing (the semantic seam)", () => {
  const p = of("semantic"), plain = observe(run(p).messages, conv), withReader = observe(arms["+reader"](parts(p), p, conv), conv);
  assert.ok(withReader.turns.size >= plain.turns.size);
  assert.ok(p.need.some((t) => withReader.turns.has(t)) && withReader.turns.size > plain.turns.size);
});

// ── the class-term, voice and ordering rules (the 100% work; each one has a case that must NOT fire it) ──
const shownTurns = (c, question) => observe(houdini(partsFor(c, question)).messages, c).turns;
test("a new name beside a class noun does not pull the old things of that class (coincidence)", () => {
  const nounShared = conv.topics.find((tp) => conv.store.some((r) => r.topic === tp.id) && conv.topics.filter((o) => o.noun === tp.noun && conv.store.some((r) => r.topic === o.id)).length >= 2);
  assert.ok(nounShared, "the fixture has a class noun shared by two discussed topics");
  assert.equal(shownTurns(conv, `Tell me about Zanthor ${nounShared.noun}.`).size, 0);
});
test("…but a named topic with an extra unknown word still bears (the rule does not fire on a name)", () => {
  const tp = conv.topics.find((x) => conv.store.some((r) => r.topic === x.id)), turns = conv.store.filter((r) => r.topic === tp.id).map((r) => r.turn);
  const shown = shownTurns(conv, `Going back to ${tp.name} Zorvik: what did we settle on?`);
  assert.ok(turns.some((t) => shown.has(t)));
});
test("under budget pressure the topics come in the order the ask mentions them, and none is starved", () => {
  const p = of("pressure"); if (!p) return;
  const o = observe(run(p).messages, conv), topicOf = (t) => conv.store.find((r) => r.turn === t).topic, per = new Map();
  for (const t of o.turns) per.set(topicOf(t), (per.get(topicOf(t)) || 0) + 1);
  const named = new Set(p.need.map(topicOf));
  for (const id of named) assert.ok((per.get(id) || 0) >= 1, "topic " + id + " has at least one record");
});

// ── found by the falsifier (eval/houdini/falsify.mjs) ──
test("a misspelled name is read as the name it is one edit from (a typo is not a new topic)", () => {
  const tp = conv.topics.find((x) => conv.store.some((r) => r.topic === x.id)), h = [...tp.head];
  [h[1], h[2]] = [h[2], h[1]];
  const turns = conv.store.filter((r) => r.topic === tp.id).map((r) => r.turn), shown = shownTurns(conv, `Remind me what we established about ${h.join("")}${tp.name.slice(tp.head.length)}.`);
  assert.ok(turns.some((t) => shown.has(t)));
});
test("a pinned record the record cap alone leaves out is a typed gap, not silence", () => {
  const c = structuredClone(conv); c.summary.records.forEach((r) => { r.unsupported = [r.gist.slice(0, 20) + " is unsupported"]; });
  const tp = c.topics.find((x) => c.store.filter((r) => r.topic === x.id).length >= 10) || c.topics[0];
  const { plan } = houdini(partsFor(c, `Going back to ${tp.name}: what did we settle on?`));
  const n = c.store.filter((r) => r.topic === tp.id).length;
  if (n > 8) assert.ok(plan.gaps.some((g) => g.kind === "pinned_unshown"));
});

// ── found by the live run on a real 75-ask thread (houdini-live) ──
const frames = (() => {
  const topics = ["Nashville", "Kilimanjaro", "Antikythera", "Voyager", "Hagia", "Mariana", "Curie", "Eiffel"], recs = [], hist = [];
  topics.forEach((n, i) => {
    const t = i * 3 + 1;
    recs.push({ turn: t, plane: "world", gist: `Q: Tell me about ${n}. A: ${n} is a thing.`, channels: [], refs: [], unsupported: [], open: [] });
    recs.push({ turn: t + 1, plane: "world", gist: `Q: How tall is ${n}? A: (showed the sources' own words)`, channels: [], refs: [], unsupported: [], open: [] });
    hist.push({ role: "user", content: `Tell me about ${n}.` }, { role: "assistant", content: `${n} is a thing.` }, { role: "user", content: `How tall is ${n}?` }, { role: "assistant", content: "(showed the sources' own words)" });
  });
  return { recs, hist, summary: { topic: null, entities: [], context: null, language: "en", turnCount: recs.length, flow: null, folds: [], records: recs } };
})();
const real = (question, turn, referents = null) => houdini(deepFreeze({ basePrompt: BASE, summary: structuredClone(frames.summary), history: structuredClone(frames.hist), question, referents, ...(turn ? { turn } : {}) }));
test("a word of the asking frame (\"tell\", spread one-per-topic through the thread) names no topic", () => {
  const { plan } = real("Tell me about the Rosetta Stone.", { kind: "standalone" });
  assert.equal(plan.records.filter((r) => r.included).length, 0, "no old record bears on a fresh ask");
});
test("a follow-up about the thread bears on what the last exchange was about, not on its own question word", () => {
  const { plan } = real("how tall is it?", { kind: "carried" });
  const inc = plan.records.filter((r) => r.included).map((r) => r.turn);
  assert.ok(inc.includes(23) || inc.includes(22), "the last topic's records (Eiffel) ride: " + inc);
});
test("an entity of function words only (a stray \"The\" in the referent record) does not make every record bear", () => {
  const ref = { entities: [{ surface: "The", forms: [], weight: 9, lastTurn: 1, roles: [], kinds: [] }], turn: 1 };
  const { plan } = real("Tell me about the Rosetta Stone.", { kind: "standalone" }, ref);
  assert.equal(plan.records.filter((r) => r.included).length, 0);
});
test("a number between a name and the next word does not make them neighbours (\"Voyager 1 still\")", () => {
  const { plan } = real("Is Voyager 1 still sending data?", { kind: "standalone" });
  assert.ok(plan.records.some((r) => r.included && /Voyager/.test(frames.recs.find((x) => x.turn === r.turn)?.gist || "")), "the Voyager records ride");
});

// ── the wiring: Gary's door hands Houdini the turn, and a throw never costs the turn ──
import { door as garyDoor } from "./fold-chat-gary.js";
test("composeTurn: with `project`, the model is handed Houdini's projection (and Terry's turn reaches it)", () => {
  const p = of("callback-mid"), seen = [];
  const r = garyDoor.composeTurn({ basePrompt: BASE, cues: [], summary: structuredClone(conv.summary), history: structuredClone(conv.history), question: p.question, sourceBlock: null,
    referents: structuredClone(conv.referents), turn: { kind: "standalone", act: "question", mode: "web" }, project: (x) => { seen.push(x.turn); return houdini(x); } }, { model: "gemma2:2b", material: 1 });
  assert.equal(seen.length > 0 && seen[0].kind, "standalone");
  const o = observe(r.messages, conv);
  assert.ok(p.need.some((t) => o.turns.has(t)), "the callback's records ride in what the model is handed");
  assert.ok(charCount(r.messages) <= charCount(garyDoor.composeTurn({ basePrompt: BASE, cues: [], summary: structuredClone(conv.summary), history: structuredClone(conv.history), question: p.question, sourceBlock: null }, { model: "gemma2:2b", material: 1 }).messages) + 1, "never above the positional size");
});
test("composeTurn: a projector that throws falls back to the positional build — the turn is never lost", () => {
  const p = of("callback-mid"), parts = { basePrompt: BASE, cues: [], summary: structuredClone(conv.summary), history: structuredClone(conv.history), question: p.question, sourceBlock: null };
  const plain = garyDoor.composeTurn(parts, { model: "gemma2:2b", material: 1 });
  const thrown = garyDoor.composeTurn({ ...parts, project: () => { throw new Error("boom"); } }, { model: "gemma2:2b", material: 1 });
  assert.deepEqual(thrown.messages, plain.messages);
});
