// fold-chat-present.js — what is left of the "present" panels: one helper the chat still uses outside them.
//
// The panels this module and fold-chat-presentview.js drew (the presented answer, the live reading panel, the replay
// tape, the nine-checks inspector) were removed on 2026-10-24: they cut sentences and found names with their own
// local rules, and reading belongs to canonical khora. The answer now draws as the facing page in fold-chat.js.
//
// salientSentences stays only because two non-panel paths in fold-chat.js still call it: the passages handed to the
// model in sourcesPrompt, and the lattice's L1 sentences (fold-chat-lattice.test.mjs reads that call). It is itself a
// LOCAL RULE (a regex sentence cut, a fixed function-word set, a boilerplate word list), not khora; it should be
// replaced by khora's reader, not extended.

// ───────── salience: which sentences of a passage are worth reading closely ─────────
const BOILER = /\b(?:our|we|us|you|your|subscribe|newsletter|channel|click|cookies?|sign up|log ?in|follow us|read more|share this|advertis\w*|sponsored|copyright|all rights)\b/i;
const FUNCW = new Set("the a an and or but of in to with by for on at from as is are was were be been being has have had it its this that these those which who what when where why how than then so also there their they he she we you i".split(" "));
/** The n sentences of `text` that carry the most about `query`: words shared with the query count most, then names and
 *  figures, then content density; site boilerplate ("on our channel", "subscribe") and fragments score down. */
export function salientSentences(text, query, n = 3) {
  const q = new Set((String(query).toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []).filter((w) => !FUNCW.has(w)));
  const sents = String(text || "").replace(/\s+/g, " ").split(/(?<=[.!?])\s+(?=[\p{Lu}\d"“(])/u).map((s) => s.trim()).filter((s) => s.length >= 30 && s.length <= 360);
  const scored = sents.map((s, i) => {
    const words = s.match(/[\p{L}\p{N}]+/gu) || [];
    const content = words.filter((w) => w.length > 3 && !FUNCW.has(w.toLowerCase()));
    const hits = new Set(content.map((w) => w.toLowerCase()).filter((w) => q.has(w))).size;
    const names = words.slice(1).filter((w) => /^\p{Lu}/u.test(w)).length;
    const figs = (s.match(/\d/g) || []).length ? 1 : 0;
    const density = words.length ? content.length / words.length : 0;
    const score = hits * 4 + Math.min(3, names) * 0.6 + figs * 0.8 + density * 2 - (BOILER.test(s) ? 4 : 0) - (words.length < 7 ? 2 : 0);
    return { s, i, score };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, n).sort((a, b) => a.i - b.i).map((x) => x.s);
}
