// eval/creole/pos-projection.mjs — derive a POSPrior@1 for a creole with no treebank by projecting the lexifier-side
// (or any anchor-language) tag through word alignment. PURE: no I/O, no clock, no global state; every random draw is
// seeded. The pre-registration is POS-PROJECTION-PREREG.md; the gates are tested (and mutation-checked) in
// pos-projection.test.mjs. Nothing here reads gold: `buildPack` has no gold parameter, and the evaluator is a separate export.
//
// METHOD (see the prereg §3): tokenise → bidirectional IBM-1 + diagonal prior → keep the INTERSECTION of the two directions'
// argmax links → soft-vote the anchor's own UPOS distribution onto the creole form → keep a (form, class) vote only when it
// strictly exceeds the maximum of B shuffled-pairing runs of the same pipeline → optional gates from a shuffled-text spread null.
//
// NO HAND-SET THRESHOLDS: every number a decision could hang on is either a count of draws (B), a convention quoted from its
// giver (Gale & Church 1993), or an optimisation tolerance — all in DECLARED, and the test scans the source for any other
// numeric literal.
import { foldText } from "../../fold-chat-foldtext.js";

export const DECLARED = Object.freeze({
  B: 199,                    // permutation draws for every null; p ≤ 1/(B+1). The repo's max-T convention.
  BOOT: 1000,                // bootstrap resamples for the REPORTED interval (a report, never a gate)
  LAMBDAS: Object.freeze([0, 1, 2, 4, 8, 16]), // diagonal-prior sharpness grid; chosen by training likelihood
  EM_TOL: 1e-6,              // optimisation tolerance on relative log-likelihood gain (not a decision)
  EM_CAP: 50,                // iteration cap
  GC_C: 1, GC_S2: 6.8,       // Gale & Church 1993: mean chars per source char, variance per char
  GC_BEADS: Object.freeze({ "1-1": 0.89, "1-0": 0.0099, "0-1": 0.0099, "2-1": 0.089, "1-2": 0.089, "2-2": 0.011 }),
  SEED: 20261013,
  CI: Object.freeze([0.025, 0.975]), // the reported interval's central 95% (a convention for REPORTING; no decision uses it)
  P0_EPS: 1e-6,              // keeps the learned NULL mass off 0 and 1 (numerical guard)
  ROUND: 100,                // stored counts keep two decimals
  MIN_PAIRS: 2,              // a source with fewer pairs cannot be shuffled, so it cannot be filtered: it is dropped
});
export const CLOSED = Object.freeze(["ADP", "AUX", "CCONJ", "DET", "PART", "PRON", "SCONJ"]);
export const OPEN = Object.freeze(["ADJ", "ADV", "INTJ", "NOUN", "PROPN", "VERB", "X"]);

// ── seeded randomness ────────────────────────────────────────────────────────────────────────────────────────────────
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Sattolo: a uniform random single cycle — a derangement, so no sentence keeps its own translation. */
export function derange(n, rand) {
  const p = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * i); [p[i], p[j]] = [p[j], p[i]]; }
  return p;
}
export function shuffled(arr, rand) {
  const p = arr.slice();
  for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  return p;
}

