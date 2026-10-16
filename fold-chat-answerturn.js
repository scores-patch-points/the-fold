// fold-chat-answerturn.js — the WHOLE answer pipeline for a slot ask, as one injectable async function (docs/ANSWER-PIPELINE.md).
// No DOM, no globals, no clock reads, NO MODEL: the answer is read, reasoned over and realised mechanically. Everything that touches the
// outside world arrives in `deps` (so a test hands it stubs, and the chat hands it the real ones):
//
//   runAnswerTurn({ question, lang, passages, now, deps }) → Promise<AnswerTurn@1 | { handoff: { kind, why } }>
//     question  the person's words, exactly as said (never rewritten)
//     lang      'en' | { code, by } | undefined (then fold-chat-lang detectLang reads it; a language it cannot name has no grammar)
//     passages  [{ ref, title, url, host, lang, text }]  what the chat has already read
//     now       a Date | { year } | a year number — passed to the probes; with none, every date check is 'unmeasured'
//     deps      { fw, resolveTitles, fetchLead, searchPassages, signal }
//                 fw              Set of function words for `lang` (or a function lang → Set | null)        — fold-chat-snippets functionWordsOf
//                 resolveTitles   (candidates[]) → Promise<Map<string, {title,redirectedFrom,disambiguation} | null>>   — fold-chat-titles
//                 fetchLead       (query, { signal }) → Promise<{ title, extract, url } | null>             — the lead of the page the query names
//                 searchPassages  (frame, { signal }) → Promise<passages[]>   ONE widening read of the pages the names resolve to
//                 signal          AbortSignal; an aborted turn comes back partial with aborted:true and NO answer
//
// The stages (the user's words in brackets):
//   1 [parse the grammar of the ask]  askFrame. Not a slot ask, or a typed frame gap (no_grammar_for_language / frame_unread /
//                                      referents_unresolved)  →  { handoff }: the chat runs today's path UNCHANGED.
//   2 [parse the grammar of the passage] bind every sentence of every passage into rows. Only T1 rows witness anything.
//   3 [what fills the slot]           a T1 row whose filler is a NAME (the filler resolves by title; a filler that is no page is not a name).
//                                      None → ONE widening read (deps.searchPassages) recorded as an event; still none → gap `unwitnessed`
//                                      (or `unreached` when nothing at all could be read). The turn ends there: the model is barred.
//   4 [is it the CURRENT one]         a present-tense ask is not witnessed by a past-tense row → gap `no_present_holder`, that row closest.
//   5 [choose]                        by bearing: referents the sentence covers, predicate words it holds, whether the page's own title
//                                      agrees with the referents, then position. Never a score from a model.
//   6 [falsify]                       runFalsify. refuted → the next candidate is tried (at most DECLARED.maxCandidates); none left → gap
//                                      `refuted` with the refuting passage. contested → a contest, both rows kept. survived / unmeasured → answer.
//   7 [back to grammar]               realise: a clause made of the row's OWN words (never a paraphrase), else the row's sentence verbatim;
//                                      ALWAYS with the verbatim row and the source beside it.
//   8 [what the model is thinking]    traceOf over the turn's events (app-authored, first person, plain words).
//
// An answer whose checks could not be run ships as standing 'unmeasured' — the source states it, nothing was able to cross-check it, and
// the card says so. It is never called 'survived'. No case logic anywhere: entities are what a TITLE resolves to.

import { askFrame, grammarOf, tokensOf, stemOf, closedClassOf, posRankOf } from "./fold-chat-frame.js";
import { sentencesOf, bindSentence } from "./fold-chat-witness.js";
import { runFalsify, askTense, sameFiller } from "./fold-chat-falsify.js";
import { createTurnVoid, traceOf, noteFalsification } from "./fold-chat-void.js";
import { detectLang } from "./fold-chat-lang.js";

/** Declared, not measured (Constitution II.11). Giver: the ANSWERTURN integrator task of the answer-pipeline contract (2026-10-06). */
export const DECLARED = Object.freeze({
  giver: "the ANSWERTURN integrator task of the answer-pipeline contract (2026-10-06); declared, not measured",
  maxCandidates: 3,        // distinct fillers tried in turn when the best one is refuted (one network query each, so <= the probes' own limit of 3)
  verifySlots: Object.freeze(["person", "place", "thing"]),   // slots whose filler must be a NAME (a title); quantity and time fillers are not names
});

/** Plain words for the feed when the chat runs today's path instead. Declared by the integrator; English only. */
export const HANDOFF_WHY = Object.freeze({
  not_a_slot_ask: "This is not a question with one fact for an answer, so I'm handling it the usual way.",
  no_grammar_for_language: "I can't read the grammar of this language yet, so I'm handling it the usual way.",
  frame_unread: "I couldn't read this as one fact to look up, so I'm handling it the usual way.",
  referents_unresolved: "I couldn't match the names in the question to pages, so I'm handling it the usual way.",
  pipeline_error: "Something went wrong while I was reading sources, so I'm handling it the usual way.",
});

