// wald.js — Wald, the watcher of the pull, under heimdall.
//
// Handle: Wald — after Abraham Wald's Sequential Analysis (Wiley 1947): at
// every stage, accept, reject, or take one more observation, and pay for it;
// the cost of experimentation is a term of the risk, in the same unit as the
// losses from wrong decisions (§10.4.3 fn. 2; eo-teachings/manifest/wald.json,
// verified against the held excerpt). Ratified by the person 2026-10-14 ("wire
// it in"), on the proposal the-fold/docs/archons/WALD-PROPOSAL.md.
//
// The register lives in solon.js — the one authoritative list; this file
// does not restate it. Here: WALD (the pull). He answers one question per
// prompt, before anything is fetched: WHAT MUST BE PULLED to answer this, and
// from where — nothing, the thread, what the fold already holds, a structured
// source, the web — and whether the mouth is reached at all. He never decides
// WHICH model (huginn), what the prompt carries (gary), or which web sources
// (the surface's router); he never reads the answer.
//
// THE RULE, Wald's own (§3.1, §3.3): each witness's vote is one observation.
// For a pull, the observations' log likelihood ratios are summed (each
// witness's ratio measured on labelled turns, never declared) and held against
// two bars derived from the tolerated error rates:
//     log A = log((1−β)/α)   at or above: PROBABLE — licensed to spend
//     log B = log(β/(1−α))   at or below: REFUSED — not pulled
//     between:               CONTINUE — take the cheapest further pull and
//                            re-decide; at the limit, Wald's truncation rule
//                            (§3.8): the sign of the sum decides.
// POSSIBLE is the low bar and is structural: any one witness voting for a
// pull makes it possible. Nothing that is not possible is ever pulled.
// α and β are inputs measured on the ledger (the gate a calibration must beat
// supplies them), never set here. A pull with no measured ratios is
// UNCALIBRATED — a typed gap, never a guess.
//
// The currency (§10.4.3 fn. 2: risk = expected loss + c·E[n], or E[c(n)]):
// a pull's price is the measured milliseconds of the person's wait it costs;
// the decision records the prices it was handed and never invents one. Off-
// device exposure is not priced: consent is the surface's gate, not a cost.
//
// PURE: no fetch, no DOM, no clock, no storage. Witness votes, calibration
// and prices are injected; the crossing owns timing and the record.

export const WALD_SCHEMA = "WaldDecision@1";

/** The closed register of pulls, cheapest first (declared order until prices are measured). */
export const PULLS = Object.freeze({
  NONE: "none",             // answered mechanically: compute, self, a fixed reply, a typed gap
  THREAD: "thread",         // the conversation already holds it
  LOCAL: "local",           // what the fold holds: an attachment, the record, a shelved book
  STRUCTURED: "structured", // one typed fact for one typed slot
  WEB: "web",               // search, then read
});
export const COST_ORDER = Object.freeze([PULLS.NONE, PULLS.THREAD, PULLS.LOCAL, PULLS.STRUCTURED, PULLS.WEB]);

export const VOTE = Object.freeze({ FOR: "for", AGAINST: "against", ABSTAIN: "abstain" });
const VOTE_VALUES = Object.freeze([VOTE.FOR, VOTE.AGAINST, VOTE.ABSTAIN]);

export const VERDICT = Object.freeze({
  PROBABLE: "probable", REFUSED: "refused", CONTINUE: "continue",
  UNCALIBRATED: "uncalibrated", IMPOSSIBLE: "impossible",
});

/** Wald §3.3: the bars from the tolerated error rates. Refuses rates outside (0, 1) and α + β ≥ 1 (no test separates). */
export function thresholdsOf({ alpha, beta } = {}) {
  const ok = (x) => Number.isFinite(x) && x > 0 && x < 1;
  if (!ok(alpha) || !ok(beta) || alpha + beta >= 1) return { ok: false, why: `alpha and beta must lie in (0,1) with alpha+beta<1 (got ${alpha}, ${beta})` };
  const A = (1 - beta) / alpha, B = beta / (1 - alpha);
  return { ok: true, alpha, beta, A, B, logA: Math.log(A), logB: Math.log(B), giver: "Wald 1947 §3.3: A ≈ (1−β)/α, B ≈ β/(1−α)" };
}

