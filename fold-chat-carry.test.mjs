import test from "node:test";
import assert from "node:assert/strict";
import { indexOfReferents, transcriptOf, carryOf, applyCarry } from "./fold-chat-carry.js";
import { admitReferents, emptyReferents } from "./fold-chat-mind.js";

const turn = (rec, q, a, titles = []) => admitReferents(rec, { question: q, answer: a, sources: titles.map((t) => ({ title: t })) });
const msgs = (pairs) => pairs.flatMap(([q, a]) => [{ role: "user", content: q }, { role: "assistant", content: a }]);

test("the transcript is answered asks only: attachments and Continue are not exchanges", () => {
  const t = transcriptOf([{ role: "user", content: "x", attachment: true }, { role: "user", content: "Who is Ada Lovelace?" }, { role: "assistant", content: "Ada Lovelace wrote notes." }, { role: "user", content: "Continue." }, { role: "assistant", content: "More." }]);
  assert.equal(t.length, 1);
  assert.equal(t[0].turn, 1);
});

test("identity is the record's: a question and an old answer naming one being resolve to one id", () => {
  let rec = turn(emptyReferents(), "Who is Ada Lovelace?", "Ada Lovelace wrote notes on the Analytical Engine.", ["Ada Lovelace — Wikipedia"]);
  const ix = indexOfReferents(rec);
  assert.deepEqual([...ix.resolveIn("what did ada lovelace do")], ["ada lovelace"]);
  assert.equal(ix.represent("ada lovelace"), "Ada Lovelace");
});

