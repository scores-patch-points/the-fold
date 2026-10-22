// resolve.mjs — which one is it? Pick the referent a mention is about, as a best assertion with odds.
//
// A person does not compare fields. They hold a purpose, read the COMPANY the mention keeps (a few rare shared
// things decide it; common ones count for nothing), forgive noise, distrust the impossible, hold a best guess with a
// confidence, and ask when torn. This organ does that over a referent graph and nothing else:
//
//   state(x)   an amplitude over referent nodes. Each node the thing is attached to carries sqrt(surprisal) — how
//              unexpected that node is in the pool — and the nodes related to it share ONE unit of amplitude, so a
//              hub's neighbourhood cannot outweigh a rare node. Cosine of two states is their overlap.
//   posterior  the Born rule: p_j ∝ s_j² (× a likelihood ratio when an axis has evidence). No fitted temperature.
//   decision   no threshold of this organ's. ASSERT only when the top posterior beats the willingness to be wrong the LENS
//              states (`lens.assertAt`, a probability — the purpose sets the stakes); with none stated, the pool's own
//              chance floor, 1 - 1/n. Otherwise ASK, naming the candidates above uniform chance and the node that separates
//              the top two, and the one question expected to teach the most (`nextQuestion`). When the best similarity does not clear the between-candidate null (how alike different
//              candidates are to each other, at the 1 - 1/n quantile), the answer is a typed GAP, never a guess.
//              An assertion carries `verification`: the one question that would test the top candidate hardest (a "no" is just the
//              Born update, so a wrong earlier answer can be reopened). N_eff = 1/Σp² (the effective number of candidates) is reported, not used to decide.
//   dates      an axis with a functional value per person. A record whose own values are impossible (death before birth)
//              is withheld and flagged — it never convicts. Whether two records that disagree by a year are the same
//              person depends on how far sources really drift, which the pool cannot show; so unless the caller supplies
//              observed same-person gaps (`sameGaps`), the axis abstains (contributes nothing). It is never a veto.
//
// STATUS: EXPERIMENTAL (2026-10-21). Measured only on Wikipedia people whose referents editors already linked (held-out "David Jones",
// 96; dev "John Smith", 233; notes: IDENTITY-WHICH-ONE.md). Not measured: reading plain text into nodes, people with a thin footprint,
// a noisy real person as the oracle. Dates abstain unless same-person gaps are supplied; induced kinds gave no gain and are not used.
//
// Smoothing constants (add-half / add-one Laplace terms, the 1 - 1/(n+1) answer model) keep a probability off 0 and 1; they are not tuned and
// carry no information. Presentation caps (top 3 reasons, top 4 distinguishing nodes) never enter a decision.
//
// PURE and DETERMINISTIC. Nothing is written; the result is a proposal (`proposed: true`) carrying its
// giver and lens, to be recorded by the caller as an EOT event. The referent graph is INJECTED (`neighbors`).
// Browser-safe on purpose: no imports. The surface (the-fold) is a static page, so this organ must not pull in node:crypto or a sibling file.
// The assertion id is a content address (two FNV-1a passes, 64 bits as hex); it names the assertion, it is not a security hash.
function hashId(...parts) {
  const text = parts.map(String).join('\u0000');
  let a = 0x811c9dc5, b = 0x9747b28c;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ (c + i), 0x01000193) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

export const RESOLVE_SCHEMA = 'EOIdentityAssertion@1';

const sq = (x) => x * x;
/** company(x) = the nodes x is attached to plus the nodes related to them (one hop through the injected graph). */
function companyOf(nodes, neighbors) {
  const out = new Set();
  for (const n of nodes) {
    out.add(n);
    for (const y of neighbors(n) ?? []) out.add(typeof y === 'string' ? y : y.node);
  }
  return out;
}

/** surprisal of a node in the pool: -log of how often candidates keep it (Laplace-smoothed). */
function makeSurprisal(companies) {
  const n = companies.length;
  const count = new Map();
  for (const c of companies) for (const x of c) count.set(x, (count.get(x) ?? 0) + 1);
  return (x) => -Math.log(((count.get(x) ?? 0) + 0.5) / (n + 1));
}

