// fold-chat-split.js — A COMPOUND ONE SHOT (2026-10-11).
//
// "Who is the US president and where was he born?" is ONE question with TWO
// slots. The one shot (AnswerTurn@1) answers one slot; this module splits the
// compound mechanically, resolves each part with the SAME one shot (the wire:
// runSlotTurn), binds later parts to earlier parts by their REAL REFERENTS
// (the frame's resolveTitles-backed entities ride every receipt; a person
// pronoun binds the earlier part's FILLER, a property anaphor its REFERENT
// title), and composes the parts into ONE modelless answer.
//
//   splitSlotParts(question, { lang }) → [{ index, ask, dependsOn, nonSlot }]
//   runSlotParts({ parts, lang, ... }) → composed AnswerTurn@1 (parts receipts)
//   partsLine(parts)         → the deterministic joined content
//   partsContentAllowed(msg) → the stored-parts invariant (per-line backing)
//
// OMNILINGUAL posture (the fold's own law — declared tables or honest gaps,
// NO case logic): the connectors and anaphors are per-language DECLARED sets
// (SPLIT_LANG, like GRAMMAR's table; giver: the author's reading, 2026-10-11).
// A language with no table is NOT split — the single one shot runs, and a part
// its own grammar cannot read is the pipeline's own typed gap, never a guess.
// Every membership check is SET membership over tokens — no regex state, no
// English case rule.
//
// FAILURE END STATES are still modelless: a part that cannot bind is a typed
// gap (dependent_unbound); a contested part makes the whole turn contested
// (both sides stay); a non-slot part is a typed gap named in the join. NO
// MODEL: every outbound call is the one shot's own, over the one injected
// fetch. Declared, not measured (Constitution II.11).

import { runSlotTurn } from "./fold-chat-answerwire.js";

export const SPLIT = Object.freeze({
  giver: "the author, 2026-10-11; declared, not measured (II.11)",
  maxParts: 4,               // a question split beyond this is not worth the machinery
});

/** Per-language declared tables — connectors that open a second clause and the
 *  anaphor classes of that language. The wh-words of the SECOND clause are
 *  language-neutral patterns; a language with no table is not split. */
const LANG = (connect, person, poss, prop, glued = []) => Object.freeze({ connect, person, poss, prop, glued });
const SPLIT_LANG = Object.freeze({
  en: LANG(["and", "also", "then"], ["he", "him", "she", "they", "them"], ["his", "her", "their"], ["it", "its", "this", "that"]),
  es: LANG(["y", "además", "luego", "después"], ["él", "ella", "ellos", "ellas", "le", "les", "él"], ["su", "sus"], ["esto", "eso", "aquello", "lo"]),
  fr: LANG(["et", "puis", "aussi"], ["il", "lui", "elle", "eux", "elles"], ["son", "sa", "ses", "leur", "leurs"], ["cela", "ça", "ceci", "ce", "cette", "elles"], ["il", "elle", "ils", "elles", "t-il", "t-elle", "t-on"]),
  de: LANG(["und", "auch", "dann"], ["er", "ihn", "ihm", "sie"], ["sein", "seine", "seinem", "ihr", "ihre", "ihrem"], ["es", "dies", "das", "dieses"]),
  ru: LANG(["и", "также", "затем"], ["он", "его", "ему", "она", "её", "ей", "они", "их", "им"], ["его", "её", "их"], ["это", "этот", "эта", "оно"]),
});

const WH_SECOND = /(?:^|[^\p{L}\p{N}])(?:who|what|where|when|which|whose|why|how|кто|что|где|когда|который|куда|почему|как|quien|qué|dónde|cuándo|cuál|por qué|cómo|qui|que|quoi|où|quand|quel|pourquoi|comment|wer|was|wo|wann|welcher|warum|wie)(?=$|[^\p{L}\p{N}])/i;

