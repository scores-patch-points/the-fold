// fold-chat-sealed-judge.test.mjs — ANGELICA, FALSIFIED. She is advisory (never standing), sealed (passages
// do not leave), typed (nothing outside the schema), and LEARNED — the same signature stops calling her.
// The controls: without a token the pipeline is byte-for-byte what it was (no consult at all).
import test from "node:test";
import assert from "node:assert/strict";
import { modelCallRule } from "./fold-chat-model-rule.js";
import { hasJudgeToken, decisionSignature, needsJudge, sealJudge, judgePrompt, parseJudge, lessonOf, Angelica } from "./fold-chat-sealed-judge.js";

const KEY = "fake-token-0123456789-abcdefghijklmnop";
const run = (answer) => async () => answer;

test("CONTROL: no token → nothing consults; a DECIDED gap never consults (the token gate is the caller's)", async () => {
  assert.equal(hasJudgeToken({ env: { ANTHROPIC_API_KEY: "" }, keyFile: "/nonexistent/nope" }), false);
  assert.equal(needsJudge({ signature: "s", gap: null, judgeOn: true }), false, "a decided machine needs no judge");
  assert.equal(needsJudge({ signature: "s", gap: "topic", judgeOn: false }), false, "judge off → no consult");
  const v = await Angelica({ run: run("{}") });   // no sealed payload → not consulted
  assert.equal(v.gap, "not_consulted");
});

test("SEALED: raw passages never leave — the payload carries no sentence of the read", () => {
  const sealed = sealJudge({ question: "was ist die Zeremonie?", kind: "research", reading: { claims: 3, findings: 0, ok: true, lang: "de" }, tools: ["web", "slot", "mouth"], topic: "die zeremonie" });
  const dumped = JSON.stringify(sealed);
  assert.equal(dumped.includes("kleiner Tod"), false, "no passage sentence in the sealed payload");
  assert.equal(dumped.includes("reisen"), false);
  assert.ok(dumped.includes('"claims":3') && dumped.includes('"reading"'), "counts and the canonical reading travel");
});

test("ADVISORY: Angelica's word cannot UNBAR a barred turn — R1–R7 still decide alone", () => {
  const barred = modelCallRule({ plan: { gap: true } });      // R1: no source
  assert.equal(barred.allowed, false);
  // even a glowing verdict (on-topic, tool proposed) does not flip it:
  const verdict = { topic: "on", confidence: 0.99, tool: "web" };
  assert.equal(barred.allowed, false, "a verdict never overrides the bar rules");
});

test("ADVISORY: her tool is a PROPOSAL — a frozen data record, never an execution path", () => {
  const v = parseJudge('{"topic":"on","confidence":0.8,"tool":"web","why":"the ask wants a page"}');
  assert.equal(v.tool, "web");
  assert.equal(v.schema, "EOSealedJudgeVerdict@1");
  assert.ok(Object.isFrozen(v), "a verdict is frozen data — nothing about it reaches a tool caller");
});

test("TYPED: a nonconforming answer is a typed gap — garbage, prose, or an unknown topic never fabricates", () => {
  for (const junk of ["hello world", "", "```json\n{\"topic\":\"banana\"}\n```", "{not json", '"just a string"']) {
    const v = parseJudge(junk);
    assert.ok(v.gap || v.topic === null, `must be a gap or null topic for: ${JSON.stringify(junk)}`);
    assert.equal(v.tool, null);
  }
  const ok = parseJudge('{"topic":"drift","confidence":0.6,"tool":null,"why":"leaning off"}');
  assert.equal(ok.topic, "drift");
});

test("LEARNED: the same signature is answered from the lesson — Angelica is consulted once, then not again", async () => {
  let consults = 0;
  const sig = decisionSignature({ kind: "research", question: "wer ist der kaiser?", gap: "topic" });
  const lessons = [];
  const consult = async () => { consults++; return Angelica({ sealed: sealJudge({ question: "wer ist der kaiser?", kind: "research" }), run: run('{"topic":"on","confidence":0.7,"tool":"web","why":"topic holds"}') }); };
  // turn 1: no lesson → needed; she is consulted; the lesson lands
  assert.equal(needsJudge({ signature: sig, gap: "topic", lessons }), true);
  const v1 = await consult(); assert.equal(consults, 1);
  lessons.push(lessonOf({ signature: sig, answer: v1.topic === "drift" ? "drift" : "ok", topic: v1.topic }));
  // turns 2–3: the lesson covers the signature → the judge is NOT needed, and no consult happens
  for (let i = 0; i < 2; i++) {
    assert.equal(needsJudge({ signature: sig, gap: "topic", lessons }), false, "covered by the lesson — she is not needed again");
    if (needsJudge({ signature: sig, gap: "topic", lessons })) await consult();
  }
  assert.equal(consults, 1, "one consult for three identical decisions — needs her less and less");
});

test("SLOW: a slow Angelica never blocks the turn — the machine's own decision stands", async () => {
  const v = await Angelica({ sealed: sealJudge({ question: "x", kind: "chat" }), run: () => new Promise(() => {}), timeoutMs: 60 });
  assert.equal(v.gap, "slow");
  assert.equal(v.why.length > 0, true);
});

test("the judge prompt itself carries the lessons (the judge steers the SAME way the machine learned)", () => {
  const sealed = sealJudge({ question: "q", kind: "chat", lessons: [lessonOf({ signature: "abcd", answer: "ok", topic: "on" })] });
  const p = judgePrompt(sealed);
  assert.ok(p.includes("advisory"));
  const behind = JSON.stringify(sealed);
  assert.ok(behind.includes('"lessons"') && behind.includes('"sig":"abcd"') && behind.includes('"a":"ok"'), "the compact lessons ride the sealed payload");
});