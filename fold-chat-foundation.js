// fold-chat-foundation.js — the fold's MIND, consulted: what it has already read, joined to what it reads now.  (2026-10-14)
//
// khora reads a corpus into the weft (the append-only log of passes). Until this module nothing in the chat loaded it — the
// falsification of the foundation read (T10: "a runtime path loads the weft or the persisted hyperlexicon") found only build
// and eval scripts touching it, so the mind was written and never opened. This is the reading end: a pure function from a
// question and the foundation index (scripts/build-foundation-index.mjs) to PASSAGES, in the shape the chat already knows how
// to read, ground against, quote and cite — `{ ref, title, source, url, host, lang, text, via, mind: true }`.
//
// A PASSAGE FROM THE MIND IS A PASSAGE, NOT A VERDICT. It carries the sentence verbatim, the document it was said in and
// its file byte address; it goes through the same pipeline a web page does (the slot pipeline binds it, the snippet
// selector may cut it, the grounder checks the answer against it). Nothing here answers; nothing here is ranked by a score
// a model gave. Retrieval is by CONTENT WORDS shared with the ask, and when it is not licensed it returns NOTHING:
//
//   THE BORN NULL (no hand-set number). A passage bears on an ask only if it shares more of the ask's content words than
//   chance already shares with ask-sized sets of words drawn from the index's own vocabulary. For an ask of n content words
//   the index is probed with `nullDraws` random n-word sets (seeded); `need` is one more than the best coverage ANY draw
//   achieved on ANY unit. If need > n the ask's words are too common to be evidence (one shared word never is) and the
//   result is a typed gap, never the nearest guess.
//
// Pure. The loader takes its fetch as an argument and never throws (a page without the index is a page with no mind yet).

import { tokensOf, stemOf } from "./fold-chat-frame.js";
import { functionWordsOf } from "./fold-chat-snippets.js";

/** Declared, not measured (Constitution II.11). Giver: the user, 2026-10-14 — "make the fold's runtime load the foundation weft so the mind is actually used". */
export const FOUNDATION = Object.freeze({
  giver: "the user, 2026-10-14: wire a consumer so the mind is actually used; declared, not measured",
  indexUrl: "./mind/foundation-index.json",
  maxPassages: 4,        // a turn's material is a handful of sentences, as a web read is (readFor ≤ 6)
  nullDraws: 200,        // random ask-sized word sets the index is probed with to find what chance covers
  seed: 20261014,
});

// words that are the SHAPE of a question, not its subject
const ASKWORDS = new Set(["who", "whom", "whose", "what", "which", "when", "where", "why", "how", "tell", "say", "said", "did", "does", "do", "is", "are", "was", "were", "about", "me", "us", "please"]);