const OWN_STOP = new Set(["the", "a", "an", "of", "in", "at", "on", "for", "and", "or", "but", "to", "is", "are", "am", "was", "were", "be", "been", "has", "have", "had", "born", "died", "located", "lives", "lived", "married", "capital", "president", "king", "queen", "kingdom", "prime", "minister", "wife", "husband", "party", "city", "country", "name", "who", "what", "where", "when", "which", "whose", "why", "how"]);

/** Split a compound slot ask into parts. Returns null when the question is not
 *  compound or the language has no declared table — the single one shot runs
 *  exactly as before. PURE (SET membership; the join regex is state-reset). */
export function splitSlotParts(question, { lang = "en" } = {}) {
  const q = String(question ?? "").trim();
  const code = lang && typeof lang === "object" ? lang.code : lang;
  const T = SPLIT_LANG[code || "en"];
  if (!q || !T) return null;
  // each standalone connector followed by a second wh-clause opens a new part.
  // Unicode-aware boundaries (a trailing \b is ASCII-word: it fails on "où",
  // "и", every accented and Cyrillic word) — the fold's own omnilingual rule.
  const re = new RegExp("(?:^|[^\\p{L}\\p{N}])(?:" + T.connect.join("|") + ")(?=$|[^\\p{L}\\p{N}])", "giu");
  re.lastIndex = 0;
  const starts = [];
  let m;
  while ((m = re.exec(q))) {
    const after = q.slice(re.lastIndex);
    const nxt = after.match(/^\s*(\S+)/);
    if (nxt && WH_SECOND.test(nxt[1])) starts.push(re.lastIndex + (after.match(/^\s*/)[0].length));
  }
  if (!starts.length) return null;
  const bounds = [0, ...starts, q.length];
  const clauses = [];
  const tailConn = new RegExp("\\s*(?:^|[^\\p{L}\\p{N}])(?:" + T.connect.join("|") + ")(?=$|[^\\p{L}\\p{N}])\\s*$", "iu");
  for (let i = 0; i < bounds.length - 1; i++) {
    const raw = q.slice(bounds[i], bounds[i + 1]).replace(tailConn, "").replace(/(?:^[\s;,]+|[\s;,]+$)/g, "").replace(/[?!¿¡]+$/u, "").trim();
    if (raw) clauses.push(raw);
  }
  if (clauses.length < 2 || clauses.length > SPLIT.maxParts) return null;
  const parts = clauses.map((ask, i) => {
    const orig = ask.trim().split(/\s+/);
    const words = orig.map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, ""));
    // a name of its own (after the clause-initial wh-word) means the clause
    // frames itself: "where was Donald Trump born" never binds an earlier part.
    // Declared OWN_STOP + the table's own anaphors/connectors NEVER signal a
    // name — so the all-caps "WHERE WAS HE BORN?" binds, and "DONALD TRUMP"
    // still does not: a name is a word no declared set covers.
    const stop = new Set([...OWN_STOP, ...T.person, ...T.poss, ...T.prop, ...T.connect]);
    const hasOwn = orig.slice(1).some((w) => /^[A-ZÀ-Þ]/.test(w) && w.length > 1 && !stop.has(w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "")));
    const person = words.some((w) => T.person.includes(w))
      || (T.glued?.length && orig.some((w) => T.glued.some((g) => w.toLowerCase().endsWith("-" + g))));   // French inversion: "est-il" gluesthe pronoun
    const ken = words.some((w) => T.poss.includes(w) || T.prop.includes(w));
    const nonSlot = /^(?:why|how|почему|как|por qué|cómo|pourquoi|comment|warum|wie)\b/i.test(ask);
    return { index: i, ask, nonSlot, dependsOn: i > 0 && !nonSlot && (person || ken) && !hasOwn ? i - 1 : null };
  });
  return parts;
}

/** Bind the anaphors of a depends-on part — SUBSTITUTION with the earlier
 *  part's own realised words, never invention: a PERSON possessive/pronoun
 *  binds the FILLER (a real page title the earlier part realised); a PROPERTY
 *  anaphor binds the earlier part's real REFERENT (the frame's resolved
 *  title), falling back to the ask's topic. */
