// work-card.js — A WORK, READY BEFORE IT IS ASKED ABOUT.  (2026-10-14)
//
// "It needs to happen mechanically, instantly, when we ask something as broad as 'so what's the deal with the Republic?'. It may not
// use all of this context, but it's ready for it" and "it needs to run without you holding its hand … across languages and texts"
// (the user, 2026-10-14). A work is folded ONCE, offline, into a small CARD; a question is then only a lookup and a selection.
//
//   buildCard   text → { pins, characteristic terms, key spans (byte-addressed, hashed), lanes }      (offline, per work)
//   nullTable   how well a RANDOM question of k terms routes: the best score any card gets from random terms, k = 1..K
//   routeQuestion  question → the card, or a typed refusal when it does no better than chance (born null, no typed threshold)
//   packetFor   route + select → the packet a mouth narrates from; never the whole work
//
// Language-agnostic by construction: terms are Unicode letter runs lowercased and de-accented (character bigrams where the script has
// no word spaces: Han, Hiragana, Katakana), weighted by the collection's own inverse document frequency — there is no stop list, no
// stemmer, no per-language switch. What each language's own parser would add is a separate lane, not a precondition.
//
// BUDGETS (declared, not thresholds of truth): SPANS key spans per work, TERMS characteristic terms, the span length window.
import crypto from "node:crypto";

export const BUDGET = Object.freeze({ spans: 8, terms: 40, minSpan: 80, maxSpan: 700, nullDraws: 300, maxK: 12, seed: 20261014 });
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const deaccent = (s) => s.normalize("NFD").replace(/\p{M}+/gu, "").replace(/ς/g, "σ");
const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

/** text → array of terms (lowercased, de-accented words ≥3 letters; bigrams for unspaced scripts). */
export function termsOf(text) {
  const out = [];
  for (const m of deaccent(String(text ?? "").toLowerCase()).matchAll(/[\p{L}]+/gu)) {
    const w = m[0];
    if (UNSPACED.test(w)) { for (let i = 0; i + 1 < w.length; i++) out.push(w.slice(i, i + 2)); }
    else if (w.length >= 3) out.push(w);
  }
  return out;
}

/** Collection statistics: document frequency of every term over the works. */
export function collectionOf(works) {
  const df = new Map(), byLang = new Map();
  for (const w of works) {
    const ts = new Set([...termsOf(unbracketed(w.text)), ...termsOf(w.title ?? "")]);                 // a work's name is part of what it says it is
    for (const t of ts) df.set(t, (df.get(t) ?? 0) + 1);
    if (w.lang) { const g = byLang.get(w.lang) ?? { df: new Map(), N: 0 }; g.N += 1; for (const t of ts) g.df.set(t, (g.df.get(t) ?? 0) + 1); byLang.set(w.lang, g); }
  }
  return { df, N: works.length, byLang };
}
// pooled idf, discounted by how common the term is among the works of the card's OWN language: a function word is common in its
// language even when the other languages make it rare in the pool. No stop list, no per-language switch; the language is a card's label.
const idf = (col, t, lang) => {
  const base = Math.log((col.N + 1) / ((col.df.get(t) ?? 0) + 0.5));
  const g = lang && col.byLang?.get(lang); if (!g || g.N < 2) return base;
  return base * (1 - (g.df.get(t) ?? 0) / g.N);
};

/** Editorial apparatus in square brackets (sidenotes, footnotes, page marks) is not the work's own prose. */
export const unbracketed = (t) => String(t).replace(/\[[^\]]{0,600}\]/g, " ");
/** Prose-shaped: sentences of several words (a cast list, a heading or an index entry is not), in any script. */
export function proseLike(t) {
  const c = unbracketed(t).replace(/_/g, " ").trim(); if (c.length < 160) return false;
  const ss = c.split(/[.!?。！？;；:：]+/).map((x) => x.trim()).filter(Boolean); if (!ss.length) return false;
  const words = (x) => (UNSPACED.test(x) ? Math.ceil(x.length / 2) : x.split(/\s+/).filter(Boolean).length);
  return ss.reduce((a, x) => a + words(x), 0) / ss.length >= 6;
}
/** The paragraphs of a text with their byte spans. */
export function paragraphsOf(text) {
  const out = []; let pos = 0, b = 0;
  for (const m of text.matchAll(/[^\n]+(?:\n(?!\s*\n)[^\n]+)*/g)) {
    b += Buffer.byteLength(text.slice(pos, m.index), "utf8"); const bl = Buffer.byteLength(m[0], "utf8");
    out.push({ text: m[0], byteStart: b, byteEnd: b + bl }); b += bl; pos = m.index + m[0].length;
  }
  return out;
}

