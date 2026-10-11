// fold-chat-heal.js — the fold REPAIRS ITS OWN misreadings from past lessons.
//
// Until this, a misread was learned outside the fold: the harness rewrote the question before the
// fold saw it, so the fold itself never changed. Here the fold keeps its own append-only store of
// confirmed corrections and APPLIES them the next time it meets the same reading — it heals, not
// merely logs. Giver of a rule is named (`supervisor` from the wildchat loop, or `person` from a
// refusal), and a rule is only ever {"from"->"to"} — a reading the fold holds, never a model voice.
//
// Pure where possible: `healedCorrections`/`healQuestion` are pure over the array; the storage
// access is injected (localStorage in the browser, a double in tests).
export const HEAL_KEY = "hd:fold-healed";

const norm = (s) => String(s || "").normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The append-only store of healed readings: [{ schema, from, to, by, at }]. */
export function healedCorrections(storage) {
  try { const a = JSON.parse(storage.getItem(HEAL_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch { return []; }
}

/** Append one confirmed correction (never edits an old one). Returns the new list. */
export function addHealedRule(storage, { from, to, by = "supervisor" }) {
  const a = healedCorrections(storage);
  a.push({ schema: "HealedRule@1", from: String(from || ""), to: String(to || ""), by: String(by || "supervisor"), at: new Date().toISOString() });
  try { storage.setItem(HEAL_KEY, JSON.stringify(a)); } catch (e) {}
  return a;
}

/** Pure: the corrected question when a learned rule applies (longest match wins), else the original.
 *  { question, healed, from, to } — never guesses when nothing is learned. */
export function healQuestion(question, corrections) {
  const t = norm(question); if (!t) return { question, healed: false, from: null, to: null };
  let best = null, bestFrom = null;
  for (const c of corrections || []) {
    const f = norm(c.from);
    if (f && f.length >= 3 && t.includes(f) && (!best || f.length > bestFrom.length)) { best = c; bestFrom = f; }
  }
  if (!best) return { question, healed: false, from: null, to: null };
  const out = String(question).replace(new RegExp(esc(bestFrom), "gi"), best.to || "");
  if (norm(out) === t) return { question, healed: false, from: null, to: null };
  return { question: out, healed: true, from: bestFrom, to: best.to };
}

export default { healedCorrections, addHealedRule, healQuestion };