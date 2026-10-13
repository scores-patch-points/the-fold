// fold-chat-frame.js — the question frame, shed before an encyclopedia is asked. Pure: no DOM, no IO, no model.
//
// Measured 2026-10-05 (eval/falsify/query-frame.mjs and by hand): Wikipedia's search matches TITLES on the question's frame words.
// "Who is the king of the UK?" ranks The Kid Who Would Be King, The Who and The Man Who Would Be King first and
// Monarchy of the United Kingdom fifth; "king of the UK" ranks it first. The frame ("Who is the", "What is the", "Does a") is closed-class
// words that name nothing, so it is cut from the FRONT of the ask using the language's own function-word prior (the khora's committed
// set, fold-chat-snippets.js functionWordsOf) — never a hand-typed English list. A language with no prior is returned unchanged (a typed
// gap, not a guess). The person's own words are never rewritten: the stripped form is only a SEARCH query, and the turn feed shows it.

const tokens = (q) => String(q ?? "").match(/[\p{L}\p{N}'’.-]+|[^\p{L}\p{N}\s]+/gu) || [];

/** Drop the leading run of function words (and the trailing '?'), keeping at least one content word. Returns the ask unchanged when
 *  there is no prior, nothing to cut, or cutting would leave nothing. `fw`: a Set of case-folded function words, or null. */
import { salienceOf } from "./fold-chat-salience-infer.js";
/** The received POSPrior's rank of a form (UD English-EWT via the salience prior: PROPN 9, NOUN 7, VERB 6, ADJ 4, ADV 1), or null when
 *  the prior has not seen it. One door for every module that reads a form's usual part of speech. */
export function posRankOf(form) { const v = salienceOf(form); return v == null ? null : Math.round(v * 9); }
export function stripFrame(question, fw) {
  const q = String(question ?? "").trim();
  if (!q || !(fw instanceof Set) || !fw.size) return q;
  const isFw = (w) => fw.has(String(w).toLowerCase().replace(/[^\p{L}\p{N}']/gu, ""));
  const asked = /[?¿]\s*$/u.test(q);
  const t = q.replace(/[?!¿¡]+\s*$/u, "").trim().split(/\s+/);
  // Only a QUESTION has a frame: "The Who albums" is a name and a noun, not a frame and a topic.
  if (!asked || t.length < 3) return q;
  let i = 0;
  while (i < t.length - 1 && isFw(t[i])) i++;
  if (i === 0) return q;                                   // nothing to cut: the ask is returned exactly as said
  const rest = t.slice(i);
  if (!rest.some((w) => !isFw(w))) return q;               // what would be left names nothing ("Who are The Who?" must not become "Who")
  return rest.join(" ");
}

// ══ askFrame — the GRAMMAR of the ask (docs/ANSWER-PIPELINE.md, stage "parse the grammar of the ASK") ═══════════════════════
// Pure but for the injected `resolveTitles` (one network call, injectable): no DOM, no model, no clock.
//
//   askFrame(question, { fw, lang, resolveTitles }) → Promise<Frame>      (async only because resolving titles asks the network)
//   Frame = { ok, lang, said, slot, referents:[{surface,title,aliases}], predicate:[{surface,stem}], gap }
//
// How the ask is read (no capital letter is read anywhere; the entity is whatever a TITLE resolves to):
//   1. The SLOT comes from a DECLARED per-language interrogative table (GRAMMAR below). A language with no table, or with no
//      function-word prior, is the typed gap `no_grammar_for_language` — never an English guess.
//   2. The interrogative phrase ("who", "what year", "how many") is cut from the front; the rest of the ask is walked for every
//      contiguous run of at most 4 tokens whose EDGES are content words (function words may sit inside a run, never at its edges;
//      a run never crosses punctuation). ALL candidate runs go to `resolveTitles` in ONE call.
//   3. The longest resolving, non-overlapping runs are the referents; a disambiguation page names no one thing and is not a
//      referent. A run of two or more content words resolves only when its title AGREES with it (shares a content stem) — see
//      `agrees`: measured live on 2026-10-06, "capital of Australia" redirects to Canberra and "king of the UK" to Monarchy of the
//      United Kingdom, which would swallow the role word into the referent and lose it from every sentence that states it.
//   4. What is left and is not a function word is the predicate.
//   Gaps: referents_unresolved (nothing resolved, or the title service could not be asked), frame_unread (no content word survives:
//   "Who are The Who?" has only function words once "who" is cut, so it is drawn as a gap, never as an empty frame).
//   A question that is not a slot ask at all is { ok:false, slot:null, gap:null } and costs no network call.
//
// DECLARED, not measured (Constitution II.11) — the giver of every table below is the AUTHOR's reading of English (2026-10-06), written
// before any measurement; the integrator may reverse any entry. Only English has a table today. Adding a language is adding a
// table here with its own named giver; a language without one gets a typed gap, not a fall-through to English.
export const GRAMMAR = Object.freeze({
  en: Object.freeze({
    giver: "the author's reading of English wh-words, 'how many/much', 'what year/date/time', copulas, auxiliaries, negators and cardinal numerals (2026-10-06); declared, not measured",
    // longest phrase first at lookup; a phrase may be preceded by ONE function word ("in what year")
    interrogatives: Object.freeze([
      { words: ["how", "many"], slot: "quantity" }, { words: ["how", "much"], slot: "quantity" },
      { words: ["what", "year"], slot: "time" }, { words: ["which", "year"], slot: "time" }, { words: ["what", "date"], slot: "time" }, { words: ["what", "time"], slot: "time" },
      { words: ["who"], slot: "person" }, { words: ["whom"], slot: "person" },
      { words: ["where"], slot: "place" }, { words: ["when"], slot: "time" },
      { words: ["what"], slot: "thing" }, { words: ["which"], slot: "thing" },
    ]),
    copulas: Object.freeze(["is", "are", "am", "was", "were"]),
    // closed class the khora's function-word prior does not carry (it lacks "have", "had"); never a referent, never a predicate
    auxiliaries: Object.freeze(["is", "are", "am", "was", "were", "be", "been", "being", "has", "have", "had", "do", "does", "did", "will", "shall"]),
    tense: Object.freeze({ present: ["is", "are", "am", "has", "have"], past: ["was", "were", "had"], future: ["will", "shall"] }),
    negation: Object.freeze(["not", "no", "never", "none", "nor", "neither", "nothing", "nobody", "cannot"]),   // plus any token ending n't
    clauseWords: Object.freeze(["who", "which", "since", "that", "having"]),
    // ROLES (2026-10-12): "the capital OF Australia" — X of Y makes X an ATTRIBUTE of the anchor Y; "Australia's capital" likewise.
    governs: Object.freeze(["of"]),
    // a passive AGENT ("was discovered by the physician Alexander Fleming at St Mary's") runs from "by" to the first of these
    agentBy: "by",
    agentStops: Object.freeze(["in", "on", "at", "during", "between", "from", "since", "until", "around", "about", "for", "with", "after", "before", "under", "near"]),
    // THE ARCHON PANEL (2026-10-13; giver: the author's reading of English closed classes, declared, not measured):
    // determiners — the ONLY words that may stand between a relation verb and its object ("painted THE Mona Lisa"; never "wrote ABOUT")
    determiners: Object.freeze(["the", "a", "an", "this", "that", "these", "those", "his", "her", "its", "their", "our", "my", "your"]),
    // stance — a sentence that only MIGHT, IF, ALLEGEDLY or by LEGEND says so is not a witness (Roberts, Scheherazade, Wigmore: MF2)
    hedges: Object.freeze(["might", "may", "could", "would", "if", "unless", "whether", "perhaps", "possibly", "reportedly", "allegedly", "supposedly", "rumoured", "rumored", "legend", "myth", "claimed", "claims", "believed"]),
    // ordinals — "the SECOND largest" is not the largest (Shizhen: MF16)
    ordinals: Object.freeze(["second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "next"]),
    // coordinators — an agent run ends at the first of these ("by Alexander Fleming AND Howard Florey": MF3/MF4)
    coordinators: Object.freeze(["and", "or", "nor", "but"]),
    numerals: Object.freeze(["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety", "hundred", "thousand", "million", "billion", "trillion"]),
    magnitudes: Object.freeze(["hundred", "thousand", "million", "billion", "trillion"]),
    year: Object.freeze({ minDigits: 3, maxDigits: 4 }),                   // a "year" is a bare run of 3–4 digits ("2 September" is a day)
    maxRun: 4,
  }),
});

/** Case- and diacritic-folded form for matching only (never displayed). Locale-neutral lowercasing; no case is ever READ. */
import { foldText } from "./fold-chat-foldtext.js";   // the khora's fold scope (II.13)
export const caseless = (s) => foldText(s);

/** DECLARED ask-side abbreviations (2026-10-11; giver: the author's reading of English, declared not measured):
 *  "us" is a function word in the closed-class prior, so "who is the US president" can never frame — the referent
 *  is eaten before it resolves. A small table expands the country names in the ASK before the frame reads it.
 *  REFUTED ONLY WHEN MISAPPLIED: "tell us who is the president" must NOT become "tell United States who…" —
 *  an abbreviation is expanded only in a question whose previous token is a function word / preposition
 *  ("the us", "of the us", "in the us", "is the us") — never after a verb. */
export const ABBREVIATIONS = Object.freeze({
  us: "United States", "u.s": "United States", "u.s.": "United States", usa: "United States",
});
const EXPAND_STOP = Object.freeze(new Set(["tell", "let", "ask", "give", "show", "teach", "help", "name", "summarize", "summarise", "read", "write"]));
// Where an abbreviation REALLY sits: after a determiner/preposition ("the us",
// "of the us", "in the us") or directly before a NOUN-like word ("us
// president"). NEVER after "for/to/with/and" (the pronoun "us": "for us to
// agree", "you and us") and never before a verb/infinitive ("us to run").
const EXPAND_AFTER = Object.freeze(new Set(["the", "of", "in", "at"]));
const EXPAND_BEFORE_NOT = Object.freeze(new Set([
  "to", "and", "or", "but", "is", "are", "am", "was", "were", "be", "been", "has", "have", "had",
  "will", "would", "should", "can", "could", "may", "might", "do", "does", "did", "not", "it", "they", "we", "you",
  "today", "news", "times", "magazine", "post", "weekly", "daily", "monthly",
]));
export function expandAskAbbreviations(question) {
  const q = String(question ?? "").trim();
  const asked = /[?¿]\s*$/u.test(q) || /^\s*(?:who|what|where|when|which|whose|why|how)\b/i.test(q);
  if (!asked) return q;
  const toks = tokensOf(q);
  const safeAt = (i) => {
    const t = toks[i];
    const repl = ABBREVIATIONS[t.fold];
    if (!repl) return false;
    const prevFold = i > 0 ? String(toks[i - 1].text).toLowerCase().replace(/[^\p{L}\p{N}']/gu, "") : null;
    const nextFold = i + 1 < toks.length ? String(toks[i + 1].fold).toLowerCase() : null;
    // the pronoun "us" ("for us to agree", "you and us") never expands: only a
    // determiner/preposition before ("the US", "of the US") or a noun-like word
    // after ("US president") licenses the abbreviation.
    const after = prevFold ? EXPAND_AFTER.has(prevFold) : false;
    const before = nextFold ? !EXPAND_BEFORE_NOT.has(nextFold) : false;
    return !(prevFold && EXPAND_STOP.has(prevFold)) && (after || before);
  };
  // SPAN SUBSTITUTION: replace only the token's own bytes, so the question's
  // punctuation and casing survive byte-for-byte ("USSR?", "the US —").
  let out = q;
  for (let i = toks.length - 1; i >= 0; i--) {
    const t = toks[i];
    if (!safeAt(i)) continue;
    out = out.slice(0, t.start) + ABBREVIATIONS[t.fold] + out.slice(t.end);
  }
  return out;
}

// Tokens with UTF-16 offsets. A token is letters/digits joined by . ' ’ , - (so "U.S.", "1,082", "air-breathing", "doesn't" stay whole);
// a possessive or contracted tail ('s 're 'll 've 'd 'm) is cut off — it is a clitic, not a word — so "Australia's" is the token "Australia".
const WORD = /[\p{L}\p{N}]+(?:[.'’,-][\p{L}\p{N}]+)*/gu;
const CLITIC = /['’](?:s|re|ll|ve|d|m)$/iu;
export function tokensOf(text) {
  const s = String(text ?? ""), out = [];
  let m; WORD.lastIndex = 0;
  while ((m = WORD.exec(s)) !== null) {
    let end = m.index + m[0].length, t = m[0];
    if (s[end] === "." && t.includes(".")) { end++; t += "."; }              // "U.S." keeps its closing dot; "end." does not
    else if (CLITIC.test(t) && t.length > 3) { t = t.replace(CLITIC, ""); end = m.index + t.length; }
    out.push({ text: t, start: m.index, end, fold: caseless(t) });
  }
  return out;
}

// A light English stemmer, DECLARED (giver: the author's reading of English inflection): -ies→-y, -ing, -ed, -s (not -ss/-us/-is) with a
// floor on what is left. It only has to make "ended/ends/ending" meet "end" and "legs" meet "leg"; irregular forms ("began") do not
// meet their root, which is a limit, not a bug. Applied to BOTH sides of every comparison, so a collision is symmetric.
export function stemOf(fold, lang = "en") {
  const w = String(fold ?? "");
  if (lang !== "en" || /\p{N}/u.test(w)) return w;
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length >= 6 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length >= 5 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length >= 4 && w.endsWith("s") && !/(?:ss|us|is)$/.test(w)) return dropE(w.slice(0, -1));
  return dropE(w);
}
// the base of an -e verb meets its -ed/-ing forms (the archon panel, MF10): "compose" ~ "composed" ~ "composing" are all "compos"; only
// past four letters, so "rose", "made", "rate" keep their e
function dropE(w) {
  return w.length > 4 && w.endsWith("e") && !w.endsWith("ee") ? w.slice(0, -1) : w;
}

/** The closed-class test for a language: the khora's function words, plus the declared auxiliaries, negators and any "n't" token. */
export function closedClassOf(fw, lang = "en") {
  const G = GRAMMAR[lang];
  const extra = new Set(G ? [...G.auxiliaries, ...G.negation] : []);
  const set = fw instanceof Set ? fw : new Set();
  return (fold) => set.has(fold) || extra.has(fold) || /n['’]t$/.test(fold);
}

const gapFrame = (said, lang, slot, kind) => ({ ok: false, lang: lang ?? null, said, slot, referents: [], predicate: [], gap: { kind } });

// "capital of Australia" → Canberra shares no content word with the run, so it is a rename, not an agreement; "UK" → United Kingdom is
// a one-word run (nothing to agree about) and "World War 2" → World War II agrees on "world" and "war".
function agrees(surfaceToks, res, closed, lang) {
  const content = surfaceToks.filter((t) => !closed(t.fold));
  if (content.length < 2) return true;
  const have = new Set(tokensOf(res.title).map((t) => stemOf(t.fold, lang)));
  return content.some((t) => have.has(stemOf(t.fold, lang)));
}

const aliasesOf = (surface, res) => {
  const seen = new Set(), out = [];
  for (const a of [surface, res.title, String(res.title).replace(/\s*\([^)]*\)\s*$/u, ""), res.redirectedFrom]) {
    const s = typeof a === "string" ? a.trim() : "";
    if (s && !seen.has(caseless(s))) { seen.add(caseless(s)); out.push(s); }
  }
  return out;
};

/** Read the grammar of an ask. Never throws: every failure is a typed gap on the returned Frame. */
export async function askFrame(question, { fw = null, lang = null, resolveTitles = null } = {}) {
  const said = String(question ?? "");
  const G = lang ? GRAMMAR[lang] : null;
  if (!G || !(fw instanceof Set) || !fw.size) return gapFrame(said, lang, null, "no_grammar_for_language");
  const closed = closedClassOf(fw, lang);
  const toks = tokensOf(said);

  // 1. the interrogative phrase, at the front (after at most one function word: "in what year")
  const phrases = [...G.interrogatives].sort((a, b) => b.words.length - a.words.length);
  let cut = -1, slot = null;
  for (const at of [0, 1]) {
    if (at === 1 && !(toks[0] && closed(toks[0].fold))) break;
    const hit = phrases.find((p) => p.words.every((w, k) => toks[at + k]?.fold === w));
    if (hit) { slot = hit.slot; cut = at + hit.words.length; break; }
  }
  if (!slot) return { ok: false, lang, said, slot: null, referents: [], predicate: [], gap: null };   // not a slot ask: today's path

  // 2. what is left must hold a content word, or the frame is unread
  const rest = toks.slice(cut);
  if (!rest.some((t) => !closed(t.fold))) return gapFrame(said, lang, slot, "frame_unread");

  // candidate runs: <= maxRun tokens, content words at both edges, whitespace-only between tokens (never across punctuation)
  const gapless = (a, b) => /^\s+$/.test(said.slice(rest[a].end, rest[b].start));
  const runs = [];
  for (let i = 0; i < rest.length; i++) {
    if (closed(rest[i].fold)) continue;
    for (let j = i; j < rest.length && j - i < G.maxRun; j++) {
      if (j > i && !gapless(j - 1, j)) break;
      if (closed(rest[j].fold)) continue;
      runs.push({ i, j, surface: said.slice(rest[i].start, rest[j].end) });
    }
  }
  // THE ASK'S RELATION IS NOT A REFERENT (battery 2026-10-12): "who WROTE Hamlet" and "the LARGEST planet" ask for a relation, and a
  // title door that happens to resolve the bare verb or superlative ("Wrote", "Largest") used to swallow it into a referent, which
  // emptied the predicate, so ANY sentence that mentioned Hamlet then "witnessed" a filler (Ophelia, Polonius, "silence"). The
  // received POSPrior (UD English-EWT, via the salience prior: PROPN 9, NOUN 7, VERB 6, ADJ 4, ADV 1) says what a form usually IS.
  // A single token that is usually a verb, adjective or adverb is never a referent on its own; a run that BEGINS with a
  // verb-dominant token ("wrote Hamlet") is not one either. Multi-word names ("Prime Minister of Canada") are untouched.
  const posRank = (t) => { const v = salienceOf(t.text); return v == null ? null : Math.round(v * 9); };
  // POSITION DECIDES, THE PRIOR ONLY BREAKS TIES (the archon panel, 2026-10-13: MF6, MF7). A token is the ask's RELATION when it sits
  // where English puts the verb of a wh-question — the first content word after the wh-phrase with no copula before it ("who WROTE
  // Hamlet", "who PENNED Hamlet", whatever the prior knows of it). A token in ARGUMENT position — after a copula ("where is NICE",
  // "who is HOPE Solo", "where are the COOK Islands") or after the relation verb ("who directed UP") — is never vetoed: there a name
  // is a name. Everywhere else the received prior decides as before: a lone verb/adjective/adverb that modifies a following word
  // ("the LARGEST planet") is not an entity.
  const copulaAt = rest.findIndex((t) => G.copulas.includes(t.fold));
  const firstContent = rest.findIndex((t) => !closed(t.fold));
  // where the relation sits: "who WROTE Hamlet" (wh + verb) — the first content word; "when DID the Titanic SINK", "what year did World
  // War 2 END" (do-support) — the LAST content word, the subject between is an argument; "how many LEGS does a spider have" — the first
  // content word is the counted noun, not a relation; after a copula there is no relation position.
  const DO = new Set(["do", "does", "did"]);
  const lastContent = (() => { for (let k = rest.length - 1; k >= 0; k--) if (!closed(rest[k].fold)) return k; return -1; })();
  const relPos = slot === "quantity" || firstContent < 0 || (copulaAt >= 0 && copulaAt < firstContent) ? -1
    : rest.slice(0, firstContent).some((t) => DO.has(t.fold)) ? (lastContent > firstContent ? lastContent : -1)
    : firstContent;
  const afterCopula = (k) => copulaAt >= 0 && k > copulaAt && rest.slice(copulaAt + 1, k).every((t) => closed(t.fold));
  const doSupport = relPos >= 0 && rest.slice(0, firstContent).some((t) => DO.has(t.fold));
  const afterRelation = (k) => relPos >= 0 && (doSupport ? k < relPos && k >= firstContent : k > relPos);
  const nextContent = (k) => rest.slice(k + 1).some((t) => !closed(t.fold));
  const argument = (r) => afterRelation(r.i) || (afterCopula(r.i) && (r.i !== r.j || !nextContent(r.i)));
  const eligible = (r) => {
    if (r.i === relPos) return false;                                         // the relation itself, never an entity
    if (argument(r)) return true;                                             // a name in argument position stays a name
    return r.i === r.j ? !(posRank(rest[r.i]) != null && posRank(rest[r.i]) <= 6) : posRank(rest[r.i]) !== 6;
  };
  for (let k = runs.length - 1; k >= 0; k--) if (!eligible(runs[k])) runs.splice(k, 1);
  // Disclosed (MF6, "who directed UP?"): a title made only of function words is never a referent — the declared doctrine pinned by
  // fold-chat-frame.test.mjs ("a function word is never a referent and never a predicate") outranks the panel's case.
  const candidates = [...new Set(runs.map((r) => r.surface))];

  // 3. ONE call; any failure is a gap, not a throw
  let table = null;
  try { table = typeof resolveTitles === "function" ? await resolveTitles(candidates.slice()) : null; } catch { table = null; }
  const lookup = table instanceof Map ? (k) => table.get(k) : null;
  if (!lookup) return gapFrame(said, lang, slot, "referents_unresolved");

  // 4. the longest resolving non-overlapping runs
  const taken = new Set(), chosen = [];
  const order = [...runs].sort((a, b) => (b.j - b.i) - (a.j - a.i) || a.i - b.i);
  for (const r of order) {
    let overlaps = false; for (let k = r.i; k <= r.j; k++) if (taken.has(k)) overlaps = true;
    if (overlaps) continue;
    const res = lookup(r.surface);
    if (!res || typeof res.title !== "string" || !res.title || res.disambiguation) continue;
    if (!agrees(rest.slice(r.i, r.j + 1), res, closed, lang)) continue;
    for (let k = r.i; k <= r.j; k++) taken.add(k);
    chosen.push({ at: r.i, to: r.j, referent: { surface: r.surface, title: res.title, aliases: aliasesOf(r.surface, res) } });
  }
  if (!chosen.length) return gapFrame(said, lang, slot, "referents_unresolved");
  chosen.sort((a, b) => a.at - b.at);

  // 4b ── ANCHORS and ATTRIBUTES (2026-10-12, the operator: "are we using referents correctly?"). A referent is an ANCHOR: the entity
  //        the answer is about. A run the anchor GOVERNS is an ATTRIBUTE of it, not a second entity: "the CAPITAL of Australia",
  //        "Australia's CAPITAL", "how many LEGS does a spider have". An attribute must still be said by a witnessing sentence, but it
  //        is never read as a page, never an alias, and never carried to a follow-up as a thing. Structural, from the ask's own
  //        connectors (GRAMMAR.governs, the possessive clitic, the counted noun) — never a list of attribute words.
  const governs = new Set(G.governs || []);
  const possessorEnds = new Set();
  rest.forEach((t, k) => { if (/^['’]s\b/u.test(said.slice(t.end, t.end + 3))) possessorEnds.add(k); });
  const k0 = rest.findIndex((t) => !closed(t.fold));
  const isAttr = (c, n) => {
    const after = rest[c.to + 1];
    if (after && governs.has(after.fold) && chosen.some((d, m) => m !== n && d.at > c.to + 1 && rest.slice(c.to + 2, d.at).every((t) => closed(t.fold)))) return true;
    if (chosen.some((d, m) => m !== n && possessorEnds.has(d.to) && c.at === d.to + 1)) return true;
    if (slot === "quantity" && c.at === k0 && chosen.length > 1) return true;
    return false;
  };
  const attrIdx = new Set(chosen.map((c, n) => (isAttr(c, n) ? n : -1)).filter((n) => n >= 0));
  if (attrIdx.size === chosen.length) attrIdx.clear();            // nothing left to be about: the ask has no anchor, keep today's reading
  const attributes = chosen.filter((c, n) => attrIdx.has(n)).map((c) => {
    const toksA = rest.slice(c.at, c.to + 1).filter((t) => !closed(t.fold));
    return { surface: c.referent.surface, stems: toksA.map((t) => stemOf(t.fold, lang)) };
  });
  const anchorsChosen = chosen.filter((c, n) => !attrIdx.has(n));

  // 5. the leftover content words are the predicate
  const predicate = [], seen = new Set();
  rest.forEach((t, k) => {
    if (taken.has(k) || closed(t.fold)) return;
    const stem = stemOf(t.fold, lang);
    // `rel`: the received POSPrior says this form is usually a verb, adjective or adverb — the ask's RELATION ("wrote", "largest",
    // "discovered", "current"), as opposed to a leftover noun ("solar", "system") that merely narrows a referent.
    // `name`: a leftover the prior ranks as a name or does not know, in argument position — an unresolved NAME of the ask ("Zelda" in
    // "where was Zelda born"), which a witness must say; dropping it let any "X was born in France" answer (the archon panel, MF20).
    const rk = posRank(t);
    const isRel = k === relPos || (rk != null && rk <= 6) || (rk == null && nextContent(k) && !afterRelation(k) && !afterCopula(k));
    const isName = !isRel && (rk == null || rk >= 8);
    if (!seen.has(stem)) { seen.add(stem); predicate.push({ surface: t.text, stem, ...(isRel ? { rel: true } : {}), ...(isName ? { name: true } : {}) }); }
  });
  // "how MANY legs …": the number must belong to the counted noun (the first content word after the interrogative), never to a
  // neighbouring noun ("52,075 SPECIES") — the witness reads this (fold-chat-witness.js nearestNumber).
  let counted = null;
  // whether or not the counted noun resolves as a page (the archon panel, MF15: "how many WINGS does a bee have")
  if (slot === "quantity" && k0 >= 0) counted = { stem: stemOf(rest[k0].fold, lang), surface: rest[k0].text };
  return { ok: true, lang, said, slot, referents: anchorsChosen.map((c) => c.referent), attributes, predicate, counted, gap: null };
}