/** One work → its card. `text` is the whole text (utf8 string); `file` is where it lives; `titleTerms` come from its name. */
export function buildCard({ id, lang, title, file, text, col, lanes = [], budget = BUDGET }) {
  const buf = Buffer.from(text, "utf8");
  const tf = new Map(); for (const t of termsOf(unbracketed(text))) tf.set(t, (tf.get(t) ?? 0) + 1);
  const weighted = [...tf].map(([t, n]) => [t, (1 + Math.log(n)) * idf(col, t, lang)]).sort((a, b) => b[1] - a[1]);
  const characteristic = weighted.slice(0, budget.terms).map(([t, w]) => ({ t, w: Math.round(w * 100) / 100 }));
  const charSet = new Map(characteristic.map((c) => [c.t, c.w]));
  const pins = [...new Set(termsOf(title))];
  // key spans: the paragraph in each of `spans` equal byte bins that carries the most characteristic weight per sqrt(length)
  const paras = paragraphsOf(text).filter((p) => p.byteEnd - p.byteStart >= budget.minSpan && proseLike(p.text));
  const total = buf.length || 1; const bins = Array.from({ length: budget.spans }, () => null);
  for (const p of paras) {
    const bi = Math.min(budget.spans - 1, Math.floor((p.byteStart / total) * budget.spans));
    const ts = new Set(termsOf(unbracketed(p.text))); let s = 0; for (const t of ts) s += charSet.get(t) ?? 0;
    const score = s / Math.sqrt(ts.size || 1);
    if (!bins[bi] || score > bins[bi].score) bins[bi] = { ...p, score };
  }
  const keySpans = bins.filter((b) => b && b.score > 0).map((b) => {
    const end = Math.min(b.byteEnd, b.byteStart + budget.maxSpan * 3);               // a window never splits a UTF-8 sequence: re-slice by decoding
    const slice = buf.subarray(b.byteStart, end).toString("utf8").replace(/�+$/u, "");
    const bytes = Buffer.from(slice, "utf8");
    return { byteStart: b.byteStart, byteEnd: b.byteStart + bytes.length, sha256: sha(bytes), score: Math.round(b.score * 100) / 100, preview: slice.replace(/\s+/g, " ").slice(0, budget.maxSpan) };
  });
  return { schema: "WorkCard@1", id, lang, title, file, bytes: buf.length, pins, characteristic, keySpans, lanes, builtWith: { budget: { spans: budget.spans, terms: budget.terms }, terms: "unicode letter runs; bigrams for unspaced scripts; collection idf" } };
}

/** The signature a question is matched against: a card's pins plus its characteristic terms, each with its collection weight. */
function signatureOf(card, col) {
  const m = new Map();
  for (const t of card.pins) m.set(t, (m.get(t) ?? 0) + idf(col, t, card.lang) * 2);            // a name in the title counts double: a rigid pin
  for (const c of card.characteristic) m.set(c.t, Math.max(m.get(c.t) ?? 0, idf(col, c.t, card.lang)));
  return m;
}
const scoreOf = (sig, qTerms) => { let s = 0; for (const t of new Set(qTerms)) s += sig.get(t) ?? 0; return s; };

/** The best a RANDOM question of k terms does against these cards (per-k maximum over seeded draws). */
export function nullTable(cards, col, budget = BUDGET, fullVocab = null) {
  const vocab = fullVocab ?? [...col.df.keys()]; const rnd = mulberry32(budget.seed); const sigs = cards.map((c) => signatureOf(c, col));
  const table = [0];
  for (let k = 1; k <= budget.maxK; k++) {
    let best = 0;
    for (let d = 0; d < budget.nullDraws; d++) {
      const q = Array.from({ length: k }, () => vocab[Math.floor(rnd() * vocab.length)]).filter((t) => col.df.has(t));   // the runtime counts only the terms it knows
      for (const s of sigs) { const v = scoreOf(s, q); if (v > best) best = v; }
    }
    table.push(best);
  }
  return table;
}