const asArr = (a) => (Array.isArray(a) ? a : []);
const isStr = (s) => typeof s === "string" && s.trim() !== "";
const q = (s) => `“${s}”`;
const hostOf = (url) => { try { return new URL(String(url)).hostname; } catch { return ""; } };
const aborted = (signal) => !!(signal && signal.aborted);

function langOf(lang, question) {
  if (isStr(lang)) return { code: lang, by: "given" };
  if (lang && typeof lang === "object" && isStr(lang.code)) return { code: lang.code, by: isStr(lang.by) ? lang.by : "given" };
  let d = null;
  try { d = detectLang(question); } catch { d = null; }
  return { code: d && d.confident && d.lang && d.lang !== "unknown" ? d.lang : null, by: "function words" };
}

// ── binding the passages ─────────────────────────────────────────────────────────────────────────────────────────
/** Bind every sentence of the passages. A sentence the frame cannot bind on its own words gets a second chance with the page's TITLE
 *  carrying the referent it leaves unsaid ("The current prime minister is Andy Burnham" on the page "Prime Minister of the United
 *  Kingdom") — such a row is marked via the returned `viaTitle` set, and its filler MUST then resolve by title to count. */
function bindPassages(passages, frame, { fw, code, from = 0, pageEntity = null }) {
  const out = [], read = [], skipped = [];
  asArr(passages).forEach((p, i) => {
    if (!p || typeof p.text !== "string" || !p.text) return;
    if (isStr(p.lang) && code && p.lang !== code) { skipped.push(p); return; }       // another language's sentence is not read with this grammar
    const source = { ref: isStr(p.ref) ? p.ref : "S" + (from + i + 1), title: p.title || "", url: p.url || "", host: p.host || hostOf(p.url), lang: p.lang || code };
    read.push(source);
    sentencesOf(p.text).forEach((s, k) => {
      const pe = pageEntity && isStr(p.title) ? pageEntity.get(p.title) || null : null;      // what the page's own title RESOLVES to (a redirect is the same entity)
      let row = bindSentence(s, frame, { fw, lang: code, source, page: p.title || null, pageEntity: pe }), viaTitle = false;
      if (!row && isStr(p.title)) {
        const r2 = bindSentence(s, frame, { fw, lang: code, source, topic: p.title, page: p.title, pageEntity: pe });
        if (r2 && r2.filler) { row = r2; viaTitle = true; }
      }
      if (row) out.push({ row, viaTitle, page: source, order: (from + i) * 10000 + k });
    });
  });
  return { entries: out, read, skipped };
}

/** What each page's own title resolves to (one batched title-door call, the titles of pages ALREADY read): "Microsoft Corporation" is
 *  "Microsoft" after the redirect, so a lead that says "Microsoft Corporation" is about the referent, not a longer entity. A failed or
 *  absent door leaves the map empty and the string test stands. */
async function pageEntitiesOf(passages, resolveTitles) {
  const titles = [...new Set(asArr(passages).map((p) => p && p.title).filter(isStr))];
  const out = new Map();
  if (!titles.length || typeof resolveTitles !== "function") return out;
  try {
    const table = await resolveTitles(titles);
    for (const t of titles) { const r = table && table.get && table.get(t); if (r && isStr(r.title) && !r.disambiguation) out.set(t, r.title); }
  } catch { /* no door: the string test stands */ }
  return out;
}

/** One resolveTitles call over the fillers of person/place/thing rows: a filler that is no page is not a name, so it witnesses nothing
 *  (the row stays in the pool as a T1 row with no filler). A failed call leaves direct rows unverified — said so — and drops title-carried ones. */
