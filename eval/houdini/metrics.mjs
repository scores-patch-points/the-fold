// eval/houdini/metrics.mjs — BLACK-BOX scoring: an arm is judged only by the messages it returns (what the model would be sent), never by its internals, so the fold today,
// Houdini, the oracle and a mutant are scored by the same code. Every metric is in [0,1]; null means "not applicable to this probe".
import { buildRecordSystemMessage, charCount, RECENCY_WINDOW } from "../../vendor/the-fold/fold.js";

const recChars = (r) => [r.gist, ...(r.open || []), ...(r.unsupported || []), ...(r.refs || [])].join("").length;

/** What a message array shows of the conversation: which records ride (parsed from the ON RECORD block), which raw exchanges ride, how many it says it left out. */
export function observe(messages, conv) {
  const sys = messages[0]?.role === "system" ? messages[0].content : "";
  const at = sys.indexOf("ON RECORD");
  const block = at >= 0 ? sys.slice(at) : "";
  const past = sys.indexOf("PAST DISCOURSE");
  const turns = new Set([...block.matchAll(/^Turn (\d+)(?: · self)?: /gm)].map((m) => Number(m[1])));
  const assistantTurn = new Map();
  conv.order.forEach((o, i) => assistantTurn.set(conv.history[2 * i + 1].content, o.turn));
  const userOf = new Map(); conv.order.forEach((o, i) => userOf.set(o.turn, conv.history[2 * i].content));
  const exch = new Map();   // turn → chars of that raw exchange as shown
  for (const m of messages.slice(1, -1)) if (m.role === "assistant" && assistantTurn.has(m.content)) { const t = assistantTurn.get(m.content); exch.set(t, m.content.length + (userOf.get(t) || "").length); }
  const ns = /Not shown: (\d+) /.exec(block);
  return { sys, block, past, turns, exch, notShown: ns ? Number(ns[1]) : null, chars: charCount(messages), lastTurn: conv.order[conv.order.length - 1].turn };
}

/** The per-probe scores of one arm's output. */
export function scoreProbe({ messages, probe, conv, baselineChars }) {
  const o = observe(messages, conv), store = conv.summary.records, recOf = new Map(store.map((r) => [r.turn, r]));
  const items = [...probe.need.map((t) => ["r", t]), ...probe.exchanges.map((t) => ["x", t]), ...(probe.rawTail ? [["x", o.lastTurn]] : [])];
  const has = ([k, t]) => (k === "r" ? o.turns.has(t) : o.exch.has(t));
  const recall = items.length ? items.filter(has).length / items.length : null;
  const pinned = probe.pinnedNeed.map((t) => ["r", t]);
  const guard = pinned.length ? pinned.filter(has).length / pinned.length : null;
  const decoyRejection = probe.decoys.length ? 1 - probe.decoys.filter((t) => o.turns.has(t)).length / probe.decoys.length : null;

  // shape precision: of what rides from the thread, how much is relevant to the ask (or is the declared floor: the previous exchange, two when the ask is thin)
  const rel = new Set(probe.relevant), needT = new Set([...probe.need, ...probe.exchanges]);
  const floorX = new Set(conv.order.slice(-Math.floor(RECENCY_WINDOW / 2)).map((x) => x.turn));   // the last few ride always: they are the declared floor, not waste
  let good = 0, waste = 0;
  for (const t of o.turns) (rel.has(t) || needT.has(t) ? (good += recChars(recOf.get(t))) : (waste += recChars(recOf.get(t))));
  for (const [t, c] of o.exch) (needT.has(t) || floorX.has(t) ? (good += c) : (waste += c));
  const precision = good + waste === 0 ? 1 : good / (good + waste);

  const budget = o.chars <= baselineChars ? 1 : 0;
  const hidden = store.length - o.turns.size;
  const honesty = o.notShown == null ? (hidden === 0 ? 1 : 0) : o.notShown === hidden ? 1 : 0;

  // integrity: the record block IS fold.js's own rendering of the records it names (never reworded), and a paraphrase never reads as a record
  const shown = [...o.turns].sort((a, b) => a - b).map((t) => recOf.get(t));
  const expected = shown.length ? buildRecordSystemMessage({ records: shown }, { window: shown.length }) : "";
  const verbatim = !shown.length || o.block.startsWith(expected);
  const separate = o.past < 0 || o.past < o.sys.indexOf("ON RECORD") || !o.block;
  const noRecordInPast = !/^Turn \d+: /m.test(o.past >= 0 ? o.sys.slice(o.past, o.block ? o.sys.indexOf("ON RECORD") : undefined) : "");
  const integrity = verbatim && separate && noRecordInPast ? 1 : 0;

  return { recall, guard, decoyRejection, precision, budget, honesty, integrity, chars: o.chars };
}

export const mean = (xs) => { const v = xs.filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
