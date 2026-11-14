// frontier/shape.mjs — ORGAN 3, Ground and question shape.
// A question is a VOID with typed fields; the ground supplies what the void cannot: identity criteria, time regime, absence semantics,
// and the baseline for "makes a difference". Both are bylined records in the log (`shape` / `ground` events), never hidden config.
// Shape fields (the brief's nine): slot, anchor, kind, extent, relation, composition, cardinality, dependency, revisionTrigger.
//   kind: value | count | sum | date | diff | compare | bool | list | entity
//   composition: single | chain | aggregate      cardinality: one | many
// A shape with a required field missing is a typed gap (`unmet_shape`), never guessed.
export const SHAPE_FIELDS = Object.freeze(["slot", "anchor", "kind", "extent", "relation", "composition", "cardinality", "dependency", "revisionTrigger"]);
const REQUIRED = { value: ["anchor", "relation"], count: ["relation"], sum: ["relation"], date: ["anchor", "relation"], diff: ["dependency"], compare: ["dependency"], bool: ["anchor", "relation"], list: ["relation"], entity: ["anchor", "relation"] };

export function makeShape(fields, { log, by = "shape", deps = [] } = {}) {
  const s = { slot: null, anchor: null, kind: "value", extent: null, relation: null, composition: "single", cardinality: "one", dependency: [], revisionTrigger: null, ...fields };
  for (const k of Object.keys(s)) if (!SHAPE_FIELDS.includes(k)) throw new TypeError(`shape: unknown field ${k}`);
  const missing = (REQUIRED[s.kind] ?? ["relation"]).filter((k) => s[k] == null || (Array.isArray(s[k]) && !s[k].length));
  if (!s.revisionTrigger) s.revisionTrigger = s.relation ? `new fact on ${s.anchor ?? "*"}.${s.relation}` : "any dependency changes";
  const key = shapeKey(s);
  const ev = log ? log.append({ kind: missing.length ? "gap" : "shape", by, deps, body: missing.length ? { gap: "unmet_shape", missing, shape: s } : { shape: s, key } }) : null;
  return { shape: Object.freeze(s), key, missing, event: ev };
}
export const shapeKey = (s) => JSON.stringify(Object.fromEntries(Object.keys(s).sort().map((k) => [k, s[k]])));

// Ground. timeRegime: "latest" (newest valid fact wins; older cannot change the answer) | "all" (every fact counts).
// absence: "open" (missing ⇒ typed gap "unknown") | "closed" (missing ⇒ false / zero, declared by the giver).
export function makeGround({ id = "default", version = 1, giver, timeRegime = "latest", absence = "open", identity = "declared-same-events", asOf = null } = {}, { log } = {}) {
  if (!giver) throw new TypeError("ground: a giver is required (Constitution II.1: defaults are givers and must sign)");
  const g = Object.freeze({ id, version, giver, timeRegime, absence, identity, asOf });
  const ev = log ? log.append({ kind: "ground", by: giver, body: { ground: g } }) : null;
  return { ground: g, event: ev };
}
