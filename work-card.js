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
// (no static node:crypto import: the chat page imports this module through work-card-runtime.js, and a browser/extension bundle cannot ship a node: specifier.
//  Hashing a span happens only when a card is BUILT, offline, in node — see scripts/build-work-cards.mjs — so it is reached by call, not by import.)

export const BUDGET = Object.freeze({ spans: 8, terms: 40, minSpan: 80, maxSpan: 700, nullDraws: 300, maxK: 12, seed: 20261014 });
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const sha = (b) => {
  const c = globalThis.process?.getBuiltinModule?.("node:crypto");
  if (!c) throw new Error("work-card: sha256 of a span is computed when a card is built (node); this runtime only reads built cards");
  return c.createHash("sha256").update(b).digest("hex");
};
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
  const common = [...commonTerms(col)];
  const need = new Set(); for (const c of cards) { for (const t of c.pins) need.add(t); for (const x of c.characteristic) need.add(x.t); }
  const lite = { df: new Map([...need].map((t) => [t, col.df.get(t) ?? 0])), N: col.N, byLang: new Map() };
  for (const [l, g] of col.byLang ?? []) lite.byLang.set(l, { N: g.N, df: new Map([...need].map((t) => [t, g.df.get(t) ?? 0]).filter(([, n]) => n > 0)) });
  // the null is computed on the LITE collection the page will actually have (k means 'known terms'), against random known terms AND against
  // other works' own characteristic terms; the earlier build drew random words from the full vocabulary and dropped the unknown ones, which
  // left nullMax at 0.0 for nominal k=1 and a 2.6 plateau after it
  const knownVocab = [...lite.df.keys()];
  const nullMax = nullTable(cards, lite, budget, knownVocab), nullCard = nullTableOtherWorks(cards, lite, budget);
  return { schema: "WorkCardIndex@1", at: new Date().toISOString(), N: lite.N, df: Object.fromEntries(lite.df), byLang: Object.fromEntries([...lite.byLang].map(([l, g]) => [l, { N: g.N, df: Object.fromEntries(g.df) }])), nullMax, nullCard, common, cards, budget: { spans: budget.spans, terms: budget.terms, maxK: budget.maxK } };
}
export function indexFromSerialized(obj) {
  if (!obj || obj.schema !== "WorkCardIndex@1" || !Array.isArray(obj.cards) || !Array.isArray(obj.nullMax)) return null;
  const col = { df: new Map(Object.entries(obj.df)), N: obj.N, byLang: new Map(Object.entries(obj.byLang ?? {}).map(([l, g]) => [l, { N: g.N, df: new Map(Object.entries(g.df)) }])) };
  const budget = { ...BUDGET, ...(obj.budget ?? {}) };
  const sigs = obj.cards.map((c) => signatureOf(c, col));
  return { cards: obj.cards, col, sigs, held: heldOf(sigs), nullMax: obj.nullMax, nullCard: obj.nullCard ?? null, common: new Set(obj.common ?? []), budget };
}


/** The best score a question ABOUT ANOTHER WORK gets on a given card: for every card j, draw k of its own characteristic terms and score
 *  them against every OTHER card i; table[i][k] is the max over j and draws. It is per card on purpose: a single max over all pairs
 *  grows with the number of cards and is set by the one pair of sibling works, which refused most true questions at 80 cards (held-out
 *  routing 68% -> 30%); a per-card threshold is strict exactly where a card is confusable (Aristophanes' Clouds vs Birds) and no stricter
 *  elsewhere. A random-vocabulary null says nothing about this case: 13% of questions about works with NO card were routed to a wrong
 *  card before it existed. */
