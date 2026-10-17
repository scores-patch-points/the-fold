// fold-chat-carry.js — the conversation's carry, COMPUTED from the record (THE-HOLOGRAPH §6 "the mechanical summary").
//
// What rides to the model from earlier turns used to be a hand-rolled projection: a topic that was the first clause of the first
// question, entities that were capitalised runs (an English-only scan — Han, Arabic, Hebrew, Devanagari read as "no entities"), and
// a flow that was a turn count. This module replaces those with the khora's own readings of the transcript, no model anywhere:
//
//   ATMOSPHERE   where the conversation stands: the ground it holds, where it last turned, what it has cited, whether the last
//                exchange moved anything (khora/native/the-fold/resolutions.js::atmosphereBlock, vendored).
//   LENS         what the checked turns say about the referents in play (lensBlock over the session's warrant records).
//
// Identity is the chat's referent record's (fold-chat-mind.js), not a string: a question and an old answer that name the same
// being resolve to one id, in any script. The index below is the thin adapter the khora blocks need (`resolve`, `resolveIn`,
// `represent`); nothing is read from capital letters.
//
// The wording is the khora's own template and the text is struck of addresses (firewall.js) — the mouth never sees one. The
// cut is the khora's DECLARED one: `dmdWindow` (kernel/activation.js) is not vendored into the page, so each block says
// "declared: no measurement organ injected" in its basis, which `carryOf` carries through and never hides.
//
// Pure: no DOM, no IO, no model. Recomputed from the messages every turn, never from its own earlier output, so it cannot drift.
import { atmosphereBlock, lensBlock, activeReferents } from "./vendor/khora/native/the-fold/resolutions.js";
import { fold, mentions } from "./fold-chat-mind.js";
import { foldNote } from "./vendor/penelope/fold-note.mjs";

/** The index the khora blocks resolve through, built from the chat's referent record (`s.referents`). Ids are the folded surface. */
export function indexOfReferents(record) {
  const ents = (record?.entities || []).filter((e) => e && e.surface);
  const idOf = (e) => fold(e.surface);
  const formsOf = (e) => [e.surface, ...(e.forms || [])];
  const byId = new Map(ents.map((e) => [idOf(e), e]));
  const resolveIn = (text) => new Set(ents.filter((e) => formsOf(e).some((f) => mentions(text, f))).map(idOf));
  const resolve = (name) => {
    const n = fold(name).trim();
    if (!n) return new Set();
    return new Set(ents.filter((e) => formsOf(e).some((f) => fold(f).trim() === n)).map(idOf));
  };
  const represent = (id) => byId.get(id)?.surface ?? id;
  return { resolve, resolveIn, represent, events: [] };
}

/** The transcript the blocks read: each answered ask as one exchange. Attachments, system notes and "Continue." are not exchanges. */
export function transcriptOf(messages) {
  const out = [];
  let ask = null;
  for (const m of messages || []) {
    if (m?.role === "user") ask = m.attachment || /^continue\.?$/i.test(String(m.content || "").trim()) ? null : m;
    else if (m?.role === "assistant" && ask && String(m.content || "").trim()) {
      const refs = [...(m.grounding?.sources || []), ...(m.grounding?.showed || [])].map((r) => r?.address).filter(Boolean);   // what a model turn cited, and what a mechanical turn showed (fold-chat-record.js mechanicalUnits)
      out.push({ turn: out.length + 1, question: String(ask.content || ""), answer: String(m.content), refs });
      ask = null;
    }
  }
  return out;
}

/** THE VOIDS THE CONVERSATION DREW (nesting audit F, D4): a slot turn that ended in a typed gap — nothing stated it (`unwitnessed`), nothing could
 *  be read (`unreached`), the holder is not current (`no_present_holder`) — is a void LOOKED FOR AND NOT FOUND, scoped to what was read. The lens
 *  (khora resolutions.js lensBlock `voids`) renders each as "looked for and not found so far: S — verb→ ? (looked for in N sources; an open gap, not
 *  a finding that it is false)". It was handed `voids: []`, so the turn's own gap never reached the next prompt. A refuted answer is a FINDING and a
 *  contest is two answers: neither is a void. A turn with no stored answer turn (a model turn) draws none. The subject is the frame's first
 *  referent as the title door resolved it; the verb is the ask's own predicate words, else the slot's name. Pure; recomputed from the messages. */