export function bindPartAsk(part, { filler = "", referent = "", topic = "" } = {}, lang = "en") {
  let out = String(part.ask ?? "");
  if (part.dependsOn == null) return out;
  const T = SPLIT_LANG[lang] || SPLIT_LANG.en;
  const f = String(filler ?? "").trim();
  const r = String(referent ?? "").trim();
  const tp = String(topic ?? "").trim();
  const outToks = out.split(/\s+/);
  const mapped = outToks.map((w) => {
    const clean = w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
    const tail = w.slice(clean.length);   // "it?" — the ? is part of the token; it stays after the bind
    if (T.poss.includes(clean)) return (f ? f + "'s" : r ? r + "'s" : w) + tail;
    if (T.person.includes(clean)) return (f || w) + tail;
    if (T.prop.includes(clean)) return (r || tp || w) + tail;
    return w;
  });
  return mapped.join(" ").replace(/\s{2,}/g, " ").trim();
}

/** BIND A FOLLOW-UP'S PRONOUN to the referent the thread already resolved (nesting audit B, D6). `planTurn` binds "he" in "Where was he born?" to
 *  "Emmanuel Macron" (the carry notice says so) and searches with it, but the slot pipeline was handed the person's raw words, so its own title door
 *  read "born" as a page ("Charles III") and answered about that. The same SUBSTITUTION the compound parts use (bindPartAsk): the pronoun's own
 *  token is replaced by the carried referent's surface, nothing else is touched, and the person's words stay what they said (`said`, kept by the
 *  caller; `ask` here is only what the pipeline is asked).
 *  Binds only when it is determined: the thread carried exactly ONE referent through a pronoun, the language has a declared anaphor table, and the
 *  ask holds a token of that table. A person-class token binds the referent as a person ("he" -> "Emmanuel Macron", "his" -> "Emmanuel Macron's");
 *  a thing-class token binds it as a thing ("it" -> "the Eiffel Tower" is the surface as the record holds it). Otherwise the ask is returned unchanged
 *  and `bound` is false: today's path, exactly.
 *  -> { ask, bound, surface, via: "person" | "thing" | null } */
export function bindFollowUp(question, { surface = "", lang = "en" } = {}) {
  const ask = String(question ?? "");
  const code = lang && typeof lang === "object" ? lang.code : lang;
  const T = SPLIT_LANG[code || "en"];
  const s = String(surface ?? "").trim();
  const none = { ask, bound: false, surface: null, via: null };
  if (!T || !s || !ask.trim()) return none;
  const toks = ask.split(/\s+/).map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, ""));
  const personal = toks.some((t) => T.person.includes(t) || T.poss.includes(t));
  const thing = !personal && toks.some((t) => T.prop.includes(t));
  if (!personal && !thing) return none;
  const out = bindPartAsk({ ask, dependsOn: 0 }, personal ? { filler: s } : { referent: s }, code || "en");
  return out !== ask ? { ask: out, bound: true, surface: s, via: personal ? "person" : "thing" } : none;
}

/** What the slot pipeline is asked on a follow-up: the planned turn (`follow`, fold-chat-flow.js planTurn) and the person's words -> `{ ask, bound, ... }`.
 *  Bound only when the thread carried exactly ONE referent through a PRONOUN (the gate said so) — see bindFollowUp. Pure; run() and the tests read it. */
export function slotAskFor(follow, question, lang = "en") {
  const ok = follow && follow.kind === "carried" && follow.gate && follow.gate.kind === "pronoun" && Array.isArray(follow.carried) && follow.carried.length === 1;
  return ok ? bindFollowUp(question, { surface: follow.carried[0], lang }) : { ask: String(question ?? ""), bound: false, surface: null, via: null };
}

/** The earlier ask's TOPIC: its content tail, mechanically cut (declared;
 *  fallback only — the real referent above is preferred). */
