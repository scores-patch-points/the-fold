// exp/worlds.mjs — the mixed synthetic world for H1/H2/ablations. Seeded; generated on this machine; no benchmark data.
// Facts are stated once each as "X's REL is V." sentences; aliases are stated as "X's alias is Z." AND admitted by a named giver
// ("registry") as `same` events (identity is received, never inferred from appearance). Distractors scale the corpus.
import { rng, names } from "../synth.mjs";
const CITIES = ["Lisbon", "Osaka", "Quito", "Tromso", "Accra", "Perth", "Leeds", "Hanoi", "Cusco", "Graz"];
const DREL = ["neighbour", "cousin", "rival", "landlord", "tailor", "barber"];

export const WORLD_VERSION = 2;
export function mixedWorld({ people = 300, chains = 8, chainLen = 12, distractors = 1000, seed = 1 } = {}) {
  const r = rng(seed), N = names(people, seed);
  const lines = [], truth = { mentor: new Map(), age: new Map(), city: new Map(), alias: new Map() };
  for (let c = 0; c < chains; c++) for (let i = 0; i < chainLen; i++) { const a = N[c * (chainLen + 1) + i], b = N[c * (chainLen + 1) + i + 1]; truth.mentor.set(a, b); lines.push(`${a}'s mentor is ${b}.`); }
  for (const p of N) { const age = 20 + Math.floor(r() * 60), city = CITIES[Math.floor(r() * CITIES.length)]; truth.age.set(p, age); truth.city.set(p, city); lines.push(`${p}'s age is ${age}.`, `${p}'s city is ${city}.`); }
  // world fix 4 (2026-11-14): an alias must never be another person's name. Before this, a drawn alias could equal a real person
  // (seed 1: "Drapelvo" at 1e4, "Rapelvo" at 1e5/1e6), so the registry declared two different people one, and the answer key disagreed
  // with the world's own declarations. Rows from before the fix carry world_version 1.
  const taken = new Set(N);
  const aliasPool = names(people + 160, seed + 999).filter((a) => !taken.has(a));
  N.filter(() => r() < 0.15).forEach((p, i) => { if (aliasPool[i]) { truth.alias.set(aliasPool[i], p); lines.push(`${p}'s alias is ${aliasPool[i]}.`); } });
  for (let i = 0; i < distractors; i++) lines.push(`${N[Math.floor(r() * N.length)]}'s ${DREL[Math.floor(r() * DREL.length)]} is ${N[Math.floor(r() * N.length)]}.`);
  for (let i = lines.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [lines[i], lines[j]] = [lines[j], lines[i]]; }
  return { text: lines.join(" "), truth, names: N, chainHeads: Array.from({ length: chains }, (_, c) => N[c * (chainLen + 1)]), chainLen };
}

/** Questions: shape fields + an NL rendering (for the shapeless arms) + the truth. */
export function questions(w, { n = 24, seed = 5 } = {}) {
  const r = rng(seed), pick = (xs) => xs[Math.floor(r() * xs.length)];
  const out = [];
  const types = ["chain3", "city", "alias_age", "sum_age", "diff_age", "unanswerable"];
  for (let i = 0; i < n; i++) {
    const t = types[i % types.length];
    if (t === "chain3") { const h = pick(w.chainHeads); let x = h; for (let k = 0; k < 3; k++) x = w.truth.mentor.get(x); out.push({ t, fields: { anchor: h, composition: "chain", kind: "entity", relation: "mentor^3", dependency: ["mentor", "mentor", "mentor"] }, nl: `Who is the mentor of the mentor of the mentor of ${h}?`, truth: x }); }
    if (t === "city") { const p = pick(w.names); out.push({ t, fields: { anchor: p, relation: "city", kind: "entity" }, nl: `What is ${p}'s city?`, truth: w.truth.city.get(p) }); }
    if (t === "alias_age") { const a = pick([...w.truth.alias.keys()]); out.push({ t, fields: { anchor: a, relation: "age", kind: "value" }, nl: `What is ${a}'s age?`, truth: String(w.truth.age.get(w.truth.alias.get(a))) }); }
    if (t === "sum_age" || t === "diff_age") { const a = pick(w.names), b = pick(w.names); const kind = t === "sum_age" ? "sum" : "diff"; out.push({ t, fields: { kind, composition: "aggregate", relation: "age", dependency: [{ anchor: a, relation: "age", kind: "value" }, { anchor: b, relation: "age", kind: "value" }] }, nl: t === "sum_age" ? `What is ${a}'s age plus ${b}'s age?` : `What is ${a}'s age minus ${b}'s age?`, truth: String(kind === "sum" ? w.truth.age.get(a) + w.truth.age.get(b) : w.truth.age.get(a) - w.truth.age.get(b)) }); }
    if (t === "unanswerable") { const p = pick(w.names); out.push({ t, fields: { anchor: p, relation: "dentist", kind: "entity" }, nl: `Who is ${p}'s dentist?`, truth: null }); }
  }
  return out;
}

export const score = (q, value, status) => {
  if (q.truth == null) return { correct: status !== "ok" || value == null, gap: status !== "ok" || value == null };
  if (status !== "ok" || value == null) return { correct: false, gap: true };
  const a = String(value).trim().toLowerCase().replace(/\.$/, ""), b = String(q.truth).toLowerCase();
  return { correct: a === b || (Number.isFinite(+a) && +a === +b), gap: false };
};
