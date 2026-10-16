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
//   identity(text)    -> the unmeasured forms reframed: candidate REFERENT surfaces (a rare name, a coinage,
//                        a typo, an identifier) — unresolved, never salience. A word is a surface; a referent
//                        is the being it may name. Ranking by identity resolves by identity; the prior never
//                        refuses what it never measured.
//   rankBySalience(...) -> order candidates by referent identity first (a title bearing the ask's unresolved
//                        referent outranks generic salience matches), then by how much of the ask's SALIENT
//                        matter they carry
//
// It never guesses: an unseen form is `unmeasured`, not assumed content or function. Pure, no IO.
import { SALIENCE_PRIOR, SALIENCE_PRIOR_SCHEMA, SALIENCE_PRIOR_SOURCE } from "./fold-chat-salience-prior.js";
// Received priors of other languages (UD Spanish-AnCora, UD French-GSD; built by scripts/build-salience-prior.mjs --lang). A language
// with no prior here measures nothing: every form is unmeasured (null), never read through the English prior.
import { SALIENCE_PRIOR as SALIENCE_PRIOR_ES } from "./fold-chat-salience-prior-es.js";
import { SALIENCE_PRIOR as SALIENCE_PRIOR_FR } from "./fold-chat-salience-prior-fr.js";
// Creoles (UD Naija-NSC train split, UD Haitian_Creole-Adolphe train split; janus/priors/pos-{pcm,hat}.json, built with --closed). The
// salience table drops function words, so these modules also carry CLOSED_CLASS (≥ 5 tokens, ≥ 50 % closed-class UPOS — the rule of
// scripts/build-function-words.mjs): without it a creole function word is "unmeasured", which the readers take for a candidate NAME.
// Wiktionary packs (pap, kea) are NOT wired: eval/creole/SALIENCE-RESULTS.md.
import { SALIENCE_PRIOR as SALIENCE_PRIOR_PCM, CLOSED_CLASS as CLOSED_PCM } from "./fold-chat-salience-prior-pcm.js";
import { SALIENCE_PRIOR as SALIENCE_PRIOR_HAT, CLOSED_CLASS as CLOSED_HAT } from "./fold-chat-salience-prior-hat.js";
const PRIORS = { en: SALIENCE_PRIOR, es: SALIENCE_PRIOR_ES, fr: SALIENCE_PRIOR_FR, pcm: SALIENCE_PRIOR_PCM, hat: SALIENCE_PRIOR_HAT };
const CLOSED = { pcm: new Set(CLOSED_PCM), hat: new Set(CLOSED_HAT) };
// The Haitian labels the detector emits today (the UDHR file names hatkreyol / hatpopular, and ISO 639-1 ht) are ONE module.
const ALIAS = { ht: "hat", hatkreyol: "hat", hatpopular: "hat" };
const own = (o, k) => (Object.hasOwn(o, k) ? o[k] : null);
const modOf = (lang) => own(ALIAS, lang) || lang;
const priorOf = (lang) => (lang == null ? SALIENCE_PRIOR : own(PRIORS, modOf(lang)));
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
export function salienceOf(form, lang = null) { const P = priorOf(lang); if (!P) return null; const d = P[fold(form)]; return d == null ? null : d / 9; }