async function verifyFillers(entries, frame, resolveTitles, fw = null) {
  const need = DECLARED.verifySlots.includes(frame.slot);
  const withFiller = entries.filter((e) => e.row.tier === "T1" && e.row.filler && !e.checked);
  if (!need || !withFiller.length) { entries.forEach((e) => { e.checked = true; }); return { unverified: false }; }
  // TITLE-DECIDED NAME (2026-10-12): an agent phrase carries its description ("the Scottish physician Alexander Fleming"); the NAME is
  // the longest tail of it that the title door resolves, starting at a name-like word (the received POSPrior ranks it PROPN, or does not
  // know it). Every variant rides the SAME one title call; the full phrase is always tried first.
  const closedV = closedClassOf(fw, frame.lang || "en");
  // THE NAME KEEPS ITS HEAD (the archon panel, MF5): from a descriptive phrase the name starts at its first name-like word (the prior
  // ranks it PROPN or does not know it) once the leading descriptors are dropped — "the Scottish physician Alexander Fleming" is
  // "Alexander Fleming" — and is then trimmed only from the RIGHT, never below two words of a multi-word name ("Alexander Fleming FRS"
  // is "Alexander Fleming"; "the retired plumber Jane Paris" is "Jane Paris" or nothing — never the city Paris).
  const variantsOf = (f) => {
    const tk = tokensOf(f.text, frame.lang || null), out = [{ text: f.text, from: 0, to: f.text.length }];
    let h = 0;
    while (h < tk.length && (closedV(tk[h].fold) || ((r) => r != null && r < 8)(posRankOf(tk[h].text, frame.lang || null)))) h++;
    if (h >= tk.length) return out;
    // A word the prior knows ONLY as a common noun (rank 7 or 8: NOUN, never PROPN-dominant) cannot END a name that is cut short of the run:
    // "Confederate veteran" in "Confederate veteran John W. Morton" is a description (the title door happens to have a page for it).
    const commonAt = (k) => !closedV(tk[k].fold) && ((r) => r === 7 || r === 8)(posRankOf(tk[k].text, frame.lang || null));
    const nameLikeAt = (k) => !closedV(tk[k].fold) && ((r) => r == null || r >= 8)(posRankOf(tk[k].text, frame.lang || null));
    for (let e = tk.length; e > h; e--) {
      if (e - h < 2 && tk.length - h >= 2) break;
      const v = { text: f.text.slice(tk[h].start, tk[e - 1].end), from: tk[h].start, to: tk[e - 1].end, descriptor: e < tk.length && commonAt(e - 1) };
      if (!out.some((x) => x.text === v.text)) out.push(v);
    }
    // …and the NAME can be the TAIL of a descriptive run whose first words the prior does not know: from every name-like word that follows a
    // common one, the rest of the run is a candidate ("Confederate veteran | John W. Morton").
    for (let st = h + 1; st < tk.length; st++) {
      if (!commonAt(st - 1) || !nameLikeAt(st)) continue;
      const v = { text: f.text.slice(tk[st].start, tk[tk.length - 1].end), from: tk[st].start, to: tk[tk.length - 1].end };
      if (!out.some((x) => x.text === v.text)) out.push(v);
    }
    return out;
  };
  // a filler may carry ALTERNATIVES (a place phrase after each locative preposition, left to right): every alternative and each of
  // its head-keeping variants rides the SAME single title call, and the first that is a page wins
  const candidatesOf = (f) => (Array.isArray(f.alts) && f.alts.length ? f.alts : [f]).flatMap((alt) => variantsOf(alt).map((v) => ({ ...v, base: alt })));
  const texts = [...new Set(withFiller.flatMap((e) => candidatesOf(e.row.filler).map((v) => v.text)))];
  let table = null;
  try { table = typeof resolveTitles === "function" ? await resolveTitles(texts.slice()) : null; } catch { table = null; }
  const ok = table instanceof Map;
  const isNamed = (res) => !!(res && typeof res.title === "string" && res.title && !res.disambiguation);
  for (const e of withFiller) {
    e.checked = true;
    if (!ok) { if (e.viaTitle) e.row = { ...e.row, filler: null }; continue; }
    const f = e.row.filler;
    const hit = candidatesOf(f).find((v) => !v.descriptor && isNamed(table.get(v.text)));
    if (!hit) { e.row = { ...e.row, filler: null }; continue; }
    const title = table.get(hit.text).title;                       // what the name IS: contest candidates that are one page are one entity
    const b0 = hit.base.span[0];
    e.row = { ...e.row, filler: { text: hit.text, span: [b0 + hit.from, b0 + hit.to], title } };
  }
  return { unverified: !ok };
}

// ── choosing ─────────────────────────────────────────────────────────────────────────────────────────────────────
function makeBearing(frame, code, fw) {
  const closed = closedClassOf(fw, code);
  const stems = (s) => tokensOf(s, code).map((t) => stemOf(t.fold, code));
  const refSeqs = frame.referents.map((r) => asArr(r.aliases).length ? r.aliases.map(stems) : [stems(r.surface), stems(r.title)]);
  const refContent = new Set(frame.referents.flatMap((r) => asArr(r.aliases).flatMap((a) => tokensOf(a, code).filter((t) => !closed(t.fold)).map((t) => stemOf(t.fold, code)))));
  const contains = (hay, seq) => { for (let i = 0; i + seq.length <= hay.length; i++) if (seq.every((s, k) => hay[i + k] === s)) return true; return false; };
  return (entry) => {
    const hay = stems(entry.row.sentence);
    const covered = refSeqs.filter((seqs) => seqs.some((s) => s.length && contains(hay, s))).length;
    const pred = frame.predicate.filter((p) => hay.includes(p.stem)).length;
    const titleAgree = stems(entry.page.title).some((s) => refContent.has(s)) ? 1 : 0;
    return [covered, pred, titleAgree, -entry.order];
  };
}
/** LICENCE (the live English held-out gate, 2026-10-13: "what is the capital of Kenya" contested by the word "city", "what currency is
 *  used in Japan" by "These"): a SINGLE-token filler that cannot be an answer is not a candidate and not a rival. Per the language's own
 *  tables — never a word list: a closed-class word ("these", "it"); a bare numeral on a name slot ("4" cut from "4,700 km"); a word the
 *  language's POS prior ranks an adverb ("unanimously"); on a place ask, a declared kind-of-place noun ("city", "country").
 *  A quantity ask keeps "no", "none" and numerals ("Venus has no moons"). Multi-token fillers are never touched: "The Who" is a name.
 *  → the reason ("closed" | "numeral" | "adverb" | "kind") or null. */