// ── serialisation: the index a page loads. The collection is cut to the terms a card signature can score (a term in no signature
// contributes nothing to any score), and the null table is rebuilt on that same cut so k means the same thing at build and at runtime.
export function serializeIndex(cards, col, budget = BUDGET) {
  const need = new Set(); for (const c of cards) { for (const t of c.pins) need.add(t); for (const x of c.characteristic) need.add(x.t); }
  const lite = { df: new Map([...need].map((t) => [t, col.df.get(t) ?? 0])), N: col.N, byLang: new Map() };
  for (const [l, g] of col.byLang ?? []) lite.byLang.set(l, { N: g.N, df: new Map([...need].map((t) => [t, g.df.get(t) ?? 0]).filter(([, n]) => n > 0)) });
  const fullVocab = [...col.df.keys()];
  const nullMax = nullTable(cards, lite, budget, fullVocab);
  return { schema: "WorkCardIndex@1", at: new Date().toISOString(), N: lite.N, df: Object.fromEntries(lite.df), byLang: Object.fromEntries([...lite.byLang].map(([l, g]) => [l, { N: g.N, df: Object.fromEntries(g.df) }])), nullMax, cards, budget: { spans: budget.spans, terms: budget.terms, maxK: budget.maxK } };
}
export function indexFromSerialized(obj) {
  if (!obj || obj.schema !== "WorkCardIndex@1" || !Array.isArray(obj.cards) || !Array.isArray(obj.nullMax)) return null;
  const col = { df: new Map(Object.entries(obj.df)), N: obj.N, byLang: new Map(Object.entries(obj.byLang ?? {}).map(([l, g]) => [l, { N: g.N, df: new Map(Object.entries(g.df)) }])) };
  const budget = { ...BUDGET, ...(obj.budget ?? {}) };
  return { cards: obj.cards, col, sigs: obj.cards.map((c) => signatureOf(c, col)), nullMax: obj.nullMax, budget };
}

/** A routing index over the cards: built once, then every question is a few map lookups. */
export function indexCards(cards, col, budget = BUDGET) {
  return { cards, col, sigs: cards.map((c) => signatureOf(c, col)), nullMax: nullTable(cards, col, budget), budget };
}

/** question → { card, score, nullMax, k } or a typed refusal. Never a guess: below the null, no card. */
export function routeQuestion(question, index) {
  const q = termsOf(question); const known = q.filter((t) => index.col.df.has(t));
  const k = Math.min(Math.max(1, new Set(known).size), index.budget.maxK);
  if (!known.length) return { refusal: "no_known_terms", k: 0 };
  let best = -1, bi = -1, second = -1;
  for (let i = 0; i < index.sigs.length; i++) { const s = scoreOf(index.sigs[i], known); if (s > best) { second = best; best = s; bi = i; } else if (s > second) second = s; }
  const nullMax = index.nullMax[k];
  if (best <= nullMax) return { refusal: "not_above_chance", score: best, nullMax, k };
  return { card: index.cards[bi], score: best, runnerUp: Math.max(0, second), nullMax, k };
}


// ── LANGUAGE-GROUPED INDEX: idf within a language, one null across groups ───────────────────────────────────────────────────────────
// A pooled idf makes Spanish function words look rare beside English ones. Each language group weighs terms by ITS OWN works; a
// question is scored in every group, each score normalised by what random vocabulary scores there (mean of the best score over
// seeded draws), and the question is accepted only above the best normalised score any random question reaches across all groups
// — the Bonferroni-by-count is carried by taking the max over groups inside the null itself.
export function indexCardsGrouped(cards, colByLang, budget = BUDGET) {
  const groups = new Map();
  cards.forEach((c, i) => { const g = groups.get(c.lang) ?? { lang: c.lang, col: colByLang.get(c.lang), idx: [] }; g.idx.push(i); groups.set(c.lang, g); });
  const G = [...groups.values()];
  for (const g of G) g.sigs = g.idx.map((i) => signatureOf(cards[i], g.col));
  const pooled = new Map(); for (const g of G) for (const t of g.col.df.keys()) pooled.set(t, true);
  const vocab = [...pooled.keys()];
  const bestIn = (g, q) => { let b = 0, bi = -1; for (let j = 0; j < g.sigs.length; j++) { const v = scoreOf(g.sigs[j], q); if (v > b) { b = v; bi = g.idx[j]; } } return [b, bi]; };
  const rnd = mulberry32(budget.seed + 11);
  const scale = new Map(), nullRatio = [0];
  for (let k = 1; k <= budget.maxK; k++) {
    const sums = new Map(G.map((g) => [g.lang, 0])); const qs = [];
    for (let d = 0; d < budget.nullDraws; d++) { const q = Array.from({ length: k }, () => vocab[Math.floor(rnd() * vocab.length)]); qs.push(q); for (const g of G) sums.set(g.lang, sums.get(g.lang) + bestIn(g, q.filter((t) => g.col.df.has(t)))[0]); }
    const sc = new Map(G.map((g) => [g.lang, Math.max(1e-6, sums.get(g.lang) / budget.nullDraws)])); scale.set(k, sc);
    let mx = 0; for (const q of qs) for (const g of G) { const r = bestIn(g, q.filter((t) => g.col.df.has(t)))[0] / sc.get(g.lang); if (r > mx) mx = r; }
    nullRatio.push(mx);
  }
  return { grouped: true, cards, groups: G, scale, nullRatio, bestIn, budget };
}
export function routeGrouped(question, index) {
  const q = termsOf(question); let best = { ratio: -1 };
  const known = (g) => q.filter((t) => g.col.df.has(t));
  const any = index.groups.some((g) => known(g).length);
  if (!any) return { refusal: "no_known_terms", k: 0 };
  for (const g of index.groups) {
    const kt = known(g); if (!kt.length) continue;
    const k = Math.min(Math.max(1, new Set(kt).size), index.budget.maxK);
    const [score, ci] = index.bestIn(g, kt); if (ci < 0) continue;
    const ratio = score / index.scale.get(k).get(g.lang);
    if (ratio > best.ratio) best = { ratio, score, ci, k, lang: g.lang };
  }
  if (best.ci === undefined || best.ratio <= index.nullRatio[best.k]) return { refusal: "not_above_chance", ratio: best.ratio, nullMax: index.nullRatio[best.k ?? 1], k: best.k ?? 0 };
  return { card: index.cards[best.ci], score: best.score, ratio: best.ratio, nullMax: index.nullRatio[best.k], k: best.k, lang: best.lang };
}

