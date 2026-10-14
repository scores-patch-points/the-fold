// fold-chat-record.js — the chat's ADAPTER onto the khora's FoldRecord@1 (vendor/khora/native/the-fold/fold-record.js).
//
// The contract (claim at a holon address, append-only store, record pointer, bounded view, round trip) lives in the khora and is
// re-exported here unchanged. What is the chat's own is only the turn's UNITS: the Pivot's spoken sentences (or the sources the fold
// showed) become the claims. Nothing is rewritten — a claim's text is the unit's, its basis carries the source address that witnessed it.
import { claimAt, holonOfSource } from "./vendor/khora/native/the-fold/fold-record.js";

export { FOLD_RECORD_SCHEMA, turnAddress, holonOfSource, claimAt, pointerOf, appendClaims, claimsAt, projectRecord, spokenFrom } from "./vendor/khora/native/the-fold/fold-record.js";

/** THE CONVERSATION'S ADDRESS (nesting audit F, D1). The earlier exchanges ride into `material` (fold-chat.js, the gear: the GATE decides what is
 *  spoken), and every pair used to carry the SAME ref "earlier in this chat", so `ref#start-end` named no turn and citedAt took the first item with
 *  the ref: another turn's bytes. Each earlier turn is now its own address, `earlier in this chat · turn N#start-end`; the old words stay as the
 *  prefix, so the ref reads the same and a stored legacy address is still readable (see citedAt). `part` separates a second item for the SAME turn
 *  (the thread-grounded answer, the strand's own words) whose text differs, so two texts never answer to one address. */
export const CONVO_REF = "earlier in this chat";
export const convoRefOf = (turn, part = "") => `${CONVO_REF} \u00b7 turn ${Number(turn) || 0}${part ? ` \u00b7 ${part}` : ""}`;

/** The earlier exchanges as material items, one per answered turn, the last `last` of them: `{ ref, source, text, turn }`. `prior` is the messages
 *  before this ask. `turn` counts the answered (non-agent, non-empty) assistant messages, the same index referencedThread (fold-chat-thread.js) and
 *  `source: "turn N"` use. Pure. */
export function conversationMaterial(prior, { last = 4 } = {}) {
  const pairs = [];
  let ask = null, n = 0;
  for (const m of Array.isArray(prior) ? prior : []) {
    if (m?.role === "user" && String(m.content || "").trim()) ask = String(m.content).replace(/\s+/g, " ").trim();
    else if (m?.role === "assistant" && String(m.content || "").trim() && m.mode !== "agent") { n++; pairs.push({ turn: n, ask, text: String(m.content).replace(/\s+/g, " ").trim().slice(0, 3000) }); }
  }
  return pairs.slice(-last).map((p) => ({ ref: convoRefOf(p.turn), source: "turn " + p.turn, turn: p.turn, text: (p.ask ? "You asked: " + p.ask + "\n" : "") + "I answered: " + p.text }));
}

/** The source's own bytes at a support address `<ref>#<from>-<to>`: `material` is what the turn READ ([{ ref, text }], the same items the Pivot judged against), the
 *  span is a byte range of that item's text. Absent (null) when the ref is not in the material or the range does not fit — never guessed, never the spoken sentence
 *  (record.sources[].text is the SPOKEN sentence and its address is the matched PHRASE's span, so neither can stand in for the page's bytes: measured by the peer session, 43/43 differed).
 *  When more than one item answers to the ref and their bytes at the span DIFFER, the address is ambiguous and the answer is null, never the first. The legacy
 *  conversation ref (the bare CONVO_REF, written before each turn had its own address) is read as "any earlier-turn item": one turn present, its bytes; several, null. */
export function citedAt(support, material) {
  const sup = String(support ?? "");
  const at = sup.lastIndexOf("#");
  if (at < 1) return null;
  const m = sup.slice(at + 1).match(/^(\d+)-(\d+)$/);
  if (!m) return null;
  const ref = sup.slice(0, at), a = Number(m[1]), b = Number(m[2]);
  if (!(b > a)) return null;
  const items = (material || []).filter((x) => x && typeof x.text === "string");
  let hit = items.filter((x) => String(x.ref) === ref);
  if (!hit.length && ref === CONVO_REF) hit = items.filter((x) => String(x.ref).startsWith(CONVO_REF + " \u00b7 turn "));
  const bytes = [...new Set(hit.filter((x) => b <= x.text.length).map((x) => x.text.slice(a, b)))];
  return bytes.length === 1 ? bytes[0] : null;
}

/** The claims one finished turn makes, in order.
 *  Spoken sentences (the Pivot's kept sentence/code units) are what the fold SAID, verbatim; when it spoke none, the sources it showed are claims it SHOWED.
 *  `basis.cited` = the source's bytes at `support` from `material` (see citedAt); `basis.support` is the address the claim stands on. */
export function claimsOfTurn({ turn, pivot = null, record = null, material = [] } = {}) {
  const out = [];
  const add = (rel, text, basis) => { const c = claimAt(turn, out.length + 1, rel, text, basis); if (c) out.push(c); };
  const withCited = (support) => { const cited = citedAt(support, material); return { support: String(support), source: holonOfSource(support), ...(cited != null ? { cited } : {}) }; };
  const units = (pivot?.units || []).filter((u) => u && (u.kind === "sentence" || u.kind === "code"));
  if (units.length) {
    for (const u of units) add("said", u.text, { turn, kind: u.kind, ...(u.support ? withCited(u.support) : {}) });
  } else {
    for (const r of record?.sources || []) if (r?.address) add("showed", r.text, { turn, kind: "source", ...withCited(r.address) });
  }
  return out;
}