export function makeLicense(frame, code, fw) {
  const closed = closedClassOf(fw, code);
  const G = grammarOf(code) || {};
  const kinds = new Set(asArr(G.placeNouns).map((w) => { const t = tokensOf(String(w), code); return t.length === 1 ? t[0].fold : null; }).filter(Boolean));
  const slot = frame && frame.slot;
  // a PLACE is asked for when the slot says so, or when the ask's own relation word is a kind of place ("the CAPITAL of Kenya": slot thing)
  const asked = [...asArr(frame && frame.predicate).map((p) => p && p.surface), ...asArr(frame && frame.attributes).map((a) => a && a.surface)].filter(Boolean);
  const placeAsk = slot === "place" || asked.some((w) => { const t = tokensOf(String(w), code); return t.length === 1 && kinds.has(t[0].fold); });
  return (text) => {
    if (slot === "quantity") return null;
    const toks = tokensOf(String(text == null ? "" : text), code);
    if (toks.length !== 1) return null;
    const w = toks[0].fold;
    if (closed(w)) return "closed";
    if (slot !== "time" && /^\p{N}[\p{N}.,]*$/u.test(toks[0].text)) return "numeral";
    if (posRankOf(toks[0].text, code) === 1) return "adverb";
    if (placeAsk && kinds.has(w)) return "kind";
    return null;
  };
}

/** Set the junk fillers aside — but ONLY when a row at least as strong survives. A junk-filler row that out-bears every survivor is the
 *  real answer wearing a mis-bound filler ("Washington was unanimously elected the first president" bound "unanimously"): dropping it
 *  would leave a weaker, wrong row to be committed (John Hanson), so then nothing changes. Evidence is the first three bearing terms
 *  (referents covered, predicate covered, title agreement); page order is not evidence. */
export function setAsideJunk(entries, isJunk) {
  const junk = [], keep = [];
  for (const e of entries) (e.row && e.row.filler && isJunk(e.row.filler.text) ? junk : keep).push(e);
  const none = { applied: false, kept: entries, set: [] };
  if (!junk.length || !keep.length) return none;
  const ev = (e) => (e.b || []).slice(0, 3);
  const cmp = (a, b) => { for (let i = 0; i < 3; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0); return 0; };
  const best = (xs) => xs.map(ev).sort((a, b) => cmp(b, a))[0];
  if (cmp(best(junk), best(keep)) > 0) return none;      // the junk row is STRICTLY stronger than every survivor
  return { applied: true, kept: keep, set: junk };
}

/** DOMINANCE (the live held-out "how many players does a football team have on the field": 53 vs 11): one row says every word of the
 *  ask that another row says AND more ("on the field"), so the other row speaks to a narrower or different question — it is not a
 *  rival. No threshold: a strict superset of the ask's own content stems, over each of the others. → the dominant row, or null. */