export const VOID_GAPS = Object.freeze(["unwitnessed", "unreached", "no_present_holder"]);
export function voidsOfMessages(messages) {
  const out = [];
  let turn = 0;
  for (const m of Array.isArray(messages) ? messages : []) {
    if (m?.role !== "assistant") continue;
    turn++;
    const at = m.answerTurn;
    if (!at || typeof at !== "object" || at.answer || (Array.isArray(at.contest) && at.contest.length)) continue;
    const kind = at.gap && at.gap.kind;
    if (!VOID_GAPS.includes(kind)) continue;
    const ref = (at.frame?.referents || []).find((r) => r && (r.title || r.surface));
    if (!ref) continue;
    const pred = (at.frame?.predicate || []).map((p) => p && (p.surface || p.stem)).filter(Boolean).join(" ");
    const sources = (Array.isArray(at.sources) ? at.sources : []).map((x) => x && (x.url || x.title)).filter(Boolean);
    out.push({ subject: String(ref.title || ref.surface), verb: pred || String(at.frame?.slot || at.slot || "answer"), scope: { sources }, kind, turn });
  }
  return out;
}

/**
 * carryOf(session) → { text, lines, entities, basis, active } — `text` is struck of addresses and is what the mouth may see;
 * `lines` keep their [turn:N] addresses for the record. Empty (text "") when nothing resolves to a referent yet; `basis` says why.
 */
export function carryOf(session, { question = null, level = 2 } = {}) {
  const index = indexOfReferents(session?.referents);
  const transcript = transcriptOf(session?.messages);
  if (!index.resolveIn || !(session?.referents?.entities || []).length) return { text: "", lines: [], entities: [], basis: "no referent established yet", active: [] };
  const q = question ?? transcript.at(-1)?.question ?? "";
  const active = activeReferents(q, transcript, index);
  const atmosphere = atmosphereBlock({ question: q, transcript, index });
  const lens = level >= 2
    // `notes` is NOT passed: this surface keeps no note ledger, and `notes: []` read as a fed-but-empty one. The voids are the gaps the
    // conversation's own slot turns drew (voidsOfMessages); the records carry the addresses mechanical turns showed (fold-chat-record.js).
    ? lensBlock({ question: q, active: active.ids, index, voids: voidsOfMessages(session?.messages), records: session?.summary?.records || [], transcript })
    : null;
  // THE PORTABLE FOLD (penelope/organs/fold-note.mjs): the SAME mechanical fold the opencode door carries — a
  // session's turns folded to their threads, bounded. The chat's own carry (atmosphere + lens) is the rich reading
  // against the referent record; this is the shared, record-free fold, so a surface with turns and no record folds
  // the same way. Additive: it never replaces the atmosphere/lens.
  const threads = foldNote(
    transcript.map((t) => ({ ask: t.question, answer: t.answer })),
    q,
    { budget: 600, threads: 4 },
  );
  const blocks = [atmosphere, lens].filter((b) => b && b.text);
  const entities = [...(session.referents.entities || [])].sort((a, b) => b.weight - a.weight).map((e) => e.surface);
  return {
    text: [blocks.map((b) => b.text).join("\n\n"), threads].filter(Boolean).join("\n\n"),
    lines: [...atmosphere.lines, ...(lens?.lines || [])],
    entities,
    basis: [atmosphere.basis, lens?.basis, lens ? "no-notes: this surface keeps no note ledger, so the lens reads none" : null].filter(Boolean).join(" · "),
    active: [...active.ids].map((id) => index.represent(id)),
  };
}

/**
 * Fold the carry into the running summary the prompt projects (`Flow:` / `Entities:`). Entities become the record's own names
 * (any script); flow becomes the Atmosphere's line(s) with their addresses struck. When nothing resolves the summary is left
 * exactly as it was — the older mechanical fields stand, so this can only add.
 */
export function applyCarry(summary, session, { maxEntities = 8 } = {}) {
  if (!summary) return summary;
  const c = carryOf({ ...session, summary });
  if (!c.text) return summary;
  const flow = c.text.split("\n").filter((l) => l.trim() && !/:$/.test(l.trim())).join(" ").replace(/\s+/g, " ").trim();
  return { ...summary, flow: flow || summary.flow, entities: c.entities.length ? c.entities.slice(0, maxEntities) : summary.entities, carry: { basis: c.basis, active: c.active, lines: c.lines } };
}
