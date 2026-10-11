// fold-chat-salience-infer.js — SALIENCE, inferred from a real prior (not declared).
//
// The fold used to decide what an ask is "about" with hand-typed lists: FRAME in fold-chat-salience.js
// (how/why/when/who/…) and a bare content word otherwise. Those lists are a stopgap (Constitution II.11).
// This module reads the ask's own words against a REAL prior — the POSPrior@1 of the UD English treebank,
// compiled to fold-chat-salience-prior.js — so "what names something" is a MEASURED property of each form
// (how often the gold treebank tagged it PROPN/NOUN/VERB/ADJ), not an author's list.
//
//   salienceOf(form)  -> 0..1 (a name ~1, a common noun .78, a verb .67, an adverb .11) or null (unmeasured)
//   isName(form)      -> the form is tagged a proper noun more than anything else
//   salientTerms(text)-> the ask's measured, content-bearing terms (salience >= floor), most salient first,
//                        with the forms the prior could NOT measure listed apart (never silently dropped)
//   rankBySalience(...) -> order candidates by how much of the ask's SALIENT matter they carry
//
// It never guesses: an unseen form is `unmeasured`, not assumed content or function. Pure, no IO.
import { SALIENCE_PRIOR, SALIENCE_PRIOR_SCHEMA, SALIENCE_PRIOR_SOURCE } from "./fold-chat-salience-prior.js";
import { FUNCTION_WORDS } from "./fold-chat-function-words.js";
import { stemOf } from "./fold-chat-ground.js";
// The fold's text folding, at the khora's declared scope (Latin vowel accents only). The old
// local `fold` was the blanket NFKD+strip-\p{M} the khora REVERTED (II.13): it deleted Devanagari
// matras and decomposed Hangul. See fold-chat-foldtext.js.
import { foldText as fold } from "./fold-chat-foldtext.js";

export { SALIENCE_PRIOR_SCHEMA, SALIENCE_PRIOR_SOURCE };
const tokens = (s) => fold(s).match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) || [];
const EN_FW = new Set(FUNCTION_WORDS.en || []);

/** The salience of a form in [0,1], or null when the prior has never seen it. */
export function salienceOf(form) { const d = SALIENCE_PRIOR[fold(form)]; return d == null ? null : d / 9; }

/** Is this form a NAME (proper noun) in the prior — the thing an ask is usually about? */
export function isName(form) { return (SALIENCE_PRIOR[fold(form)] || 0) >= 8; }

/**
 * The ask's measured terms. Returns:
 *   terms      [{ form, salience }] with a measured salience >= floor, deduped, most salient first
 *   unmeasured forms the prior never saw and that are not a known function word (a rare name, a coinage)
 *   measured   false when NOTHING in the ask was measurable (no prior coverage) — a typed gap, not a guess
 * The function class is read from the real prior too: a form absent from SALIENCE_PRIOR **and** absent from
 * FUNCTION_WORDS is `unmeasured`; absent and in FUNCTION_WORDS is simply not salient (who/the/is/of).
 */
export function salientTerms(text, { floor = 0.5, max = 8, functionWords = EN_FW } = {}) {
  const seen = new Map(), unmeasured = [];
  for (const t of tokens(text)) {
    if (seen.has(stemOf(t))) continue;
    const s = salienceOf(t);
    if (s == null) { if (!functionWords.has(t) && t.length > 1 && !unmeasured.includes(t)) unmeasured.push(t); continue; }
    if (s >= floor) seen.set(stemOf(t), { form: t, stem: stemOf(t), salience: s });
  }
  const terms = [...seen.values()].sort((a, b) => b.salience - a.salience || (a.form < b.form ? -1 : 1)).slice(0, max);
  return { terms, unmeasured, measured: terms.length > 0 };
}

/** The salience weight a form contributes to a match (0 when unmeasured). */
const weight = (form) => salienceOf(form) || 0;

/**
 * Order candidates by how much of the ask's SALIENT matter each carries. A candidate's own words are read
 * the same way; its TITLE counts double (a page named for the subject is about it). Matching is stem-folded,
 * so "presidents" answers an ask about "president". Returns the reordered list (stable: ties keep their
 * order) with a per-candidate score, and the ask's terms.
 *   candidates: [{ title, snippet?, url?, ... }]
 */
export function rankBySalience(candidates, ask, { titleOf = (c) => String(c?.title ?? ""), snippetOf = (c) => String(c?.snippet ?? ""), floor = 0.5 } = {}) {
  const list = Array.isArray(candidates) ? candidates : [];
  const { terms, measured } = salientTerms(ask, { floor });
  if (!measured) return { ranked: list, scores: list.map(() => 0), terms, measured: false };
  const scored = list.map((c, i) => {
    const inTitle = new Set(tokens(titleOf(c)).map(stemOf)), inBody = new Set(tokens(snippetOf(c)).map(stemOf));
    let score = 0;
    for (const { stem, salience } of terms) { if (inTitle.has(stem)) score += 2 * salience; else if (inBody.has(stem)) score += salience; }
    return { c, i, score };
  });
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  return { ranked: scored.map((x) => x.c), scores: scored.map((x) => x.score), terms, measured: true };
}