export function topicOfAsk(ask) {
  const t = String(ask ?? "").trim().replace(/[?!]+$/u, "");
  const m = t.match(/\b(?:who|what|where|when|which|whose|why|how)(?:\s+(?:many|much|old|long|tall|far|often))?\s+(?:is|are|am|was|were|be|been)\s+(?:the|a|an|that|this)\s+/i);
  return m ? t.slice(m.index + m[0].length) : t.replace(/^(?:who|what|where|when|which|whose|why|how)\b\s*/i, "");
}

/** Run the parts, each through the one shot, in dependency order, and compose
 *  the receipts. A part that binds an earlier part's referent runs after it.
 *  → AnswerTurn@1-shaped: { schema, parts, answer?, gap?, contests? } */
export async function runSlotParts({ parts, lang, webPassages, searchQ = null, now = new Date(), fetchImpl, signal = null, memo = null, onStatus = null, timeBoxMs = null } = {}) {
  if (!Array.isArray(parts) || parts.length < 2) return { handoff: { kind: "not_compound", why: "fewer than two parts" } };
  const exec = [...parts].sort((a, b) => (a.dependsOn ?? -1) - (b.dependsOn ?? -1) || a.index - b.index);
  const resolved = new Map();
  const receipts = [];
  for (const part of exec) {
    if (signal?.aborted) return { aborted: true, answer: null, contest: [], gap: null, trace: [] };
    let result = null;
    let bound = part.ask;
    if (part.dependsOn != null) {
      const prior = resolved.get(part.dependsOn);
      if (prior?.answer) {
        const refs = prior.frame?.referents || [];
        const referent = refs[0]?.aliases?.[0] || refs[0]?.title || null;
        bound = bindPartAsk(part, { filler: prior.answer.filler?.text || "", referent, topic: topicOfAsk(parts[part.dependsOn].ask) }, typeof lang === "object" ? lang.code : lang);
      } else if (prior?.gap && prior.gap.kind === "part_handoff") {
        // the prior part never engaged the world: this part hands off WITH it (the wire's
        // contract stays transitive, so an all-handoff compound can leave the usual path)
        result = { gap: { kind: "part_handoff", english: `\u201c${part.ask}\u201d handed off with the earlier part (\u201c${parts[part.dependsOn].ask}\u201d)` } };
      } else { result = { gap: { kind: "dependent_unbound", english: `the earlier part \u201c${parts[part.dependsOn].ask}\u201d did not answer, so \u201c${part.ask}\u201d has nothing to bind` } }; }
    }
    if (!result && part.nonSlot) {
      result = { gap: { kind: "non_slot_part", english: `\u201c${part.ask}\u201d is not a one-fact slot — the fold does not guess; it is marked here` } };
    }
    if (!result) {
      if (typeof onStatus === "function") { try { onStatus(`part ${part.index + 1}/${parts.length} \u00b7 ${part.ask}`); } catch {} }
      const r = await runSlotTurn({ question: bound, lang, webPassages, searchQ: bound, now, fetchImpl, signal, memo: memo ? { ...memo } : null, ...(timeBoxMs ? { timeBoxMs } : {}) });
      if (r.aborted || signal?.aborted) return { aborted: true, answer: null, contest: [], gap: null, trace: [] };
      if (r.answer) result = { answer: { text: r.answer.text, filler: r.answer.filler || null, row: r.answer.row || null, standing: r.answer.standing || "survived" }, frame: r.frame || null, searched: r.searched || [] };
      else if (r.contest?.length) result = { contest: r.contest, frame: r.frame || null, searched: r.searched || [] };
      else if (r.gap) result = { gap: r.gap, frame: r.frame || null, searched: r.searched || [] };
      else if (r.handoff) result = { gap: { kind: "part_handoff", english: `\u201c${part.ask}\u201d handed off (${r.handoff.why || r.handoff.kind})` }, searched: r.searched || [] };
      else result = { gap: { kind: "part_no_result", english: `\u201c${part.ask}\u201d produced nothing` } };
    }
    const receipt = { index: part.index, ask: part.ask, dependsOn: part.dependsOn, ...(bound !== part.ask ? { boundAsk: bound } : {}), ...result };
    resolved.set(part.index, receipt);
    receipts.push(receipt);
  }
  receipts.sort((a, b) => a.index - b.index);
  // THE WIRE'S CONTRACT, kept for compounds: if NO part of the question reached a real end state —
  // every part handed off — the whole ask hands off too and the USUAL path runs (exactly as a single
  // non-slot ask does). One part ending mechanically ends the turn; all parts handing off never traps it.
  if (receipts.length && receipts.every((r) => r.gap && r.gap.kind === "part_handoff")) {
    return { handoff: { kind: "compound_handoff", why: "no part of this question is a one-fact slot the fold can settle \u2014 the usual path runs" } };
  }
  const answered = receipts.filter((r) => r.answer);
  const contests = receipts.filter((r) => r.contest);
  const gaps = receipts.filter((r) => r.gap);
  const standing = contests.length ? "contested" : answered.length === receipts.length ? "answered" : "partial";
  const text = partsLine(receipts);
  const gapsList = gaps.map((g) => ({ at: g.ask, kind: g.gap.kind, english: g.gap.english || String(g.gap.kind || "") }));
  return {
    schema: "AnswerTurn@1",
    parts: receipts,
    ...(answered.length ? { answer: { text, row: answered[0].answer.row, filler: answered[0].answer.filler, standing: contests.length ? "contested" : "survived" } } : {}),
    ...(gapsList.length ? { gap: { kind: contests.length ? "contest" : "partial", english: `one fact is missing: ` + gapsList.map((g) => g.english).join(" \u00b7 ") } } : {}),
    ...(contests.length ? { contest: contests.flatMap((c) => c.contest) } : {}),
    searched: [...new Set(receipts.flatMap((r) => r.searched || []))],
    trace: receipts.map((r) => r.answer
      ? { say: `part \u201c${r.ask}\u201d answered from its own source sentence` }
      : r.contest ? { say: `part \u201c${r.ask}\u201d's sources disagree \u2014 both are on the record` }
      : { say: `part \u201c${r.ask}\u201d is a gap (${r.gap.kind}) \u2014 drawn, not said` }),
  };
}

