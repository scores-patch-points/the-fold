// fold-chat-void-intl.js — the keyed door's language-general FRONT END (eval/void/PREREG.md Amendment 16). Pure but for injected fetches. No model.
//
// A question in any language reaches the door's inputs — an anchor, the relation words, the language — without a declared question grammar:
//   segmentation  ICU/CLDR `Intl.Segmenter(lang, word)` (a received facility; Japanese splits オーストラリア | の | 首都 | は | どこ)
//   open class    the language's own POS prior (janus/priors/pos-<iso3>.json, dominant UPOS); closed = ADP DET AUX PRON CCONJ SCONJ PART PUNCT SYM
//   the anchor    candidate runs (≤ 5 segments, content edges) go to THAT language's edition's title door; the entity that matters is the one
//                 whose KIND HAS THE KEY the rest of the ask names (a kind is its keys): "capital" and "首都" resolve as pages too, but only
//                 Australia's item carries the capital property
//   agglutinative languages (declared: ko, tr) bind a particle to the noun (호주의, Avustralya'nın): every prefix ≥ 2 characters of a run is also
//                 a candidate and the title door is the witness (the longest resolving prefix wins)
// Nothing here is a slot grammar: the interrogative is not needed to know what kind of value a property holds (its own datatype).
import { keyedFill } from "./fold-chat-void-keyed.js";

const CLOSED_UPOS = new Set(["ADP", "DET", "AUX", "PRON", "CCONJ", "SCONJ", "PART", "PUNCT", "SYM"]);
export const AGGLUTINATIVE = Object.freeze(new Set(["ko", "tr"]));   // DECLARED for this battery

export function segmentsOf(ask, lang) {
  const seg = new Intl.Segmenter(lang, { granularity: "word" });
  return [...seg.segment(ask)].map((x) => ({ text: x.segment, start: x.index, end: x.index + x.segment.length, word: !!x.isWordLike }));
}

/** The candidate surfaces of an ask: runs of word segments with content edges, whitespace allowed between, and (agglutinative) prefixes of the last word. */
export function candidateRuns(ask, lang, { closedOf }) {
  const segs = segmentsOf(ask, lang);
  const out = new Map();   // surface -> { start, end, tokens }
  const words = segs.filter((s) => s.word);
  for (let a = 0; a < words.length; a++) {
    if (closedOf(words[a].text)) continue;
    for (let b = a; b < words.length && b - a < 5; b++) {
      if (b > a) { const between = ask.slice(words[b - 1].end, words[b].start); if (!/^\s*$/u.test(between)) break; }
      if (closedOf(words[b].text)) continue;
      const surface = ask.slice(words[a].start, words[b].end);
      out.set(surface, { start: words[a].start, end: words[b].end, tokens: words.slice(a, b + 1).map((w) => w.text) });
      if (AGGLUTINATIVE.has(lang)) {
        const last = [...words[b].text];
        for (let k = 2; k < last.length; k++) {
          const pre = last.slice(0, k).join("");
          out.set(ask.slice(words[a].start, words[b].start) + pre, { start: words[a].start, end: words[b].start + pre.length, tokens: [...words.slice(a, b).map((w) => w.text), pre] });
        }
      }
    }
  }
  return out;
}

/**
 * intlDoor({ ask, lang, getJson, resolveTitles, dominantOf, sameAct, lemmasOf }) →
 *   { verdict, claim?, answer?, anchor?, cause, tried: [...], refused? }
 * `cause` is the named cause of a non-answer: ANCHOR | LABEL | TYPE | NOVAL | CONTEST (Amendment 16).
 */
export async function intlDoor({ ask, lang, getJson, resolveTitles, dominantOf = null, sameAct = null, lemmasOf = null }) {
  const upos = (w) => { const d = dominantOf ? dominantOf(String(w).toLowerCase()) : null; return d ? d.upos : null; };
  const closedOf = (w) => CLOSED_UPOS.has(upos(w));
  const runs = candidateRuns(ask, lang, { closedOf });
  if (!runs.size) return { verdict: "unbound", cause: "ANCHOR", tried: [], refused: "no_candidate_runs" };
  let table = null;
  try { table = await resolveTitles([...runs.keys()], { edition: lang }); } catch { table = null; }
  const resolved = [];
  if (table instanceof Map) for (const [surface, r] of table) if (r && r.title && !r.disambiguation) resolved.push({ surface, title: r.title, ...runs.get(surface) });
  if (!resolved.length) return { verdict: "unbound", cause: "ANCHOR", tried: [], refused: "no_title_resolved" };
  // longest first; a run contained in an already chosen longer run is not tried separately (the longest resolving prefix wins)
  resolved.sort((x, y) => (y.end - y.start) - (x.end - x.start) || x.start - y.start);
  const chosen = [];
  for (const r of resolved) if (!chosen.some((c) => r.start >= c.start && r.end <= c.end)) chosen.push(r);
  const tried = [];
  const bound = [];
  for (const anc of chosen.slice(0, 4)) {
    const rest = segmentsOf(ask, lang).filter((s) => s.word && !(s.start >= anc.start && s.end <= anc.end) && !closedOf(s.text)).map((s) => s.text);
    const r = await keyedFill({ fields: { slot: null, admits: null }, anchor: { title: anc.title, surface: anc.surface }, relationWords: rest, askWords: [], getJson, sameAct, lemmasOf, dominantOf, keyed: true, lang, edition: lang, slotFree: true });
    tried.push({ surface: anc.surface, title: anc.title, verdict: r.verdict, refused: r.refused || null, property: r.property && r.property.id, matched: r.matched || null });
    if (r.verdict === "bound" || r.verdict === "contested") bound.push({ anc, r });
  }
  if (bound.length) {
    const top = bound.find((b) => b.r.verdict === "bound") || bound[0];
    return { verdict: top.r.verdict, claim: top.r.claim, answer: top.r.answer, anchor: top.anc.title, tried, cause: top.r.verdict === "contested" ? "CONTEST" : null };
  }
  const reasons = tried.map((t) => t.refused);
  const cause = reasons.includes("datatype_mismatch") ? "TYPE" : reasons.includes("kind_has_key_no_value") ? "NOVAL" : reasons.includes("no_identity") && reasons.every((x) => x === "no_identity") ? "ANCHOR" : "LABEL";
  return { verdict: "unbound", cause, tried };
}

export default { intlDoor, candidateRuns, segmentsOf, AGGLUTINATIVE };
