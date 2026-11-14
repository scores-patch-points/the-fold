// frontier/synth.mjs — seeded synthetic worlds for the stage tests and experiments. Deterministic (mulberry32). Nothing here is a benchmark.
export function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const SYL = ["ka", "lo", "mi", "ra", "ten", "vo", "su", "ni", "dra", "pel", "or", "zu", "fen", "ga", "ti", "mar"];
export function names(n, seed = 1) { const r = rng(seed), out = new Set(); while (out.size < n) out.add([0, 1, 2].map(() => SYL[Math.floor(r() * SYL.length)]).join("").replace(/^./, (c) => c.toUpperCase()) + (out.size >= SYL.length ** 3 / 2 ? out.size : "")); return [...out]; }

/** A chain world: E0's mentor is E1, ..., plus distractor sentences. Returns { text, chain, names } . */
export function chainWorld({ hops = 100, distractors = 2000, seed = 7 } = {}) {
  const r = rng(seed), N = names(hops + 1 + 200, seed);
  const chain = N.slice(0, hops + 1), others = N.slice(hops + 1);
  const lines = [];
  for (let i = 0; i < hops; i++) lines.push(`${chain[i]}'s mentor is ${chain[i + 1]}.`);
  const rel = ["neighbour", "cousin", "rival", "landlord"];
  for (let i = 0; i < distractors; i++) {
    const a = r() < 0.5 ? chain[Math.floor(r() * chain.length)] : others[Math.floor(r() * others.length)];
    lines.push(`${a}'s ${rel[Math.floor(r() * rel.length)]} is ${others[Math.floor(r() * others.length)]}.`);
  }
  for (let i = lines.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [lines[i], lines[j]] = [lines[j], lines[i]]; }
  return { text: lines.join(" "), chain, names: N };
}

/** A plain sentence splitter for SYNTHETIC worlds only, where every sentence ends "X." by construction. Stage tests that need the canonical
 * reader use surf's default (khora readDocument); this exists so 10^5-sentence synthetic corpora ingest in seconds. Declared, not a reader. */
export const synthCut = async (t) => ({ sentences: [...t.matchAll(/[^.]+\./g)].map((m) => { const lead = m[0].length - m[0].trimStart().length; return { start: m.index + lead, end: m.index + m[0].length, text: m[0].trim() }; }), gaps: [] });

/** A deterministic stand-in READER mouth for "X's REL is Y." evidence. It is the apparatus's seam stub, not a model; it answers only what a
 *  line literally states and cites that line, else null. `lie` makes it fabricate a value with probability p (for witness tests). */
export function patternReader({ lie = 0, seed = 3 } = {}) {
  const r = rng(seed);
  return ({ user }) => {
    const shape = JSON.parse((user.match(/QUESTION SHAPE: (.*)/) ?? [, "{}"])[1]);
    const rel = String(shape.relation ?? "").replace(/_/g, " ");
    if (lie && r() < lie) return { value: "Zzyzx", cite: [] };
    for (const m of user.matchAll(/\[(ev\d+)\] (.+?)'s (.+?) is (.+?)\./g)) if (m[2] === shape.anchor && m[3] === rel) return { value: m[4], cite: [m[1]] };
    return { value: null, cite: [] };
  };
}
