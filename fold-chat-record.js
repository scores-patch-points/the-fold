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

/** THE MOUTH IS NEVER A WITNESS (nesting audit F, open item 3.5). The repo's own law: a layer's product does not witness itself, and the reader is
 *  never a witness of record. A turn the MODEL wrote is the mouth's output; letting "earlier in this chat · turn N" cite it meant a later draft that
 *  repeated an earlier false paragraph was "supported" by the model's own earlier turn (measured: 12-turn fabricate arm, turns 6-10). So this is the
 *  one place that decides whose turn it is. A turn the person wrote, or one the app authored from a page (a sources / slot turn, a clarifying
 *  question, the watcher's reply, any turn the model was barred from), may witness; the model's turn has no witness address. No record of who wrote
 *  it is read as the model's (never assumed to be the app's). Pure, mechanical, no list of words. */
export const MODEL_NOT_WITNESS = "model-authored-not-a-witness";
export function modelAuthored(m) {
  if (!m || m.role !== "assistant") return false;
  if (m.authored === "sources") return false;                      // the page's own words, verbatim (strand / slot turn)
  if (m.followup) return false;                                     // the clarifying question is the app's
  if (m.watch && m.watch.appAnswered) return false;                 // the watcher's own reply (no model)
  const r = m.grounding && m.grounding.modelRule;
  if (r && r.allowed === false) return false;                       // the model was barred on this turn: the app wrote it
  return true;
}

/** The earlier exchanges split by who may witness, one entry per answered turn, the last `last` of them. `items`: `{ ref, source, text, turn }` the
 *  material (the same shape as before). A turn the model wrote contributes only the PERSON's words (`You asked: ...`, at its own `· you` address);
 *  its "I answered" half is not material and is listed in `notWitness` (`{ turn, ref, text, reason }`) so the loss is typed and countable, never
 *  silent. `prior` is the messages before this ask. `turn` counts the answered (non-agent, non-empty) assistant messages, the same index
 *  referencedThread (fold-chat-thread.js) and `source: "turn N"` use. Pure. */
export function conversationWitness(prior, { last = 4 } = {}) {
  const pairs = [];
  let ask = null, n = 0;
  for (const m of Array.isArray(prior) ? prior : []) {
    if (m?.role === "user" && String(m.content || "").trim()) ask = String(m.content).replace(/\s+/g, " ").trim();
    else if (m?.role === "assistant" && String(m.content || "").trim() && m.mode !== "agent") { n++; pairs.push({ turn: n, ask, text: String(m.content).replace(/\s+/g, " ").trim().slice(0, 3000), model: modelAuthored(m) }); }
  }
  const items = [], notWitness = [];
  for (const p of pairs.slice(-last)) {
    if (!p.model) { items.push({ ref: convoRefOf(p.turn), source: "turn " + p.turn, turn: p.turn, text: (p.ask ? "You asked: " + p.ask + "\n" : "") + "I answered: " + p.text }); continue; }
    if (p.ask) items.push({ ref: convoRefOf(p.turn, "you"), source: "turn " + p.turn, turn: p.turn, text: "You asked: " + p.ask });
    notWitness.push({ turn: p.turn, ref: convoRefOf(p.turn), text: p.text, reason: MODEL_NOT_WITNESS });
  }
  return { items, notWitness };
}

/** The earlier exchanges that may witness, as material items: `conversationWitness(prior).items`. Pure. */
export function conversationMaterial(prior, opts) { return conversationWitness(prior, opts).items; }

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

/** THE MECHANICAL TURN'S UNITS (nesting audit F, D2). A slot answer and a sources strand carry no model text, so the Pivot has no spoken units and
 *  `turnRecord("")` has no sources: both used to end with 0 claims, and recall/freshness read an empty store. What such a turn SHOWED is still
 *  addressed: the slot answer's `row.span` into its source page, a strand snip's `range` into its page. This resolves each to the chat's own passage
 *  (by url, then by the pipeline's `S<n>` index into the read passages) and returns `[{ text, address, kind }]`, `address` = `<chat ref>#<from>-<to>`, the
 *  same shape and namespace as a model turn's record.sources (so citedAt and freshness read it unchanged). A gap, a contest, a handoff, a snip with no
 *  range (a card, a recipe) or a span that does not fit its page is no unit: nothing is invented. `line` is the line the turn showed (the realised slot
 *  answer); without it the source sentence is the text. Pure. */
