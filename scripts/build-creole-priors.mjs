// Build fold-chat-creole-priors.js — the creole priors AND the two cutoff tables the tier reads (LANGID-PREREG.md).
//   node scripts/build-creole-priors.mjs [--out ../fold-chat-creole-priors.js] [--report eval/creole/results/langid-build-report.json]
// Sources: eval/creole/langid-build.mjs (UDHR, Kreyol-MT bitexts, APiCS, janus POS forms; never the held-out files).
//   priors  : the same builder functions/constants as scripts/build-lang-priors.mjs (KW K2 K3 FW RHO ALPHA from the base file's PARAMS)
//   TAU[c]  : a staircase [[tokens, nats], …]: at n tokens, the max over NULL texts of at most n tokens (non-creole Latin text,
//             hash folds 1-4, + each declared perturbation + token and bigram windows) of T_c = s_c − max core s_i.
//             Fold 0 of the null is never used here: it is the fresh sample UNCHANGED is checked on.
//   MU[b|r] : a staircase of the largest lead (s_b − s_r) a WRONG-best creole b had on a sentence truly in r with at most n
//             tokens, in 5-fold cross-validation (a sentence is scored only by priors built from the other four hash folds).
//             No wrong-best ever seen: absent (= 0).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { creoleSentences, creoleForms, nullSentences, udhrCompetitors, SUPERSEDES, decontam, perturb, PERTURBATIONS, META } from "../eval/creole/langid-build.mjs";
import { CREOLE_CTX } from "../fold-chat-langid.js";
import { DECLARED } from "../fold-chat-langid.js";
import { PARAMS as BASE_PARAMS } from "../fold-chat-lang-priors.js";
import { makeScorer, stairOf, stairAt } from "../fold-chat-langid-creole.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const OUT = path.resolve(arg("--out", path.join(HERE, "..", "fold-chat-creole-priors.js")));
const REPORT = path.resolve(arg("--report", path.join(HERE, "..", "eval", "creole", "results", "langid-build-report.json")));
const { KW, K2, K3, FW, RHO, ALPHA } = BASE_PARAMS;

// ── the base builder's functions, verbatim in effect (scripts/build-lang-priors.mjs is a script and cannot be imported) ──
const fold = (s) => s.normalize("NFD").replace(/\p{M}+/gu, "").normalize("NFC");
const LETTERS = /[^\p{L}\p{M}]+/u;
const q = (c, T) => Math.min(255, Math.max(0, Math.round(-Math.log(c / T) * 10)));
function countText(cnt, text, weight = 1) {
  for (const t of String(text).normalize("NFC").toLowerCase().split(LETTERS)) if (t && /\p{L}/u.test(t)) cnt.set(t, (cnt.get(t) || 0) + weight);
}
function build(cnt) {
  const w = new Map();
  for (const [t, c] of cnt) { const f = fold(t); if (f !== t) { w.set(t, (w.get(t) || 0) + c * (1 - RHO)); w.set(f, (w.get(f) || 0) + c * RHO); } else w.set(t, (w.get(t) || 0) + c); }
  let N = 0; for (const c of cnt.values()) N += c;
  const words = [...w].sort((a, b) => b[1] - a[1]).slice(0, KW);
  const fwAll = new Set(); for (const t of [...cnt].sort((a, b) => b[1] - a[1]).slice(0, FW).map(([t]) => t)) { fwAll.add(t); fwAll.add(fold(t)); }
  const g1 = new Map(), g2 = new Map(), g3 = new Map();
  for (const [t, c] of w) { const cs = [..."_" + t + "_"]; for (let i = 0; i < cs.length; i++) { if (cs[i] !== "_") g1.set(cs[i], (g1.get(cs[i]) || 0) + c); if (i + 2 <= cs.length) { const g = cs[i] + cs[i + 1]; if (g !== "__") g2.set(g, (g2.get(g) || 0) + c); } if (i + 3 <= cs.length) { const g = cs[i] + cs[i + 1] + cs[i + 2]; g3.set(g, (g3.get(g) || 0) + c); } } }
  let NG = 0; for (const m of [g1, g2, g3]) for (const c of m.values()) NG += c;
  const top = (m, k) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k);
  const grams = [...top(g1, 1e9), ...top(g2, K2), ...top(g3, K3)];
  return { script: "Latin", n: Math.round(N), wf: q(ALPHA, N), gf: q(ALPHA, NG), w: words.map(([t, c]) => t + ":" + q(c, N)).join(","), g: grams.map(([t, c]) => t + ":" + q(c, NG)).join(","), fw: [...fwAll].join(" ") };
}

