// fold-chat-murmur.test.mjs — the murmur says what the question is, and catches the two 2026-10-10 failures.
import test from "node:test";
import assert from "node:assert/strict";
import { murmurOf, splitRunTogether, murmurSay, murmurText, sentenceFor } from "./fold-chat-murmur.js";
import { FUNCTION_WORDS } from "./fold-chat-function-words.js";

const EN = new Set(FUNCTION_WORDS.en);
const ops = (m) => m.lines.map((l) => l.op);
const line = (m, op) => m.lines.find((l) => l.op === op);

test("splitRunTogether finds a run-together token, and refuses a real word", () => {
  assert.deepEqual(splitRunTogether("itnow", EN), ["it", "now"]);
  assert.equal(splitRunTogether("lovelace", EN), null);
});

test("CATCHES 'itnow': a run-together token is suspected, never taken as a name", () => {
  const m = murmurOf({ question: "who is itnow?", carried: ["Emperor of Japan"] });
  const s = line(m, "suspicion");
  assert.ok(s, "a suspicion line");
  assert.equal(s.token, "itnow");
  assert.deepEqual(s.split, ["it", "now"]);
  assert.equal(s.serious, true);
  assert.equal(m.interpretation, "Emperor of Japan");   // still read as about the referent, not ITNOW
});

test("CATCHES 'who is it now': the leftover 'now' is a caution, not a subject", () => {
  const m = murmurOf({ question: "who is it now?", carried: ["Emperor of Japan"] });
  assert.ok(ops(m).includes("referent"));
  assert.equal(line(m, "referent").carried[0], "Emperor of Japan");
  assert.ok(!ops(m).includes("warning"));                // it HAS a referent — not a hard ask
  const c = line(m, "caution");
  assert.ok(c && c.low.includes("now"), "now is named as low-salience");
  assert.equal(m.interpretation, "Emperor of Japan");
  assert.equal(m.hard, false);
});

test("DIFFICULTY: a follow-up with a referent is ordinary; the same with nothing to lean on is hard", () => {
  assert.equal(murmurOf({ question: "who is it now?", carried: ["Emperor of Japan"] }).hard, false);
  const orphan = murmurOf({ question: "who is it now?" });
  assert.equal(orphan.hard, true);
  assert.ok(ops(orphan).includes("warning"));
  assert.equal(murmurOf({ question: "who is itnow?", carried: ["Emperor of Japan"] }).hard, true);   // run-together
  assert.equal(murmurOf({ question: "Who is the president?" }).hard, false);
});

test("a real subject is named from the prior (president)", () => {
  const m = murmurOf({ question: "Who is the president?" });
  assert.ok(m.names.includes("president"));
  assert.equal(m.interpretation, "president");
});

test("a Capitalized OOV is a NAME by the script's own rule, not unknown; lowercase OOV stays unknown", () => {
  const m = murmurOf({ question: "Who is Ada Lovelace?" });
  assert.ok(m.names.includes("lovelace"), "Capitalized in a case-significant script is a name (HEAD f565963)");
  assert.ok(!m.unknown.includes("lovelace"));
  const lower = murmurOf({ question: "who is ada lovelace?" });
  assert.ok(lower.unknown.includes("lovelace"), "lowercase OOV is still disclosed as unknown");
  assert.ok(lower.content.includes("ada") || lower.names.includes("ada"), "the measured part still names the subject");
});

test("the murmur is a proposal, never an answer: it carries no answer field", () => {
  const m = murmurOf({ question: "Who is the president?" });
  assert.equal(m.schema, "Murmur@1");
  assert.ok(!("answer" in m));
});

test("the murmur FLAGS ambiguity on the object, so a caller can gate on it", () => {
  assert.equal(murmurOf({ question: "who is the president?" }).ambiguous, true);   // bare role
  assert.equal(murmurOf({ question: "tell me about mercury" }).ambiguous, true);
  assert.equal(murmurOf({ question: "who is the emperor of japan?" }).ambiguous, false);
  assert.equal(murmurOf({ question: "what is the capital of france?" }).ambiguous, false);
});

test("MODELESS NL: the murmur renders as whole clean sentences, no model, nothing invented", () => {
  const m = murmurOf({ question: "who is itnow?", carried: ["Emperor of Japan"] });
  const say = murmurSay(m);
  assert.ok(say.length >= 4);
  for (const s of say) assert.ok(/^[A-Z\u201c]/.test(s) && /[.!?]$/.test(s), "a whole sentence: " + s);
  const text = murmurText(m);
  assert.match(text, /You wrote \u201citnow\u201d; I read that as \u201cit now\u201d/);   // catches the ITNOW failure
  assert.match(text, /reading the question as being about Emperor of Japan/);
  assert.equal(text, say.join(" "));
});

test("MODELESS NL: the two 2026-10-10 failures read as a plain explanation, with no model in the path", () => {
  const a = murmurText(murmurOf({ question: "who is it now?", carried: ["Emperor of Japan"] }));
  assert.match(a, /It points back to Emperor of Japan/);
  assert.match(a, /\u201cnow\u201d is a follow-up word/);
  const b = murmurText(murmurOf({ question: "who is itnow?", carried: ["Emperor of Japan"] }));
  assert.match(b, /run-together, not a name/);
});

test("UNKNOWN (referent-first 2026-10-11): an unmeasured form is an unresolved referent, never a refused word", () => {
  const m = murmurOf({ question: "who is ada lovelace?" });
  assert.ok(m.unknown.includes("lovelace"), "still disclosed as unknown (the array is unchanged)");
  assert.match(murmurText(m), /names something I have not met/, "the murmur looks for what bears the name");
  assert.ok(!murmurText(m).includes("a word I do not hold"), "the refusal sentence is gone");
});