const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/** The content stems of a text, in the index's own terms (no function words, no question shape, each once). */
export function contentStems(text, lang = "en") {
  const fw = functionWordsOf(lang) ?? new Set();
  const seen = new Set(), out = [];
  for (const t of tokensOf(text)) {
    const f = t.fold ?? String(t.text).toLowerCase();
    if (f.length < 3 || fw.has(f) || ASKWORDS.has(f)) continue;   // a year is content: it is what makes a fact a fact
    const s = stemOf(f, lang);
    if (!seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out;
}

/** FoundationIndex@1 JSON → the searchable index (postings by stem). Never throws; a malformed index is null. */
export function indexOf(json, lang = "en") {
  try {
    if (!json || json.schema !== "FoundationIndex@1" || !Array.isArray(json.units) || !Array.isArray(json.docs)) return null;
    const postings = new Map(); const unitTerms = new Array(json.units.length);
    json.units.forEach((u, i) => {
      const terms = contentStems(u[2], lang); unitTerms[i] = terms;
      for (const t of terms) { let p = postings.get(t); if (!p) postings.set(t, (p = [])); p.push(i); }
    });
    return { docs: json.docs, units: json.units, postings, unitTerms, vocab: [...postings.keys()], built: json.built ?? null, weft: json.weft ?? null, lang };
  } catch { return null; }
}

const slugOf = (x) => String(x || "foundation").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "foundation";

/** log2 bin of a document frequency (df 0 and 1 share the rarest bin). */
const binOf = (df) => (df <= 1 ? 0 : Math.floor(Math.log2(df)));

/**
 * What chance covers FOR THESE WORDS: for each of the ask's n content words draw a random word of the SAME document-frequency
 * bin (a rare word is matched with rare words, a common one with common ones), `draws` times, and take the best coverage any
 * unit reached. A fixed null over the whole vocabulary would call every short, plain ask "too common" and every rare one
 * "evidence" for the wrong reason; matching the ask's own frequencies is what makes the bar the ask's own.
 */
export function chanceCoverage(index, terms, { draws = FOUNDATION.nullDraws, seed = FOUNDATION.seed } = {}) {
  if (!index || !terms.length) return 0;
  const byBin = new Map();
  for (const [t, p] of index.postings) { const b = binOf(p.length); (byBin.get(b) ?? byBin.set(b, []).get(b)).push(t); }
  const rnd = mulberry32(seed + terms.length);
  const ask = new Set(terms);
  let best = 0;
  for (let d = 0; d < draws; d++) {
    const counts = new Map();
    for (const t of terms) {
      const pool = byBin.get(binOf((index.postings.get(t) ?? []).length)) ?? byBin.get(0) ?? [];
      if (!pool.length) continue;
      let pick = pool[Math.floor(rnd() * pool.length)], guard = 0;
      while (ask.has(pick) && guard++ < 8) pick = pool[Math.floor(rnd() * pool.length)];
      for (const u of index.postings.get(pick) ?? []) { const c = (counts.get(u) ?? 0) + 1; counts.set(u, c); if (c > best) best = c; }
    }
  }
  return best;
}

/**
 * question → { passages, basis }. `basis` always says what was done: the ask's content stems, the coverage chance reached,
 * the coverage required, how many units met it. An empty `passages` carries `gap` saying why.
 */
export function mindPassagesFor({ question, index, lang = "en", max = FOUNDATION.maxPassages } = {}) {
  if (!index) return { passages: [], basis: null, gap: "no_index" };
  const terms = contentStems(question, lang);
  const n = terms.length;
  if (n < 2) return { passages: [], basis: { terms, n }, gap: n === 0 ? "no_content_words" : "one_word_is_not_evidence" };
  const chance = chanceCoverage(index, terms);
  const need = chance + 1;
  if (need > n) return { passages: [], basis: { terms, n, chance, need }, gap: "ask_words_too_common_to_be_evidence" };
  const cover = new Map();
  for (const t of terms) for (const u of index.postings.get(t) ?? []) cover.set(u, (cover.get(u) ?? 0) + 1);
  const wantsDate = /^\s*when\b|\bwhat year\b|\bwhich year\b|\bin what year\b/i.test(String(question));
  const hasDate = (u) => /\b(?:1[0-9]{3}|20[0-9]{2})\b/.test(index.units[u][2]);
  const hits = [...cover].filter(([, c]) => c >= need)
    .sort((a, b) => b[1] - a[1] || (wantsDate ? (hasDate(b[0]) ? 1 : 0) - (hasDate(a[0]) ? 1 : 0) : 0) || a[0] - b[0]);
  const perDoc = new Map(); const picked = [];
  for (const [u, c] of hits) {                                   // a mind of many voices: at most two sentences from one document
    const d = index.units[u][0]; if ((perDoc.get(d) ?? 0) >= 2) continue;
    perDoc.set(d, (perDoc.get(d) ?? 0) + 1); picked.push([u, c]); if (picked.length >= max) break;
  }
  const passages = picked.map(([u, c]) => {
    const [d, at, text] = index.units[u]; const doc = index.docs[d];
    return {
      ref: `${doc.source || "Foundation"} — ${doc.title}`, title: doc.title, source: doc.source_url || `foundation:${doc.file}`, url: `foundation://${slugOf(doc.source)}/${doc.file}#${at}`,
      host: "foundation", site: doc.source || "the foundation read", lang: doc.lang === "en" || !doc.lang ? "en" : doc.lang, text, via: "mind", mind: true,
      layer: doc.layer, license: doc.license, address: { file: doc.file, at }, coverage: c,
    };
  });
  return { passages, basis: { terms, n, chance, need, matched: hits.length }, gap: passages.length ? null : "nothing_met_the_bar" };
}

/** The mind's passages go in FRONT of what the web returned (what was already read and kept is read first); duplicates by address are dropped. */
export function mergeMind(webPassages, mind, max = FOUNDATION.maxPassages) {
  const web = Array.isArray(webPassages) ? webPassages : [];
  const m = (mind?.passages ?? []).slice(0, max);
  if (!m.length) return web;
  const have = new Set(m.map((p) => p.url));
  return [...m, ...web.filter((p) => !have.has(p?.url))];
}

// ── the loader: one fetch per page load, never throws ───────────────────────────────────────────────────────────────
// Two indexes may be present: the committed one (open-licence documents) and a LOCAL one (closed-licence text the person holds in
// their own corpus cache, git-ignored, never served from anywhere but their own machine). Each is optional; both are merged.
let loading = null;
const LOCAL_URL = "./mind/foundation-index.local.json";
export function ensureFoundation({ fetchImpl = (typeof fetch === "function" ? fetch : null), url = FOUNDATION.indexUrl, localUrl = LOCAL_URL, lang = "en" } = {}) {
  if (loading) return loading;
  if (!fetchImpl) return (loading = Promise.resolve(null));
  const get = async (u) => { try { const r = await fetchImpl(u, { cache: "force-cache" }); return r && r.ok ? await r.json() : null; } catch { return null; } };
  loading = (async () => {
    const [pub, loc] = await Promise.all([get(url), localUrl ? get(localUrl) : null]);
    const ok = (j) => j && j.schema === "FoundationIndex@1" && Array.isArray(j.units) && Array.isArray(j.docs);
    if (!ok(pub) && !ok(loc)) return null;
    if (!ok(loc)) return indexOf(pub, lang);
    if (!ok(pub)) return indexOf(loc, lang);
    const off = pub.docs.length;                                  // the local units point past the public documents
    return indexOf({ ...pub, docs: [...pub.docs, ...loc.docs], units: [...pub.units, ...loc.units.map((u) => [u[0] + off, u[1], u[2]])] }, lang);
  })();
  return loading;
}
/** Test seam: forget the loaded index. */
export const resetFoundation = () => { loading = null; };
