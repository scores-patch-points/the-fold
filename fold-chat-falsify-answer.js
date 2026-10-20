// fold-chat-falsify-answer.js — try to break each claim of an answer against EVERYTHING the turn read, source by source.
//
// One claim = one sentence of the answer. For every independent source (a domain; two domains carrying the same
// syndicated sentence are one chain, after al-Bukhari: a shared chain is one witness) the best sentence it holds is
// found and asked three things:
//   STATES       it says the claim: a run of 4+ shared words, or most of the claim's content words — AND every figure
//                the claim states appears in that sentence, AND every name in its neighbourhood, AND the same polarity.
//   CONTRADICTS  it is about the same thing (shares 40%+ of the claim's content words) but flips the polarity, or gives
//                a different figure in the same unit where the claim's figure is absent.
//   SILENT       neither.
// Then the attack that makes a "states" worth something — the SWAP: replace the claim's figure (or name) with a
// competitor the same source offers and ask again. If the swapped, false claim is "stated" just as well, the
// evidence does not discriminate and the support is weak however long the match.
//
// verdict per claim: contested (any source contradicts) · corroborated (2+ independent chains state it, swap holds)
//                    · held (one chain) · weak (indiscriminate, or close but short) · unsupported.
// Pure; node-testable. Every string out is a substring of the input (no wording is invented here).
import { figuresIn, figureMatches, namesIn, stemOf as groundStem } from "./fold-chat-ground.js";
import { impressionOf } from "./fold-chat-impression.js";
import { FUNCTION_WORDS } from "./fold-chat-function-words.js";

export const FALSIFY = Object.freeze({ RUN: 4, STATE_OVERLAP: 0.5, STATE_MIN_SHARED: 3, ABOUT_OVERLAP: 0.4, SYNDICATED_RUN: 12, MAX_SENTS_PER_SOURCE: 400 });
// The words of HEDGING and REPORTING ("some claim", "experts say", "it is widely considered"): they frame a claim, they
// are not its content, and a source that states the claim in its own frame should not lose for lacking them.
const HEDGE = "some many most several critics experts economists researchers scholars studies study analysts proponents supporters others claim claims claimed argue argues argued suggest suggests suggested say says said believe believes believed note notes noted report reports reported state states stated generally often widely broadly largely commonly usually typically considered seen viewed regarded thought known shown according overall also however although though while whereas indeed particularly especially notably".split(" ");

const FW = new Set([...(FUNCTION_WORDS?.en || []), ..."the a an and or but of in to with by for on at from as is are was were be been being has have had it its this that these those which who what when where why how than then so also there their they he she we you i".split(" "), ...HEDGE]);
const fold = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const words = (s) => fold(s).match(/[\p{L}\p{N}]+/gu) || [];
const stem = (w) => w.replace(/(?:ing|ed|es|s|ly)$/u, "").slice(0, 6);
/** one normal form for overlap (F2 S2b/r04-r05, C2/C3): the gate's irregular table first
 *  (fell/fall, won/win, met/meet stay one verb). The local slice is NOT applied here — slicing
 *  ("largest"→"larges") breaks idempotence with the predicate side; groundStem is a fixed point. */
