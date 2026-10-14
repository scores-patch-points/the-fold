// fold-chat-lessons.js — the fold's NEXT-ROUND PROMPTING carries what it failed to learn.
//
// The supervisor (wildchat-supervised.mjs) proposes a MECHANICAL rule — { mechanism, promptRule } —
// when the fold misreads. Proposals append to the store (`hd:fold-lessons`); from then on EVERY model
// prompt carries them as a compact LESSONS block through Gary's door (basePrompt), so the local mouth
// behaves by the lesson before any deeper code fix. The log is kept so a person/agent can later turn
// the proposals into real code. Pure; storage injected (localStorage in the browser, a double in tests).
export const LESSONS_KEY = "hd:fold-lessons";

/** The accumulated proposals: [{ schema, id, at, mechanism, promptRule, round?, ask? }]. */
export function proposalsOf(storage) {
  try { const a = JSON.parse(storage.getItem(LESSONS_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}

/** Append one proposal (never edits an old one). */
export function addProposal(storage, p) {
  const a = proposalsOf(storage);
  a.push({ schema: "LessonProposal@1", id: "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: new Date().toISOString(), mechanism: String(p.mechanism || "general"), promptRule: String(p.promptRule || ""), ...(p.round != null ? { round: p.round } : {}), ...(p.ask ? { ask: String(p.ask).slice(0, 90) } : {}) });
  try { storage.setItem(LESSONS_KEY, JSON.stringify(a)); } catch (e) {}
  return a;
}

/** A compact LESSONS block for the model prompt: the last `maxLines` rules, capped. Empty when none. */
export function lessonsPrompt(proposals, { maxLines = 4, maxChars = 700 } = {}) {
  const rules = (Array.isArray(proposals) ? proposals : []).map((p) => p.promptRule).filter(Boolean);
  if (!rules.length) return "";
  const take = rules.slice(-maxLines).join(" ");
  return "Lessons the fold has learned from past rounds — the mouth obeys these, then answers from the sources: " + take;
}

/** The fold's own reading of the ask, for the mouth: "the fold reads this as about X" (or empty). */
export function readAsLine(murmur) {
  const about = murmur && murmur.interpretation;
  return about ? `The fold reads this question as being about ${about}.` : "";
}

export default { proposalsOf, addProposal, lessonsPrompt, readAsLine };