export function nullTableOtherWorks(cards, col, budget = BUDGET) {
  const rnd = mulberry32(budget.seed + 3); const sigs = cards.map((c) => signatureOf(c, col));
  const perCard = Math.max(8, Math.ceil(budget.nullDraws / Math.max(1, cards.length)));
  const table = cards.map(() => new Array(budget.maxK + 1).fill(0));
  for (let k = 1; k <= budget.maxK; k++) {
    cards.forEach((c, j) => {
      const pool = c.characteristic.map((x) => x.t).filter((t) => col.df.has(t)); if (pool.length < k) return;
      for (let d = 0; d < perCard; d++) {
        const q = new Set(); while (q.size < k) q.add(pool[Math.floor(rnd() * pool.length)]);
        const qa = [...q];
        for (let i = 0; i < sigs.length; i++) if (i !== j) { const v = scoreOf(sigs[i], qa); if (v > table[i][k]) table[i][k] = v; }
      }
    });
  }
  return table;
}

/** Terms that are in the majority of a language's works (or of the pool when no language is labelled): function-like, not names. A majority
 *  is the natural cut; nothing is listed and no number is tuned. */
export function commonTerms(col) {
  const out = new Set();
  if (col.byLang?.size) { for (const [, g] of col.byLang) if (g.N >= 3) for (const [t, n] of g.df) if (n * 2 > g.N) out.add(t); }
  else for (const [t, n] of col.df) if (n * 2 > col.N) out.add(t);
  return out;
}

/** Every term some card names or is characterised by: computed ONCE per index (it was rebuilt on every question). */
const heldOf = (sigs) => { const h = new Set(); for (const s of sigs) for (const t of s.keys()) h.add(t); return h; };

/** A routing index over the cards: built once, then every question is a few map lookups. */
export function indexCards(cards, col, budget = BUDGET) {
  const sigs = cards.map((c) => signatureOf(c, col));
  return { cards, col, sigs, held: heldOf(sigs), nullMax: nullTable(cards, col, budget), nullCard: nullTableOtherWorks(cards, col, budget), common: commonTerms(col), budget };
}

/** question → { card, score, nullMax, k } or a typed refusal. Never a guess: below the null, no card. */
export function routeQuestion(question, index) {
  const q = termsOf(question); const known = q.filter((t) => index.col.df.has(t));
  const k = Math.min(Math.max(1, new Set(known).size), index.budget.maxK);
  if (!known.length) return { refusal: "no_known_terms", k: 0, asked: [...new Set(q)], known: [] };
  let best = -1, bi = -1, second = -1;
  for (let i = 0; i < index.sigs.length; i++) { const s = scoreOf(index.sigs[i], known); if (s > best) { second = best; best = s; bi = i; } else if (s > second) second = s; }
  // the bar: what random vocabulary reaches, and what OTHER works' terms reach on THIS card
  const nullMax = Math.max(index.nullMax[k], index.nullCard?.[bi]?.[k] ?? 0);
  const card = index.cards[bi];
  // NAMES. The question names things. P: asked terms that are this card's own title terms. U: asked terms that NO card names or is
  // characterised by and that are not common words of the collection (the question names something the fold does not hold). A name
  // that belongs to this card carries the question when it outnumbers the names the card cannot account for; otherwise the content
  // overlap has to clear the bar on its own. ("tell me about Tom Sawyer" shares "adventures" with Alice's title: P=1, U=2 -> not Alice.)
  const asked = [...new Set(q)]; const held = index.held;
  // a title word that is a common word of the collection ("the", "of") names nothing
  const P = known.filter((t, i) => card.pins.includes(t) && !index.common?.has(t) && known.indexOf(t) === i);
  const U = asked.filter((t) => !held.has(t) && !(index.common?.has(t)) && t.length >= 3);
  const byName = P.length > 0 && P.length > U.length;
  if (best <= nullMax && !byName) return { refusal: "not_above_chance", score: best, nullMax, k, asked, known: [...new Set(known)], named: P, unnamed: U, nearest: card };
  return { card, score: best, runnerUp: Math.max(0, second), nullMax, k, viaPin: P.length > 0, named: P, unheld: U, byName };
}

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
/** A POSITIVE VOID. Not holding a work is a fact the fold asserts, with its terms, not a silence the caller has to infer.
 *  `unheld` are the asked terms that no card names or is characterised by; `nearest` is the closest card and why it is NOT the answer
 *  (below the bar for this question); `fill` says what would make the void a work. The mouth narrates "the fold holds no card for ..."; it
 *  never answers from `nearest`. */
