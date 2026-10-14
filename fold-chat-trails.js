// fold-chat-trails.js — THE STIGMERGIC PHEROMONE TRAILS of the fold's hunt. Pure; node-testable.
//
// The ant-swarm protocol (deposit · evaporate · follow) over the fold's log: a path that led to a
// held page is reinforced, a path that soured is marked down, and every deposit lets the whole
// ledger evaporate a little, so stale ground is forgotten. The hunt then follows the strongest
// trail first (fold-chat-folds.js, "src:" ground and the "rung:" climb).
//
// THE RATE IS NOT THE SAME FOR EVERY SOURCE. One global 0.85 (the old `EVAPORATE`) is wrong three
// ways, and each has a real cost on the hunt:
//
//   1. A SOURED trail must fade faster than a held one. A single failed read is not a verdict on a
//      host: if the mark-down lingers, a source that had one bad day is blacklisted and the hunt
//      stops exploring ground that would now hold. Failure is provisional; success is earned.
//   2. WEB GROUND ("src:") and THE CLIMB ("rung:") are not the same kind of memory. A host that
//      yields usable passages is a durable fact about the world and should persist across turns of
//      the same kind; a rung that worked for one build is a hint about method and should not ossify
//      the spiral. So the web source decays slower than the rung.
//   3. A trail must be BOUNDED. `t[k] += 1` forever makes a favourite host asymptotically dominant;
//      a saturating cap keeps the follow-the-strongest order without a runaway.
//
// DECLARED, not measured (Constitution II.11): the rates below are set by the author from the
// half-life the behaviour wants, not fitted to a capture. `halfLife` reports them so the choice is
// legible and testable. The falsifying control lives in fold-chat-trails.test.mjs: a source that
// sours must be retried within a couple of deposits (a held one must not), and a rung must outlive
// nothing it should not.

/** Retention per deposit, by trail-source and sign (1 = immortal, 0 = gone next deposit). */
export const DECAY = Object.freeze({
  src:  { pos: 0.90, neg: 0.40 },   // web ground: a good host is durable; a bad read is forgotten in ~3 turns, so it is retried
  rung: { pos: 0.85, neg: 0.42 },   // the climb: a method that worked, fresh enough not to ossify the spiral
  chat: { pos: 0.70, neg: 0.35 },   // chat-scoped hints: short-lived by design
});
export const DEFAULT_DECAY = Object.freeze({ pos: 0.85, neg: 0.45 });
export const FLOOR = 0.05;          // below this a trail is forgotten (|value|), as before
export const CAP = 6;               // a positive trail saturates here, so no host runs away

/** The source class of a trail key ("src:example.com" -> "src"). */
export function sourceOf(key) {
  const s = String(key ?? "").split(":")[0].trim().toLowerCase();
  return s || "default";
}

/** The retention rate for one trail, chosen by its source class and the sign of its value. */
export function rateFor(key, value = 1) {
  const d = DECAY[sourceOf(key)] || DEFAULT_DECAY;
  return (value < 0 ? d.neg : d.pos);
}

/** How many deposits a trail of this source and sign takes to halve. Reported so the declared
 *  rate is legible: `halfLife("src:…", 1)` ≈ 6.6, `halfLife("src:…", -1)` ≈ 1.2. */
export function halfLife(key, value = 1) {
  const r = rateFor(key, value);
  if (!(r > 0) || r >= 1) return Infinity;
  return Math.log(0.5) / Math.log(r);
}

/** Evaporate a ledger once, each key at ITS source's rate. Pure: returns a new ledger. */
export function evaporate(trails = {}) {
  const out = {};
  for (const [k, v] of Object.entries(trails || {})) {
    if (!Number.isFinite(v)) continue;
    const n = v * rateFor(k, v);
    if (Math.abs(n) >= FLOOR) out[k] = n;
  }
  return out;
}

/** Deposit a batch: evaporate once (every key, at its own rate), then add `amount` to each key.
 *  A negative `amount` sours the ground. Pure: returns a new ledger. */
export function deposit(trails = {}, keys = [], amount = 1) {
  const t = evaporate(trails);
  for (const k of keys || []) {
    if (!k) continue;
    const v = (t[k] || 0) + amount;
    t[k] = v > CAP ? CAP : v;
  }
  return t;
}

/** The strength of one trail (absent = 0). */
export function pheromone(trails, key) { return (trails && trails[key]) || 0; }

/** The keys ordered strongest-first — what the hunt follows. Ties keep the input order. */
export function follow(trails, keys = []) {
  return [...keys].sort((a, b) => pheromone(trails, b) - pheromone(trails, a));
}
