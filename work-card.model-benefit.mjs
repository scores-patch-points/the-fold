// work-card.model-benefit.mjs — WHAT DOES THE SMALL MODEL ADD TO A MECHANICAL PACKET?  (2026-10-14)
//
//   node work-card.model-benefit.mjs [--model gemma2:2b] [--per-lang 4]
//
// "Is it steering by physics, or helping it ideate?" Same question, two conditions, the same small local model, temperature 0:
//   M0  closed-book: the question alone
//   M1  packet:      the question + the card's key spans verbatim (the mechanical selection)
// Every measure is mechanical, computed from the answer text against the packet and against the WHOLE work (the half the card never saw):
//   grounded    idf-weighted share of the answer's terms that occur in the packet, the question or the title ("steered by physics")
//   inWork      the share that is not in the packet but occurs somewhere in the work ("ideation that is still true to the text")
//   outside     the share that occurs nowhere in the work (the model's own words: generic, pretrained, or invented)
//   heldOut     how many of the second half's most characteristic terms the answer reaches that the packet did NOT contain
//   language    the answer is in the question's language (its terms are mostly the work's language, not the other's)
// Nothing here judges truth. It says where the words came from.
import fs from "node:fs";
import path from "node:path";
import { BUDGET, termsOf, collectionOf, buildCard, indexCards, packetFor } from "./work-card.js";

const args = process.argv.slice(2); const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const MODEL = opt("--model", "gemma2:2b"), PER = Number(opt("--per-lang", 4));
const ZEN = "/Users/mlacy/Documents/3.0/Zenodotus/";
const SRC = [
  { lang: "en", dir: "01-literature-books/gutenberg/", q: (t) => `So what's the deal with ${t}?` },
  { lang: "grc", dir: "11-multi-language/greek-originals/", q: (t) => `So what's the deal with ${t}?` },
  { lang: "es", dir: "24-global-literature/es/", q: (t) => `¿De qué trata la obra de ${t}?` },
  { lang: "pt", dir: "24-global-literature/pt/", q: (t) => `Sobre o que é a obra de ${t}?` },
  { lang: "ca", dir: "24-global-literature/ca/", q: (t) => `De què tracta l'obra de ${t}?` },
];
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rnd = mulberry32(BUDGET.seed + 1);
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const titleOf = (f) => path.basename(f).replace(/\.[^.]+$/, "").replace(/^(pg)?\d+[_-]/i, "").replace(/^[a-z]{2}-\d+-/i, "").replace(/^\d+-/, "").replace(/[_-]+/g, " ").trim();

// the same disjoint sample B as the harness's WC_SAMPLE=B, so no work here was used to develop the weighting
const works = [];
for (const s of SRC) {
  const dir = ZEN + s.dir;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".txt")).map((f) => path.join(dir, f)).filter((f) => { const n = fs.statSync(f).size; return n >= 60_000 && n <= 3_000_000; }).sort();
  for (const f of shuffle(files).slice(10, 10 + PER)) works.push({ lang: s.lang, file: f, title: titleOf(f), id: path.basename(f), q: s.q });
}
// the collection must be the harness's (all eight groups) for the weights to be the shipped ones: rebuild from sample B across languages
const more = [];
for (const l of ["zh", "eo", "tl"]) { const dir = ZEN + `24-global-literature/${l}/`; const files = fs.readdirSync(dir).filter((f) => f.endsWith(".txt")).map((f) => path.join(dir, f)).filter((f) => { const n = fs.statSync(f).size; return n >= 60_000 && n <= 3_000_000; }).sort(); for (const f of shuffle(files).slice(10, 20)) more.push({ lang: l, file: f, title: titleOf(f), id: path.basename(f) }); }
const all = [...works.map((w) => ({ ...w })), ...more];
for (const w of all) { w.text = fs.readFileSync(w.file, "utf8"); const cut = w.text.indexOf("\n\n", Math.floor(w.text.length / 2)); const mid = cut < 0 ? Math.floor(w.text.length / 2) : cut; w.first = w.text.slice(0, mid); w.second = w.text.slice(mid); }
const col = collectionOf(all.map((w) => ({ text: w.first, title: w.title, lang: w.lang })));
const cards = all.map((w) => buildCard({ id: w.id, lang: w.lang, title: w.title, file: w.file, text: w.first, col }));
const index = indexCards(cards, col);
const idf = (t, l) => { const b = Math.log((col.N + 1) / ((col.df.get(t) ?? 0) + 0.5)); const g = col.byLang.get(l); return g && g.N >= 2 ? b * (1 - (g.df.get(t) ?? 0) / g.N) : b; };