const contentStems = (s) => [...new Set(words(s).filter((w) => w.length > 2 && !FW.has(w) && !/^\d+$/.test(w)).map((w) => groundStem(w)))];
const NEG = /\b(?:not|no|never|neither|nor|none|without|cannot|n't|failed to|did not|does not|is not|was not)\b/i;
// a PREDICATE negation ("refused to concede", "denied the result") flips polarity the same way "did not" does
const PNEG = /\b(?:refused?|denied|denies|rejected|rejects|declined|declines)\b/i;
// NEGATORS THAT DO NOT NEGATE (referent-first repair, F2 C1/C5): scalar "not only/just/merely/simply" affirms,
// epistemic "no doubt/question" asserts. Stripped before any polarity verdict, on both sides.
const VOID_NEG = /\bnot\s+(?:only|just|merely|simply)\b|\bno\s+(?:doubt|question)\b/i;
const stripVoid = (s) => String(s ?? "").replace(VOID_NEG, " ");
const neg = (s) => NEG.test(stripVoid(s)) || PNEG.test(String(s));
// polarity-transparent adverbs between a negator and its predicate ("not only divided", "did not really change")
const SKIP_GOV = new Set(["only", "just", "merely", "simply", "even", "really", "certainly", "probably", "quite", "rather"]);
const PRON = new Set(["he", "she", "it", "they", "we", "you", "i", "this", "that", "these", "those", "there", "here", "who", "which"]);
const tokClean = (x) => String(x ?? "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
/** edit distance capped at `cap` (early exit): "filed"/"file", "won"/"win" meet here; anything
 *  farther never does. Used ONLY for predicate meeting, always behind the subject+proximity gates. */
function levCapped(a, b, cap = 1) {
  a = String(a); b = String(b);
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = [];
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}
/** The negated PREDICATE: the first content word after a negator, in normal form. Skips a small CLOSED
 *  set (determiners/aux/pronouns/prepositions/transparent adverbs) — never the broad function-word list,
 *  which eats real predicates ("seen", "stated"). Hyphenated forms split ("wrought-iron" → "wrought"). */
const GOV_CLOSED = new Set(("the a an of in to with by for on at from as is are was were be been being has have had do does did will would could should shall may might must can it its this that these those which who whom whose and or but so than then too also there their they he she we you i my your his her our their my we our your an no not never neither nor none without cannot n't 's 'm 're 've 'll 'd s").split(" "));
export function governedPredicate(s) {
  const toks = String(s ?? "").toLowerCase().split(/[\s\-–—/]+/);
  for (let i = 0; i < toks.length; i++) {
    if (!NEG.test(toks[i]) && !PNEG.test(toks[i])) continue;
    for (const x of toks.slice(i + 1, i + 7)) {
      const t = tokClean(x);
      if (t.length <= 2 || GOV_CLOSED.has(t) || SKIP_GOV.has(t)) continue;
      return groundStem(t);
    }
  }
  return null;
}
/** The subject of the negated clause: the last name ending before the negator (namesOf), else the first
 *  word of the sentence. A pronoun subject ("He never returned") resolves through the neighbourhood
 *  (`around`), never by position. */
function negSubject(text, upto) {
  const pre = String(text ?? "").slice(0, upto);
  const ns = namesIn(pre);
  // multiword names first: acronyms/date-fragments ("AD") match after the runs in namesIn's order
  // and must never win the subject over a real being ("Eastern Roman Empire", not "AD")
  const multi = ns.filter((n) => /\s/.test(n.trim()));
  if (multi.length) return { name: multi[multi.length - 1], pronoun: false };
  if (ns.length) return { name: ns[ns.length - 1], pronoun: false };
  const first = (String(text ?? "").trim().match(/^[\p{L}'-]+/u) || [""])[0];
  if (first && PRON.has(first.toLowerCase())) return { name: first, pronoun: true };
  return first ? { name: first, pronoun: false } : null;
}
const foldEq = (a, b) => { const x = fold(a), y = fold(b); return x === y || (x && y && (x.includes(y) || y.includes(x))); };
/** token distance between two folded forms in a text (Infinity when either is absent).
 *  The predicate meets in any shared normal form (exact, gate-irregular, local-stem) — "filed" meets
 *  "file" here just as it does for the flip verdict itself (F2 C3 d12). */
function tokGap(text, a, b) {
  const toks = wordsLc(text);
  const ia = toks.findIndex((w) => fold(w) === fold(a) || fold(a).includes(w) || w.includes(fold(a)));
  const ib = toks.findIndex((w) => w === b || groundStem(w) === b || levCapped(w, b) <= 1);
  if (ia < 0 || ib < 0) return Infinity;
  return Math.abs(ia - ib);
}
/** Do two clause-subjects name the same being? Full-name containment either way ("The Berlin Wall" holds
 *  "The Wall"; "Eastern Roman Empire" does not hold "Western Roman Empire") — or the same HEAD word
 *  ("The Berlin Wall" and "The Wall" are one being by their head; "Wall" and "barrier" are not) — AND
 *  near the shared predicate (a joined pair can hold both names far apart: "Armstrong … Collins remained"
 *  is two propositions, not one). A pronoun subject holds whatever the neighbourhood holds (the claim's
 *  head must stand near it there). */
function sameSubject(negName, negPronoun, otherText, aroundText, claimHead, predStem = "") {
  if (!negName) return true;   // no subject to disagree on
  if (negPronoun) {
    const hay = fold(String(otherText ?? "") + " " + String(aroundText ?? ""));
    return !!claimHead && hay.includes(fold(claimHead));
  }
  if (!subjectNamesMatch(negName, String(otherText ?? "").slice(0, 200))) return false;
  if (predStem && tokGap(otherText, negName.split(/\s+/).pop(), predStem) > 5) return false;
  return true;
}
/** two names for the same being: containment either way ("The Berlin Wall" holds "The Wall"), or the
 *  same head word without a contradictory modifier ("Eastern Roman Empire" does NOT hold against
 *  "Western Roman Empire" — eastern≠western; "The Berlin Wall" holds against "The Wall", which
 *  modifies nothing). Modifiers are the capitalized non-head words of each side's phrase. */
function subjectNamesMatch(a, bText) {
  const x = fold(a), y = fold(bText);
  if (!x || !y) return false;
  if (x.includes(y) || y.includes(x)) return true;
  const mods = (s) => { const w = String(s).split(/[^a-zA-Z]+/).filter((t) => /^[A-Z]/.test(t) && t.length > 1 && !/^(?:the|a|an)$/i.test(t)); return { head: w.length ? w[w.length - 1].toLowerCase() : "", mods: w.slice(0, -1).map((t) => t.toLowerCase()) }; };
  const A = mods(a);
  if (!A.head) return false;
  const m = String(bText).match(new RegExp(`([A-Z][a-zA-Z'’-]*\\s+){0,3}${A.head.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "iu"));
  if (!m) return false;
  const Bm = mods(m[0]);
  if (Bm.head !== A.head) return false;
  return !A.mods.some((m1) => Bm.mods.some((m2) => m1 !== m2 && !m1.includes(m2) && !m2.includes(m1)));
}
/** A polarity flip counts only for the SAME proposition: sides differ on negation, the negated predicate
 *  (first content after the negator) is what the other side commits to, and the negated clause's subject
 *  is the other side's subject. Exported: fold-chat-present.js :: scopeHas delegates to it so the k6 branch
 *  and the cross-reference branch judge polarity by one rule (F2 C1/C5). */
export function negationFlips(negText, otherText, otherStems, aroundText = "", claimHead = "") {
  const t = stripVoid(negText);
  if (!NEG.test(t) && !PNEG.test(t)) return false;
  const p = governedPredicate(t);
  if (!p) return false;
  // the predicate meets the other side in any shared normal form: exact, gate-irregular
  // ("fell"/"fall", "met"/"meet"), or one edit apart ("filed"/"file")
  const hit = (k) => k === p || groundStem(k) === p || levCapped(k, p) <= 1;
  if (!otherStems.some(hit)) return false;
  const idx = String(t).toLowerCase().search(NEG.test(t) ? NEG : PNEG);
  const subj = negSubject(t, idx < 0 ? t.length : idx);
  if (!subj) return true;
  return sameSubject(subj.name, subj.pronoun, otherText, aroundText, claimHead, p);
}
/** The content stems a negation in `s` actually governs (kept for callers that list them; the flip verdict
 *  itself goes through negationFlips/governedPredicate). */
const negGoverns = (s) => { const toks = String(s).toLowerCase().split(/\s+/); const out = new Set(); toks.forEach((w, i) => { if (NEG.test(w) || PNEG.test(w)) for (const x of toks.slice(i + 1, i + 5)) { const t = x.replace(/[^\p{L}\p{N}]/gu, ""); if (t.length > 2) out.add(stem(t)); } }); return out; };
const flipsPolarity = (claim, sent, cs, ss, around = "", cHead = "") => {
  const cn = neg(claim), sn = neg(sent);
  if (cn === sn) return false;
  // the negated side's predicate must be committed to by the other side, about the same subject
  return sn ? negationFlips(sent, claim, cs, around, cHead) : negationFlips(claim, sent, ss, around, cHead);
};
const domainOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const SENT = /(?<=[.!?。！？])\s+(?=[\p{Lu}\p{N}"“(])/u;
const sentencesOf = (t) => String(t ?? "").replace(/\s+/g, " ").split(SENT).map((s) => s.trim()).filter((s) => s.length >= 12);

/** Longest run of consecutive words two texts share (folded), and the run itself as the SOURCE wrote it. */
function longestRun(claim, sent) {
  const a = words(claim), bRaw = String(sent).match(/[\p{L}\p{N}]+/gu) || [], b = bRaw.map(fold);
  let best = 0, end = 0;
  const prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : 0;
      if (prev[j] > best) { best = prev[j]; end = j; }
      diag = tmp;
    }
  }
  return { n: best, text: best ? bRaw.slice(end - best, end).join(" ") : "" };
}

function figuresAgree(claimFigs, sent) {
  const sf = figuresIn(sent);
  const missing = claimFigs.filter((c) => !sf.some((w) => figureMatches(c, w)));
  // a DIFFERENT figure of the same kind where the claim's is absent: same unit dimension, or both bare years
  const year = (f) => f.numeric && !f.unit && /^\d{4}$/.test(f.norm) && f.v >= 1000 && f.v <= 2200;
  const clash = missing.map((c) => ({ c, w: sf.find((w) => w.numeric && c.numeric && w.norm !== c.norm && ((c.unit && w.unit && c.unit.dim === w.unit.dim) || (year(c) && year(w)) || (!c.unit && !w.unit && c.norm.endsWith("%") === w.norm.endsWith("%") && c.norm.endsWith("%")))) })).filter((x) => x.w);
  return { missing, clash };
}
/** nearest non-be verb stem to a char offset, staying inside the figure's own clause (F2 S1 c14:
 *  "discovered in 1930 and was reclassified" — the 1930 belongs to "discovered", not to the nearer-by-char
 *  "reclassified" across the "and"). Figures themselves are never verbs. Clause edges: [,;] and
 *  but/and/while/though/whereas — the same seam the role windows cut on. */
function nearestVerb(text, offset) {
  const s = String(text ?? "");
  const bounds = [0];
  for (const m of s.matchAll(/[,;]|\b(?:but|and|while|though|whereas)\b/gu)) bounds.push(m.index, m.index + m[0].length);
  bounds.push(s.length + 1);
  let lo = 0, hi = s.length + 1;
  for (let i = 0; i < bounds.length; i += 2) {
    if (offset >= bounds[i] && offset < (bounds[i + 1] ?? s.length + 1)) { lo = bounds[i]; hi = bounds[i + 1] ?? s.length + 1; break; }
  }
  let best = null, bd = Infinity;
  for (const m of s.toLowerCase().matchAll(/[\p{L}\p{N}]+/gu)) {
    if (m.index < lo || m.index >= hi) continue;
    if (/^\d+$/.test(m[0])) continue;
    const v = groundStem(m[0]);
    if (!v || v.length < 3 || BE_VERB.has(v) || !isVerbish(m[0])) continue;
    const d = Math.abs(m.index - offset);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}

// ---- role confusion (F2 C4): the same verb with permuted roles ----
// "Napoleon defeated Wellington" against "Napoleon was defeated by two armies" shares every word that
// matters except the binding: who did what to whom. Words match; the ACT does not. A single-role mismatch
// stays silent (alias pairs like Wall/barrier must never fail); BOTH roles mismatched is positive evidence
// the edge is wrong. Negated pairs belong to polarity; be-verbs carry no roles.
const BE_VERB = new Set(["am", "is", "are", "was", "were", "be", "been", "being"]);
// stative/possessive predicates carry no transferable act ("stood", "has"): role-mismatch across
// different events is expected, never a contradiction (F2 S1 c10/c16). Event verbs only.
const STATIVE = new Set(["stand", "stood", "sit", "sat", "lie", "lay", "lain", "exist", "existed", "has", "have", "had"]);
const wordsLc = (s) => String(s ?? "").toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
const DET = new Set(["the", "a", "an"]);
/** crude voice/roles for one verb stem: passive = be-verb ≤3 before + "by" ≤6 after; else active.
 *  A determiner-led occurrence ("the boiling point") is nominal, never the predicate: skipped.
 *  Role phrases cut at clause boundaries — "divided Berlin but also stood" is about Berlin, not about
 *  "Berlin but also stood" (F2 S1 c10). Relative pronouns keep their clause. */
const CLAUSE_CUT = /[,;]|\b(?:but|and|while|though|whereas)\b/;
const cutPost = (toks) => toks.join(" ").split(CLAUSE_CUT).map((x) => x.trim()).filter(Boolean)[0] || "";
function rolesOf(text, verbStem) {
  const toks = wordsLc(text);
  const raw = String(text ?? "").match(/[\p{L}\p{N}]+/gu) || [];
  // a mid-sentence capital is a name, never the predicate ("Chrysler Building" does not build;
  // sentence-initial position capitalises by rule and stays eligible)
  const isNameToken = (i) => { const r = raw[i] || ""; return /^\p{Lu}/u.test(r) && !/^[A-Z][a-z]?$/.test(r) && i > 0; };
  let vi = -1;
  for (let i = 0; i < toks.length; i++) {
    if (groundStem(toks[i]) !== verbStem) continue;
    if (isNameToken(i)) continue;
    if (i > 0 && DET.has(toks[i - 1])) continue;   // "the boiling point" names, it does not boil
    vi = i;
    break;
  }
  if (vi < 0) return null;
  const beBefore = toks.slice(Math.max(0, vi - 3), vi).some((w) => BE_VERB.has(w));
  const byAfter = toks.slice(vi + 1, vi + 7).includes("by");
  // the agent is the WHOLE pre-verb window, uncut: "Marie Curie and Henri Becquerel won" names joint
  // agents, and cutting at "and" would compare only "Henri Becquerel" — manufacturing a substitution
  // the source never made (F2 swap-test: joint winners substitute freely). The patient cuts at the
  // first clause boundary ("divided Berlin but also stood" is about Berlin).
  const pre = toks.slice(Math.max(0, vi - 6), vi).join(" ");
  const post = cutPost(toks.slice(vi + 1, vi + 7));
  if (beBefore && byAfter) {
    const bym = String(text).toLowerCase().match(/\bby\s+([a-z][\p{L}\p{N}'’.-]*(?:\s+[a-z][\p{L}\p{N}'’.-]*){0,3})/u);
    return { agent: bym ? bym[1] : "", patient: pre, passive: true };
  }
  return { agent: pre, patient: post, passive: false };
}
const phraseHas = (phrase, name) => {
  const p = fold(phrase), n = fold(name);
  if (!n || !p) return false;
  if (p.includes(n) || n.includes(p)) return true;
  // by STEM, content words only: "two Nobel Prizes" is in "the Nobel Prize in Physics" (a plural, a determiner and a qualifier are not another being)
  const NUMW = /^(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twice|thrice|several|few|many|both)$/;
  const stems = (x) => new Set(words(x).filter((w) => w.length > 1 && !FW.has(w) && !NUMW.test(w) && !/^\d+$/.test(w)).map((w) => groundStem(w)));
  const a = stems(p), b = stems(n);
  const within = (x, y) => x.size > 0 && [...x].every((k) => y.has(k));
  return within(a, b) || within(b, a);
};
/** a numeral: digits or a number word, which makes the word after it a counted noun */
const COUNTING = /^(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|dozen|several|many|few|both)$/i;
// light verbs too short for the morphology rule below, but real predicates ("Mars has …")
const LIGHT_VERB = new Set(["has", "have", "had", "do", "does", "did", "make", "made"]);
/** verb-shaped, honestly: a light verb, a regular suffix, or an irregular the gate's table reduces —
 *  but never a bare-e strip ("people"→"peopl", "battle", "file" are not verbs; "wrote"→"write",
 *  "fell"→"fall", "led"→"lead" are). */
function isVerbish(w) {
  const t = String(w ?? "").toLowerCase();
  if (t.length < 3 || LIGHT_VERB.has(t)) return LIGHT_VERB.has(t);
  if (/(?:ing|ed|es|s)$/.test(t) && t.length >= 4) return true;
  const g = groundStem(t);
  return g !== t && g !== t.replace(/e$/, "");
}
const rawWords = (s) => String(s ?? "").match(/[\p{L}\p{N}]+/gu) || [];
/** the pair's FIRST shared predicate, or null. A verb candidate is lowercase in the claim (names are
 *  capitalised; sentence position capitalises too, an accepted miss), stemmed with the gate's own
 *  irregular table, and verb-shaped (irregular, -ed/-ing/-es/-s, or a light verb) — so "Napoleon" never
 *  becomes the verb of a Napoleon sentence. Be-verbs carry no roles. */
function firstSharedVerb(claim, sent, cnames) {
  const inNames = (w) => (cnames || []).some((n) => fold(n).split(/[^a-z0-9]+/i).includes(fold(w)));
  // proper nouns are never verbs: a mid-sentence capital ("Chrysler Building") must not supply "build"
  // (F2 S1 c04). Sentence-initial position capitalises by rule, so index 0 stays eligible.
  const verbStemsOf = (text) => {
    const toks = String(text ?? "").match(/[\p{L}\p{N}]+/gu) || [];
    const out = new Set();
    toks.forEach((raw, i) => {
      if (i > 0 && /^\p{Lu}/u.test(raw)) return;
      out.add(groundStem(raw.toLowerCase()));
    });
    return out;
  };
  const sgs = verbStemsOf(sent);
  const claimWords = rawWords(claim);
  for (let i = 0; i < claimWords.length; i++) {
    const raw = claimWords[i];
    if (/^\p{Lu}/u.test(raw)) continue;                    // capitalised: a name or position, never the verb
    // a word counted by a numeral is a noun, not a verb ("seven languages", "199 pages", "13,353 text lines"): a plural -s is not a third-person verb
    if (i > 0 && COUNTING.test(claimWords[i - 1])) continue;
    const w = raw.toLowerCase();
    if (w.length < 3 || inNames(w)) continue;
    const v = groundStem(w);
    if (!v || BE_VERB.has(v) || STATIVE.has(v)) continue;
    // verb-shaped per isVerbish (irregulars, suffixes, light verbs — never bare-e strips like
    // "people"→"peopl"). Plain nouns ("battle") rarely qualify; when they do, the
    // both-roles-must-mismatch gate below still protects true statements.
    if (!isVerbish(w)) continue;
    if (sgs.has(v)) return v;
  }
  return null;
}
/** role confusion about the pair's FIRST shared verb, or null. Both sides non-negated; ≥1 shared name
 *  (unanchored generic verbs never fire); a missing counterpart is never a mismatch (intransitives). */
export function roleConfusion(claim, sent, cnames) {
  if (neg(claim) || neg(sent)) return null;
  const verb = firstSharedVerb(claim, sent, cnames);
  if (!verb) return null;
  const sharedName = (cnames || []).some((n) => { const nw = words(n).filter((w) => w.length > 1 && !FW.has(w)); const head = nw[nw.length - 1]; return head && (fold(sent).includes(head) || nw.every((w) => fold(sent).includes(w))); });
  if (!sharedName) return null;
  const cr = rolesOf(claim, verb), sr = rolesOf(sent, verb);
  if (!cr || !sr) return null;
  // a role phrase with no content word ("he", "they were", "it") is VACUOUS — pronouns and
  // function words carry no role to mismatch (F2 C5 c12 "He received…" vs "Einstein received…").
  // Vacuity can only clear mismatches, never create them.
  const vacuous = (ph) => !String(ph ?? "").split(/[^a-z0-9]+/i).filter((w) => w.length > 1 && !FW.has(w.toLowerCase())).length;
  const agentOk = vacuous(cr.agent) || vacuous(sr.agent) || !cr.agent || !sr.agent || phraseHas(cr.agent, sr.agent);
  const patientOk = vacuous(cr.patient) || vacuous(sr.patient) || !cr.patient || !sr.patient || phraseHas(cr.patient, sr.patient);
  if (!agentOk && !patientOk) return { confused: true, why: `reverses who did what to whom (${verb}): ${cr.agent.slice(0, 40)} / ${cr.patient.slice(0, 40)}` };
  // RIVAL SUBSTITUTION (F2 S3/S5/C4 d14/d15): exactly one role mismatches, and the two values are
  // DIFFERENT NAMED beings standing in the same role ("Wellington led" where "Blücher led").
  // Common nouns never qualify ("moons"/"satellites", "Wall"/"barrier" are not rival beings).
  if ((!agentOk) !== (!patientOk)) {
    const pair = !agentOk ? [cr.agent, sr.agent] : [cr.patient, sr.patient];
    const inNames = (ph, list) => (list || []).filter((n) => phraseHas(ph, n));
    const a = inNames(pair[0], cnames), b = inNames(pair[1], namesOf(sent));
    // heads compare by STEM: "Nobel Prizes" and "Nobel Prize" are one being, not a rival substituted for another
    const headOf = (n) => { const w = words(n).filter((x) => x.length > 1 && !FW.has(x)); return w.length ? groundStem(w[w.length - 1]) : ""; };
    // PLACE-STACKS are not rivals: "born in Ulm, in the Kingdom" names one place twice (meronymy),
    // while "Wellington led" / "Blücher led" names two beings. A stack = both names in one sentence
    // joined by in/near/of with no verb between (a verb between means separate clauses, separate beings).
    const stacked = (x, y) => {
      const both = [String(claim), String(sent)].join(" ").split(/(?<=[.!?])\s+/);
      const fx = fold(x), fy = fold(y);
      return both.some((s) => {
        const ls = fold(s), ix = ls.indexOf(fx), iy = ls.indexOf(fy);
        if (ix < 0 || iy < 0) return false;
        const lo = Math.min(ix, iy), hi = Math.max(ix, iy);
        const between = ls.slice(lo, hi);
        if (!/\b(?:in|near|of)\b/.test(between)) return false;
        return !between.split(/[^a-z0-9]+/i).filter((w) => w.length > 2).some(isVerbish);
      });
    };
    for (const x of a) for (const y of b) {
      if (headOf(x) && headOf(y) && headOf(x) !== headOf(y) && !stacked(x, y)) return { confused: true, why: `substitutes ${x.slice(0, 40)} for ${y.slice(0, 40)} (${verb})` };
    }
  }
  return null;
}

/** Judge one claim against one sentence (with its neighbours, for names).
 *  `joined` marks a pair-joined evaluation (two adjacent source sentences as one): wording-level checks
 *  (runs, overlap, figures, polarity) read it whole, but ROLE confusion does not — roles live in clauses,
 *  clauses live in sentences, and windows spanning the join invent bindings ("deimos they were"). */
// The debug trace is a Node convenience (FCFA_TRACE in the environment). This module also runs IN THE BROWSER, where there is no `process`:
// the read below was unguarded and threw "process is not defined" on every falsify of a model-written answer (audit F/B, D2).
const TRACE = () => { try { return typeof process !== "undefined" && !!(process.env && process.env.FCFA_TRACE); } catch { return false; } };
/** A claim's multi-word name ("Pierre Curie") is present where only its HEAD is ("Curie"), unless every place the source writes that head it
 *  is behind a DIFFERENT given name ("Marie Curie"): then the source speaks of another person who shares the surname. A bare head, or a
 *  head behind one of the claim name's own words, keeps the match (the source's own subject may be written by surname alone). */
function headIsSame(name, nw, head, around) {
  if (nw.length < 2) return true;
  const raw = String(around).match(/[\p{L}\p{N}'’-]+/gu) || [];
  const at = raw.map((w, i) => (fold(w) === head ? i : -1)).filter((i) => i >= 0);
  if (!at.length) return true;
  return at.some((i) => {
    const before = raw[i - 1];
    if (!before || !/^\p{Lu}/u.test(before) || FW.has(fold(before))) return true;   // bare surname (or after a lowercase word)
    return nw.some((w) => w === fold(before));                                        // behind one of the claim's own name words
  });
}
function judge(claim, cs, cfigs, cnames, sent, around, joined = false) {
  const ss = new Set(contentStems(sent));
  const shared = cs.filter((k) => ss.has(k));
  const overlap = cs.length ? shared.length / cs.length : 0;
  const run = longestRun(claim, sent);
  const { missing, clash } = figuresAgree(cfigs, sent);
  const hay = fold(around);
  // a name is present when its HEAD token is ("Joe Biden" is present where the source says "Biden"); a wholly different
  // name is still missing, so a rival is never silently accepted
  const namesMissing = cnames.filter((n) => { const nw = words(n).filter((w) => w.length > 1 && !FW.has(w)); if (!nw.length) return false; const head = nw[nw.length - 1]; if (nw.every((w) => hay.includes(w))) return false; if (!hay.includes(head)) return true; return !headIsSame(n, nw, head, around); });
  // SUBJECT/FILLER: a claim's FIRST name is its subject; it must sit at the START of the matched region, not merely
  // appear somewhere — else a page that says "Biden won … defeating incumbent Donald Trump" would clear "Trump won".
  let subjectMissing = false;
  if (cnames.length) {
    const subj = words(cnames[0]).filter((w) => w.length > 1 && !FW.has(w));
    const head = subj[subj.length - 1];
    if (head && run.text) { const stoks = words(sent); const hi = stoks.indexOf(head), ri = stoks.indexOf(fold(run.text).split(" ")[0]); if (hi >= 0 && ri >= 0 && hi > ri + 2) subjectMissing = true; }
    // VETO, never a trigger: a sentence-initial capital the name-list dropped ("Mars has two small moons…",
    // where namesIn skips the opener) standing at the match's start clears a false miss. It cannot create
    // one — the Trump-won guard above still fires on its own terms.
    if (subjectMissing) {
      const fc = (String(claim).trim().match(/^[\p{Lu}][\p{L}'-]+/u) || [""])[0];
      if (fc && fc.length > 1 && !/^[A-Z][a-z]?$/.test(fc)) {
        const stoks = words(sent); const fi = stoks.indexOf(fold(fc)), ri = stoks.indexOf(fold(run.text).split(" ")[0]);
        if (fi >= 0 && ri >= 0 && fi <= ri + 2) subjectMissing = false;
      }
    }
  }
  const cHead = (() => { const w = words(cnames[0] || "").filter((x) => x.length > 1 && !FW.has(x)); return w.length ? w[w.length - 1] : (String(claim).trim().match(/^[\p{L}'-]+/u) || [""])[0].toLowerCase(); })();
  // A negated sentence that gives a DIFFERENT figure of the same kind ("did not win … in 1900") says nothing against a claim
  // about another event ("won … in 1903"): the figure separates the events, so the polarity is not read across them.
  // A pair-JOINED window mixes two events (the comment on roles above): polarity is read in each sentence ALONE, where the
  // figures of its own event are compared, never across the join.
  // A negation SCOPED to a year the claim never states ("did not win … in 1900" against "won two prizes") limits itself to that
  // time; it denies nothing the claim says about another or no time.
  const scopedNeg = neg(sent) && !neg(claim) && figuresIn(sent).some((f) => f.numeric && !f.unit && /^\d{4}$/.test(f.norm) && f.v >= 1000 && f.v <= 2200) && !cfigs.some((f) => /^\d{4}$/.test(f.norm));
  const polarity = clash.length || joined || scopedNeg ? true : !flipsPolarity(claim, sent, cs, [...ss], around, cHead);
  const about = overlap >= FALSIFY.ABOUT_OVERLAP && shared.length >= 1;
  const close = run.n >= FALSIFY.RUN || (overlap >= FALSIFY.STATE_OVERLAP && shared.length >= Math.min(FALSIFY.STATE_MIN_SHARED, cs.length));
  const role = about && !joined ? roleConfusion(claim, sent, cnames) : null;
  if (TRACE()) console.error("DBG q=" + JSON.stringify(claim.slice(0,40)) + " s=" + JSON.stringify(sent.slice(0,50)) + " about=" + about + " pol=" + polarity + " ov=" + overlap.toFixed(2) + " sh=" + shared.length + " role=" + JSON.stringify(role) + " clashN=" + clash.length);
  // a figure-clash counts only on its own event: the figure's nearest verb is the pair's shared verb.
  // "Fell in 1961" against fell-1989 fires; "born…1879 and died in 1955" against born-1879 does not —
  // the 1955 belongs to another clause (F2 S1 c06/c13 truthful, S2b r01 catches).
  const pairVerb = about ? firstSharedVerb(claim, sent, cnames) : null;
  // figure-clashes, like roles, live in single sentences: a pair-joined text mixes two events, so any
  // figure in it trivially "clashes" with the claim's (F2 S1 c04/c14 truthful). Single sentences only.
  // ... and only between sentences of the SAME polarity: "did not win … in 1900" gives no rival year for "won … in 1903" (it says no
  // event happened then), so a figure read from a negated sentence is not a clash for an affirmed claim, nor the reverse.
  const clashHere = !joined && neg(claim) === neg(sent) ? clash.filter((x) => pairVerb && nearestVerb(claim, x.c.start) === pairVerb) : [];
  if (TRACE() && clash.length) console.error("DBGCL3 pv=" + pairVerb + " nv=" + JSON.stringify(clash.map((x) => [x.c.raw, nearestVerb(claim, x.c.start)])) + " joined=" + joined);
  let verdict = "silent", why = "", kind = null;
  if (TRACE() && about) console.error("DBG role=" + JSON.stringify(role) + " clashN=" + clash.length + " clashHere=" + clashHere.length);
  if (about && !polarity) { verdict = "contradicts"; kind = "polarity"; why = "same subject, opposite polarity"; }
  else if (role && role.confused) { verdict = "contradicts"; kind = "role"; why = role.why; }
  else if (about && clashHere.length) { verdict = "contradicts"; kind = "figure"; why = `gives ${clashHere[0].w.raw} where the claim says ${clashHere[0].c.raw}`; }
  else if (close && !missing.length && !namesMissing.length && !subjectMissing) { verdict = "states"; why = run.n >= FALSIFY.RUN ? `shares the run \u201c${run.text}\u201d` : `${shared.length} of ${cs.length} content words`; }
  else if (close) { verdict = "near"; why = subjectMissing ? `the claim's subject ${cnames[0]} is only the source's object` : missing.length ? `the figure ${missing[0].raw} is not in it` : `the name ${namesMissing[0]} is not near it`; }
  return { verdict, why, kind, overlap, shared: shared.length, runN: run.n, run: run.text, score: run.n * 2 + shared.length + (verdict === "states" ? 100 : verdict === "contradicts" ? 50 : 0) };
}

/** Group passages into independent sources (by domain), each with its sentences. */
export function sourcesOf(passages) {
  const by = new Map();
  for (const p of passages || []) {
    const text = String(p?.text ?? [p?.before, p?.mark, p?.after].filter(Boolean).join(" "));
    if (!text.trim()) continue;
    const url = p.url || p.source || "";
    const key = domainOf(url) || p.ref || url || "source";
    if (!by.has(key)) by.set(key, { key, domain: domainOf(url), url, ref: p.ref || p.label || key, texts: [] });
    const s = by.get(key);
    // a shorter clip of a page already held adds no sentence: keep the fullest copy only
    if (!s.texts.some((t) => t === text || t.includes(text) || text.includes(t))) s.texts.push(text);
  }
  return [...by.values()].map((s) => ({ ...s, sents: s.texts.flatMap(sentencesOf).slice(0, FALSIFY.MAX_SENTS_PER_SOURCE) }));
}

function bestIn(src, claim, cs, cfigs, cnames) {
  let best = null, contraAlt = null;
  const consider = (sent, i, around, joined = false) => {
    const j = judge(claim, cs, cfigs, cnames, sent, around, joined);
    const w = { ...j, sentence: sent, i };
    if (!best || j.score > best.score) best = w;
    // a contradiction buried under a higher-scoring states-witness is still a contradiction (F2 C2/C3:
    // "Canberra is the capital" states while "Canberra is not the largest" contradicts — the best
    // witness must not silence it). Tracked apart so display/swap logic still reads the best.
    if (j.verdict === "contradicts" && (!contraAlt || j.score > contraAlt.score)) contraAlt = { ...w, src: src.key };
  };
  src.sents.forEach((sent, i) => {
    const around = [src.sents[i - 1], sent, src.sents[i + 1]].filter(Boolean).join(" ");
    consider(sent, i, around, false);
    // a claim often joins two adjacent sentences of its source ("X began in 2008, when Y"): judge the pair as one
    const nx = src.sents[i + 1];
    if (nx && sent.length + nx.length < 520) consider(sent + " " + nx, i, around + " " + (src.sents[i + 2] || ""), true);
  });
  const out = best || { verdict: "silent", why: "nothing read from it", score: 0, sentence: "", overlap: 0, shared: 0, runN: 0, run: "" };
  if (contraAlt && contraAlt !== best) out.contraAlt = contraAlt;
  return out;
}

const CALENDAR = /^(?:January|February|March|April|May|June|July|August|September|October|November|December|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/;
/** The names a claim commits to — without a lone capitalised first word ("Quantitative easing began…" names nothing) and without months/days. Exported for the provenance non-claim gate (fold-chat-provenance.js), which needs the same strictness. */
export function namesOf(s) {
  const first = (String(s).trim().match(/^[\p{L}'-]+/u) || [""])[0];
  return namesIn(s).map((n) => n.replace(/^(?:In|On|At|By|From|Since|During|After|Before|The)\s+/u, "").replace(/['’]s$/u, "")).filter((n) => n && !CALENDAR.test(n) && !(n === first && !/\s/.test(n) && !/^\p{Lu}{2,}$/u.test(n)));
}

/** The swap: a competitor of the same kind from the witness's own source, put in place of the claim's figure/name. */
function swapTest(claim, cfigs, cnames, src, witness) {
  const allFigs = src.sents.flatMap((s) => figuresIn(s));
  // a competitor must be a figure the claim does not already contain ("8" in "8 ft 1 in" is not a rival to "246.3 cm")
  const inClaimFigs = figuresIn(claim);
  for (const c of cfigs) {
    const comp = allFigs.find((w) => w.norm !== c.norm && !figureMatches(c, w) && !inClaimFigs.some((k) => k.norm === w.norm || figureMatches(k, w)) && ((c.unit && w.unit && c.unit.dim === w.unit.dim) || (!c.unit && !w.unit && c.norm.length === w.norm.length)));
    if (!comp) continue;
    const swapped = claim.replace(c.raw, comp.raw);
    // judged against the sentence of the witness that carries the claim's figure (a joined pair may carry both figures)
    const core = sentencesOf(witness.sentence).find((x) => figuresIn(x).some((w) => figureMatches(c, w))) || witness.sentence;
    const j = judge(swapped, contentStems(swapped), figuresIn(swapped), cnames, core, core);
    return { armed: true, kind: "figure", from: c.raw, to: comp.raw, discriminates: j.verdict !== "states" };
  }
  // a rival NAME is a name of the same shape: a person for a person (two or more capitalised words), a single word for a
  // single word; never a lone capitalised word that follows an article or sits inside another name ("a Polish physicist",
  // "the Guinness World Records"): an adjective or a fragment is not someone the claim could have been about.
  const capSeq = /(?<![\p{L}])\p{Lu}[\p{L}'’-]+(?:\s+\p{Lu}[\p{L}'’-]+)*/gu;
  const inClaim = new Set(words(claim));
  for (const n of cnames) {
    const multi = /\s/.test(n.trim());
    const pool = new Set();
    // a rival must be someone the claim could have been about: named in ANOTHER sentence of the source, or alongside the
    // original in the stating sentence ("X and Y", "X with Y"). A name in the stating sentence in some other role
    // ("recognised by Guinness World Records") is not a rival, so it can neither pass nor fail the claim.
    const stating = String(witness?.sentence || "");
    const sameSent = (s) => !!stating && (stating.includes(s) || s.includes(stating));
    const alongside = (s, t) => { const a = s.indexOf(n), b = s.indexOf(t); if (a < 0 || b < 0) return false; const lo = a < b ? a + n.length : b + t.length, hi = a < b ? b : a; return /^\s*(?:,|and|or|&|with|,\s*and|and\s+also)\s*$/i.test(s.slice(lo, hi)); };
    for (const s of src.sents) for (const m of s.matchAll(capSeq)) {
      const t = m[0].replace(/['’]s$/u, ""), before = s.slice(Math.max(0, m.index - 4), m.index).toLowerCase();
      if (m.index === 0 && !/\s/.test(t)) continue;                                   // a sentence's first word is capitalised by position
      if (/\b(?:a|an|the)\s$/.test(before)) continue;                                 // an article: an adjective or a role, not a name
      if (/\s/.test(t) !== multi) continue;                                           // same shape as the claim's name
      if (stating.includes(t) && !alongside(stating, t)) continue;                    // in the stating sentence only as a different role
      pool.add(t);
    }
    const comp = [...pool].find((x) => !inClaim.has(fold(x)) && !words(x).some((w) => inClaim.has(w)) && !FW.has(fold(x)) && !CALENDAR.test(x));
    if (!comp) continue;
    const swapped = claim.replace(n, comp);
    const j = judge(swapped, contentStems(swapped), figuresIn(swapped), namesOf(swapped), witness.sentence, witness.sentence);
    return { armed: true, kind: "name", from: n, to: comp, discriminates: j.verdict !== "states" };
  }
  return { armed: false };
}

/** Split a compound claim at coordinating conjunctions so a sentence whose clauses a source states in DIFFERENT
 *  sentences can still hold — but never split a bare list ("Michigan and Wisconsin" stays one clause). */
export function clausesOf(s) {
  const text = String(s).trim();
  const parts = text.split(/\s*;\s*|\s+(?:but|whereas)\s+|\s+and\s+(?=\S+(?:\s+\S+){3,})/u).map((x) => x.trim()).filter((x) => x.length >= 12);
  return parts.length >= 2 ? parts : [text];
}

/** Falsify an answer. `sentences`: the answer's sentences (strings). `passages`: everything read ({ text | before/mark/after, url, ref }). */
export function falsifyAnswer(sentences, passages) {
  const sources = sourcesOf(passages);
  const claims = (sentences || []).map((raw, i) => {
    const s = String(raw ?? "").trim();
    const cs = contentStems(s), cfigs = figuresIn(s), cnames = namesOf(s);
    const per = sources.map((src) => {
      const b = bestIn(src, s, cs, cfigs, cnames);
      if (b.verdict !== "states") {
        // a compound claim whose every clause a source states (in different sentences) is stated by that source
        const cl = clausesOf(s);
        if (cl.length > 1) {
          const each = cl.map((c) => bestIn(src, c, contentStems(c), figuresIn(c), namesOf(c)));
          if (each.every((x) => x.verdict === "states")) return { src: src.key, ...b, verdict: "states", why: "every clause is stated", clauseSupport: true };
        }
      }
      return { src: src.key, ...b };
    });
    // independence: two sources whose stating sentences share a long run are one chain (syndicated copy)
    const states = per.filter((w) => w.verdict === "states");
    const chains = [];
    for (const w of states) { const c = chains.find((ch) => longestRun(ch[0].sentence, w.sentence).n >= FALSIFY.SYNDICATED_RUN); if (c) { c.push(w); w.sameChainAs = c[0].src; } else chains.push([w]); }
    const contra = per.filter((w) => w.verdict === "contradicts");
    const contraBuried = per.filter((w) => w.verdict !== "contradicts" && w.contraAlt);
    const lead = states[0] ? sources.find((x) => x.key === states[0].src) : null;
    const swap = lead && !states[0].clauseSupport ? swapTest(s, cfigs, cnames, lead, states[0]) : { armed: false };
    let verdict;
    if (!cs.length && !cfigs.length) verdict = "n/a";
    else if (contra.length || contraBuried.length) verdict = "contested";
    else if (states.length && swap.armed && !swap.discriminates) verdict = "weak";
    else if (chains.length >= 2) verdict = "corroborated";
    else if (chains.length === 1) verdict = "held";
    else if (per.some((w) => w.verdict === "near")) verdict = "weak";
    else verdict = "unsupported";
    return { i, s, figures: cfigs.map((f) => f.raw), names: cnames, witnesses: per, chains: chains.length, contradictions: contra.length, swap, verdict };
  });
  const count = (v) => claims.filter((c) => c.verdict === v).length;
  const scored = claims.filter((c) => c.verdict !== "n/a");
  return {
    sources: sources.map((s) => ({ key: s.key, domain: s.domain, url: s.url, ref: s.ref, sentences: s.sents.length })),
    claims,
    summary: { claims: scored.length, corroborated: count("corroborated"), held: count("held"), weak: count("weak"), contested: count("contested"), unsupported: count("unsupported"),
      backed: count("corroborated") + count("held"), swapsArmed: claims.filter((c) => c.swap.armed).length, swapsFailed: claims.filter((c) => c.swap.armed && !c.swap.discriminates).length,
      cleared: scored.length > 0 && scored.every((c) => c.verdict === "corroborated" || c.verdict === "held") },
  };
}

// ───────── THE REC LOOP's helpers: where a failing claim goes back to, and what the restatement may see ─────────
export const FAILING = new Set(["unsupported", "contested", "weak"]);
export const claimSentences = (text) => sentencesOf(text);
/** REC → INS: recall a failing claim against the FULL pages already read (each admitted as a shadow Field, relative.js,
 *  by impressionOf) and take a new impression of each page FOR THE CLAIM. Only sentences the claim recalls above the
 *  page's own null band, that reach something the first impression did not carry, come back. Returns new passages
 *  (with their shadows: byte ranges in the original page) — nothing when the page holds nothing more about it. */
export function reImpress(claim, pages, { budget = 1400 } = {}) {
  const out = [];
  for (const pg of pages || []) {
    const page = String(pg?.text ?? pg?.page ?? "");
    if (page.length < 200) continue;
    let e; try { e = impressionOf(page, claim, { budget, lead: false }); } catch { continue; }
    if (!e || !e.text || !e.shadow || !(e.shadow.recalled > 0) || e.shadow.kept >= page.length) continue;
    const had = new Set((pg.shadow?.segments || []).map((g) => g.start + ":" + g.end));
    const fresh = (e.shadow.segments || []).filter((g) => !had.has(g.start + ":" + g.end));
    if (!fresh.length) continue;
    out.push({ ref: pg.ref, url: pg.url, source: pg.url, text: e.text, via: "re-impression", shadow: e.shadow, forClaim: claim.slice(0, 160) });
  }
  return out;
}

/** The search a failing claim sends the turn back with: the claim's own names, figures and content words. */
export function claimQuery(s) {
  const toks = String(s ?? "").match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) || [];
  return toks.filter((w) => !FW.has(fold(w)) && w.length > 1).slice(0, 10).join(" ");
}
/** REC routes each failing claim back to the operator where it failed: first INS (the full pages already read, recalled
 *  for the claim), then SIG (a new search with the claim as the query) for what the pages do not hold. */
export function routeOf(c) {
  const why = c.verdict === "contested" ? "a source contradicts it \u2014 two cannot settle it, so a third, independent source"
    : c.verdict === "weak" ? (c.swap?.armed && !c.swap.discriminates ? `the evidence does not tell \u201c${c.swap.from}\u201d from \u201c${c.swap.to}\u201d \u2014 a sharper sentence` : "close, but a figure or name is missing \u2014 a sentence that states all of it")
    : "no kept passage states it \u2014 look in the whole pages, then search with the claim itself";
  return { op: "INS", why, query: claimQuery(c.s) };
}
/** The passages most about a claim (content-word overlap), clipped, for the restatement. */
export function pickPassages(claim, passages, n = 4) {
  const cs = new Set(contentStems(claim));
  return (passages || []).map((p) => ({ p, k: contentStems(p.text).filter((x) => cs.has(x)).length })).filter((x) => x.k >= 2)
    .sort((a, b) => b.k - a.k).slice(0, n).map((x) => ({ ref: x.p.ref, url: x.p.url || x.p.source, text: String(x.p.text || "").slice(0, 1500) }));
}
/** The SYN step of a lap: restate ONE sentence from the passages, or say NONE. */
export function restateClaimMessages(sentence, passages) {
  return [
    { role: "system", content: "You restate one sentence so that the passages below state it. Use only what the passages say; keep every figure and name a passage gives exactly as written. Reply with the one sentence only, in the same language as the sentence. If the passages support no version of it, reply exactly: NONE" },
    { role: "user", content: passages.map((p, i) => `[${i + 1}] ${p.text}`).join("\n\n") + `\n\nSentence: ${sentence}` },
  ];
}
/** Replace a sentence in a text even when the text's whitespace differs from the sentence's. */
export function replaceSentence(text, from, to) {
  const esc = String(from).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const re = new RegExp(esc);
  return re.test(text) ? String(text).replace(re, () => to) : text;
}

/** Everything a turn's record says it read, as passages: the kept passages on the tape, the facing page's spans, the material. */
export function passagesOfRecord(rec) {
  const out = [];
  // the stored passages first: they are the FULLEST copy (3000 chars, D1 store-shadow), so the cross-check judges against
  // the page the turn actually read — not only the 900-char tape clip, which silently dropped a true sentence's support
  for (const p of rec?.passages || []) if (p && p.text) out.push({ text: p.text, url: p.url || p.source, ref: p.ref });
  for (const e of rec?.tape || []) if (e && e.kind === "quick" && e.p) out.push({ text: e.p.text, url: e.p.url, ref: e.p.ref });
  for (const s of rec?.facing?.sources || []) out.push({ before: s.before, mark: s.mark, after: s.after, url: s.url, ref: s.ref || s.label });
  for (const m of rec?.material || []) if (m && m.text) out.push({ text: m.text, url: m.url || m.source, ref: m.ref });
  return out;
}