export function voidOf(question, index, r) {
  const sigTerms = index.held;
  const asked = r.asked ?? [...new Set(termsOf(question))];
  const unheld = asked.filter((t) => !sigTerms.has(t));
  const named = unheld.filter((t) => !index.common?.has(t) && t.length >= 3);   // asked, rare, held by no card: what the question names that the fold does not hold
  const n = r.nearest ?? null;
  return {
    kind: "WorkVoid@1", asserted: true, question: String(question).slice(0, 300),
    absence: r.refusal === "no_known_terms" ? { reason: "no_known_terms", detail: "no word of the question is one any card names or is characterised by" }
      : r.refusal === "not_above_chance" ? { reason: "not_above_the_bar", detail: `the best card scores ${r.score?.toFixed?.(1)} and this card's bar for a question of ${r.k} known term${r.k === 1 ? "" : "s"} is ${r.nullMax?.toFixed?.(1)}: what it shares with the question is no more than other works' words share with it` }
      : { reason: String(r.refusal), detail: "" },
    asked, unheld, named,
    nearest: n ? { id: n.id, title: n.title, lang: n.lang, score: r.score ?? null, bar: r.nullMax ?? null, isTheAnswer: false } : null,
    fill: named.length ? `no card names or characterises: ${named.slice(0, 8).join(", ")}; reading the work they name into a card (scripts/build-work-cards.mjs) would close this void` : "the question's words are held, but none of them singles out one work above the bar",
    standing: "asserted by the router; the mouth narrates it and answers from nothing else",
  };
}

export function packetFor(question, index, { distance = 1 } = {}) {
  const t0 = process.hrtime.bigint();
  const r = routeQuestion(question, index);
  if (r.refusal) return { kind: "WorkPacket@1", ready: true, work: null, refusal: r.refusal, void: voidOf(question, index, r), route: r, ms: Number(process.hrtime.bigint() - t0) / 1e6 };
  const D = DISTANCES[Math.max(0, Math.min(DISTANCES.length - 1, distance))];
  const qs = new Set(termsOf(question)); const c = r.card;
  const hit = (s) => { let n = 0; for (const t of new Set(termsOf(s.preview))) if (qs.has(t) && !c.pins.includes(t)) n += 1; return n; };
  const narrow = c.keySpans.some((s) => hit(s) > 0);
  // ONE ordering of the card's spans, then a prefix of it: so a farther distance is always a subset of a nearer one (nested folds).
  // Broad: farther keeps the spans that carry the most characteristic weight; narrow: the spans that carry the question's terms first.
  const ordered = narrow ? [...c.keySpans].sort((a, b) => hit(b) - hit(a) || b.score - a.score || a.byteStart - b.byteStart) : [...c.keySpans].sort((a, b) => b.score - a.score || a.byteStart - b.byteStart);
  const picked = new Set(ordered.slice(0, D.spans).map((s) => s.byteStart));
  const spans = c.keySpans.filter((s) => picked.has(s.byteStart));                      // shown in the work's own order
  return { kind: "WorkPacket@1", ready: true, work: { id: c.id, title: c.title, lang: c.lang, file: c.file, bytes: c.bytes }, route: { score: r.score, runnerUp: r.runnerUp ?? null, nullMax: r.nullMax, k: r.k, viaPin: r.viaPin ?? null, ...(r.ratio !== undefined ? { ratio: r.ratio, lang: r.lang } : {}) }, mode: narrow ? "narrow" : "broad", distance: D.d, distanceName: D.name, characteristic: c.characteristic.slice(0, D.terms).map((x) => x.t), keySpans: spans, lanes: c.lanes, standing: "mechanical selection; the mouth narrates, it adds nothing", ms: Number(process.hrtime.bigint() - t0) / 1e6 };
}