/** Is this form a NAME (proper noun) in the prior — the thing an ask is usually about? */
/** Is a folded form in the language's received lexicon (its POS prior saw it as a content word)? */
export function inLexicon(foldedForm, lang = null) { const P = priorOf(lang); return !!P && P[foldedForm] != null; }
/** The letters the language's received lexicon is written in (for edit-distance readings), cached per language. */
const ALPHA = new Map();
export function alphabetOf(lang = null) {
  const key = lang || "en";
  if (ALPHA.has(key)) return ALPHA.get(key);
  const P = priorOf(lang), set = new Set();
  if (P) for (const k of Object.keys(P)) for (const c of k) if (/\p{L}/u.test(c)) set.add(c);
  const a = [...set];
  ALPHA.set(key, a);
  return a;
}
/** The language's CLOSED CLASS as a Set of folded forms, or null when the Fold holds none for it (es/fr/en use FUNCTION_WORDS). */
export function closedFormsOf(lang = null) { return lang == null ? null : own(CLOSED, modOf(lang)); }
/** Is the form closed-class in the language's received pack (a function word, never a name or content word)? */
export function isClosedForm(form, lang = null) { const c = closedFormsOf(lang); return !!c && c.has(fold(form)); }
/** Does the Fold hold a received salience prior for this language (English counts)? */
export function hasPrior(lang = null) { return priorOf(lang) != null; }
export function isName(form, lang = null) { const P = priorOf(lang); return !!P && (P[fold(form)] || 0) >= 8; }

/**
 * The ask's measured terms. Returns:
 *   terms      [{ form, salience }] with a measured salience >= floor, deduped, most salient first
 *   unmeasured forms the prior never saw and that are not a known function word (a rare name, a coinage)
 *   identity   the SAME unmeasured forms reframed as candidate referent surfaces: what the ask may NAME
 *              that the prior cannot read. Never salience, never a guess at meaning — the handle a
 *              referent-first retrieval resolves by identity (title bearing the surface outranks a
 *              generic salience match). Empty exactly when unmeasured is empty.
 *   measured   false when NOTHING in the ask was measurable (no prior coverage) — a typed gap, not a guess.
 *              A measured:false ask WITH identity still ranks by identity: no prior coverage is a fact
 *              about the prior, never a refusal of the question.
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
  return { terms, unmeasured, identity: [...unmeasured], measured: terms.length > 0 };
}

/** The salience weight a form contributes to a match (0 when unmeasured). */
const weight = (form) => salienceOf(form) || 0;

/**
 * Order candidates by REFERENT IDENTITY first, then by salience. A candidate's own words are read
 * the same way; its TITLE counts double (a page named for the subject is about it). Matching is stem-folded,
 * so "presidents" answers an ask about "president". An unresolved referent surface (identity) borne in a
 * title outranks generic salience matches: the ask is about the being it names, not about the words
 * around it. Returns the reordered list (stable: ties keep their order) with a per-candidate score,
 * the ask's terms, and the identity hits per candidate ({ title, body }).
 *   candidates: [{ title, snippet?, url?, ... }]
 */
export function rankBySalience(candidates, ask, { titleOf = (c) => String(c?.title ?? ""), snippetOf = (c) => String(c?.snippet ?? ""), floor = 0.5 } = {}) {
  const list = Array.isArray(candidates) ? candidates : [];
  const { terms, measured, identity } = salientTerms(ask, { floor });
  const idStems = new Set((identity || []).map(stemOf));
  const scored = list.map((c, i) => {
    const inTitle = new Set(tokens(titleOf(c)).map(stemOf)), inBody = new Set(tokens(snippetOf(c)).map(stemOf));
    let score = 0;
    for (const { stem, salience } of terms) { if (inTitle.has(stem)) score += 2 * salience; else if (inBody.has(stem)) score += salience; }
    let idTitle = 0, idBody = 0;
    for (const s of idStems) { if (inTitle.has(s)) idTitle++; else if (inBody.has(s)) idBody++; }
    return { c, i, score, idTitle, idBody };
  });
  // Identity first (a title bearing the ask's unresolved referent), then salience, then body identity.
  // With no identity terms this reduces exactly to the old salience order.
  scored.sort((a, b) => b.idTitle - a.idTitle || b.score - a.score || b.idBody - a.idBody || a.i - b.i);
  return { ranked: scored.map((x) => x.c), scores: scored.map((x) => x.score), terms, measured, identity, identityHits: scored.map((x) => ({ title: x.idTitle, body: x.idBody })) };
}
