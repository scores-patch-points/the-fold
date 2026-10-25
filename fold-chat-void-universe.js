// fold-chat-void-universe.js — L2: THE REFERENT'S UNIVERSE, and the void's open edge bound inside it (eval/void/PREREG.md, Amendments 1–2).
// Pure: no DOM, no IO, no model, no clock. The passages and the lemmatizer (khora morphology.js sameAct over the received prior) are injected.
//
// Measured first (Amendment 2): the engine's rich relation reader binds NAME → NAME — the date and the referring expression ("the building")
// fall inside connector text — so the unit here is the CLAUSE:
//
//   universeOf({ anchor, passages, sameAct }) → { anchor, aliases, kinds: [EOKindEvidence@1], clauses: [{ ref, start, end, text, about }] }
//     kinds    a copula sentence on the anchor's OWN page ("⟨anchor⟩ is a/an/one of the … K", "regarded as one of the … Ks", "became a K")
//              recorded as khora terrainEvidence (explicit_classification, witnessed by its byte address) — the anchor's kinds ARE those records
//     about    how the clause reaches the anchor: "name" (an alias), "kind" ("the building", K among its witnessed kinds), "continuity"
//   bindVoid(fields, universe, { sameAct, relationWords }) → { edges: [{ filler, key, ref, start, end, text, about, relation }], fillers: [{ key, value, edges }] }
//     an EDGE is one clause holding the anchor, a token that is sameAct with a relation word, and a filler from the reader for `admits`
//
// DECLARED, NOT MEASURED (Constitution II.11; giver: the author, 2026-10-14, eval/void Amendment 2) — each named so a measurement can reverse it:
//   page-subject continuity  on the anchor's own page, a clause-initial "it"/"its" in a sentence after one naming the anchor is the anchor
//   nearest argument         within a clause the filler is the candidate nearest the relation token (Talmy's figure placed against its ground;
//                            "written by William Shakespeare" binds Shakespeare, not "Prince of Denmark" further off)
//   filler keys              a date clusters by its year; a name by its last word; anything else by its folded text
//   kind heads               the last content word of the classification's noun phrase, before a preposition or clause break, singularised
import { splitSentences } from "./vendor/khora/native/adapters/text/spans.js";
import { extractSurfaces } from "./vendor/khora/native/adapters/text/surfaces.js";
import { terrainEvidence } from "./vendor/khora/native/kernel/terrain-induction.js";   // Kanada (khora terrainInduction, renamed from kind-induction)
import { clausesOf, datesIn, quantitiesIn } from "./fold-chat-answerspan.js";
import { stemOf } from "./fold-chat-frame.js";
import { abbreviationsOf } from "./fold-chat-cut.js";

const fold = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const STOP_NP = new Set(["in", "on", "at", "of", "for", "from", "to", "by", "with", "that", "which", "who", "and", "located", "where", "since"]);
const ARTICLES = new Set(["a", "an", "the"]);
const QUANT_DIM = Object.freeze({ length: "len", mass: "mass", temperature: "temp" });

/** Sentences with their byte offsets in the passage (khora's splitter; offsets found by forward search, so a repeated sentence keeps its own). */
function sentencesOf(text) {
  const out = []; let from = 0;
  for (const s of splitSentences(String(text ?? ""), { abbreviations: abbreviationsOf(String(text ?? "")) })) {
    const t = typeof s === "string" ? s : s.text ?? String(s);
    const at = text.indexOf(t, from);
    if (at < 0) continue;
    out.push({ start: at, end: at + t.length, text: t });
    from = at + t.length;
  }
  return out;
}

function aliasesFor(anchor) {
  const xs = [anchor.title, anchor.surface, String(anchor.title || "").replace(/\s*\([^)]*\)\s*$/u, ""), ...(anchor.aliases || [])].filter(Boolean);
  return [...new Set(xs.map((x) => String(x).trim()).filter((x) => x.length > 1))].sort((a, b) => b.length - a.length);
}
const mentions = (text, aliases) => aliases.some((a) => fold(text).includes(fold(a)));

