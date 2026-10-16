// fold-chat-casts.js — whose turn established each referent, and a scope the person can actually reach (fix (e)).
//
// A pronoun binds only to referents the PERSON's own turns established, or that the FOLD showed them in an answer —
// never to a referent only a SOURCE asserted. That is the sibling-word failure (Great Wall vs Berlin Wall: "about the
// Great Wall" returned the Berlin Wall turn) and the top-2 pollution (D1: 17/18 near-carry queries carried a second,
// unrelated referent). The record's weight still ranks; the holder scope and the person's refusals are hard filters.
//
// OFF by default: resolveQuestion/followUp use it only when the caller passes `casts` (the live page reads
// localStorage["fold-chat:casts"] === "on"). Pure; node-testable. The model never sees this module.
import { personLike } from "./fold-chat-mind.js";
import { PRONOUN_GENDER } from "./fold-chat-pronoun-gender.js";

const fold = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const H = { USER: "user", FOLD: "fold", SOURCE: "source" };

function genderUnion() {
  const out = {}, drop = new Set();
  for (const t of Object.values(PRONOUN_GENDER)) for (const [w, g] of Object.entries(t.forms)) { if (out[w] && out[w] !== g) drop.add(w); else out[w] = g; }
  for (const w of drop) delete out[w];
  return out;
}

export const CASTS = Object.freeze({
  // DECLARED (II.11): a SOURCE's assertion is not the person's establishment; the fold's shown answer is reachable.
  accessibility: Object.freeze({ [H.USER]: [H.FOLD], [H.FOLD]: [H.SOURCE, H.USER], [H.SOURCE]: [] }),
  // DECLARED, never measured (giver: the author; English-only; LEFT on purpose, docs/NO-FIXED-LISTS.md): animacy of a thing-shaped surface (an article title,
  // an office, a structure, a year). Removing it passes the suites and the ratchet but makes Berlin Wall / Eiffel Tower persons: fold-chat-casts.test.mjs PINs it.
  inanimate: /\b(?:election|presidential|office|presidency|king|queen|prime minister|mayor|president|wall|tower|bridge|river|city|capital|planet|element|band|album|record label|article|page|edition|ship|war|battle|treaty|law)\b|\b(?:19|20)\d{2}\b|·|—/i,
  // DERIVED (scripts/gen-pronoun-gender.mjs -> fold-chat-pronoun-gender.js): the pronouns of a NATURAL-gender language (no determiner/adjective agrees
  // in Gender in its UD treebank) say person (Masc/Fem) or thing (Neut); a grammatical-gender language contributes nothing. A form two languages
  // disagree on is dropped. English he/she/it is what the generator measures, not what is typed here.
  pronounGender: Object.freeze(genderUnion()),
});

/** The head token and first token of a surface, folded — what "appears in a turn" means. */
const tokenRuns = (s) => (String(s).match(/[\p{L}\p{N}]+/gu) || []).map(fold);

/** The gendered pronoun form the ask actually uses, or null (used only to filter a referent's animacy). */
export function pronounOf(ask, gate) {
  if (gate?.kind !== "pronoun") return null;
  return tokenRuns(ask).find((w) => CASTS.pronounGender[w]) || null;
}

/** Do two word forms share a stem? Equal; one a prefix or suffix of the other (a plural, a compound head: "wahl" in "praesidentschaftswahl"); or a long
 *  common prefix ("eleccio" in elecció / eleccions). Folded, ≥4 letters. The false-positive rate on unrelated words is MEASURED in
 *  fold-chat-pronoun-levels.test.mjs, not assumed. */
export function sameStem(a, b) {
  a = fold(a); b = fold(b);
  if (a.length < 4 || b.length < 4) return false;
  if (a === b) return true;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  if (l.startsWith(s) || l.endsWith(s)) return true;
  let k = 0; while (k < s.length && s[k] === l[k]) k++;
  return k >= Math.max(5, Math.ceil(0.75 * s.length));
}
/** Does the ask itself NAME this referent (some word of the ask shares a stem with some word of its surface)? */
export const askNames = (ask, surface) => { const a = tokenRuns(ask).filter((w) => w.length >= 4); return tokenRuns(surface).some((s) => s.length >= 4 && a.some((w) => sameStem(w, s))); };

