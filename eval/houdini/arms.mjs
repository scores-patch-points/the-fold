// eval/houdini/arms.mjs — the projections the battery scores. Each arm is (parts, probe, conv) → messages, where `parts` is exactly what the app hands the fold:
// { basePrompt, summary, history, question, referents } (deep-frozen: an arm that writes to its inputs throws and is scored as such).
//
//   positional   THE FOLD TODAY: vendor/the-fold/fold.js::buildTurnMessages (last 8 records, last 4 raw messages, whatever the ask)
//   houdini      fold-chat-houdini.js
//   oracle       builds the projection FROM THE GOLD — the ceiling. If the oracle does not score 100% the suite is wrong, not the fold
//   empty        the running summary and the ask, no records and no raw turns (a fold with no memory)
//   everything   every record and every message (perfect recall, no budget — the window grows)
import { buildTurnMessages, buildRecordSystemMessage, buildSummarySystemMessage, charCount, RECENCY_WINDOW, RECORDS_IN_PROMPT } from "../../vendor/the-fold/fold.js";
import { houdini } from "../../fold-chat-houdini.js";
import { planTurn } from "../../fold-chat-flow.js";
import { hintsFor } from "../../fold-chat-hints.js";
import { detectLang } from "../../fold-chat-lang.js";

export const BASE = "You are the fold. Answer from the material; say what you cannot support.";

export function deepFreeze(o) {
  if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); for (const k of Object.keys(o)) deepFreeze(o[k]); }
  return o;
}

const positional = (p) => buildTurnMessages({ basePrompt: p.basePrompt, summary: p.summary, history: p.history, question: p.question });
const empty = (p) => buildTurnMessages({ basePrompt: p.basePrompt, summary: { ...p.summary, records: [] }, history: [], question: p.question });
const everything = (p) => buildTurnMessages({ basePrompt: p.basePrompt, summary: p.summary, history: p.history, question: p.question, recordWindow: Math.max(1, p.summary.records.length), recencyWindow: Math.max(1, p.history.length) });
// Terry Gross's reading of the turn, from the SAME planner the app calls (fold-chat-flow.js planTurn), over the thread so far — the projector is handed what the app hands it
const terryOf = (p) => { try { const lang = detectLang(p.question, { prior: p.summary?.language || null }).lang; const f = planTurn(p.question, p.history, { referents: p.referents || null, hints: hintsFor(lang === "unknown" ? "en" : lang), lang }); return { kind: f.kind || null, act: f.act || null, mode: f.mode || null }; } catch { return null; } };
const houdiniArm = (config, budget, reader) => (p) => houdini({ basePrompt: p.basePrompt, summary: p.summary, history: p.history, question: p.question, referents: p.referents, turn: terryOf(p), ...(budget ? { budget } : {}) }, { ...(config ? { config } : {}), ...(reader ? { reader } : {}) }).messages;

/** The ceiling: exactly the gold records, the exchanges the probe needs, the floor exchange(s), the honest count — built from `turns` (a prefix of the priority-ordered need). */
function oracleWith(p, probe, conv, turns) {
  const store = p.summary.records;
  const sel = turns.map((t) => store.find((x) => x.turn === t)).filter(Boolean).sort((a, b) => a.turn - b.turn);
  const n = store.length - sel.length;
  let rec = sel.length ? buildRecordSystemMessage({ records: sel }, { window: sel.length }) : null;
  const note = n > 0 ? `Not shown: ${n} other checked ${n === 1 ? "turn" : "turns"} on record (they stay addressed and can be re-opened).` : "";
  if (rec && note) rec += "\n\n" + note; else if (!rec && note) rec = "ON RECORD — " + note.replace(/\.$/, "") + "; none bears on this ask.";
  const sys = [p.basePrompt, buildSummarySystemMessage(p.summary), rec].filter(Boolean).join("\n\n");
  const keepTurns = new Set([...probe.exchanges, ...conv.order.slice(-Math.floor(RECENCY_WINDOW / 2)).map((o) => o.turn)]);   // the last few ride always (the brief of 2026-10-13)
  const msgs = [{ role: "system", content: sys }];
  conv.order.forEach((o, i) => { if (keepTurns.has(o.turn)) msgs.push(p.history[2 * i], p.history[2 * i + 1]); });
  msgs.push({ role: "user", content: p.question });
  return msgs.map((m) => ({ role: m.role, content: m.content }));
}
/** The longest prefix of the priority-ordered need that fits the positional budget. Every arm is scored against THIS gold. */
export function feasibleNeed(p, probe, conv, baselineChars) {
  let k = probe.need.length;
  while (k > 0 && charCount(oracleWith(p, probe, conv, probe.need.slice(0, k))) > baselineChars) k--;
  return probe.need.slice(0, k);
}
const oracle = (p, probe, conv, baselineChars) => oracleWith(p, probe, conv, feasibleNeed(p, probe, conv, baselineChars));

// ── positive control: a reader that actually understands the paraphrase (the seam a semantic organ would fill). Not a mutant; it shows the seam moves the semantic metric. ──
const paraReader = (conv) => (ask, unit) => {
  for (const [noun, desc] of Object.entries(conv.pack.para || {})) if (ask.includes(desc) && unit.toLowerCase().includes(noun.toLowerCase())) return 1;
  return 0;
};

// ── mutants: each breaks ONE property; the suite must see it ──
const strip = (re) => (msgs) => msgs.map((m) => (m.role === "system" ? { ...m, content: m.content.replace(re, "") } : m));
export const MUTANTS = {
  "no-bearing":      { target: "needRecall",     arm: houdiniArm({ maxClusters: 0 }) },
  "no-decoy-guard":  { target: "decoyRejection", arm: houdiniArm({ relFloor: 0, bearFloor: 0.01 }) },
  "unbounded":       { target: "budget",         arm: houdiniArm({ maxRecords: 99, bearFloor: 0.01, relFloor: 0 }, { chars: 1e9 }) },
  "silent-omission": { target: "honesty",        post: strip(/\n*Not shown: \d+ [^\n]*/g) },
  "truncates-record": { target: "integrity",     post: (msgs) => msgs.map((m) => (m.role === "system" ? { ...m, content: m.content.replace(/^(Turn \d+: .{12}).*$/gm, "$1…") } : m)) },
  "nondeterministic": { target: "determinism",   post: (msgs) => msgs.map((m, i) => (i === 0 ? { ...m, content: m.content + " " + Math.random().toString(36).slice(2, 6) } : m)) },
  "drops-pinned":    { target: "guard",          post: (msgs) => msgs.map((m) => (m.role === "system" ? { ...m, content: m.content.replace(/Turn \d+: [^\n]*\n(?:  [^\n]*\n)*?  NOT supported[^\n]*(?:\n  [^\n]*)*/g, "") } : m)) },
  "writes-inputs":   { target: "integrity",      arm: (p) => { p.summary.records.pop(); return houdiniArm()(p); } },
};

export function makeArms(conv) {
  return {
    oracle: (p, probe, c, baselineChars) => oracle(p, probe, conv, baselineChars),
    houdini: houdiniArm(),
    "houdini-lex": (p, probe) => houdiniArm()({ ...p, referents: null }, probe),   // the lexical path alone: no referent record
    positional, empty, everything,
    "+reader": houdiniArm(null, null, paraReader(conv)),
    ...Object.fromEntries(Object.entries(MUTANTS).map(([k, m]) => [`mut:${k}`, m.arm ? m.arm : (p, probe) => m.post(houdiniArm()(p, probe))])),
  };
}
export { charCount, RECENCY_WINDOW };