/** amplitude state: attached nodes carry sqrt(surprisal); the nodes related to each share one unit. */
export function stateOf(nodes, { neighbors, surprisal }) {
  const a = new Map();
  const add = (k, v) => a.set(k, (a.get(k) ?? 0) + v);
  for (const x of new Set(nodes)) {
    add(x, Math.sqrt(Math.max(surprisal(x), 0)));
    // a neighbour may carry a weight ({ node, w }): the related nodes then share the one unit in proportion to w (unit L2 norm), not equally
    const wmap = new Map();
    for (const y of neighbors(x) ?? []) { const node = typeof y === 'string' ? y : y.node; wmap.set(node, Math.max(wmap.get(node) ?? 0, typeof y === 'string' ? 1 : y.w)); }
    const nb = [...wmap.keys()];
    const norm = Math.sqrt([...wmap.values()].reduce((t, w) => t + w * w, 0)) || 1;
    for (const y of nb) add(y, Math.sqrt(Math.max(surprisal(y), 0)) * (wmap.get(y) / norm));
  }
  return a;
}
const normOf = (a) => Math.sqrt([...a.values()].reduce((s, v) => s + v * v, 0)) || 1;
function overlap(a, na, b, nb) {
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  let d = 0;
  for (const [k, v] of small) { const w = large.get(k); if (w) d += v * w; }
  return d / (na * nb);
}

const impossible = (r) => r && r.birth !== undefined && r.death !== undefined && r.death < r.birth;

/** date likelihood ratio for (mention record, candidate record). 1 = no evidence. */
function dateEvidence(mRec, cRec, { sameGaps, diffGapDensity, n }) {
  if (impossible(mRec)) return { lr: 1, flag: 'mention record impossible (death before birth): withheld' };
  if (impossible(cRec)) return { lr: 1, flag: 'candidate record impossible (death before birth): withheld' };
  if (!sameGaps?.length || mRec?.birth === undefined || cRec?.birth === undefined) return { lr: 1, flag: null };
  const g = Math.abs(mRec.birth - cRec.birth);
  const hit = sameGaps.filter((x) => Math.abs(x - g) <= 0.5).length;
  const pSame = (1 - 1 / n) * ((hit + 0.5) / (sameGaps.length + 1)) + (1 / n) * diffGapDensity(g);
  return { lr: pSame / diffGapDensity(g), flag: null };
}

function gapDensityFrom(records) {
  const ys = records.map((r) => r?.birth).filter((y) => y !== undefined);
  const hist = new Map();
  let tot = 0;
  for (let i = 0; i < ys.length; i += 1) for (let j = i + 1; j < ys.length; j += 1) {
    const g = Math.abs(ys[i] - ys[j]);
    hist.set(g, (hist.get(g) ?? 0) + 1); tot += 1;
  }
  return (g) => ((hist.get(g) ?? 0) + 0.5) / (tot + 1);
}


const entropy = (ps) => -ps.reduce((a, q) => a + (q > 0 ? q * Math.log(q) : 0), 0);

/** The node whose answer is expected to teach the most: max expected information gain over the posterior, restricted to the
 *  candidates above chance. null when no node has positive gain (the record has no question left to ask). */
function bestQuestion(p, cStates, cNorms, idx, qOf, asked) {
  const nodes = new Set();
  for (const j of idx) for (const k of cStates[j].keys()) if (!asked.has(k)) nodes.add(k);
  const pj = idx.map((j) => p[j]); const z = pj.reduce((a, b) => a + b, 0) || 1; const pn = pj.map((v) => v / z);
  const h0 = entropy(pn);
  let best = null;
  for (const k of nodes) {
    const q = idx.map((j) => qOf(j, k));
    const yes = pn.map((v, i) => v * q[i]), no = pn.map((v, i) => v * (1 - q[i]));
    const py = yes.reduce((a, b) => a + b, 0), pno = no.reduce((a, b) => a + b, 0);
    if (py <= 0 || pno <= 0) continue;
    const gain = h0 - (py * entropy(yes.map((v) => v / py)) + pno * entropy(no.map((v) => v / pno)));
    if (gain > 1e-9 && (!best || gain > best.gain)) best = { node: k, gain: +gain.toFixed(4), pYes: +py.toFixed(4) };
  }
  return best;
}