// ── corpora ───────────────────────────────────────────────────────────────────────────────────────────────────
const sents = creoleSentences();
const forms = creoleForms();
const langs = [...new Set(sents.map((s) => s.lang).concat(Object.keys(forms)))].sort();
function priorsExcluding(foldOut) {
  const out = {};
  for (const lang of langs) {
    const cnt = new Map();
    for (const s of sents) if (s.lang === lang && s.fold !== foldOut) countText(cnt, s.text);
    if (forms[lang]) for (const [f, c] of forms[lang]) countText(cnt, f, c);
    if (cnt.size >= 30) out[lang] = build(cnt);
  }
  return out;
}
const P = { wordWeight: DECLARED.wordWeight, gramWeight: DECLARED.gramWeight };
const bar = (...a) => process.stderr.write(a.join(" ") + "\n");

// ── MU: 5-fold cross-validation ────────────────────────────────────────────────────────────────────────────────
const MUitems = {}, cv = {};
for (const k of langs) cv[k] = { n: 0, best: 0, byBest: {} };
for (let f = 0; f < 5; f++) {
  const sc = makeScorer(CREOLE_CTX, priorsExcluding(f));
  for (const s of sents) {
    if (s.fold !== f || !sc.codes.includes(s.lang)) continue;
    const r = sc.scoreTokens(CREOLE_CTX.tokenize(s.text), P);
    let b = null; for (const c of Object.keys(r.s)) if (b === null || r.s[c] > r.s[b]) b = c;
    cv[s.lang].n++;
    if (b === s.lang) cv[s.lang].best++;
    else { cv[s.lang].byBest[b] = (cv[s.lang].byBest[b] || 0) + 1; const key = b + "|" + s.lang; (MUitems[key] ??= []).push([r.n, r.s[b] - r.s[s.lang]]); }
  }
  bar("cv fold", f, "done");
}

// MU, two derivations kept side by side: MU_PAIR (the lead wrong-best b had on a sentence of r, that pair only) and MU (the same
// pooled over every pair of one lexifier family: confusability of a family is estimated from all of its members' errors, so a pair
// that CV happened never to confuse is not trusted as separable). The tier reads MU.
const MU_PAIR = Object.fromEntries(Object.entries(MUitems).map(([k, v]) => [k, stairOf(v)]));
const famOf = (c) => (META[c] && META[c].lexifier) || null;
const MU = { ...MU_PAIR };
for (const F of new Set(langs.map(famOf).filter(Boolean))) {
  const members = langs.filter((c) => famOf(c) === F);
  const pooled = [];
  for (const [k, v] of Object.entries(MUitems)) { const [b, r] = k.split("|"); if (famOf(b) === F && famOf(r) === F) pooled.push(...v); }
  if (!pooled.length) continue;
  const st = stairOf(pooled);
  for (const b of members) for (const r of members) if (b !== r) MU[b + "|" + r] = st;
}

// ── final priors, then TAU from the null ───────────────────────────────────────────────────────────────────────
const PRIORS = priorsExcluding(-1);
const overlap = Object.keys(PRIORS).filter((c) => CREOLE_CTX.coreEntries().some(([k]) => k.split("#")[0] === c));
if (overlap.length) throw new Error("creole code collides with a core code: " + overlap);
// --reuse-tau: re-derive only MU (cross-validation) and the priors; keep the TAU table of the file already at --out (the null is slow)
const REUSE = process.argv.includes("--reuse-tau");
const PREV = REUSE ? await import("file://" + OUT + "?t=" + Date.now()) : null;
const nullAll = REUSE ? [] : nullSentences();
const cal = nullAll.filter((n) => n.fold !== 0), ver = nullAll.filter((n) => n.fold === 0);
// CROSS-FIT RIVALS: the creole must also beat the UDHR-built non-creole languages (Fon, Franco-Provencal, Bikol … read as Krio or
// Haitian otherwise). A null sentence of fold k is scored by rivals built WITHOUT fold k, so no null text is scored by a prior
// that saw it (the shipped tier uses the base's all-data UDHR priors).
const udhr = udhrCompetitors();
function rivalsExcluding(k) {
  const out = [];
  for (const [key, arr] of Object.entries(udhr)) {
    const cnt = new Map();
    for (const s of arr) if (s.fold !== k) countText(cnt, s.text);
    if (cnt.size >= 60) { const p = build(cnt); if (/\p{Script=Latin}/u.test(p.w)) out.push([key, p]); }
  }
  return out;
}
const scorers = [0, 1, 2, 3, 4].map((k) => makeScorer(CREOLE_CTX, PRIORS, rivalsExcluding(k)));
bar("rivals per fold:", scorers.map((s) => s.codes.length).join(","), "creoles; rival priors built from", Object.keys(udhr).length, "UDHR files");
const TAUitems = Object.fromEntries(Object.keys(PRIORS).map((c) => [c, []])), peak = {};
let scored = 0, windowsN = 0;
function consider(sc, text) {
  for (const r of sc.readings(text, P)) for (const [c, t] of Object.entries(r.T)) { TAUitems[c].push([r.n, t]); if (!(c in peak) || t > peak[c].T) peak[c] = { T: +t.toFixed(1), n: r.n, text: text.slice(0, 100) }; }
  scored++;
}
for (let k = 1; k < 5; k++) {
  const sc = scorers[k], seen = new Set();
  for (const n of cal) {
    if (n.fold !== k) continue;
    consider(sc, n.text);
    for (const kind of PERTURBATIONS) { const p = perturb(n.text, kind); if (p !== n.text) consider(sc, p); }
    // windows: every token and every adjacent pair (short asks, names, one-word asks), typed only
    const toks = CREOLE_CTX.tokenize(n.text);
    for (let i = 0; i < toks.length; i++) for (const w of [toks[i], i + 1 < toks.length ? toks[i] + " " + toks[i + 1] : null]) if (w && !seen.has(w)) { seen.add(w); consider(sc, w); windowsN++; }
  }
  bar("null fold", k, "done");
}
const windows = { size: windowsN };
const TAU = REUSE ? { ...PREV.TAU } : Object.fromEntries(Object.entries(TAUitems).map(([c, v]) => [c, stairOf(v)]));
const argmax = peak;
bar("null calibrated on", cal.length, "sentences +", windowsN, "windows =", scored, "scored texts");