/** The deterministic joined content: each answered part's realised line, in the
 *  QUESTION's order, blank-line separated. A gap/contest part contributes no
 *  line (drawn, never said). This is what message.content must equal. */
export function partsLine(receipts) {
  return (Array.isArray(receipts) ? receipts : []).filter((r) => r && r.answer && String(r.answer.text || "").trim())
    .map((r) => String(r.answer.text).replace(/\s+/g, " ").trim()).join("\n\n");
}

const wordsOf = (t) => (String(t ?? "").match(/[\p{L}\p{N}]+/gu) || []);
const norm = (t) => String(t ?? "").replace(/\s+/g, " ").trim();

/** THE STORED-PARTS INVARIANT (folds contentAllowed for a parts turn): the
 *  message's content IS the deterministic join, and EVERY line of it is the
 *  words of ITS OWN part's source sentence — a line no part's own row carries
 *  is refused, exactly as a single slot's off-sentence words are. */
export function partsContentAllowed(answerTurn, content) {
  const parts = answerTurn?.parts;
  if (!Array.isArray(parts) || !parts.length) return false;
  const join = norm(partsLine(parts));
  if (!join || norm(content) !== join) return false;
  return parts.every((p) => {
    if (!p?.answer?.text) return true;                       // a gap/contest part contributes no line
    const row = p.answer.row;
    if (!row || typeof row.sentence !== "string" || !row.sentence.trim() || !(row.source?.url || row.source?.title)) return false;
    const held = new Set(wordsOf(row.sentence));
    return wordsOf(p.answer.text).every((w) => held.has(w));
  });
}