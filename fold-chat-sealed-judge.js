// fold-chat-sealed-judge.js — ANGELICA, THE SEALED JUDGE (user, 2026-10-11).
//
// If an Anthropic token is present, a sealed judge may be consulted at the mouth's decision point:
// it can judge whether the fold is staying on topic, and propose WHICH tool to call — but its word is
// ADVISORY, never standing: a verdict cannot bar a turn (the bar rules R1–R7 of fold-chat-model-rule.js
// still decide alone), cannot unbar one, and is never executed implicitly. Every judge call is fed the
// lessons from earlier judgements, and every judgement that lands generates a lesson — so the same
// decision signature is answered from the lesson next time, and the system needs the judge less and less.
//
// SEALED: the payload never carries raw passages — only the canonical reading, the claim/finding counts,
// the tool names and the topic line. Sentences do not leave the machine.
//
// Calling: `Angelica({ sealed, run })` — `run(prompt) -> Promise<text>` is the executor (the bridge in
// the browser, the Anthropic client in the tools). Without a token `needsJudge` says false and the turn
// is exactly as it was before Angelica existed.

// NO node: imports here — this module is imported by the browser's fold-chat.js. A deterministic pure-JS
// hash signs decisions (stability is all a signature needs), and the token check takes an injectable
// reader so node callers can hand it the key file while the browser simply reports what its bridge serves.

export const JUDGE_SCHEMA = "EOSealedJudgeVerdict@1";

export const JUDGE_RULES = Object.freeze({
  advisory: "the verdict is consultable, never standing — the bar rules still decide alone",
  sealed: "the payload carries no raw passages — only counts, canonical words, tool names, the topic line",
  typed: "nothing outside the verdict schema is accepted; a refused line is disclosed, never fabricated",
  lessons: "every judgement that lands becomes a lesson; the same signature is then answered from the lesson",
});

// a deterministic, dependency-free hash (FNV-1a, both directions → 16 hex chars) — a signature only needs
// to be stable across sessions, never cryptographic. Keeps this module importable in the browser.
function fnv1a(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, "0"); }
const signatureHash = (s) => fnv1a(s) + fnv1a([...s].reverse().join(""));

/** In the browser fold the token lives server-side (heimdall), never in the page: an Anthropic model in
 *  the served model list IS the signal. In node the check is env/file. Either proves reach — that is the
 *  only thing the judge needs to know; the token itself is never touched by the page. */
export function judgeReachable({ models = [], env = typeof process !== "undefined" ? process.env : {}, keyFile = null, read = null, storage = typeof localStorage !== "undefined" ? localStorage : null } = {}) {
  if (hasJudgeToken({ env, keyFile, read })) return true;
  // THE BROWSER LANE (user, 2026-10-11: "wire in Angelica so i can put in an anthropic api key"):
  // on the in-browser-only surface there is no served model list and no server-side key — the
  // Anthropic key the person pasted into Settings is stored in THIS browser and is her reach.
  if (browserJudgeKey(storage).length >= 20) return true;
  return Array.isArray(models) && models.some((m) => /^claude-|anthropic/i.test(String(m?.id || m?.name || "")));
}

/** The browser key lane: the Anthropic key stored in this browser (Settings → API keys).
 *  It is used for ONE thing — Angelica's sealed consult — and never for answers. */
export const JUDGE_KEY_STORE = "fold-chat:key:anthropic";
export const JUDGE_MODEL_STORE = "fold-chat:judgemodel";
export const JUDGE_MODEL_DEFAULT = "claude-sonnet-4-5";
export function browserJudgeKey(storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try { return String(storage?.getItem?.(JUDGE_KEY_STORE) || "").trim(); } catch { return ""; }
}
export function judgeModelName(storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try { return String(storage?.getItem?.(JUDGE_MODEL_STORE) || "").trim() || JUDGE_MODEL_DEFAULT; } catch { return JUDGE_MODEL_DEFAULT; }
}

/** ANGELICA'S DIRECT SEALED LANE: one consult straight to Anthropic from this browser
 *  (their CORS door), the sealed prompt and nothing else — temperature 0, tight JSON, the
 *  same shape the bridge returned. A missing key and an HTTP failure are typed errors; the
 *  turn falls back to the machine's own decision exactly as if no judge had been called. */