export function dominantRow(rows, frame, code, fw) {
  if (!Array.isArray(rows) || rows.length < 2) return null;
  const closed = closedClassOf(fw, code);
  const stemsOf = (t) => tokensOf(t, code).filter((x) => !closed(x.fold)).map((x) => stemOf(x.fold, code));
  // only the ask's SCOPE words count — predicate, attribute and counted stems. A referent's own name is never a scope word: a row that
  // spells the same entity longer ("Wolfgang Amadeus Mozart" for "Mozart") says no more of what was asked (panel 4, second re-read).
  const ask = new Set([
    ...asArr(frame.predicate).map((p) => p.stem),
    ...asArr(frame.attributes).flatMap((a) => asArr(a.stems)),
    ...asArr(frame.counted && frame.counted.stems),
  ].filter(Boolean));
  if (!ask.size) return null;
  // the words said in the CLAUSE that holds the filler (commas and semicolons bound it): "Voltaire wrote Emma, a novel, as a joke" says
  // "novel" in an appositive, not of what Voltaire wrote
  const clauseOf = (r) => {
    const t = String(r.sentence || ""), f = r.filler && Array.isArray(r.filler.span) ? r.filler.span : null;
    if (!f) return t;
    let a = 0, b = t.length;
    for (let i = f[0] - 1; i >= 0; i--) if (",;:()".includes(t[i])) { a = i + 1; break; }
    for (let i = f[1]; i < t.length; i++) if (",;:()".includes(t[i])) { b = i; break; }
    return t.slice(a, b);
  };
  const cover = rows.map((r) => { const have = new Set(stemsOf(clauseOf(r))); return [...ask].filter((st) => have.has(st)); });
  // …and a crowned row must NAME every anchor in that clause: a row carried by its page's title ("Kathryn Sullivan became the first American
  // woman to walk in space" on "Has a Woman Ever Walked on the Moon?") says nothing of the Moon — the live false premise, crowned once
  const namesAnchors = (r) => { const have = new Set(stemsOf(clauseOf(r))); return frame.referents.every((ref) => [ref.surface, ref.title, ...asArr(ref.aliases)].filter(Boolean).some((n) => { const st = stemsOf(n); return st.length && st.every((x) => have.has(x)); })); };
  for (let i = 0; i < rows.length; i++) {
    const mine = new Set(cover[i]);
    // …and the dominant row must say EVERY scope word of the ask: a row that is merely less incomplete than another still does not
    // answer the ask (the false premise "the first WOMAN to walk on the Moon": neither row says "woman" — no row is crowned)
    if (mine.size < ask.size || !namesAnchors(rows[i])) continue;
    if (rows.every((_, j) => j === i || (cover[j].every((st) => mine.has(st)) && mine.size > cover[j].length))) return { row: rows[i], index: i, missing: rows.filter((_, j) => j !== i).map((r2, k) => ({ row: r2, words: [...mine].filter((st) => !new Set(cover[rows.indexOf(r2)]).has(st)) })) };
  }
  return null;
}
const byBearing = (a, b) => { for (let i = 0; i < 4; i++) if (a.b[i] !== b.b[i]) return b.b[i] - a.b[i]; return 0; };