/** The anchor's universe over the passages. */
export function universeOf({ anchor, passages = [] } = {}) {
  if (!anchor || !anchor.title) return { anchor: null, aliases: [], kinds: [], clauses: [], gap: { kind: "no_anchor" } };
  const aliases = aliasesFor(anchor);
  const own = (p) => fold(p.title) === fold(anchor.title);
  const kinds = [];
  // 1. kinds, from the anchor's own page: "<alias|it> <is|was|are|were|became|regarded as> (a|an|one of the …) <NP>"
  for (const p of passages.filter(own)) {
    let named = false;
    for (const s of sentencesOf(p.text)) {
      const lower = fold(s.text);
      const subjectIsAnchor = mentions(s.text.slice(0, Math.max(60, s.text.length / 3)), aliases) || (named && /^(?:it|its)\b|,\s*it\b/u.test(lower));
      if (mentions(s.text, aliases)) named = true;
      if (!subjectIsAnchor) continue;
      const m = lower.match(/\b(?:is|was|are|were|became|regarded as|considered)\s+(?:(?:widely|often|commonly|also)\s+)*(?:regarded as\s+)?(?:a|an|one of the|one of)\s+(.+?)(?:[,.;:]|$)/u);
      if (!m) continue;
      const words = m[1].split(/\s+/);
      const np = [];
      for (const w of words) { if (STOP_NP.has(w) && np.length) break; if (!ARTICLES.has(w)) np.push(w.replace(/[^\p{L}\p{N}-]/gu, "")); }
      const head = np.filter(Boolean).pop();
      if (!head) continue;
      const kindKey = stemOf(head, "en");
      kinds.push(terrainEvidence({ id: `kind:${p.ref}#${s.start}-${s.end}`, entityRef: anchor.title, evidenceType: "explicit_classification", kindKey, kindSurface: np.filter(Boolean).join(" ") }));
    }
  }
  const kindKeys = new Set(kinds.map((k) => k.kindKey));
  // 2. clauses, from every passage, with how each reaches the anchor
  const clauses = [];
  for (const p of passages) {
    let named = false;
    for (const s of sentencesOf(p.text)) {
      for (const c of clausesOf(s.text)) {
        const text = s.text.slice(c.start, c.end);
        let about = null;
        if (mentions(text, aliases)) about = "name";
        else if (own(p) && [...fold(text).matchAll(/\b(?:the|this)\s+([\p{L}-]+)/gu)].some((m) => kindKeys.has(stemOf(m[1], "en")))) about = "kind";
        else if (own(p) && named && /^\s*(?:it|its)\b/u.test(fold(text))) about = "continuity";
        clauses.push({ ref: p.ref, title: p.title, start: s.start + c.start, end: s.start + c.end, text, about });
      }
      if (mentions(s.text, aliases)) named = true;
    }
  }
  return { anchor, aliases, kinds, clauses };
}

/** The candidate fillers a clause offers for `admits`, with their offsets in the clause. */
function fillersIn(text, admits, aliases) {
  if (admits === "date" || admits === "era" || admits === "year" || admits === "century" || admits === "decade") return datesIn(text).map((d) => ({ value: d.text, start: d.start, end: d.end, type: "date" }));
  if (QUANT_DIM[admits]) return quantitiesIn(text).filter((q) => q.dim === QUANT_DIM[admits]).map((q) => ({ value: q.text, start: q.start, end: q.end, type: "quantity" }));
  if (admits === "count" || admits === "amount") return quantitiesIn(text).map((q) => ({ value: q.text, start: q.start, end: q.end, type: "quantity" }));
  // person / place / thing / a role noun: the perceived names in the clause, other than the anchor's own
  let names = [];
  try { names = extractSurfaces([text]).map((x) => x.surface); } catch { names = []; }
  const longest = names.filter((n) => !names.some((o) => o !== n && o.includes(n)));
  return longest.filter((n) => !mentions(n, aliases) && !aliases.some((a) => fold(n).includes(fold(a)) || fold(a).includes(fold(n))))
    .map((n) => { const at = text.indexOf(n); return { value: n, start: at, end: at + n.length, type: "name" }; }).filter((x) => x.start >= 0);
}

const keyOf = (f) => {
  if (f.type === "date") { const y = String(f.value).match(/\b(\d{3,4})\b/); return y ? y[1] : fold(f.value); }
  if (f.type === "name") { const w = fold(f.value).split(" "); return w[w.length - 1]; }
  return fold(f.value);
};

/** Bind the void's open edge inside the universe. `relationWords`: the ask's own relation surfaces (askFrame predicate + role noun). */
export function bindVoid(fields, universe, { sameAct = null, relationWords = [] } = {}) {
  const out = { edges: [], fillers: [] };
  if (!universe || !universe.anchor || !fields || !fields.admits) return out;
  const rel = relationWords.map((w) => fold(w)).filter(Boolean);
  const isRel = (tok) => rel.some((r) => {
    const t = fold(tok);
    if (t === r) return true;
    if (typeof sameAct === "function") { try { if (sameAct(r, t)) return true; } catch { /* an unknown form is not the act */ } }
    return stemOf(t, "en") === stemOf(r, "en");
  });
  for (const c of universe.clauses) {
    if (!c.about) continue;
    const toks = [...c.text.matchAll(/[\p{L}\p{N}'’-]+/gu)];
    const relTok = toks.find((m) => isRel(m[0]));
    if (!relTok) continue;
    const cands = fillersIn(c.text, fields.admits, universe.aliases);
    if (!cands.length) continue;
    const at = relTok.index;
    const nearest = cands.reduce((b, f) => { const d = Math.min(Math.abs(f.start - at), Math.abs(f.end - at)); return !b || d < b.d ? { f, d } : b; }, null).f;
    out.edges.push({ filler: nearest.value, key: keyOf(nearest), type: nearest.type, ref: c.ref, title: c.title, start: c.start, end: c.end, text: c.text, about: c.about, relation: relTok[0] });
  }
  const byKey = new Map();
  for (const e of out.edges) { if (!byKey.has(e.key)) byKey.set(e.key, { key: e.key, value: e.filler, edges: [] }); byKey.get(e.key).edges.push(e); }
  out.fillers = [...byKey.values()].sort((a, b) => b.edges.length - a.edges.length);
  return out;
}

export default { universeOf, bindVoid };
