// fold-chat-typing.js — SURVIVE TYPING: an additive second reading of what the person typed (never a rewrite of it).
//
// Operator (2026-10-13): "we need to survive typos and leetspeak and everything else." The omnilingual falsification measured that a single
// transposed letter or a leetspeak digit broke most answers in every language: the referent is resolved by an exact title and the ask's own
// words are matched against exact tables. This module proposes a READING of the ask, word by word, from the language's own received
// lexicon — never from a list of misspellings, never from a model:
//
//   a token that mixes letters and digits is decoded by the language's DECLARED leet table (GRAMMAR[lang].leet; "1" is i or l);
//   a token in NO lexicon of the language (its received POS prior, its function words, its declared table) is read as its UNIQUE one-edit
//   neighbour in that lexicon (one transposition, substitution, insertion or deletion); two or more neighbours → ambiguous → left as typed.
//   A token in `protect` (a name the title door already resolved) is never touched; a pure number is never touched.
//
// askFrame (fold-chat-frame.js) uses the reading only when it changed something and its own frame resolves; every change is disclosed
// as { typed, read }. Pure, no IO, no model.
import { tokensOf, grammarOf, caseless, closedClassOf } from "./fold-chat-frame.js";
import { inLexicon, alphabetOf } from "./fold-chat-salience-infer.js";

function tableWords(G) {
  const out = new Set();
  for (const [k, v] of Object.entries(G || {})) {
    if (k === "giver" || k === "leet") continue;
    if (k === "interrogatives") { for (const i of v) for (const w of i.words) out.add(w); continue; }
    if (Array.isArray(v)) for (const w of v) if (typeof w === "string") out.add(w);
    else if (v && typeof v === "object") for (const b of Object.values(v)) if (Array.isArray(b)) for (const w of b) if (typeof w === "string") out.add(w);
  }
  return out;
}

/** Is a folded form a word of the language: its function words, its table, or its received POS prior. */
function lexiconOf(lang, fw) {
  const G = grammarOf(lang);
  const tw = tableWords(G);
  const f = fw instanceof Set ? fw : new Set();
  const closed = closedClassOf(f, lang);            // the language's closed class as the binder reads it ("a-t-il": every part closed)
  return (w) => f.has(w) || tw.has(w) || closed(w) || inLexicon(w, lang);
}

/** Every form one edit away (Damerau: transposition, substitution, insertion, deletion), over the language's own alphabet. */
function edits1(w, alphabet) {
  const out = new Set();
  for (let i = 0; i < w.length; i++) out.add(w.slice(0, i) + w.slice(i + 1));
  for (let i = 0; i + 1 < w.length; i++) out.add(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2));
  for (let i = 0; i < w.length; i++) for (const c of alphabet) if (c !== w[i]) out.add(w.slice(0, i) + c + w.slice(i + 1));
  for (let i = 0; i <= w.length; i++) for (const c of alphabet) out.add(w.slice(0, i) + c + w.slice(i));
  out.delete(w);
  return out;
}

function leetVariants(w, leet) {
  let acc = [""];
  for (const ch of w) {
    const opts = leet && leet[ch] ? leet[ch] : [ch];
    acc = acc.flatMap((a) => opts.map((o) => a + o));
    if (acc.length > 16) acc = acc.slice(0, 16);
  }
  return acc;
}

/** A predicate: is this folded form in NO lexicon of the language (and not closed class)? The words a spelling suggestion may touch. */
export function outOfLexicon(lang, fw = null) { const inLex = lexiconOf(lang, fw); return (w) => !/^\p{N}+([.,]\p{N}+)*$/u.test(w) && !inLex(w); }

export const withCaseOf = (orig, read) => (/^\p{Lu}/u.test(orig) ? read.charAt(0).toLocaleUpperCase() + read.slice(1) : read);

/**
 * The reading of a typed text in `lang`: { text, changes: [{ typed, read, how: "leet"|"edit" }] }. `protect`: folded forms never to touch.
 * A language with no table, or no lexicon, reads as typed.
 */
export function readingOf(text, lang, { fw = null, protect = null } = {}) {
  const s = String(text ?? "");
  const G = grammarOf(lang);
  if (!G) return { text: s, changes: [] };
  const inLex = lexiconOf(lang, fw);
  const alphabet = alphabetOf(lang);
  const leet = G.leet || null;
  const changes = [];
  let out = "", at = 0;
  for (const t of tokensOf(s, lang)) {
    let read = null, how = null;
    const w = t.fold;
    const skip = /^\p{N}+([.,]\p{N}+)*$/u.test(w) || w.length < 3 || (protect && protect.has(w)) || inLex(w);
    if (!skip) {
      if (leet && /\p{L}/u.test(w) && /\p{N}/u.test(w)) {
        const vs = leetVariants(w, leet).filter((v) => !/\p{N}/u.test(v));
        const hit = vs.find((v) => inLex(v)) || vs[0] || null;
        if (hit) { read = hit; how = "leet"; }
      }
      const base = read || w;
      if (!inLex(base) && alphabet.length) {
        // a TRANSPOSITION is the one slip that keeps every letter typed ("wehre": "where", never "were"), so its neighbours are asked
        // first; only when no transposition is a word are the other one-edit neighbours asked. Unique, or left as typed.
        const swaps = [];
        for (let i = 0; i + 1 < base.length; i++) { const v = base.slice(0, i) + base[i + 1] + base[i] + base.slice(i + 2); if (v !== base && inLex(v) && !swaps.includes(v)) swaps.push(v); }
        const near = swaps.length ? swaps : [...edits1(base, alphabet)].filter((v) => inLex(v));
        if (near.length === 1) { read = near[0]; how = how ? how + "+edit" : "edit"; }
      }
    }
    if (read && read !== w) {
      out += s.slice(at, t.start) + withCaseOf(t.text, read);
      changes.push({ typed: t.text, read: withCaseOf(t.text, read), how });
    } else out += s.slice(at, t.end);
    at = t.end;
  }
  out += s.slice(at);
  return { text: out, changes };
}
export { caseless };