// ── realising: a clause of the row's OWN words ───────────────────────────────────────────────────────────────────
const END_PUNCT = /[.!?。！？]["”’')\]]*$/u;
const finish = (clause, row) => {
  const c = clause.trim();
  if (!c) return row.sentence;
  const done = END_PUNCT.test(c) ? c : c + ".";
  const strip = (s) => s.replace(/[\s.!?。！？"”’')\]]+$/u, "");
  return strip(done) === strip(row.sentence) ? row.sentence : done;
};

/** First clause boundary (a comma, semicolon, colon, parenthesis, or one of the language's clause words) at or after `from`; -1 if none. */
function firstBoundary(text, from, G) {
  let at = -1;
  for (let i = Math.max(0, from); i < text.length; i++) if (",;:(（，；".includes(text[i])) { at = i; break; }
  for (const t of tokensOf(text, G.lang || null)) if (t.start >= from && G.clauseWords.includes(t.fold) && (at < 0 || t.start < at)) { at = t.start; break; }
  return at;
}

/** The answer line. A copular slot: the sentence's own words from its start to the last matched word of the filler's clause
 *  ("Charles III is the king of the United Kingdom."). A quantity: the same, or — when a clause word sits between the subject and the
 *  number — subject + the closed-class words right before the number + the number + the matched noun after it ("Spiders have eight
 *  legs."). A time, or anything that cannot be built from the row's own words, is the row's sentence verbatim. */
export function realise(row, frame, { fw, lang }) {
  if (row && row.viaSpan) return row.sentence;   // read by the extractive witness: the sentence as written ("…whose company designed and built the tower"), never cut to a clause that loses the verb asked about
  const G = grammarOf(lang);
  const f = row && row.filler;
  const text = row ? row.sentence : "";
  if (!G || !f || !Array.isArray(f.span) || text.slice(f.span[0], f.span[1]) !== f.text) return text;
  const spans = asArr(row.emphasis).filter((s) => Array.isArray(s) && s[1] > s[0] && s[1] <= text.length);
  const [fa, fb] = f.span;
  if (frame.slot === "person" || frame.slot === "place" || frame.slot === "thing") {
    if (fa > 0 && firstBoundary(text, 0, G) >= 0 && firstBoundary(text, 0, G) < fa) return text;       // the subject itself is cut by a boundary
    const be = firstBoundary(text, fb, G), clauseEnd = be < 0 ? text.length : be;
    let end = fb;
    for (const [a, b] of spans) if (a < clauseEnd && b <= clauseEnd) end = Math.max(end, b);
    return finish(text.slice(0, end), row);
  }
  if (frame.slot === "quantity") {
    const be = firstBoundary(text, 0, G);
    if (be < 0 || be >= fb) {                                   // no boundary before the number: the clause as written
      const ce = firstBoundary(text, fb, G), clauseEnd = ce < 0 ? text.length : ce;
      let end = fb;
      for (const [a, b] of spans) if (a < clauseEnd && b <= clauseEnd) end = Math.max(end, b);
      return finish(text.slice(0, end), row);
    }
    const closed = closedClassOf(fw, lang);
    const toks = tokensOf(text, lang);
    const gapless = (a, b) => /^\s+$/.test(text.slice(a.end, b.start));
    const fi = toks.findIndex((t) => t.start >= fa);
    if (fi <= 0) return text;
    let s = fi;
    while (s - 1 >= 0 && gapless(toks[s - 1], toks[s]) && closed(toks[s - 1].fold)) s--;
    while (s < fi && G.clauseWords.includes(toks[s].fold)) s++;      // "that have eight legs" → "have eight legs"
    if (s >= fi) return text;
    const verbStart = toks[s].start;
    const subject = spans.find(([a, b]) => b <= verbStart && !(a >= fa && b <= fb));
    if (!subject) return text;
    let line = `${text.slice(subject[0], subject[1])} ${text.slice(verbStart, fb)}`;
    const tail = spans.find(([a]) => a >= fb && /^\s+$/.test(text.slice(fb, a)));
    if (tail) line += ` ${text.slice(tail[0], tail[1])}`;
    return finish(line, row);
  }
  return text;
}

// ── the turn ─────────────────────────────────────────────────────────────────────────────────────────────────────
const uniq = (xs) => [...new Set(xs.filter(isStr))];

function refuterRow(refuter, frame, code, n) {
  const p = refuter.passage || {};
  const source = { ref: "S" + n, title: p.title || "", url: p.url || "", host: hostOf(p.url), lang: code };
  return { tier: "T2", sentence: p.text, source, span: [0, String(p.text || "").length], polarity: "+", tense: "unknown", filler: null, emphasis: [] };
}

export async function runAnswerTurn({ question, lang, passages = [], now, deps = {} } = {}) {
  try {
    return await run({ question, lang, passages, now, deps: deps || {} });
  } catch (e) {
    return { handoff: { kind: "pipeline_error", why: HANDOFF_WHY.pipeline_error, error: String((e && e.message) || e) } };
  }
}

async function run({ question, lang, passages, now, deps }) {
  const said = String(question ?? "");
  const L = langOf(lang, said);
  const code = L.code;
  const signal = deps.signal;
  const fw = typeof deps.fw === "function" ? deps.fw(code) : deps.fw;

  const bare = (extra = {}) => ({ schema: "AnswerTurn@1", said, searched: [], lang: { code, by: L.by }, void: null, answer: null, contest: [], gap: null, trace: [], sources: [], ...extra });
  if (aborted(signal)) return bare({ aborted: true });

  // 1 ── the grammar of the ask
  const frame = await askFrame(said, { fw, lang: code, resolveTitles: deps.resolveTitles, suggestQuery: typeof deps.suggestQuery === "function" ? deps.suggestQuery : null });
  if (aborted(signal)) return bare({ aborted: true });
  if (!frame.ok) {
    const kind = frame.gap && frame.gap.kind ? frame.gap.kind : "not_a_slot_ask";
    return { handoff: { kind, why: HANDOFF_WHY[kind] || HANDOFF_WHY.frame_unread } };
  }

  const tv = createTurnVoid(frame);
  // SURVIVE TYPING: a second reading of the ask was used — every word read differently is disclosed, never silent (fold-chat-typing.js)
  if (Array.isArray(frame.readAs) && frame.readAs.length) tv.note("read-as", { changes: frame.readAs.map((c) => ({ typed: c.typed, read: c.read, how: c.how })) });
  const bearing = makeBearing(frame, code, fw);
  const searched = [];
  const sourcesSeen = [];
  const addSources = (list) => { for (const s of list) if (!sourcesSeen.some((x) => x.url === s.url && x.title === s.title && x.ref === s.ref)) sourcesSeen.push(s); };
  for (const p of asArr(passages)) if (p && isStr(p.query)) searched.push(p.query);

  const finishTurn = (parts) => {
    const trace = traceOf(tv);
    const tree = tv.close();
    return { ...bare({ slot: frame.slot, searched: uniq(searched), void: tree, trace, sources: sourcesSeen.slice() }), ...parts,
      // THE REAL FRAME rides the receipt (2026-10-11): the resolveTitles-backed referents and the
      // predicate — what the compound one shot binds later parts against (omnilingual: a referent is
      // whatever a TITLE resolved to, never a case rule).
      frame: { slot: frame.slot, referents: frame.referents, predicate: frame.predicate, attributes: frame.attributes || [], counted: frame.counted || null },
    };
  };
  const partial = () => finishTurn({ aborted: true });

  // 2 ── bind
  const pageEntity = await pageEntitiesOf(passages, deps.resolveTitles);
  const first = bindPassages(passages, frame, { fw, code, pageEntity });
  addSources(first.read);
  let entries = first.entries;
  let unverifiedNames = (await verifyFillers(entries, frame, deps.resolveTitles, fw)).unverified;
  if (aborted(signal)) return partial();

  const witnesses = () => entries.filter((e) => e.row.tier === "T1" && e.row.filler && e.row.polarity === "+");

  let widened = [];   // the passages the one wider read added (3b reads them too)
  // 3 ── something must fill the slot; one wider read before giving up
  if (!witnesses().length && typeof deps.searchPassages === "function") {
    const asked = frame.referents.map((r) => r.title || r.surface);
    let more = [], reason = null;
    try { more = asArr(await deps.searchPassages(frame, { signal })); } catch (e) { more = []; reason = e && e.name === "AbortError" ? "the search was stopped" : "the read failed"; }
    if (aborted(signal)) return partial();
    const have = new Set(entries.map((e) => e.page.url + "\u0000" + e.page.title));
    const fresh = more.filter((p) => p && typeof p.text === "string" && !have.has((p.url || "") + "\u0000" + (p.title || "")) && !asArr(passages).some((x) => x && x.url && x.url === p.url));
    widened = fresh;
    const next = bindPassages(fresh, frame, { fw, code, from: asArr(passages).length, pageEntity: await pageEntitiesOf(fresh, deps.resolveTitles) });
    addSources(next.read);
    entries = entries.concat(next.entries);
    for (const p of fresh) if (isStr(p.query)) searched.push(p.query);
    tv.note("widen", { asked, read: next.read.map((s) => ({ title: s.title, host: s.host, url: s.url })), ...(reason ? { reason } : {}) });
    unverifiedNames = (await verifyFillers(entries, frame, deps.resolveTitles, fw)).unverified || unverifiedNames;
    if (aborted(signal)) return partial();
  }

  const readTitles = sourcesSeen.map((s) => s.title || s.host || s.url).filter(isStr);
  let scored = entries.map((e) => ({ ...e, b: bearing(e) })).sort(byBearing);
  // 3b ── LICENCE: a filler that cannot be an answer is no candidate and no rival (set aside, said in the trace, only if a row at least as
  //       strong survives — see setAsideJunk)
  {
    const license = makeLicense(frame, code, fw);
    const live = scored.filter((e) => e.row.tier === "T1" && e.row.filler && e.row.polarity === "+");
    const sa = setAsideJunk(live, (t) => !!license(t));
    if (sa.applied) {
      const gone = new Set(sa.set.map((e) => e.row));
      tv.note("set-aside", { fillers: sa.set.map((e) => ({ text: e.row.filler.text, why: license(e.row.filler.text) })) });
      scored = scored.filter((e) => !gone.has(e.row));
      entries = entries.filter((e) => !gone.has(e.row));
    }
  }
  const closestOf = (list) => (list.length ? list[0].row : null);

  // 4 ── the CURRENT-ness rule
  const cands = scored.filter((e) => e.row.tier === "T1" && e.row.filler && e.row.polarity === "+");
  const present = askTense(frame, {}) === "present";
  const usable = present ? cands.filter((e) => e.row.tense !== "past") : cands;
  if (!usable.length && cands.length && present) {
    const row = cands[0].row;
    tv.note("past-only", { row });
    return finishTurn({ gap: { kind: "no_present_holder", closest: row, tried: readTitles, closeBy: [] } });
  }
  if (!usable.length) {
    const closest = closestOf(scored.filter((e) => e.row.tier === "T1")) || closestOf(scored);
    if (!sourcesSeen.length) {
      tv.note("no-witness", { kind: "unreached", tried: [], reason: "no source could be read" });
      return finishTurn({ gap: { kind: "unreached", tried: [], closeBy: [] } });
    }
    tv.note("no-witness", { kind: "unwitnessed", tried: readTitles, ...(closest ? { closest } : {}) });
    return finishTurn({ gap: { kind: "unwitnessed", ...(closest ? { closest } : {}), tried: readTitles, closeBy: [] } });
  }

  // 5 ── choose: distinct fillers in order of their best row's bearing
  const groups = [];
  for (const e of usable) {
    const t = e.row.filler.title || null;
    const g = groups.find((x) => sameFiller(x.name, e.row.filler.text) || (t && x.title && x.title === t));
    if (g) { g.entries.push(e); if (!g.title && t) g.title = t; } else groups.push({ name: e.row.filler.text, title: t, entries: [e] });
  }

  // 6 ── falsify: the best candidate first. A refuted one is set aside (its rows leave the pool: a dead holder is not a rival) and the
  //      next is tried. A candidate CONTESTED by another candidate's row is not left at that: the rival is itself put to the search that
  //      names it, and if it falls, the first is judged again without it (a stale page's "Elizabeth II is the monarch" must not turn
  //      "Charles III is the king" into a contest). One lookup per name, never repeated; at most DECLARED.maxCandidates names in all.
  const poolAll = entries.map((e) => e.row);
  const memo = new Map();
  const fetchLead = typeof deps.fetchLead === "function"
    ? (query, o) => { if (!memo.has(query)) memo.set(query, (async () => deps.fetchLead(query, o))()); return memo.get(query); }
    : null;
  const refutedRows = [], evaluated = [];
  // a filler-less NEGATION row denies the claim only if it says what the ask is about (its attribute: "currency", "king")
  // the ask's NOUN-like words, by the language's own prior (rank 7+: "currency", "king"; a verb such as "used" is rank 6 and is not scope);
  // a language with no prior ranks nothing, so no scope is applied and the check is as it was
  const attrStems = [
    ...asArr(frame.predicate).filter((p) => p && p.surface && (posRankOf(p.surface, code) || 0) >= 7).map((p) => p.stem),
    ...asArr(frame.attributes).flatMap((a) => asArr(a && a.stems)),
  ].filter(Boolean);
  const negationScope = attrStems.length
    ? (row) => { const have = new Set(tokensOf(String((row && row.sentence) || ""), code).map((t) => stemOf(t.fold, code))); return attrStems.every((s) => have.has(s)); }
    : null;
  let firstRefuted = null, budget = DECLARED.maxCandidates;
  const evaluate = async (g) => {
    const cand = g.entries[0].row;
    tv.note("candidate", { row: cand });
    const pool = poolAll.filter((r) => !refutedRows.includes(r));
    const run = await runFalsify({ candidate: { filler: cand.filler, row: cand }, frame, rows: pool, now, fetchLead, signal, negationScope });
    for (const qy of run.queries) searched.push(qy);
    noteFalsification(tv, run, cand.filler.text);
    const outcome = { run, cand, group: g };
    if (run.standing === "refuted") { for (const e of g.entries) refutedRows.push(e.row); firstRefuted = firstRefuted || outcome; }
    return outcome;
  };
  let outcome = null;
  for (const g of groups) {
    if (budget <= 0 || evaluated.includes(g)) continue;
    budget--; evaluated.push(g);
    outcome = await evaluate(g);
    if (aborted(signal)) return partial();
    if (outcome.run.standing === "refuted") continue;
    if (outcome.run.standing === "contested") {
      const rivals = groups.filter((x) => x !== g && !evaluated.includes(x) && x.entries.some((e) => outcome.run.contest.includes(e.row)));
      let fell = false;
      for (const r of rivals) {
        if (budget <= 0) break;
        budget--; evaluated.push(r);
        const rv = await evaluate(r);
        if (aborted(signal)) return partial();
        if (rv.run.standing === "refuted") fell = true;
      }
      if (fell) { outcome = await evaluate(g); if (aborted(signal)) return partial(); }
    }
    break;
  }
  const { run, cand } = outcome;

  if (run.standing === "refuted") {
    const f = firstRefuted;
    const refuter = f.run.refuters[0];
    const closest = refuterRow(refuter, frame, code, sourcesSeen.length + 1);
    addSources([closest.source]);
    return finishTurn({ gap: { kind: "refuted", closest, claim: f.cand, refuters: f.run.refuters, tried: f.run.queries.map(q), closeBy: [] } });
  }
  if (run.standing === "contested") {
    const rows = run.contest.length >= 2 ? run.contest : [cand];
    // one row covers strictly more of the ask's own words than every other: the others answer a narrower or different question
    const dom = dominantRow(rows, frame, code, fw);
    if (dom) {
      const unmeasured = [`${dom.missing.map((m) => `another source says ${q(m.row.filler && m.row.filler.text)} but does not say ${m.words.slice(0, 3).map(q).join(", ")}`).join("; ")}`];
      const answer = { text: realise(dom.row, frame, { fw, lang: code }), filler: dom.row.filler, row: dom.row, standing: "unmeasured", survived: [], unmeasured, by: "mechanical" };
      return finishTurn({ answer });
    }
    if (rows.length >= 2) return finishTurn({ contest: rows });
    return finishTurn({ gap: { kind: "unwitnessed", closest: cand, tried: readTitles, closeBy: [] } });
  }

  // 7 ── survived or unmeasured: realise the answer from the row's own words
  const unmeasured = run.unmeasured.slice();
  if (unverifiedNames) unmeasured.push(`whether ${q(cand.filler.text)} names a page: I could not ask the title service`);
  const answer = {
    text: realise(cand, frame, { fw, lang: code }), filler: cand.filler, row: cand,
    standing: run.standing, survived: run.survived.slice(), unmeasured, by: "mechanical",
  };
  return finishTurn({ answer });
}