// ── fresh null (fold 0), never used above: the false-fire count at these cutoffs ─────────────────────────────────
let verScored = 0; const fires = [];
for (const n of ver) {
  for (const t of [n.text, ...PERTURBATIONS.map((k) => perturb(n.text, k))]) {
    verScored++;
    for (const r of scorers[0].readings(t, P)) for (const [c, v] of Object.entries(r.T)) if (v > stairAt(TAU[c], r.n)) fires.push({ c, T: +v.toFixed(1), tau: stairAt(TAU[c], r.n), n: r.n, text: t.slice(0, 120), src: n.src, lang: n.lang });
  }
}

// ── write ───────────────────────────────────────────────────────────────────────────────────────────────────────
const tokens = Object.fromEntries(Object.entries(PRIORS).map(([k, v]) => [k, v.n]));
const head = `// fold-chat-creole-priors.js — priors and derived cutoffs of the creole tier (fold-chat-langid-creole.js).
// GENERATED by scripts/build-creole-priors.mjs from UDHR translations (OHCHR), Kreyol-MT OPUS bitexts, APiCS Online survey
// examples (CC BY 4.0) and janus POS-pack forms (UD, CC BY-SA 4.0); never from the held-out CreoleVal files. Never edit by hand.
// Same format and constants as fold-chat-lang-priors.js. TAU[c]: the largest lead over the best base language any of ${scored}
// non-creole texts of at most n tokens reached (a staircase [[n, nats]…]). MU["b|r"]: the same for the lead a wrong-best creole b
// had on a sentence of r in 5-fold cross-validation.
`;
fs.writeFileSync(OUT, head
  + `export const PARAMS = Object.freeze(${JSON.stringify({ KW, K2, K3, FW, RHO, ALPHA, nullTexts: scored, folds: 5 })});\n`
  + `export const META = Object.freeze(${JSON.stringify(Object.fromEntries(Object.keys(PRIORS).map((c) => [c, META[c] || { name: c, lexifier: null }])))});\n`
  + `export const TAU = Object.freeze(${JSON.stringify(TAU)});\n`
  + `export const MU = Object.freeze(${JSON.stringify(MU)});\n`
  + `export const MU_PAIR = Object.freeze(${JSON.stringify(MU_PAIR)});\n`
  + `export const SUPERSEDES = Object.freeze(${JSON.stringify(SUPERSEDES)});\n`
  + `export const GIVERS = Object.freeze(${JSON.stringify(tokens)});\n`
  + `export const PRIORS = ${JSON.stringify(PRIORS)};\n`);
fs.mkdirSync(path.dirname(REPORT), { recursive: true });
const rep = {
  sentencesPerLang: Object.fromEntries(langs.map((l) => [l, sents.filter((s) => s.lang === l).length])), decontaminatedDropped: decontam.dropped,
  priorTokens: tokens, cv, MU, MU_PAIR, TAU, tauArgmax: argmax,
  null: { calibrationSentences: cal.length, windows: windows.size, rivalsPerFold: scorers.map((s2) => s2.codes.length), scoredTexts: scored, freshSentences: ver.length, freshScoredTexts: verScored, freshFires: fires.length, fires: fires.slice(0, 50) },
};
fs.writeFileSync(REPORT, JSON.stringify(rep, null, 1));
console.log("creoles:", Object.keys(PRIORS).length, "| null scored:", scored, "| fresh null:", verScored, "| fresh fires:", fires.length);
for (const c of Object.keys(PRIORS)) console.log(c.padEnd(5), String(tokens[c]).padStart(7), "tok  TAU@10", String(stairAt(TAU[c], 10)).padStart(6), "TAU@25", String(stairAt(TAU[c], 25)).padStart(6), "  cv", cv[c] ? `${cv[c].best}/${cv[c].n}` : "-", JSON.stringify(cv[c]?.byBest || {}));
console.log("->", path.relative(process.cwd(), OUT), Math.round(fs.statSync(OUT).size / 1024) + "KB");