/** The question that tests the top candidate hardest: the node it keeps whose "no" would lower its posterior the most.
 *  null when no unasked node would lower it. A "no" is just the Born update; a "yes" lets the assertion stand. */
function verifyQuestion(w, top, cStates, qOf, asked) {
  const tot = (f) => w.reduce((a, v, j) => a + v * f(j), 0) || 1;
  let best = null;
  for (const k of cStates[top].keys()) {
    if (asked.has(k)) continue;
    const afterNo = (w[top] * (1 - qOf(top, k))) / tot((j) => 1 - qOf(j, k));
    if (!best || afterNo < best.ifNo) best = { node: k, ifNo: afterNo };
  }
  const p = w[top] / (tot(() => 1));
  return best && best.ifNo < p ? { node: best.node, ifNoP: +best.ifNo.toFixed(4), fromP: +p.toFixed(4) } : null;
}

/**
 * resolveReferent({ mention, candidates, neighbors, lens, giver, cursor, sameGaps, answers })
 *   centered    false (default) | true: subtract the pool's mean state before the cosine (Janus's lambda: words every candidate shares stop counting)
 *   answerModel 'partial' (default) | 'born' (RUN 1, kept for reproducibility)
 *   answers     [{ node, yes }]                                  the person's replies to earlier questions (see nextQuestion in the result)
 *   mention     { nodes: string[], record?: {birth?, death?} }   the referents the mention is attached to
 *   candidates  [{ id, nodes: string[], record? }]               what each candidate is known to be attached to
 *   neighbors   (nodeId) => string[]                             the referent graph, injected (typed relations flattened)
 *   lens        a stated purpose — no lens, no comparison (typed refusal, like same.mjs)
 */
