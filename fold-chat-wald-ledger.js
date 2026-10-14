// fold-chat-wald-ledger.js — WALD'S TURN LEDGER (eval/wald/PREREG-METABOLISM.md, prerequisite). Pure: no DOM, no IO, no clock.
//
// Phase 2 learns from turns, so turns must outlive the tab. One entry per answered turn, appended when the turn's record is complete, and
// CLOSED by the next turn with the person's next act — the earn-back signal (a skipped pull the person then needed costs Wald that turn).
//
// WHAT IS KEPT: only fields record.wald already carries, minus every `why` (a witness's why can carry the ask's own words — "the ask names
// eiffel, tower"), plus `used`/`usedBy` (a kept passage was used: cited by the answer, or the answer IS the sources' own words — PREREG-METABOLISM Clarification 1) and `next`. No ask text, no answer text, no URL. Append-only by contract:
// an entry is never edited after it is closed.
//
//   ledgerEntry({ sid, turn, at, head, wald, usedBy }) → WaldLedger@1 (next: null); usedBy: "cited" | "sources" | null
//   nextActOf(follow)                                  → "reask" | "sourceAsk" | "challenge" | "moveOn"
//   closeLast(ledger, sid, next)                       → new ledger: the session's last open entry gets `next`
//   appendEntry(ledger, entry, { cap })                → new ledger, oldest dropped past `cap`
//
// `nextActOf` reads the planner's own verdict on the NEXT ask, never a new classifier: planTurn's `retry` (a nudge after an unanswered ask),
// its `source-ask`, and Terry's speech act `escalation` (a push-back). DECLARED LIMIT: a fresh re-wording of the same question is planned as a
// standalone ask and is read here as "moveOn" — a miss this ledger cannot see yet. It is recorded as a limit, not hidden.
export const LEDGER_SCHEMA = "WaldLedger@1";
export const LEDGER_KEY = "fold-chat:wald-ledger";
// a STORAGE bound, not a judgment: localStorage holds ~5 MB per origin and an entry is ~0.5 KB, so 4,000 entries stays under half of it.
export const LEDGER_CAP = 4000;

const NEXT = Object.freeze(["reask", "sourceAsk", "challenge", "moveOn"]);

export function ledgerEntry({ sid = null, turn = null, at = null, head = null, wald = null, usedBy = null, droppedBefore = 0 } = {}) {
  const d = wald?.decision || null;
  const web = d?.pulls?.web || null;
  return {
    schema: LEDGER_SCHEMA,
    sid: sid == null ? null : String(sid),
    turn: Number.isFinite(turn) ? turn : null,
    at: at == null ? null : String(at),
    head: head == null ? null : String(head),
    gateNow: typeof wald?.gateNow === "boolean" ? wald.gateNow : null,
    waldWeb: typeof wald?.waldWeb === "boolean" ? wald.waldWeb : null,
    agrees: typeof wald?.agrees === "boolean" ? wald.agrees : null,
    possible: d ? [...d.possible] : [],
    recommend: d ? [...d.recommend] : [],
    web: web ? { verdict: web.verdict, llr: Number.isFinite(web.llr) ? web.llr : null, logA: web.logA ?? null, logB: web.logB ?? null, truncated: web.truncated ?? null } : null,
    votes: (wald?.votes || []).map((v) => ({ witness: v.witness, pull: v.pull, vote: v.vote })),   // never the why
    gaps: d ? d.gaps.length : 0,
    webTaken: typeof wald?.webTaken === "boolean" ? wald.webTaken : null,
    turnMs: Number.isFinite(wald?.turnMs) ? wald.turnMs : null,
    decideMs: Number.isFinite(wald?.decideMs) ? +wald.decideMs.toFixed(3) : null,
    passagesKept: Number.isFinite(wald?.passagesKept) ? wald.passagesKept : null,
    used: usedBy === "cited" || usedBy === "sources",
    usedBy: usedBy === "cited" || usedBy === "sources" ? usedBy : null,
    droppedBefore: Number.isInteger(droppedBefore) && droppedBefore > 0 ? droppedBefore : 0,   // writes lost to a full/blocked store since the last entry that landed
    next: null,
  };
}

/** The person's next act, as the planner already read it. */
export function nextActOf(follow) {
  if (!follow) return "moveOn";
  if (follow.kind === "retry") return "reask";
  if (follow.kind === "source-ask") return "sourceAsk";
  if (follow.act === "escalation") return "challenge";
  return "moveOn";
}

/** Close the session's last open entry with the next act. Never edits a closed entry; an unknown act is refused. */
export function closeLast(ledger, sid, next) {
  const list = Array.isArray(ledger) ? ledger : [];
  if (!NEXT.includes(next)) return list;
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    if (e?.sid !== String(sid)) continue;
    if (e.next !== null) return list;   // the session's last entry is already closed: nothing open
    const out = list.slice();
    out[i] = { ...e, next };
    return out;
  }
  return list;
}

export function appendEntry(ledger, entry, { cap = LEDGER_CAP } = {}) {
  const list = Array.isArray(ledger) ? ledger : [];
  const out = [...list, entry];
  return out.length > cap ? out.slice(out.length - cap) : out;
}

export default { LEDGER_SCHEMA, LEDGER_KEY, LEDGER_CAP, ledgerEntry, nextActOf, closeLast, appendEntry };