// ── tokens ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const RUN = /[\p{L}\p{M}\p{N}]+(?:['’\-][\p{L}\p{M}\p{N}]+)*/gu;
const LETTERS = /^\p{L}+$/u;
/** Held-out guard key: NFKC, lower-cased, letters and digits only. Two sentences with one key are the same sentence. */
export const foldKey = (s) => String(s ?? "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, "");
/**
 * Folded word tokens. An apostrophe splits only when the left piece is 1–2 letters and the right piece ≥ 2 letters.
 * `bare` (round 2, T): the left piece drops its apostrophe ("l'ekol" → "l" "ekol"), the shape UD Haitian's gold uses.
 */
export function tokenize(s, { bare = false } = {}) {
  const out = [];
  for (const raw of foldText(String(s ?? "")).match(RUN) ?? []) {
    const m = /^([\p{L}]{1,2})['’]([\p{L}\p{M}\p{N}]{2,}.*)$/u.exec(raw);
    if (m) { out.push(bare ? m[1] : `${m[1]}'`); out.push(m[2]); } else out.push(raw.replace(/’/g, "'"));
  }
  return out;
}
/** Script rule: digits-only → NUM; no letter or digit at all → PUNCT; otherwise null (a word). Identical in every arm. */
export function scriptClass(form) {
  const f = String(form ?? "").trim();
  if (!f) return "PUNCT";
  if (/^[\p{Nd}\p{No}\p{Nl}]+$/u.test(f)) return "NUM";
  if (!/[\p{L}\p{M}\p{N}]/u.test(f)) return "PUNCT";
  return null;
}

// ── anchors ──────────────────────────────────────────────────────────────────────────────────────────────────────────
/** POSPrior@1 `forms` → Map folded form → Map UPOS → count (forms that fold together pool). */
export function anchorIndex(forms, { bare = false } = {}) {
  const idx = new Map();
  for (const [form, dist] of Object.entries(forms ?? {})) {
    let k = foldText(form);
    if (bare) { k = k.replace(/['’]+$/u, ""); if (!k) continue; }
    let m = idx.get(k); if (!m) idx.set(k, (m = new Map()));
    for (const [u, n] of Object.entries(dist)) m.set(u, (m.get(u) ?? 0) + n);
  }
  return idx;
}
export const dominant = (dist) => {
  let best = null, bn = -Infinity;
  for (const [u, n] of dist) if (n > bn || (n === bn && u < best)) { best = u; bn = n; }
  return best;
};
/** The anchor language's measured closed-class token share over non-PUNCT, non-SYM tokens. */
export function closedShare(index) {
  let c = 0, t = 0;
  for (const d of index.values()) for (const [u, n] of d) { if (u === "PUNCT" || u === "SYM") continue; t += n; if (CLOSED.includes(u)) c += n; }
  return t ? c / t : 0;
}

// ── Gale–Church paragraph alignment (for the UDHR) ───────────────────────────────────────────────────────────────────
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; };
const normCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
function gcCost(l1, l2, prior) {
  if (l1 === 0 && l2 === 0) return 0;
  const mean = (l1 + l2 / DECLARED.GC_C) / 2;
  const z = (l2 - l1 * DECLARED.GC_C) / Math.sqrt(Math.max(mean, 1) * DECLARED.GC_S2);
  const p = 2 * (1 - normCdf(Math.abs(z)));
  return -Math.log(Math.max(p, Number.MIN_VALUE) * prior);
}
/** Beads of (src paragraph idxs, tgt paragraph idxs); only beads with both sides non-empty yield a pair. */
export function galeChurch(srcLens, tgtLens) {
  const n = srcLens.length, m = tgtLens.length;
  const cum = (a) => { const c = [0]; for (const x of a) c.push(c[c.length - 1] + x); return c; };
  const S = cum(srcLens), T = cum(tgtLens);
  const INF = Infinity;
  const D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(INF));
  const back = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(null));
  D[0][0] = 0;
  const beads = [[1, 1], [1, 0], [0, 1], [2, 1], [1, 2], [2, 2]];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) {
    if (D[i][j] === INF) continue;
    for (const [di, dj] of beads) {
      const ni = i + di, nj = j + dj; if (ni > n || nj > m) continue;
      const c = D[i][j] + gcCost(S[ni] - S[i], T[nj] - T[j], DECLARED.GC_BEADS[`${di}-${dj}`]);
      if (c < D[ni][nj]) { D[ni][nj] = c; back[ni][nj] = [i, j]; }
    }
  }
  const out = [];
  let i = n, j = m;
  while (i > 0 || j > 0) { const b = back[i][j]; if (!b) break; out.push([[b[0], i], [b[1], j]]); [i, j] = b; }
  return out.reverse();
}
const clausesOf = (p) => p.split(/(?<=[.;:!?])\s+/u).map((x) => x.trim()).filter(Boolean);
/** Round 2, S: re-cut one matched paragraph pair at sentence/clause punctuation and align the clauses by the same DP. */
export function pairClauses(c, a) {
  const cs = clausesOf(c), as = clausesOf(a);
  if (cs.length < 2 || as.length < 2) return [{ c, a }];
  const out = [];
  for (const [[c0, c1], [a0, a1]] of galeChurch(cs.map((x) => x.length), as.map((x) => x.length))) {
    if (c1 === c0 || a1 === a0) continue;
    out.push({ c: cs.slice(c0, c1).join(" "), a: as.slice(a0, a1).join(" ") });
  }
  return out.length ? out : [{ c, a }];
}
/** Pair two paragraph lists: [{c, a}] — c from the creole side, a from the anchor side. `clauses`: round-2 S. */
export function pairParagraphs(creoleParas, anchorParas, { clauses = false } = {}) {
  const beads = galeChurch(creoleParas.map((p) => p.length), anchorParas.map((p) => p.length));
  const pairs = [];
  for (const [[c0, c1], [a0, a1]] of beads) {
    if (c1 === c0 || a1 === a0) continue;
    const pair = { c: creoleParas.slice(c0, c1).join(" "), a: anchorParas.slice(a0, a1).join(" ") };
    if (clauses) pairs.push(...pairClauses(pair.c, pair.a)); else pairs.push(pair);
  }
  return pairs;
}

// ── alignment: IBM-1 with a diagonal prior, EM ───────────────────────────────────────────────────────────────────────
/** One direction. src/tgt are arrays of Int32Array (ids ≥ 1; 0 is NULL). Returns argmax links tgt position → src position|-1. */
export function emDirection(src, tgt, Vt, lambda) {
  const K = src.length;
  // cells: for sentence k, (m+1)*n parameter indices; index 0 row = NULL
  const cellIndex = new Map();
  const srcOfCell = [], tgtOfCell = [];
  const idxs = new Array(K), hs = new Array(K);
  let tgtTokens = 0;
  for (let k = 0; k < K; k++) {
    const s = src[k], t = tgt[k], m = s.length, n = t.length; tgtTokens += n;
    const ix = new Int32Array((m + 1) * n), h = new Float64Array(m * n);
    for (let j = 0; j < n; j++) {
      let z = 0;
      for (let i = 0; i <= m; i++) {
        const sid = i === 0 ? 0 : s[i - 1];
        const key = sid * (Vt + 1) + t[j];
        let c = cellIndex.get(key);
        if (c === undefined) { c = srcOfCell.length; cellIndex.set(key, c); srcOfCell.push(sid); tgtOfCell.push(t[j]); }
        ix[j * (m + 1) + i] = c;
        if (i > 0) { const w = lambda === 0 ? 1 : Math.exp(-lambda * Math.abs(i / m - (j + 1) / n)); h[j * m + i - 1] = w; z += w; }
      }
      for (let i = 0; i < m; i++) h[j * m + i] /= z || 1;
    }
    idxs[k] = ix; hs[k] = h;
  }
  const C = srcOfCell.length;
  const srcOf = Int32Array.from(srcOfCell);
  const t = new Float64Array(C).fill(1 / Math.max(1, Vt));
  const counts = new Float64Array(C);
  let Vs = 0; for (const x of srcOf) if (x + 1 > Vs) Vs = x + 1;
  const totals = new Float64Array(Vs);
  let p0 = 0.5, prev = -Infinity, ll = -Infinity;
  for (let it = 0; it < DECLARED.EM_CAP; it++) {
    counts.fill(0); totals.fill(0); let nullPost = 0; ll = 0;
    for (let k = 0; k < K; k++) {
      const m = src[k].length, n = tgt[k].length, ix = idxs[k], h = hs[k];
      for (let j = 0; j < n; j++) {
        const base = j * (m + 1);
        let denom = p0 * t[ix[base]];
        for (let i = 1; i <= m; i++) denom += (1 - p0) * h[j * m + i - 1] * t[ix[base + i]];
        if (!(denom > 0)) continue;
        ll += Math.log(denom);
        const w0 = (p0 * t[ix[base]]) / denom; counts[ix[base]] += w0; totals[0] += w0; nullPost += w0;
        for (let i = 1; i <= m; i++) { const w = ((1 - p0) * h[j * m + i - 1] * t[ix[base + i]]) / denom; counts[ix[base + i]] += w; totals[src[k][i - 1]] += w; }
      }
    }
    for (let c = 0; c < C; c++) { const tot = totals[srcOf[c]]; t[c] = tot > 0 ? counts[c] / tot : 0; }
    p0 = Math.min(Math.max(nullPost / Math.max(1, tgtTokens), DECLARED.P0_EPS), 1 - DECLARED.P0_EPS);
    if (it > 0 && Math.abs(ll - prev) / Math.max(1, Math.abs(prev)) < DECLARED.EM_TOL) break;
    prev = ll;
  }
  // Viterbi (argmax) links
  const links = new Array(K);
  for (let k = 0; k < K; k++) {
    const m = src[k].length, n = tgt[k].length, ix = idxs[k], h = hs[k], a = new Int32Array(n);
    for (let j = 0; j < n; j++) {
      const base = j * (m + 1);
      let best = -1, bw = p0 * t[ix[base]];
      for (let i = 1; i <= m; i++) { const w = (1 - p0) * h[j * m + i - 1] * t[ix[base + i]]; if (w > bw) { bw = w; best = i - 1; } }
      a[j] = best;
    }
    links[k] = a;
  }
  return { links, ll, model: { cellIndex, t, p0, lambda, Vt } };
}
/** Log-likelihood of unseen sentences under a trained direction (unseen cells get the uniform floor 1/Vt). */
export function scoreModel(model, src, tgt) {
  const { cellIndex, t, p0, lambda, Vt } = model; const floor = 1 / Math.max(1, Vt);
  let ll = 0;
  for (let k = 0; k < src.length; k++) {
    const s = src[k], tg = tgt[k], m = s.length, n = tg.length;
    for (let j = 0; j < n; j++) {
      let z = 0; const w = new Float64Array(m);
      for (let i = 0; i < m; i++) { w[i] = lambda === 0 ? 1 : Math.exp(-lambda * Math.abs((i + 1) / m - (j + 1) / n)); z += w[i]; }
      const look = (sid) => { const c = cellIndex.get(sid * (Vt + 1) + tg[j]); return c === undefined ? floor : t[c] || floor; };
      let d = p0 * look(0);
      for (let i = 0; i < m; i++) d += (1 - p0) * (w[i] / (z || 1)) * look(s[i]);
      ll += Math.log(d); // GATE:score
    }
  }
  return ll;
}
function bestDirection(src, tgt, Vt, lambdas, heldout = false) {
  let best = null;
  for (const l of lambdas) {
    let score;
    if (heldout && src.length >= DECLARED.MIN_PAIRS * 2) { // round 2, L: 2-fold held-out likelihood
      const half = (keep) => [src.filter((_, k) => k % 2 === keep), tgt.filter((_, k) => k % 2 === keep)];
      const [sa, ta] = half(0), [sb, tb] = half(1);
      score = scoreModel(emDirection(sa, ta, Vt, l).model, sb, tb) + scoreModel(emDirection(sb, tb, Vt, l).model, sa, ta); // GATE:heldout-ll
    } else score = null;
    const r = emDirection(src, tgt, Vt, l);
    const key = score === null ? r.ll : score;
    if (!best || key > best.key) best = { ...r, lambda: l, key };
  }
  return best;
}

/**
 * Align a pair list. `pairs`: [{c: string[], a: string[]}] (tokens). Returns per pair the intersection links [[ci, ai], …]
 * and the λ each direction chose. `fixLambda` (a {fwd,rev}) skips the grid (used inside the null draws, prereg amendment A1).
 */
export function alignPairs(pairs, fixLambda = null, { heldout = false } = {}) {
  const cv = new Map(), av = new Map();
  const id = (m, w) => { let x = m.get(w); if (x === undefined) { x = m.size + 1; m.set(w, x); } return x; };
  const C = pairs.map((p) => Int32Array.from(p.c, (w) => id(cv, w)));
  const A = pairs.map((p) => Int32Array.from(p.a, (w) => id(av, w)));
  // forward: anchor → creole (each creole token picks an anchor token); reverse: creole → anchor
  const fwd = fixLambda ? { ...emDirection(A, C, cv.size, fixLambda.fwd), lambda: fixLambda.fwd } : bestDirection(A, C, cv.size, DECLARED.LAMBDAS, heldout);
  const rev = fixLambda ? { ...emDirection(C, A, av.size, fixLambda.rev), lambda: fixLambda.rev } : bestDirection(C, A, av.size, DECLARED.LAMBDAS, heldout);
  const links = pairs.map((_, k) => intersectLinks(fwd.links[k], rev.links[k]));
  return { links, lambda: { fwd: fwd.lambda, rev: rev.lambda } };
}
/** f[j] = anchor position creole token j chose (or -1); r[i] = creole position anchor token i chose. Mutual choices only. */
export function intersectLinks(f, r) {
  const out = [];
  for (let j = 0; j < f.length; j++) { const i = f[j]; if (i >= 0 && r[i] === j) out.push([j, i]); } // GATE:intersect
  return out;
}

// ── projection ───────────────────────────────────────────────────────────────────────────────────────────────────────
const addVote = (votes, f, dist, w) => {
  let m = votes.get(f); if (!m) votes.set(f, (m = new Map()));
  let tot = 0; for (const n of dist.values()) tot += n;
  if (!tot) return;
  for (const [u, n] of dist) m.set(u, (m.get(u) ?? 0) + (w * n) / tot);
};
/** Soft votes for one source: Map form → Map UPOS → vote. Script-typed tokens never vote. */
export function votesFromLinks(pairs, links, anchor) {
  const votes = new Map();
  pairs.forEach((p, k) => {
    for (const [j, i] of links[k]) {
      const f = p.c[j], a = p.a[i];
      if (scriptClass(f) || scriptClass(a)) continue;
      const dist = anchor.get(a);
      if (dist) addVote(votes, f, dist, 1);
    }
  });
  return votes;
}
const sumInto = (into, from) => {
  for (const [f, m] of from) { let t = into.get(f); if (!t) into.set(f, (t = new Map())); for (const [u, n] of m) t.set(u, (t.get(u) ?? 0) + n); }
  return into;
};
const tokenPairs = (pairs, conv) => pairs.map((p) => ({ c: tokenize(p.c, conv), a: tokenize(p.a, conv) })).filter((p) => p.c.length && p.a.length);

/** A (form, class) vote survives iff it STRICTLY exceeds the largest vote any shuffled-pairing run gave it. */
export function keepAgainstNull(real, maxNull) {
  const kept = new Map();
  for (const [f, m] of real) {
    const k = new Map();
    for (const [u, v] of m) if (v > (maxNull.get(f)?.get(u) ?? 0)) k.set(u, v); // GATE:null
    if (k.size) kept.set(f, k);
  }
  return kept;
}

// ── function-word spread (frequency × document spread against a shuffled-text null) ──────────────────────────────────
function ladder(S) { const ks = []; for (let k = 1; k <= S; k *= 2) ks.push(k); return ks; }
function spreadCounts(sents, ks) {
  // per form: Float64Array(ks.length) of block document frequencies
  const df = new Map();
  ks.forEach((k, ki) => {
    for (let b = 0; b * k < sents.length; b++) {
      const seen = new Set();
      for (let s = b * k; s < Math.min(sents.length, (b + 1) * k); s++) for (const w of sents[s]) seen.add(w);
      for (const w of seen) { let a = df.get(w); if (!a) df.set(w, (a = new Float64Array(ks.length))); a[ki] += 1; }
    }
  });
  return df;
}
/**
 * Creole-side sentences in input order → per form {tf, T, bursty, closedlike}. `shareClosed`: the anchor's measured closed share.
 * bursty iff T strictly below all B shuffled-text values (tf ≥ 2). closedlike iff not bursty AND within the top-frequency
 * set whose token mass reaches shareClosed.
 */
export function functionFlags(input, shareClosed, rand) {
  const sents = input.filter((s, i) => i === 0 || s.join(" ") !== input[i - 1].join(" "));
  const S = sents.length, ks = ladder(S);
  const tf = new Map(); let total = 0;
  for (const s of sents) for (const w of s) { if (scriptClass(w)) continue; tf.set(w, (tf.get(w) ?? 0) + 1); total += 1; }
  const obs = spreadCounts(sents, ks);
  const flat = sents.flat(), lens = sents.map((s) => s.length);
  const nullDf = [];
  for (let b = 0; b < DECLARED.B; b++) {
    const perm = shuffled(flat, rand); let o = 0;
    nullDf.push(spreadCounts(lens.map((l) => { const r = perm.slice(o, o + l); o += l; return r; }), ks));
  }
  const flags = new Map();
  const forms = [...tf.keys()].sort((x, y) => (tf.get(y) - tf.get(x)) || (x < y ? -1 : 1));
  let mass = 0; const top = new Set();
  for (const f of forms) { if (mass >= shareClosed * total) break; top.add(f); mass += tf.get(f); }
  for (const f of forms) {
    const n = tf.get(f);
    let T = NaN, bursty = false;
    if (n >= 2) {
      const exp = new Float64Array(ks.length);
      for (const d of nullDf) { const a = d.get(f); if (a) for (let i = 0; i < ks.length; i++) exp[i] += a[i] / DECLARED.B; }
      const score = (a) => { let s = 0, c = 0; for (let i = 0; i < ks.length; i++) if (exp[i] > 0) { s += (a ? a[i] : 0) / exp[i]; c += 1; } return c ? s / c : NaN; };
      T = score(obs.get(f));
      let min = Infinity; for (const d of nullDf) { const v = score(d.get(f)); if (v < min) min = v; }
      bursty = T < min; // GATE:bursty
    }
    flags.set(f, { tf: n, T, bursty, closedlike: !bursty && top.has(f) });
  }
  return flags;
}

/** Gates only RE-WEIGH existing votes; they never create a class a form has no vote for. */
export function applyGates(kept, flags, { gateClosed = false, gateOpen = false } = {}) {
  const out = new Map();
  for (const [f, m] of kept) {
    const fl = flags.get(f);
    let use = m;
    const restrict = (set) => { const r = new Map([...m].filter(([u]) => set.includes(u))); return r.size ? r : null; }; // GATE:gate-never-creates
    if (gateClosed && fl?.closedlike) use = restrict(CLOSED) ?? use;
    else if (gateOpen && fl?.bursty) use = restrict(OPEN) ?? use;
    out.set(f, use);
  }
  return out;
}

/**
 * Stage 1 — align, project, and null-filter. NO gold parameter: the builder cannot see it.
 * sources: [{ name, group?, anchor: Map (anchorIndex), pairs: [{c: string, a: string}] }]
 * opts: { seed, B }. Returns the base every arm is finalised from (so arms share one real run and one null).
 */
export function projectBase(sources, opts = {}) {
  const rand = rng(opts.seed ?? DECLARED.SEED);
  const B = opts.B ?? DECLARED.B;
  const conv = { bare: !!opts.bare };
  const prepared = sources.map((s) => ({ ...s, tp: tokenPairs(s.pairs, conv) })).filter((s) => s.tp.length >= DECLARED.MIN_PAIRS);
  const aligned = prepared.map((s) => alignPairs(s.tp, null, { heldout: !!opts.heldoutLambda }));
  const real = new Map();
  prepared.forEach((s, i) => sumInto(real, votesFromLinks(s.tp, aligned[i].links, s.anchor)));
  // shuffled-pairing nulls: derange each source's anchor side, re-run the pipeline at the real fit's λ (amendment A1)
  const nullRaw = [];
  const maxNull = new Map();
  for (let b = 0; b < B; b++) {
    const draw = new Map();
    prepared.forEach((s, i) => {
      const p = derange(s.tp.length, rand);
      const sh = s.tp.map((x, k) => ({ c: x.c, a: s.tp[p[k]].a }));
      const al = alignPairs(sh, aligned[i].lambda);
      sumInto(draw, votesFromLinks(sh, al.links, s.anchor));
    });
    nullRaw.push(draw);
    for (const [f, m] of draw) { let t = maxNull.get(f); if (!t) maxNull.set(f, (t = new Map())); for (const [u, v] of m) if (v > (t.get(u) ?? 0)) t.set(u, v); }
  }
  return { prepared, real, kept: keepAgainstNull(real, maxNull), nullRaw, lambdas: aligned.map((a) => a.lambda), B, seed: opts.seed ?? DECLARED.SEED };
}

/** Stage 2 — the arms: optional function-word gates and identity fill, then the POSPrior@1 `forms`. */
export function finalizePack(base, opts = {}) {
  const { prepared, kept } = base;
  let flags = new Map();
  if (opts.gateClosed || opts.gateOpen) {
    // one creole text per group (UDHR paired with three anchors is ONE creole document), consecutive repeats collapsed
    const seen = new Set();
    const all = prepared.filter((s) => { const g = s.group ?? s.name; if (seen.has(g)) return false; seen.add(g); return true; }).flatMap((s) => s.tp.map((p) => p.c));
    const share = Math.max(...prepared.map((s) => closedShare(s.anchor)));
    flags = base.flagsMemo ??= functionFlags(all, share, rng(base.seed + 1));
  }
  let final = applyGates(kept, flags, opts);
  // identity fill: attested creole forms with no kept vote whose folded string equals an anchor form
  if (opts.identity) {
    final = new Map(final);
    for (const s of prepared) for (const p of s.tp) for (const f of p.c) {
      if (final.has(f) || scriptClass(f)) continue;
      const d = s.anchor.get(f);
      if (d) { const m = new Map(); let tot = 0; for (const n of d.values()) tot += n; for (const [u, n] of d) m.set(u, n / tot); final.set(f, m); }
    }
  }
  const forms = {};
  for (const [f, m] of final) { const o = {}; for (const [u, v] of [...m].sort((x, y) => (x[0] < y[0] ? -1 : 1))) o[u] = Math.round(v * DECLARED.ROUND) / DECLARED.ROUND || 1 / DECLARED.ROUND; forms[f] = o; }
  return {
    forms, flags,
    stats: { sources: prepared.map((s) => ({ name: s.name, pairs: s.tp.length, creoleTokens: s.tp.reduce((n, p) => n + p.c.length, 0) })), forms: Object.keys(forms).length, rawForms: base.real.size, B: base.B, lambdas: base.lambdas },
  };
}
/**
 * Gold-free chance check for one pack: how many (form, class) votes would the SAME filter keep if a shuffled-pairing run were
 * the data (each draw judged against the maximum of the other draws)? The real count must exceed every draw's count.
 */
export function chanceDiscoveries(base) {
  const top = new Map(); // key f\0u → [max, second]
  for (const d of base.nullRaw) for (const [f, m] of d) for (const [u, v] of m) {
    const k = `${f}\u0000${u}`; const t = top.get(k) ?? [0, 0];
    if (v > t[0]) { t[1] = t[0]; t[0] = v; } else if (v > t[1]) t[1] = v;
    top.set(k, t);
  }
  const counts = base.nullRaw.map((d) => {
    let n = 0;
    for (const [f, m] of d) for (const [u, v] of m) { const t = top.get(`${f}\u0000${u}`); const others = v === t[0] ? t[1] : t[0]; if (v > others) n += 1; }
    return n;
  });
  let real = 0; for (const m of base.kept.values()) real += m.size;
  return { real, nullMax: Math.max(0, ...counts), nullCounts: counts, beatsChance: real > Math.max(0, ...counts) };
}
export function buildPack(sources, opts = {}) {
  const base = projectBase(sources, opts);
  return { ...finalizePack(base, opts), kept: base.kept, rawVotes: base.real, nullRaw: base.nullRaw };
}

// ── held-out guard ───────────────────────────────────────────────────────────────────────────────────────────────────
/** Drop every pair whose creole side's key is in `heldKeys`. Returns {kept, dropped}. */
export function excludeHeldOut(pairs, heldKeys) {
  const kept = [], dropped = [];
  for (const p of pairs) { if (heldKeys.has(foldKey(p.c))) dropped.push(p); else kept.push(p); } // GATE:heldout
  return { kept, dropped };
}

// ── evaluation (the only place gold appears) ─────────────────────────────────────────────────────────────────────────
const argmax = (m) => { let best = null, bn = -Infinity; for (const [u, n] of Object.entries(m)) if (n > bn || (n === bn && u < best)) { best = u; bn = n; } return best; };
/**
 * gold: [[{form, upos}]] — sentences of tokens. forms: {f: {u: n}} (a pack's forms).
 * Returns per-class tallies plus the per-sentence tallies the bootstrap needs. PUNCT/NUM are scored by the script rule
 * and kept out of the headline ("non-trivial").
 */
export function tally(forms, gold) {
  const sents = [];
  for (const sent of gold) {
    const t = { gold: {}, pred: {}, tp: {}, tokens: 0, covered: 0, trivialGold: {}, trivialTp: 0, trivial: 0 };
    for (const { form, upos } of sent) {
      const sc = scriptClass(form);
      if (sc) { t.trivial += 1; t.trivialGold[upos] = (t.trivialGold[upos] ?? 0) + 1; if (sc === upos) t.trivialTp += 1; continue; }
      const key = foldText(String(form).trim());
      const trimmed = key.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
      // own properties only: "constructor" is a real word and must not resolve to Object.prototype.constructor
      const d = Object.hasOwn(forms, key) ? forms[key] : Object.hasOwn(forms, trimmed) ? forms[trimmed] : null;
      t.tokens += 1; t.gold[upos] = (t.gold[upos] ?? 0) + 1;
      if (!d) continue;
      const p = argmax(d); t.covered += 1; t.pred[p] = (t.pred[p] ?? 0) + 1;
      if (p === upos) t.tp[upos] = (t.tp[upos] ?? 0) + 1;
    }
    sents.push(t);
  }
  return sents;
}
export function summarise(sents) {
  const g = {}, p = {}, tp = {}; let tokens = 0, covered = 0, correct = 0, trivial = 0, trivialTp = 0;
  for (const s of sents) {
    tokens += s.tokens; covered += s.covered; trivial += s.trivial; trivialTp += s.trivialTp;
    for (const [u, n] of Object.entries(s.gold)) g[u] = (g[u] ?? 0) + n;
    for (const [u, n] of Object.entries(s.pred)) p[u] = (p[u] ?? 0) + n;
    for (const [u, n] of Object.entries(s.tp)) { tp[u] = (tp[u] ?? 0) + n; correct += n; }
  }
  const perClass = {};
  let f1s = [];
  for (const u of Object.keys(g).sort()) {
    const P = p[u] ? (tp[u] ?? 0) / p[u] : null, R = (tp[u] ?? 0) / g[u];
    const F = P !== null && P + R > 0 ? (2 * P * R) / (P + R) : 0;
    perClass[u] = { nGold: g[u], nPred: p[u] ?? 0, tp: tp[u] ?? 0, precision: P, recall: R, f1: F };
    f1s.push(F);
  }
  return { tokens, covered, correct, coverage: tokens ? covered / tokens : 0, accuracyCovered: covered ? correct / covered : null, accuracyAll: tokens ? correct / tokens : 0, macroF1: f1s.length ? f1s.reduce((a, b) => a + b, 0) / f1s.length : 0, trivial, trivialTp, perClass };
}
/** Sentence bootstrap: the central 95% of `stat` over BOOT resamples (a REPORT, not a gate). */
export function bootstrap(sents, stat, rand, BOOT = DECLARED.BOOT) {
  const vals = [];
  for (let b = 0; b < BOOT; b++) {
    const r = []; for (let i = 0; i < sents.length; i++) r.push(sents[Math.floor(rand() * sents.length)]);
    const v = stat(summarise(r)); if (v !== null && Number.isFinite(v)) vals.push(v);
  }
  vals.sort((a, b) => a - b);
  if (!vals.length) return null;
  const q = (x) => vals[Math.min(vals.length - 1, Math.max(0, Math.floor(x * (vals.length - 1))))]; 
  return [q(DECLARED.CI[0]), q(DECLARED.CI[1])];
}
/** Paired sign-flip max-T: does arm A beat arm B on per-sentence `score`, against all B flips? Returns {delta, maxNull, adopt}. */
export function pairedMaxT(scoresA, scoresB, rand, B = DECLARED.B) {
  const d = scoresA.map((x, i) => x - scoresB[i]);
  const obs = d.reduce((a, b) => a + b, 0);
  let max = -Infinity;
  for (let b = 0; b < B; b++) { let s = 0; for (const x of d) s += rand() < 0.5 ? x : -x; if (s > max) max = s; }
  return { delta: obs, maxNull: max, adopt: obs > max };
}
export const correctPerSentence = (sents) => sents.map((s) => Object.values(s.tp).reduce((a, b) => a + b, 0));

/** The raw-vote lexicon of one null draw as pack-shaped forms (F1: chance). */
export function lexiconOf(votes) {
  const forms = {};
  for (const [f, m] of votes) { const o = {}; for (const [u, v] of m) o[u] = v; forms[f] = o; }
  return forms;
}

export function packShape(language, forms, provenance) {
  return { schema: "POSPrior@1", language, provenance, forms };
}