const mentions = (surface, text) => {
  const ws = tokenRuns(surface);
  if (!ws.length) return false;
  const t = new Set(tokenRuns(text));
  return ws.some((w) => t.has(w));
};

/** Build the cast from the chat's messages and referent record. `established`: [{ id, surface, holder, person, weight, age }]. */
export function castOf(messages = [], record = {}) {
  const userSeen = new Set(), foldSeen = new Set();
  for (const m of messages || []) {
    const c = String(m?.content ?? m?.text ?? "");
    if (!c) continue;
    const into = m.role === "user" ? userSeen : foldSeen;
    tokenRuns(c).forEach((w) => into.add(w));
  }
  const entities = (record?.entities || []).map((e, i) => ({ e, i })).sort((a, b) => (b.e.weight || 0) - (a.e.weight || 0));
  const established = entities.map(({ e, i }) => {
    const surface = e.surface || e.text || "";
    const inUser = [...userSeen].some((w) => mentions(surface, w)) || mentions(surface, [...userSeen].join(" "));
    const inFold = !inUser && (mentions(surface, [...foldSeen].join(" ")));
    const holder = inUser ? H.USER : inFold ? H.FOLD : H.SOURCE;
    return { id: fold(surface), surface, holder, person: personLike(surface, null) && !CASTS.inanimate.test(surface), weight: e.weight || 0, age: i };
  });
  const userReachable = new Set([H.USER, ...(CASTS.accessibility[H.USER] || [])]);
  return { H, established, accessibility: CASTS.accessibility, userReachable, fold: CASTS };
}

/** Resolve an anaphor to ONE referent under the person's scope. `pronoun` = the matched pronoun form of the ask.
 *  Returns the resolveQuestion shape ({ said, resolved, carried:[{surface, by}], reason, id }). */
export function resolveCast(question, cast, { rejected = null, pronoun = null } = {}) {
  const said = String(question ?? "").trim();
  const base = { said, resolved: said, carried: [], reason: "no-record" };
  if (!cast || !cast.established.length) return base;
  const refused = new Set((Array.isArray(rejected) ? rejected : []).map((x) => fold(x).trim()));
  const wantAnim = pronoun && CASTS.pronounGender[pronoun] ? CASTS.pronounGender[pronoun] : null;
  let pool = cast.established.filter((e) => cast.userReachable.has(e.holder) && e.holder !== H.SOURCE && !refused.has(e.id));
  // DISJOINT REFERENCE (Level 4, language-free). In a one-sentence ask, a pronoun does not stand for a referent the ask itself names: in
  // "say more about him losing the election" the election is named, so "him" is not the election. It needs no animacy table and no
  // pronoun gender, so it holds in every language the stem test holds in. Applied only when it leaves at least one candidate, and not to
  // an ask of several sentences ("Trump lost. Tell me more about him."), where the pronoun may well stand for a name already given.
  const oneSentence = !/[.!?;。！？]\s*\p{L}/u.test(said);
  if (oneSentence) { const rest = pool.filter((e) => !askNames(said, e.surface)); if (rest.length && rest.length < pool.length) pool = rest; }
  if (wantAnim === "n") pool = pool.filter((e) => !e.person);
  else if (wantAnim === "p") { const pl = pool.filter((e) => e.person); if (pl.length) pool = pl; }
  if (!pool.length) return { ...base, reason: wantAnim ? "nothing-person-like-or-reachable" : "nothing-reachable", why: "the referent the ask points back to is out of the person's scope, or was refused" };
  // one best, never top-2: a second referent pollutes the query (D1 1a)
  const top = [...pool].sort((a, b) => (b.weight - a.weight) || (a.age - b.age))[0];
  const carried = [{ surface: top.surface, by: "cast:holder-scope" }];
  return { ...base, carried, resolved: `${said} (about: ${top.surface})`, reason: "carried", id: top.id };
}