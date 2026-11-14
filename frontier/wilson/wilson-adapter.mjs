// wilson-adapter.mjs — Wilson's trails (khora native/kernel/stigmergy.js) for a fixed-budget reader.
// Draft for the fixed-context apparatus; the owning session decides whether it goes in.
//
// What it adds over stigmergy.js, and why:
//  1. Every guard is a switch, so an ablation can turn each off: halfLifeDays (Infinity = no
//     evaporation), explore (0 = no scouts), veto (false = contradictions deposit nothing).
//     stigmergy.js's routeOrderFor cannot do the first: trailStats calls trailWeight with the default
//     7-day half-life and takes no option.
//  2. Deposits come from the witness verdict, not from "a row came back":
//       supported -> ok deposit, cost = tokens spent
//       contradicted -> veto deposit (alarm trail) when veto is on, else nothing
//       unknown -> nothing (an absence is not evidence; evaporation alone demotes)
//  3. Order is by net strength (hits minus vetoes, both evaporating), tie-break by mean tokens per
//     supported answer (the budget's own currency), then the caller's default order.
//     A route whose net strength is <= 0 sorts AFTER never-tried routes. In stigmergy.js a route that
//     has only ever failed still sorts ahead of every never-tried route, because any deposit counts as
//     "tried": the colony keeps walking a dead trail before it scouts.
//  4. Scouts probe the least-recently-tried route when every route has been tried, not only a never-tried
//     one. stigmergy.js stops exploring once all routes have a deposit, which is the mill condition.
// Nothing here knows what a route or head means. Pure; rng and now are injectable.
import { deposit as rawDeposit, trailWeight, TRAIL_HALF_LIFE_DAYS, EXPLORE_EPSILON } from "./stigmergy-src.mjs";

export const DEFAULTS = Object.freeze({ halfLifeDays: TRAIL_HALF_LIFE_DAYS, explore: EXPLORE_EPSILON, veto: true });

/** depositFromWitness(trails, {head, route, verdict, tokens, at}, opts) -> new trails (or the same). */
export function depositFromWitness(trails, { head, route, verdict, tokens = 0, at = Date.now() }, opts = {}) {
  const { veto } = { ...DEFAULTS, ...opts };
  if (verdict === "supported") return rawDeposit(trails, { head, route, ok: true, ms: tokens, at });
  if (verdict === "contradicted" && veto) {
    // stigmergy.js's deposit keeps only {head, route, ok, ms, at}; the veto rides on a tagged route-less
    // field we add after the window cap so the stored shape stays EOStigmergy@1 plus one flag.
    const next = rawDeposit(trails, { head, route, ok: false, ms: tokens, at });
    const list = next[head].slice();
    list[list.length - 1] = { ...list[list.length - 1], veto: true };
    return { ...next, [head]: list };
  }
  if (verdict === "contradicted" || verdict === "unknown") {
    // recorded as a plain miss so "tried" and "last tried" stay honest; carries no weight
    return rawDeposit(trails, { head, route, ok: false, ms: tokens, at });
  }
  throw new Error(`depositFromWitness: unknown verdict ${verdict}`);
}

/** statsFor(trails, head, {routes, now, halfLifeDays}) -> per-route net strength, tokens per hit, last tried. */
export function statsFor(trails, head, { routes = [], now = Date.now(), halfLifeDays = DEFAULTS.halfLifeDays } = {}) {
  const w = (at) => (halfLifeDays === Infinity ? 1 : trailWeight(at, now, { halfLifeDays }));
  const m = new Map(routes.map((r) => [r, { route: r, net: 0, hits: 0, vetoes: 0, deposits: 0, tokens: 0, last: -Infinity }]));
  for (const t of trails?.[head] ?? []) {
    const s = m.get(t.route) ?? { route: t.route, net: 0, hits: 0, vetoes: 0, deposits: 0, tokens: 0, last: -Infinity };
    s.deposits += 1;
    s.last = Math.max(s.last, t.at);
    if (t.ok) { s.hits += 1; s.net += w(t.at); s.tokens += t.ms; }
    else if (t.veto) { s.vetoes += 1; s.net -= w(t.at); }
    m.set(t.route, s);
  }
  return [...m.values()].map((s) => ({ ...s, tokensPerHit: s.hits ? s.tokens / s.hits : null }));
}