test("the carry is computed, struck of addresses, and says where the conversation stands", () => {
  let rec = emptyReferents(); const pairs = [];
  for (const [q, a, t] of [["Who is Ada Lovelace?", "Ada Lovelace wrote notes on the Analytical Engine.", "Ada Lovelace — Wikipedia"], ["What did Ada Lovelace publish?", "Ada Lovelace published a translation with notes.", "Ada Lovelace — Wikipedia"]]) { rec = turn(rec, q, a, [t]); pairs.push([q, a]); }
  const c = carryOf({ referents: rec, messages: msgs(pairs), summary: { records: [] } });
  assert.match(c.text, /Where the conversation stands/);
  assert.match(c.text, /Ada Lovelace/);
  assert.ok(!/\[turn:/.test(c.text), "addresses are struck in the mouth-facing text");
  assert.ok(c.lines.some((l) => /\[turn:/.test(l)), "the record keeps them");
  assert.match(c.basis, /grounds segmented/);
});

test("a new subject turns the ground and the carry says it turned", () => {
  let rec = emptyReferents(); const pairs = [];
  for (const [q, a] of [["Who is Ada Lovelace?", "Ada Lovelace wrote notes."], ["Who is Alan Turing?", "Alan Turing studied computation."]]) { rec = turn(rec, q, a); pairs.push([q, a]); }
  const c = carryOf({ referents: rec, messages: msgs(pairs), summary: { records: [] } });
  assert.match(c.text, /turned there/);
});

test("it is omnilingual: a Han conversation yields a carry, not 'no entities'", () => {
  let rec = turn(emptyReferents(), "谁是李白?", "李白是唐代诗人。", ["李白 — 维基百科"]);
  const c = carryOf({ referents: rec, messages: msgs([["谁是李白?", "李白是唐代诗人。"]]), summary: { records: [] } });
  assert.ok(c.entities.some((e) => e.includes("李白")), JSON.stringify(c.entities));
  assert.match(c.text, /李白/);
});

test("nothing resolves → the summary is left exactly as it was (it can only add)", () => {
  const s = { topic: "t", flow: "1 turn(s)", entities: ["X"], records: [] };
  assert.deepEqual(applyCarry(s, { referents: emptyReferents(), messages: [] }), s);
});

test("applyCarry puts the atmosphere in Flow and the record's names in Entities, with its basis", () => {
  let rec = turn(emptyReferents(), "Who is Ada Lovelace?", "Ada Lovelace wrote notes.", ["Ada Lovelace — Wikipedia"]);
  const out = applyCarry({ topic: "t", flow: "1 turn(s)", entities: [], records: [] }, { referents: rec, messages: msgs([["Who is Ada Lovelace?", "Ada Lovelace wrote notes."]]) });
  assert.match(out.flow, /stood on Ada Lovelace/);
  assert.ok(!/\[turn:/.test(out.flow));
  assert.ok(out.entities.includes("Ada Lovelace"));
  assert.ok(out.carry.basis);
});

// ── F-D4 (nesting audit, 2026-10-14): lensBlock was handed `notes: [], voids: []`, so a slot turn's own typed gap never reached the next prompt.
import { voidsOfMessages } from "./fold-chat-carry.js";

const GAP_TURN = { role: "assistant", content: "", answerTurn: { schema: "AnswerTurn@1", slot: "place", answer: null, contest: [], gap: { kind: "unwitnessed" }, frame: { slot: "place", referents: [{ surface: "Emmanuel Macron", title: "Emmanuel Macron" }], predicate: [{ surface: "born", stem: "born" }] }, sources: [{ title: "Emmanuel Macron", url: "https://en.wikipedia.org/wiki/Emmanuel_Macron" }] } };

test("F-D4: a slot turn that ended in an unwitnessed gap is a declared void, scoped to what was read", () => {
  assert.deepEqual(voidsOfMessages([{ role: "user", content: "Where was he born?" }, GAP_TURN]), [
    { subject: "Emmanuel Macron", verb: "born", scope: { sources: ["https://en.wikipedia.org/wiki/Emmanuel_Macron"] }, kind: "unwitnessed", turn: 1 },
  ]);
});

test("F-D4 negative controls: an answer, a contest, a refuted finding, a model turn and a gap with no referent are not voids", () => {
  const withAt = (patch) => ({ role: "assistant", content: "", answerTurn: { ...GAP_TURN.answerTurn, ...patch } });
  assert.deepEqual(voidsOfMessages([withAt({ answer: { text: "Amiens." }, gap: null })]), []);
  assert.deepEqual(voidsOfMessages([withAt({ contest: [{ filler: { text: "a" } }, { filler: { text: "b" } }] })]), []);
  assert.deepEqual(voidsOfMessages([withAt({ gap: { kind: "refuted" } })]), [], "a refutation is a finding, not an open void");
  assert.deepEqual(voidsOfMessages([{ role: "assistant", content: "A model answer." }]), []);
  assert.deepEqual(voidsOfMessages([withAt({ frame: { slot: "place", referents: [] } })]), []);
  assert.deepEqual(voidsOfMessages(null), []);
});

test("F-D4: the carry's lens now says what was looked for and not found; the notes it does not have are typed, not an empty array", () => {
  const Q1 = "Who is the president of France?", A1 = "Emmanuel Macron is a French politician who has served as president of France since 14 May 2017.";
  const rec = turn(emptyReferents(), Q1, A1, ["Emmanuel Macron"]);
  const messages = [{ role: "user", content: Q1 }, { role: "assistant", content: A1 }, { role: "user", content: "Where was he born?" }, GAP_TURN];
  const c = carryOf({ referents: rec, messages, summary: { records: [] } }, { question: "Emmanuel Macron: where was he born?" });
  assert.ok(c.lines.some((l) => /looked for and not found so far: Emmanuel Macron — born→ \?/.test(l)), JSON.stringify(c.lines));
  assert.match(c.text, /an open gap, not a finding that it is false/);
  assert.match(c.basis, /no-notes/);
  // positive control: with no gap turn the same conversation carries no void line
  const c0 = carryOf({ referents: rec, messages: messages.slice(0, 2), summary: { records: [] } }, { question: "Emmanuel Macron: where was he born?" });
  assert.ok(!c0.lines.some((l) => /looked for and not found/.test(l)));
});

test("the carry ALSO holds penelope's portable fold (fold-note): many asks fold to threads", () => {
  const topics = ["parser", "deploy", "billing"];
  const pairs = Array.from({ length: 20 }, (_, i) => [`work on the ${topics[i % 3]} item ${i}`, `settled the ${topics[i % 3]} work`]);
  const rec = turn(emptyReferents(), "Who is Ada Lovelace?", "Ada Lovelace wrote notes on the Analytical Engine.", ["Ada Lovelace — Wikipedia"]);
  const c = carryOf({ referents: rec, messages: msgs(pairs) }, { question: "what did we settle about the parser?" });
  assert.match(c.text, /fold: the thread/); // the shared, record-free fold rides with the chat's own rich carry
  assert.match(c.text, /thread\(s\)/);
});