/** The packet a mouth narrates from: the route, the card's selection, the lanes with their standing. A broad question takes the
 *  card's arc (key spans in order); a narrow one takes the spans that carry the question's own terms first. */
export const DISTANCES = Object.freeze([
  { d: 0, name: "near", spans: 8, terms: 12 },       // every key span, verbatim, in the arc of the work
  { d: 1, name: "default", spans: 5, terms: 12 },
  { d: 2, name: "far", spans: 3, terms: 8 },
  { d: 3, name: "farthest", spans: 1, terms: 6 },    // the single span that carries most of the work, and its few characteristic terms
]);
/** A meta command over the fold: DISTANCE(set, d) | DISTANCE(shift, ±n). Pure; the state is just the integer. Clamped to the ladder. */
export function applyDistance(current, cmd) {
  const last = DISTANCES.length - 1; const c = Number.isFinite(current) ? current : 1;
  const next = cmd?.op === "set" ? Number(cmd.value) : c + Number(cmd?.value ?? 0);
  return Math.max(0, Math.min(last, Math.round(Number.isFinite(next) ? next : c)));
}
export function packetFor(question, index, { distance = 1 } = {}) {
  const t0 = process.hrtime.bigint();
  const r = index.grouped ? routeGrouped(question, index) : routeQuestion(question, index);
  if (r.refusal) return { kind: "WorkPacket@1", ready: true, work: null, refusal: r.refusal, route: r, ms: Number(process.hrtime.bigint() - t0) / 1e6 };
  const D = DISTANCES[Math.max(0, Math.min(DISTANCES.length - 1, distance))];
  const qs = new Set(termsOf(question)); const c = r.card;
  const hit = (s) => { let n = 0; for (const t of new Set(termsOf(s.preview))) if (qs.has(t) && !c.pins.includes(t)) n += 1; return n; };
  const narrow = c.keySpans.some((s) => hit(s) > 0);
  // ONE ordering of the card's spans, then a prefix of it: so a farther distance is always a subset of a nearer one (nested folds).
  // Broad: farther keeps the spans that carry the most characteristic weight; narrow: the spans that carry the question's terms first.
  const ordered = narrow ? [...c.keySpans].sort((a, b) => hit(b) - hit(a) || b.score - a.score || a.byteStart - b.byteStart) : [...c.keySpans].sort((a, b) => b.score - a.score || a.byteStart - b.byteStart);
  const picked = new Set(ordered.slice(0, D.spans).map((s) => s.byteStart));
  const spans = c.keySpans.filter((s) => picked.has(s.byteStart));                      // shown in the work's own order
  return { kind: "WorkPacket@1", ready: true, work: { id: c.id, title: c.title, lang: c.lang, file: c.file, bytes: c.bytes }, route: { score: r.score, runnerUp: r.runnerUp ?? null, nullMax: r.nullMax, k: r.k, ...(r.ratio !== undefined ? { ratio: r.ratio, lang: r.lang } : {}) }, mode: narrow ? "narrow" : "broad", distance: D.d, distanceName: D.name, characteristic: c.characteristic.slice(0, D.terms).map((x) => x.t), keySpans: spans, lanes: c.lanes, standing: "mechanical selection; the mouth narrates, it adds nothing", ms: Number(process.hrtime.bigint() - t0) / 1e6 };
}