/** orderRoutes(trails, head, {routes, now, halfLifeDays, explore, rng}) -> { order, scout } */
export function orderRoutes(trails, head, opts = {}) {
  const { routes = [], now = Date.now(), halfLifeDays, explore, rng = Math.random } = { ...DEFAULTS, ...opts };
  const stats = statsFor(trails, head, { routes, now, halfLifeDays });
  const idx = (r) => { const i = routes.indexOf(r); return i < 0 ? Infinity : i; };
  const earned = stats.filter((s) => s.net > 0).sort((a, b) =>
    b.net - a.net
    || (a.tokensPerHit ?? Infinity) - (b.tokensPerHit ?? Infinity)
    || idx(a.route) - idx(b.route));
  const never = stats.filter((s) => s.deposits === 0).sort((a, b) => idx(a.route) - idx(b.route));
  const dead = stats.filter((s) => s.deposits > 0 && s.net <= 0).sort((a, b) => b.net - a.net || idx(a.route) - idx(b.route));
  const order = [...earned, ...never, ...dead].map((s) => s.route);
  if (!(explore > 0) || order.length < 2 || !(rng() < explore)) return { order, scout: null };
  // scout: a never-tried route if any, else the least-recently-tried route that is not already first
  const pick = never[0]?.route
    ?? [...stats].filter((s) => s.route !== order[0]).sort((a, b) => a.last - b.last || idx(a.route) - idx(b.route))[0]?.route;
  return { order: [pick, ...order.filter((r) => r !== pick)], scout: pick };
}

/** fitBudget(ordered excerpts with .tokens, budget) -> the prefix that fits, and how much was left out. */
export function fitBudget(items, budget) {
  const kept = []; let used = 0;
  for (const it of items) { if (used + it.tokens > budget) continue; kept.push(it); used += it.tokens; }
  return { kept, used, dropped: items.length - kept.length };
}

// ── DMD evaporation (ledgers/pharos-lazy/PREREG-A8.md, applied to token cost) ─────────────────────────
// A8 replaces a typed half-life with: keep a trail only while it makes a difference to cost. Here the cost is
// tokens per supported answer, which is the "answer-quality DMD" A8 names and does not run. The 7-day
// half-life above stays as A8's fixed-window comparator arm.

/** shadowSample(questionId) -> true on a deterministic ~5% sample (FNV-1a hash mod 20 === 0; no rng, A8 U5). */
export function shadowSample(questionId) {
  let h = 0x811c9dc5;
  for (const ch of String(questionId)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h % 20 === 0;
}

/** savingOf({coldTokens, trailTokens, verifyTokens, depositTokens, verified}) -> s for one use.
 *  s = cold - (trail + verify + deposit); a failed hint is -(wasted tokens) (A8 U1, U7). */
export function savingOf({ coldTokens, trailTokens, verifyTokens = 0, depositTokens = 0, verified = true }) {
  const spent = trailTokens + verifyTokens + depositTokens;
  return verified ? coldTokens - spent : -spent;
}

/** dmdKeep(savings newest-last) -> { keep, window, net }. Window widens 1,2,4,... until the keep/drop
 *  decision is unchanged across two successive widenings (found, not set; A8). No uses -> drop (A8 U4).
 *  A failed verification on the newest use drops at once whatever came before (A8 U7). */
export function dmdKeep(savings, { failedLast = false } = {}) {
  if (!savings.length) return { keep: false, window: 0, net: 0 };
  if (failedLast) return { keep: false, window: 1, net: savings[savings.length - 1] };
  const decide = (w) => { const net = savings.slice(-w).reduce((a, b) => a + b, 0); return { keep: net > 0, net, window: w }; };
  let prev = decide(1), same = 0;
  for (let w = 2; ; w *= 2) {
    const cur = decide(Math.min(w, savings.length));
    same = cur.keep === prev.keep ? same + 1 : 0;
    if (same >= 2 || cur.window >= savings.length) return cur; // stable, or all evidence used
    prev = cur;
  }
}

/** scoutShare(log) -> share of scout probes in the last n rounds; falling to 0 with flat accuracy = mill risk. */
export function scoutShare(log, n = 50) {
  const tail = log.slice(-n);
  return tail.length ? tail.filter((e) => e.scout).length / tail.length : null;
}
