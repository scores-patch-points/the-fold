// work-card.meta-detect.mjs — CAN "SHORTER" BE RECOGNISED AS ABOUT THE ANSWER, IN ANY LANGUAGE, WITH NO WORD LIST?  (2026-10-14)
//
//   node work-card.meta-detect.mjs
//
// A request about the previous answer ("shorter", "más breve", "更短") has no TOPIC of its own. A topical question reaches at least one
// term that is specific to some work; a meta utterance reaches only terms every work in its language already uses. So: the specificity
// of an utterance is the largest collection weight among its known terms, weighed within the language group where it is most known
// (pooled idf discounted by the term's rate among the works of that language — the same weight the cards use). No word is listed.
// Reported threshold-free: AUC = P(a topical question is more specific than a meta utterance), plus the operating point "below the least
// specific topical question that routed correctly". The utterances below are TEST INPUTS, not a system list. Languages absent from
// the collection (de, fr, ja here) have no known terms: they read as topic-less, which is right for "kürzer" and wrong for a German
// topical question — measured separately and reported, not hidden.
import fs from "node:fs";
import path from "node:path";
import { BUDGET, termsOf, collectionOf } from "./work-card.js";

const ZEN = "/Users/mlacy/Documents/3.0/Zenodotus/";
const LANGS = [["en", "01-literature-books/gutenberg/"], ["grc", "11-multi-language/greek-originals/"], ["es", "24-global-literature/es/"], ["pt", "24-global-literature/pt/"], ["zh", "24-global-literature/zh/"], ["ca", "24-global-literature/ca/"], ["eo", "24-global-literature/eo/"], ["tl", "24-global-literature/tl/"]];
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rnd = mulberry32(BUDGET.seed + 1);
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const works = [];
for (const [lang, dir] of LANGS) {
  const files = fs.readdirSync(ZEN + dir).filter((f) => f.endsWith(".txt")).map((f) => path.join(ZEN + dir, f)).filter((f) => { const n = fs.statSync(f).size; return n >= 60_000 && n <= 3_000_000; }).sort();
  for (const f of shuffle(files).slice(10, 20)) works.push({ lang, file: f });                          // sample B: not used to develop the weights
}
for (const w of works) { w.text = fs.readFileSync(w.file, "utf8"); const cut = w.text.indexOf("\n\n", Math.floor(w.text.length / 2)); const mid = cut < 0 ? Math.floor(w.text.length / 2) : cut; w.first = w.text.slice(0, mid); w.second = w.text.slice(mid); }
const col = collectionOf(works.map((w) => ({ text: w.first, lang: w.lang })));
const weight = (g, t) => { const b = Math.log((col.N + 1) / ((col.df.get(t) ?? 0) + 0.5)); return b * (1 - (g.df.get(t) ?? 0) / g.N); };
function specificity(utterance) {
  const ts = [...new Set(termsOf(utterance))]; if (!ts.length) return { s: 0, lang: null, known: 0 };
  let best = null;
  for (const [lang, g] of col.byLang) { const known = ts.filter((t) => g.df.has(t)); if (!known.length) continue; const s = Math.max(...known.map((t) => weight(g, t))); if (!best || known.length > best.known || (known.length === best.known && s > best.s)) best = { s, lang, known: known.length }; }
  return best ?? { s: 0, lang: null, known: 0 };
}
const META = ["shorter", "briefer", "make it shorter", "more detail", "explain more", "simpler", "tl;dr", "say that again", "más corto", "más breve", "explícame más", "más detalle", "mais curto", "mais breve", "explique melhor", "més curt", "explica més", "kürzer", "knapper", "erklär mehr", "plus court", "plus de détails", "pli mallonge", "mas maikli", "更短", "详细一点", "もっと短く"];
// topical questions: the 3 terms most characteristic of each work's held-out second half (what a person asks about a work)
const idfSub = (l, t) => weight(col.byLang.get(l), t);
const CONTENT = works.map((w) => { const tf = new Map(); for (const t of termsOf(w.second)) tf.set(t, (tf.get(t) ?? 0) + 1); return { lang: w.lang, q: [...tf].filter(([t, n]) => n >= 2 && col.df.has(t)).map(([t, n]) => [t, (1 + Math.log(n)) * idfSub(w.lang, t)]).sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[0]).join(" ") }; }).filter((x) => x.q);
const sm = META.map((u) => ({ u, ...specificity(u) })), sc = CONTENT.map((c) => ({ ...c, ...specificity(c.q) }));
let gt = 0, eq = 0; for (const c of sc) for (const m of sm) { if (c.s > m.s) gt += 1; else if (c.s === m.s) eq += 1; }
const auc = (gt + 0.5 * eq) / (sc.length * sm.length);
const floor = Math.min(...sc.map((c) => c.s));
const metaBelow = sm.filter((m) => m.s < floor).length, contentBelow = sc.filter((c) => c.s < floor).length;
const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
console.log(`collection: ${works.length} works, ${col.byLang.size} languages · topical questions ${sc.length} · meta utterances ${sm.length} (${new Set(META.map((m) => m)).size})`);
console.log(`specificity — topical median ${med(sc.map((c) => c.s)).toFixed(2)} (min ${floor.toFixed(2)}) · meta median ${med(sm.map((m) => m.s)).toFixed(2)}`);
console.log(`AUC (topical more specific than meta) = ${auc.toFixed(3)} · operating point "below the least specific topical question": meta caught ${metaBelow}/${sm.length}, topical wrongly caught ${contentBelow}/${sc.length}`);
console.log(`\nmeta utterances by specificity:`); for (const m of sm.sort((a, b) => b.s - a.s)) console.log(`  ${m.s.toFixed(2).padStart(6)}  ${String(m.lang ?? "-").padEnd(4)} known ${m.known}  ${m.u}`);
const byLang = new Map(); for (const c of sc) { const a = byLang.get(c.lang) ?? []; a.push(c.s); byLang.set(c.lang, a); }
console.log(`\ntopical questions by language (median specificity): ${[...byLang].map(([l, a]) => `${l} ${med(a).toFixed(1)}`).join(" · ")}`);