export function resolveReferent({ mention, candidates, neighbors = () => [], lens, giver = null, cursor = null, sameGaps = null, answers = [], answerModel = 'partial', centered = false } = {}) {
  if (!lens) return { schema: RESOLVE_SCHEMA, decision: 'refused', reason: 'no lens: which-one needs a stated purpose' };
  if (lens.assertAt !== undefined && !(Number.isFinite(lens.assertAt) && lens.assertAt > 0 && lens.assertAt <= 1)) return { schema: RESOLVE_SCHEMA, decision: 'refused', reason: 'lens.assertAt must be a probability in (0, 1]' };
  const ans = Array.isArray(answers) ? answers : [];
  if (!mention?.nodes?.length) return { schema: RESOLVE_SCHEMA, decision: 'gap', reason: 'mention keeps no company: nothing to read', lens: lens.name ?? null };
  const cands = (candidates ?? []).filter((c) => c?.nodes?.length);
  if (!cands.length) return { schema: RESOLVE_SCHEMA, decision: 'gap', reason: 'no candidate keeps any company', lens: lens.name ?? null };
  if (new Set(cands.map((c) => c.id)).size !== cands.length) return { schema: RESOLVE_SCHEMA, decision: 'refused', reason: 'candidate ids must be unique' };
  // one candidate has no between-candidate null: nothing to read it against, so it is a typed gap, never an assertion
  if (cands.length === 1) return { schema: RESOLVE_SCHEMA, decision: 'gap', reason: 'one candidate: there is no between-candidate null to read the mention against', lens: lens.name ?? null, candidates: [{ id: cands[0].id }] };

  const n = cands.length;
  const comps = cands.map((c) => companyOf(c.nodes, neighbors));
  const mComp = companyOf(mention.nodes, neighbors);
  const surprisal = makeSurprisal([...comps, mComp]);
  const ctx = { neighbors, surprisal };
  const mState = stateOf(mention.nodes, ctx), mNorm = normOf(mState);
  const cStates = cands.map((c) => stateOf(c.nodes, ctx));
  const cNorms = cStates.map(normOf);
  // similarity runs on `simM`/`simC`; with `centered` these are residuals from the pool's mean state, otherwise the states themselves.
  // The question helpers and the answer model keep the raw states (a question is about a node the candidate actually keeps).
  let simM = mState, simC = cStates;
  const subMean = (() => {
    if (!centered) return (st) => st;
    const mean = new Map();
    for (const st of cStates) for (const [k, v] of st) mean.set(k, (mean.get(k) ?? 0) + v / cStates.length);
    return (st) => { const o = new Map(); for (const k of new Set([...st.keys(), ...mean.keys()])) { const d = (st.get(k) ?? 0) - (mean.get(k) ?? 0); if (d) o.set(k, d); } return o; };
  })();
  if (centered) { simM = subMean(mState); simC = cStates.map(subMean); }
  const simMNorm = normOf(simM), simCNorms = simC.map(normOf);
  const s = simC.map((st, j) => overlap(simM, simMNorm, st, simCNorms[j]));

  // the null: how alike are DIFFERENT candidates to each other? A mention must beat the (1 - 1/n) quantile of that
  // distribution to count as the same one — no draws, no threshold of mine, the pool's own chance of confusion.
  // candidates the record cannot tell apart (identical states) are reported, and left out of the null: they say nothing about chance
  const between = [], twins = [], twinIdx = [];
  for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) if (i !== j) {
    const o = overlap(simC[i], simCNorms[i], simC[j], simCNorms[j]);
    if (o > 1 - 1e-9) { if (i < j) { twins.push([cands[i].id, cands[j].id]); twinIdx.push([i, j]); } } else between.push(o);
  }
  between.sort((a, b) => a - b);
  const nullQ = between.length ? between[Math.min(between.length - 1, Math.floor(between.length * (1 - 1 / Math.max(n, 2))))] : 0;

  // dates: evidence or abstention, never a veto
  const diffDensity = gapDensityFrom(cands.map((c) => c.record));
  const flags = [];
  const lr = cands.map((c) => {
    const e = dateEvidence(mention.record, c.record, { sameGaps, diffGapDensity: diffDensity, n });
    if (e.flag) flags.push({ candidate: c.id, issue: e.flag });
    return e.lr;
  });

  // Born rule
  // answers. A candidate's record is a PARTIAL view of the thing, so a node the record lacks is silent, not contradicted:
  //   'partial' (default)  P(yes | j has the node) = 1 - 1/(n+1); P(yes | j lacks it) = the node's pool frequency f(n) (add-half);
  //                        P(no) is the complement. A rare node a candidate keeps is strong evidence; one it lacks is mild.
  //   'born'  (RUN 1)      P(yes | j) = the Born probability that j's state includes the node, add-one smoothed. Kept so
  //                        RUN 1 stays reproducible: it treats a missing node as near-impossible and kills the true candidate
  //                        whenever the person says yes to something the record never captured.
  const universeSize = new Set(cStates.flatMap((st) => [...st.keys()])).size || 1;
  const hasCount = new Map();
  for (const st of cStates) for (const k of st.keys()) hasCount.set(k, (hasCount.get(k) ?? 0) + 1);
  const qOf = answerModel === 'born'
    ? (j, node) => ((sq(cStates[j].get(node) ?? 0)) + 1 / universeSize) / (sq(cNorms[j]) + 1)
    : (j, node) => (cStates[j].has(node) ? 1 - 1 / (n + 1) : ((hasCount.get(node) ?? 0) + 0.5) / (n + 1));
  // log space, so many answers cannot underflow; a similarity of zero is a weight of zero
  const ansLog = cands.map((_, j) => ans.reduce((a, r) => a + Math.log(r.yes ? qOf(j, r.node) : 1 - qOf(j, r.node)), 0));
  const logw = s.map((v, j) => (v > 0 ? 2 * Math.log(v) + Math.log(lr[j]) + ansLog[j] : -Infinity));
  const mx = Math.max(...logw);
  if (!Number.isFinite(mx)) return { schema: RESOLVE_SCHEMA, decision: 'gap', reason: 'the mention overlaps no candidate', lens: lens.name ?? null, poolSize: n, flags: [] };
  const ew = logw.map((l) => Math.exp(l - mx));
  const tot = ew.reduce((a, b) => a + b, 0);
  const p = ew.map((v) => v / tot);
  const w = p; // the question helpers only use ratios, which the normalised posterior keeps
  // ties break by id, never by input order
  const order = p.map((q, j) => [q, j]).sort((a, b) => b[0] - a[0] || (cands[a[1]].id < cands[b[1]].id ? -1 : cands[a[1]].id > cands[b[1]].id ? 1 : 0));
  const nEff = 1 / p.reduce((a, q) => a + q * q, 0);

  const top = order[0][1];
  // the runner-up the record CAN separate from the top (skipping twins of the top)
  const second = (order.find(([, j]) => j !== top && overlap(simC[top], simCNorms[top], simC[j], simCNorms[j]) <= 1 - 1e-9) ?? [0, undefined])[1];
  const why = (j) => {
    const rows = [];
    for (const [k, v] of simM) { const u = simC[j].get(k); if (u > 0 && v > 0) rows.push({ node: k, weight: +(v * u).toFixed(4) }); }
    return rows.sort((a, b) => b.weight - a.weight).slice(0, 3);
  };
  const out = {
    schema: RESOLVE_SCHEMA, proposed: true, lens: lens.name ?? null, giver, cursor, poolSize: n,
    nullQuantile: +nullQ.toFixed(4), nEff: +nEff.toFixed(3), flags,
    indistinguishable: twins, candidates: order.map(([pj, j]) => ({ id: cands[j].id, p: +pj.toFixed(4), odds: pj < 1 ? +(pj / (1 - pj)).toFixed(3) : null, similarity: +s[j].toFixed(4), why: why(j) })),
  };
  const aboveIdx = order.filter(([q]) => q >= (1 / n) * (1 - 1e-9)).map(([, j]) => j);
  const askedNodes = new Set([...ans.map((r) => r.node), ...mention.nodes]);
  // the null guards against a similarity that is luck; once the person has ANSWERED, the posterior carries direct evidence and decides
  const informative = ans.some((r) => hasCount.has(r.node)); // an answer about a node no candidate keeps says nothing
  if (!informative && !(s[top] > nullQ)) {
    return { ...out, decision: 'gap', reason: 'no candidate clears the between-candidate null at the pool chance floor',
      nextQuestion: aboveIdx.length > 1 ? bestQuestion(p, cStates, cNorms, aboveIdx, qOf, askedNodes) : null };
  }
  // sensitivity: which single attached node, if wrong, would change the answer
  const fragile = [];
  if (mention.nodes.length > 1) {
    for (const drop of new Set(mention.nodes)) {
      const rest = mention.nodes.filter((x) => x !== drop);
      const st = subMean(stateOf(rest, ctx)), nn = normOf(st);
      const ww = simC.map((cs, j) => sq(Math.max(overlap(st, nn, cs, simCNorms[j]), 0)) * lr[j] * Math.exp(ansLog[j]));
      const best = ww.indexOf(Math.max(...ww));
      if (best !== top) fragile.push({ ifWrong: drop, flipsTo: cands[best].id });
    }
  }
  out.fragile = fragile;
  const assertAt = lens.assertAt ?? 1 - 1 / Math.max(n, 2);
  out.assertAt = +assertAt.toFixed(4);
  const topHasTwin = twinIdx.some(([i, j]) => i === top || j === top);
  if (order[0][0] >= assertAt && !topHasTwin) return { ...out, decision: 'assert', asserted: cands[top].id, verification: verifyQuestion(w, top, cStates, qOf, askedNodes), id: hashId('assert', cands[top].id, JSON.stringify(mention.nodes), String(cursor ?? '')) };

  // ask: the node that most separates the top two, on each side
  const diff = [];
  if (second !== undefined) for (const k of new Set([...cStates[top].keys(), ...cStates[second].keys()])) {
    const d = (cStates[top].get(k) ?? 0) - (cStates[second].get(k) ?? 0);
    if (d) diff.push({ node: k, favors: d > 0 ? cands[top].id : cands[second].id, amplitude: +Math.abs(d).toFixed(4) });
  }
  diff.sort((a, b) => b.amplitude - a.amplitude);
  const betweenIdx = aboveIdx;
  return { ...out, decision: 'ask', between: betweenIdx.map((j) => cands[j].id), distinguishing: diff.slice(0, 4), nextQuestion: bestQuestion(p, cStates, cNorms, betweenIdx, qOf, askedNodes) };
}

export default { RESOLVE_SCHEMA, resolveReferent, stateOf };