async function ask(prompt) {
  const r = await fetch("http://localhost:11434/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: MODEL, prompt, stream: false, options: { temperature: 0, num_predict: 180, seed: 7 } }) });
  const j = await r.json(); return String(j.response ?? "").trim();
}
const rows = []; const t0 = Date.now();
for (const w of works) {
  const question = w.q(w.title); const p = packetFor(question, index);
  const spans = p.work?.id === w.id ? p.keySpans : cards.find((c) => c.id === w.id).keySpans.slice(0, 5);
  const routed = p.work?.id === w.id;
  const ctx = spans.map((s, i) => `[${i + 1}] ${s.preview}`).join("\n");
  const m0 = await ask(question);
  const m1 = await ask(`${ctx}\n\nUsing the passages above, answer briefly: ${question}`);
  const packetTerms = new Set([...termsOf(ctx), ...termsOf(question), ...termsOf(w.title)]);
  const workTerms = new Set(termsOf(w.text));
  const top2 = new Set([...(() => { const tf = new Map(); for (const t of termsOf(w.second)) tf.set(t, (tf.get(t) ?? 0) + 1); return [...tf].filter(([t, n]) => n >= 2 && col.df.has(t)).map(([t, n]) => [t, (1 + Math.log(n)) * idf(t, w.lang)]).sort((a, b) => b[1] - a[1]).slice(0, BUDGET.terms).map((x) => x[0]); })()]);
  const measure = (a) => {
    const ts = [...new Set(termsOf(a))]; const wt = (t) => Math.max(idf(t, w.lang), 0.01); const tot = ts.reduce((s, t) => s + wt(t), 0) || 1;
    let g = 0, iw = 0, out = 0, held = 0, own = 0;
    for (const t of ts) { const x = wt(t); if (packetTerms.has(t)) g += x; else if (workTerms.has(t)) iw += x; else out += x; if (!packetTerms.has(t) && top2.has(t)) held += 1; if (col.byLang.get(w.lang)?.df.has(t)) own += 1; }
    return { terms: ts.length, grounded: g / tot, inWork: iw / tot, outside: out / tot, heldOut: held, inLanguage: ts.length ? own / ts.length : 0 };
  };
  rows.push({ lang: w.lang, title: w.title, question, routed, m0: { text: m0, ...measure(m0) }, m1: { text: m1, ...measure(m1) } });
  console.log(`${w.lang} ${w.title.slice(0, 26).padEnd(26)} routed=${routed}  M0 grounded ${(100 * rows.at(-1).m0.grounded).toFixed(0)}% inWork ${(100 * rows.at(-1).m0.inWork).toFixed(0)}% outside ${(100 * rows.at(-1).m0.outside).toFixed(0)}% held ${rows.at(-1).m0.heldOut}  |  M1 grounded ${(100 * rows.at(-1).m1.grounded).toFixed(0)}% inWork ${(100 * rows.at(-1).m1.inWork).toFixed(0)}% outside ${(100 * rows.at(-1).m1.outside).toFixed(0)}% held ${rows.at(-1).m1.heldOut}`);
}
const mean = (a, f) => a.reduce((s, x) => s + f(x), 0) / (a.length || 1);
const sum = (m) => ({ grounded: mean(rows, (r) => r[m].grounded), inWork: mean(rows, (r) => r[m].inWork), outside: mean(rows, (r) => r[m].outside), heldOut: mean(rows, (r) => r[m].heldOut), inLanguage: mean(rows, (r) => r[m].inLanguage) });
const s0 = sum("m0"), s1 = sum("m1");
const wins = rows.filter((r) => r.m1.outside < r.m0.outside).length;
console.log(`\nN=${rows.length} · ${((Date.now() - t0) / 1000).toFixed(0)} s · model ${MODEL}`);
console.log(`M0 closed-book : grounded ${(100 * s0.grounded).toFixed(0)}% · inWork ${(100 * s0.inWork).toFixed(0)}% · outside ${(100 * s0.outside).toFixed(0)}% · held-out terms reached ${s0.heldOut.toFixed(1)} · in the question's language ${(100 * s0.inLanguage).toFixed(0)}%`);
console.log(`M1 with packet : grounded ${(100 * s1.grounded).toFixed(0)}% · inWork ${(100 * s1.inWork).toFixed(0)}% · outside ${(100 * s1.outside).toFixed(0)}% · held-out terms reached ${s1.heldOut.toFixed(1)} · in the question's language ${(100 * s1.inLanguage).toFixed(0)}%`);
console.log(`packet lowers the share of words found nowhere in the work in ${wins} of ${rows.length} questions`);
for (const l of [...new Set(rows.map((r) => r.lang))]) { const r = rows.filter((x) => x.lang === l); console.log(`  ${l}: outside M0 ${(100 * mean(r, (x) => x.m0.outside)).toFixed(0)}% → M1 ${(100 * mean(r, (x) => x.m1.outside)).toFixed(0)}% · grounded ${(100 * mean(r, (x) => x.m0.grounded)).toFixed(0)}% → ${(100 * mean(r, (x) => x.m1.grounded)).toFixed(0)}%`); }
fs.writeFileSync(new URL("./work-card.model-benefit.json", import.meta.url), JSON.stringify({ at: new Date().toISOString(), model: MODEL, summary: { M0: s0, M1: s1, wins, N: rows.length }, rows }, null, 2) + "\n");