/** Normalise a vote record: { witness, pull, vote, why }. An unknown vote is an abstention, said so. */
function voteOf(v) {
  const vote = VOTE_VALUES.includes(v?.vote) ? v.vote : VOTE.ABSTAIN;
  return { witness: String(v?.witness ?? "?"), pull: String(v?.pull ?? ""), vote, why: String(v?.why ?? (vote === v?.vote ? "" : "unreadable vote, read as abstain")) };
}

/**
 * Measure each witness's likelihood ratios for one pull from labelled rows.
 * rows: [{ votes: [{witness, pull, vote}], label: { [pull]: boolean } }]
 * Laplace's rule of succession (add one to every cell) is the only prior: a
 * vote never seen under a label is improbable there, never impossible.
 * → { pull, n, needed, notNeeded, lr: { [witness]: { for, against, abstain } } }
 */
export function measureRatios(rows, pull) {
  const counts = new Map();   // witness → { needed: {for,against,abstain}, not: {...} }
  let needed = 0, notNeeded = 0;
  for (const r of rows || []) {
    const lab = r?.label?.[pull];
    if (typeof lab !== "boolean") continue;
    lab ? needed++ : notNeeded++;
    for (const raw of r.votes || []) {
      const v = voteOf(raw);
      if (v.pull !== pull) continue;
      if (!counts.has(v.witness)) counts.set(v.witness, { needed: { for: 0, against: 0, abstain: 0 }, not: { for: 0, against: 0, abstain: 0 } });
      counts.get(v.witness)[lab ? "needed" : "not"][v.vote]++;
    }
  }
  const lr = {};
  for (const [w, c] of counts) {
    // a witness that did not vote on a row abstained there
    const nN = needed, nX = notNeeded;
    const fill = (side, tot) => ({ ...side, abstain: side.abstain + (tot - side.for - side.against - side.abstain) });
    const cn = fill(c.needed, nN), cx = fill(c.not, nX);
    lr[w] = {};
    for (const val of VOTE_VALUES) {
      const pN = (cn[val] + 1) / (nN + VOTE_VALUES.length);
      const pX = (cx[val] + 1) / (nX + VOTE_VALUES.length);
      lr[w][val] = pN / pX;
    }
  }
  return { pull, n: needed + notNeeded, needed, notNeeded, lr, giver: "measured on labelled turns; Laplace rule of succession (1814) as the only prior" };
}

/**
 * Decide every pull for one prompt.
 * votes        [{ witness, pull, vote, why }]   from the injected witnesses
 * calibration  { [pull]: { lr, alpha, beta } } measured; a pull without one is UNCALIBRATED
 * prices       { [pull]: ms }                  measured; recorded, never invented
 * → WaldDecision@1 { schema, pulls: { [pull]: {...} }, possible, probable, refused, continue, recommend, skipped, disagreements, gaps }
 */