export function mechanicalUnits({ slotTurn = null, strand = null, webPassages = [], line = "" } = {}) {
  const pages = Array.isArray(webPassages) ? webPassages : [];
  const urlOf = (p) => String((p && (p.url || p.source)) || "");
  const fits = (p, a, b) => p && typeof p.text === "string" && p.ref && Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b > a && b <= p.text.length;
  const out = [];
  // a COMPOUND turn ("who is X and where was he born") answers each part from its own row; its joined `answer.text` is not one sentence of one page
  const rows = Array.isArray(slotTurn?.parts) && slotTurn.parts.length
    ? slotTurn.parts.filter((x) => x && x.answer && x.answer.row).map((x) => ({ row: x.answer.row, text: String(x.answer.text || "").trim() }))
    : slotTurn?.answer?.row ? [{ row: slotTurn.answer.row, text: String(line || "").trim() }] : [];
  for (const { row, text: shown } of rows) {
    if (!Array.isArray(row.span) || !row.source) continue;
    const [a, b] = row.span;
    const byUrl = row.source.url ? pages.filter((p) => urlOf(p) === String(row.source.url)) : [];
    const k = /^S(\d+)$/.exec(String(row.source.ref || ""));
    const page = byUrl.find((p) => fits(p, a, b)) || (k ? [pages[Number(k[1]) - 1]].find((p) => fits(p, a, b)) : null);
    const text = shown || String(row.sentence || "").trim();
    if (page && text) out.push({ text, address: `${page.ref}#${a}-${b}`, kind: "slot" });
  }
  for (const sn of Array.isArray(strand?.snips) ? strand.snips : []) {
    const r = sn && sn.range;
    if (!r || !sn.source || !String(sn.text || "").trim()) continue;
    const page = pages.find((p) => urlOf(p) === String(sn.source) && fits(p, r.start, r.end));
    if (page) out.push({ text: String(sn.text).trim(), address: `${page.ref}#${r.start}-${r.end}`, kind: "strand" });
  }
  return out;
}

/** The claims one finished turn makes, in order.
 *  Spoken sentences (the Pivot's kept sentence/code units) are what the fold SAID, verbatim; when it spoke none, the sources it showed are claims it SHOWED.
 *  A MECHANICAL turn (`mechanical` from mechanicalUnits: a slot answer, a strand) has no model words at all, so its units are the claims it SHOWED, at
 *  the address of the span it carried; they take the place of the pivot's, which read a draft that was not spoken.
 *  `basis.cited` = the source's bytes at `support` from `material` (see citedAt); `basis.support` is the address the claim stands on. */
export function claimsOfTurn({ turn, pivot = null, record = null, material = [], mechanical = [] } = {}) {
  const out = [];
  const add = (rel, text, basis) => { const c = claimAt(turn, out.length + 1, rel, text, basis); if (c) out.push(c); };
  const withCited = (support) => { const cited = citedAt(support, material); return { support: String(support), source: holonOfSource(support), ...(cited != null ? { cited } : {}) }; };
  const mech = (Array.isArray(mechanical) ? mechanical : []).filter((u) => u && u.address && String(u.text || "").trim());
  if (mech.length) {
    for (const u of mech) add("showed", u.text, { turn, kind: u.kind || "source", ...withCited(u.address) });
    return out;
  }
  const units = (pivot?.units || []).filter((u) => u && (u.kind === "sentence" || u.kind === "code"));
  if (units.length) {
    for (const u of units) add("said", u.text, { turn, kind: u.kind, ...(u.support ? withCited(u.support) : {}) });
  } else {
    for (const r of record?.sources || []) if (r?.address) add("showed", r.text, { turn, kind: "source", ...withCited(r.address) });
  }
  return out;
}