export async function anthropicJudge({ prompt, key, fetchImpl = fetch, model = null, maxTokens = 400, signal = null } = {}) {
  const token = String(key ?? "").trim();
  if (token.length < 20) throw Object.assign(new Error("no Anthropic key is stored in this browser"), { status: 401, kind: "no-key" });
  const r = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": token,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model: model || JUDGE_MODEL_DEFAULT, max_tokens: maxTokens, temperature: 0, messages: [{ role: "user", content: String(prompt ?? "") }] }),
    ...(signal ? { signal } : {}),
  });
  if (!r.ok) throw Object.assign(new Error("Anthropic answered " + r.status), { status: r.status, kind: "http" });
  const j = await r.json();
  const text = (Array.isArray(j?.content) ? j.content : []).filter((c) => c && c.type === "text").map((c) => String(c.text || "")).join("\n");
  return { text, model: j?.model || model || JUDGE_MODEL_DEFAULT, usage: j?.usage || null };
}

/** Does the machine hold an Anthropic token? env first; a key FILE only when the caller hands a reader
 *  (node/tools: `read: (p) => readFileSync(p, "utf8")`) — the browser has no filesystem and reports false
 *  here, then proves reach through `judgeReachable`'s model list instead. */
export function hasJudgeToken({ env = typeof process !== "undefined" ? process.env : {}, keyFile = null, read = null } = {}) {
  if (env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY.trim().length >= 20) return true;
  try { if (keyFile && typeof read === "function") { const v = read(keyFile); return typeof v === "string" && v.trim().length >= 20; } } catch (e) { return false; }
  return false;
}

/** The signature of a decision: a deterministic string that identical decisions share, so a lesson for one
 *  covers the next. kind + the ask's own function-word profile + the decision gap. */
export function decisionSignature({ kind = "chat", question = "", gap = "topic-or-tool" } = {}) {
  const profile = Array.from(new Set(String(question).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length <= 2)))
    .sort().join(",");
  return signatureHash(`${kind}|${profile}|${gap}`).slice(0, 24);
}

/** Does this decision need the judge at all? A lesson that already covers the signature answers modellessly —
 *  that IS the "needs it less and less": identical decisions stop reaching the judge. `gap` is the modelless
 *  path's own indecision ("topic" / "tool:X" / null = decided). */
export function needsJudge({ signature, gap = null, lessons = [], judgeOn = true } = {}) {
  if (!judgeOn) return false;
  if (gap == null) return false;                       // the machine already decided — no judge is consulted
  const covered = lessons.some((l) => l?.op === "judge" && l?.signature === signature && l?.answer !== null);
  return !covered;
}

/** The SEALED payload: the canonical ask, counts, a topic line, tool names, lessons — never raw passages. */
export function sealJudge({ question = "", kind = "chat", reading = null, tools = [], topic = "", lessons = [] } = {}) {
  return Object.freeze({
    schema: JUDGE_SCHEMA,
    sealed: true,
    kind,
    question: String(question).slice(0, 200),
    reading: reading ? { claims: reading.claims ?? 0, findings: reading.findings ?? 0, ok: !!reading.ok, lang: reading.lang || null } : null,
    topic: String(topic).slice(0, 80),
    tools: [...(tools || [])].sort(),
    lessons: [...(lessons || [])].slice(-6).map((l) => ({ sig: l.signature, a: l.answer, o: l.outcome || null })),
  });
}

/** The judge's prompt: it judges an already-typed decision, never a standing; it may propose a tool, and it
 *  is handed the lessons so it steers the SAME way the fold already learned. */
export function judgePrompt(sealed) {
  return [
    "You are a sealed judge consulted by a reading machine. You are advisory only.",
    "THE MACHINE'S READING (sealed — no passages):",
    JSON.stringify(sealed, null, 1),
    "You judge two things, and only two:",
    "1) topic — whether the machine's approach to the ask stays on the topic line (answer on / drift / undecided),",
    "2) tool — of the tools listed, which ONE you would propose (or null).",
    "A verdict NEVER overrides the machine: the bar rules alone decide. A refusal is a refused line, spoken as such.",
    "Answer with exactly one JSON object: {\"topic\":\"on\"|\"drift\"|\"undecided\",\"confidence\":0..1,\"tool\":null|\"<tool>\",\"why\":\"<one short line>\"}",
    "Nothing else. No markdown, no prose.",
  ].join("\n");
}