export function waldDecide({ votes = [], calibration = {}, prices = {} } = {}) {
  const vs = votes.map(voteOf).filter((v) => COST_ORDER.includes(v.pull));
  const pulls = {};
  const gaps = [];
  for (const pull of COST_ORDER) {
    const mine = vs.filter((v) => v.pull === pull);
    const fors = mine.filter((v) => v.vote === VOTE.FOR);
    const againsts = mine.filter((v) => v.vote === VOTE.AGAINST);
    const possible = fors.length > 0;
    const entry = {
      possible,
      for: fors.map((v) => v.witness), against: againsts.map((v) => v.witness),
      price: Number.isFinite(prices[pull]) ? prices[pull] : null,
    };
    if (!possible) { entry.verdict = VERDICT.IMPOSSIBLE; pulls[pull] = entry; continue; }
    const cal = calibration[pull];
    const th = cal ? thresholdsOf(cal) : null;
    if (!cal || !cal.lr || !th?.ok) {
      entry.verdict = VERDICT.UNCALIBRATED;
      gaps.push({ pull, why: !cal ? "no measured ratios for this pull" : th && !th.ok ? th.why : "calibration carries no ratios" });
      pulls[pull] = entry; continue;
    }
    let llr = 0;
    const terms = [];
    for (const v of mine) {
      const r = cal.lr[v.witness]?.[v.vote];
      if (!Number.isFinite(r) || r <= 0) { terms.push({ witness: v.witness, vote: v.vote, llr: null, why: "witness not in calibration" }); continue; }
      const t = Math.log(r);
      llr += t;
      terms.push({ witness: v.witness, vote: v.vote, llr: +t.toFixed(4) });
    }
    entry.llr = +llr.toFixed(4);
    entry.logA = +th.logA.toFixed(4);
    entry.logB = +th.logB.toFixed(4);
    entry.terms = terms;
    entry.verdict = llr >= th.logA ? VERDICT.PROBABLE : llr <= th.logB ? VERDICT.REFUSED : VERDICT.CONTINUE;
    if (entry.verdict === VERDICT.CONTINUE) entry.truncated = llr > 0 ? "pull" : "skip";   // §3.8: at the limit the sign decides
    pulls[pull] = entry;
  }
  const by = (verdict) => COST_ORDER.filter((p) => pulls[p].verdict === verdict);
  const possible = COST_ORDER.filter((p) => pulls[p].possible);
  const probable = by(VERDICT.PROBABLE);
  const cont = by(VERDICT.CONTINUE);
  // the cheapest further observation for each CONTINUE pull: the cheapest possible pull below it that is not refused
  const probe = {};
  for (const p of cont) {
    const below = COST_ORDER.slice(0, COST_ORDER.indexOf(p)).find((q) => pulls[q].possible && pulls[q].verdict !== VERDICT.REFUSED);
    probe[p] = below || null;
  }
  // what Wald would take, cheapest first: the probable pulls, then each continue pull truncated
  const recommend = COST_ORDER.filter((p) => pulls[p].verdict === VERDICT.PROBABLE || (pulls[p].verdict === VERDICT.CONTINUE && pulls[p].truncated === "pull"));
  const skipped = possible.filter((p) => !recommend.includes(p)).map((p) => ({ pull: p, verdict: pulls[p].verdict, why: skipWhy(pulls[p]) }));
  const disagreements = COST_ORDER.filter((p) => pulls[p].for.length && pulls[p].against.length)
    .map((p) => ({ pull: p, for: pulls[p].for, against: pulls[p].against }));
  return { schema: WALD_SCHEMA, pulls, possible, probable, refused: by(VERDICT.REFUSED), continue: cont, probe, recommend, skipped, disagreements, gaps };
}

function skipWhy(e) {
  if (e.verdict === VERDICT.REFUSED) return `evidence ${e.llr} at or below log B ${e.logB}`;
  if (e.verdict === VERDICT.CONTINUE) return `evidence ${e.llr} between the bars; truncated by sign (§3.8) to skip`;
  if (e.verdict === VERDICT.UNCALIBRATED) return "no measured ratios: a gap, not a decision";
  return e.verdict;
}

/** The compact line a record carries (counts and pulls only — never the ask's text). */
export function waldLine(d) {
  if (!d || d.schema !== WALD_SCHEMA) return "wald: no decision";
  const p = (xs) => (xs.length ? xs.join(",") : "—");
  return `wald · possible ${p(d.possible)} · probable ${p(d.probable)} · continue ${p(d.continue)} · would take ${p(d.recommend)}${d.gaps.length ? ` · ${d.gaps.length} gap(s)` : ""}`;
}

export default { WALD_SCHEMA, PULLS, COST_ORDER, VOTE, VERDICT, thresholdsOf, measureRatios, waldDecide, waldLine };