/** Parse the judge's answer TIGHTLY: only the schema is accepted; anything else is a typed gap (the turn
 *  falls back to the machine's own decision exactly as if no judge had been called). */
export function parseJudge(text = "") {
  const m = String(text || "").match(/\{[\s\S]*\}/);
  if (!m) return { schema: JUDGE_SCHEMA, gap: "no_json", topic: null, confidence: null, tool: null, why: "the judge returned nothing parseable — the machine's own decision stands" };
  try {
    const raw = JSON.parse(m[0]);
    const topic = ["on", "drift", "undecided"].includes(raw.topic) ? raw.topic : null;
    if (!topic) return { schema: JUDGE_SCHEMA, gap: "untyped_topic", topic: null, confidence: null, tool: null, why: "a topic outside the schema is a typed gap", refused: true };
    const confidence = Number.isFinite(Number(raw.confidence)) ? Math.min(1, Math.max(0, Number(raw.confidence))) : null;
    const tool = typeof raw.tool === "string" && raw.tool.length ? raw.tool : null;
    return Object.freeze({ schema: JUDGE_SCHEMA, topic, confidence, tool, why: String(raw.why || "").slice(0, 160) });
  } catch (e) {
    return { schema: JUDGE_SCHEMA, gap: "unparseable", topic: null, confidence: null, tool: null, why: "the judge's words did not parse — the machine's own decision stands" };
  }
}

/** The lesson a landed judgement generates: the same signature never calls the judge again. Append-only. */
export function lessonOf({ signature, answer = null, topic = null, outcome = null } = {}) {
  return Object.freeze({ op: "judge", signature, answer, topic, outcome, at: Date.now() });
}

export const JUDGE_KEY = "hd:fold-judged";
export const JUDGE_TOGGLE = "fold-chat:angelica";

/** Is the judge honoured in this fold? A storage toggle (default ON — the same pattern as the pivot), so a
 *  fold can decide locally whether Angelica is consulted at all. */
export function judgeOn(storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try { return storage?.getItem?.(JUDGE_TOGGLE) !== "off"; } catch { return true; }
}

/** The lessons Angelica has already steered by — the append-only store (localStorage in the fold), so her
 *  next consult sees them and the identical decision is answered from a lesson instead. */
export function judgeLessonsOf(storage = typeof localStorage !== "undefined" ? localStorage : null, key = JUDGE_KEY) {
  try { return JSON.parse(storage?.getItem?.(key) || "[]") || []; } catch { return []; }
}

/** One landed judgement is appended (append-only; the fold's own storage contract). */
export function addJudgeLesson(lesson, storage = typeof localStorage !== "undefined" ? localStorage : null, key = JUDGE_KEY) {
  const all = judgeLessonsOf(storage, key);
  all.push(lesson);
  try { storage?.setItem?.(key, JSON.stringify(all)); } catch { /* a fold that cannot persist still judges */ }
  return all.length;
}

/** ANGELICA — the invocation. One sealed consult: prompt → run → TIGHT parse. A slow judge never blocks
 *  the turn (timeoutMs), a missing executor or a gap plays out as "no verdict — the machine's own decision
 *  stands", exactly as if she had not been consulted. */
export async function Angelica({ sealed = null, run = null, timeoutMs = 3500 } = {}) {
  if (!sealed || typeof run !== "function") {
    return Object.freeze({ schema: JUDGE_SCHEMA, gap: "not_consulted", topic: null, confidence: null, tool: null, why: "no sealed consult (no token or no executor) — the machine's own decision stands" });
  }
  const settled = await Promise.race([
    (async () => { try { return await run(judgePrompt(sealed)); } catch (e) { return null; } })(),
    new Promise((r) => setTimeout(() => r("__timeout__"), timeoutMs)),
  ]);
  if (settled === "__timeout__") {
    return Object.freeze({ schema: JUDGE_SCHEMA, gap: "slow", topic: null, confidence: null, tool: null, why: "Angelica was slow — the turn did not wait (the machine's own decision stands)" });
  }
  return parseJudge(settled || "");
}

export default { hasJudgeToken, judgeReachable, decisionSignature, needsJudge, sealJudge, judgePrompt, parseJudge, lessonOf, Angelica, judgeOn, judgeLessonsOf, addJudgeLesson, JUDGE_SCHEMA, JUDGE_KEY, JUDGE_TOGGLE };