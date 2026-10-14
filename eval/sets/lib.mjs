// eval/sets/lib.mjs — the exit criteria's per-language test sets: their shape, and the split nobody picks.
//
// DECLARED, not measured (II.11). giver: "The Fold: Measurable Exit Criteria" (the user, 2026-10-13) — each Tier 1
// language gets 40 factual questions (half parallel to English items), 10 negation/presupposition traps and 10
// named-entity items in native script; 30% of every set is held out and run once at the end; a second labeler
// re-labels a 20% sample. The counts and fractions are the spec's, not tuned here.
//
// The split is chosen by a hash of each item's id within its (language, part) stratum, so no one chooses which
// items are held out, and an item keeps its side however the file is reordered.
// What would prove it wrong: two runs of splitOf on the same ids giving different sides; a stratum whose holdout is
// not ceil(30%) of it; a set that passes checkSet with a missing gold source or fewer than 20 parallel items.
import crypto from "node:crypto";

export const SHAPE = Object.freeze({ factual: 40, trap: 10, entity: 10 });
export const PARALLEL_MIN = 20;          // "half parallel translations of English items"
export const HOLDOUT = 0.3, RELABEL = 0.2;
export const TRAP_KINDS = Object.freeze(["false-premise", "multiple"]);

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
export const md5Of = (bytes) => crypto.createHash("md5").update(bytes).digest("hex");
const nonEmpty = (s) => typeof s === "string" && s.trim().length > 0;

/** Every problem with a set, as plain sentences; [] means it has the spec's shape. `en` is the English set, for parallels. */
export function checkSet(set, { en = null } = {}) {
  const bad = [], items = Array.isArray(set?.items) ? set.items : null;
  if (!nonEmpty(set?.lang)) bad.push("the set names no language");
  if (!items) return [...bad, "the set has no items list"];
  const ids = new Set(), enIds = new Set((en?.items || []).map((x) => x.id));
  const count = { factual: 0, trap: 0, entity: 0 };
  let parallel = 0;
  for (const [i, it] of items.entries()) {
    const at = `item ${i + 1}${nonEmpty(it?.id) ? ` (${it.id})` : ""}`;
    if (!nonEmpty(it?.id)) bad.push(`${at}: no id`); else if (ids.has(it.id)) bad.push(`${at}: the id is used twice`); else ids.add(it.id);
    if (it?.lang !== set.lang) bad.push(`${at}: its language is not the set's`);
    if (!(it?.part in SHAPE)) { bad.push(`${at}: part must be factual, trap or entity`); continue; }
    count[it.part]++;
    if (!nonEmpty(it.ask)) bad.push(`${at}: no question`);
    if (!nonEmpty(it.gold?.source?.title) || !nonEmpty(it.gold?.source?.quote)) bad.push(`${at}: no gold source (title and the quoted span)`);
    if (it.part === "trap") { if (!TRAP_KINDS.includes(it.gold?.flag)) bad.push(`${at}: a trap needs gold.flag, false-premise or multiple`); }
    else if (!Array.isArray(it.gold?.answers) || !it.gold.answers.some(nonEmpty)) bad.push(`${at}: no gold answer`);
    if (it.part === "entity" && (!Array.isArray(it.gold?.keep) || !it.gold.keep.some(nonEmpty))) bad.push(`${at}: an entity item needs gold.keep, the native-script name that must not be transliterated`);
    if (it.parallelOf != null) {
      if (set.lang === "en") bad.push(`${at}: an English item cannot be a parallel`);
      else if (it.part !== "factual") bad.push(`${at}: only factual items are parallels`);
      else if (en && !enIds.has(it.parallelOf)) bad.push(`${at}: parallelOf ${it.parallelOf} is not an English item`);
      else parallel++;
    }
  }
  for (const [p, n] of Object.entries(SHAPE)) if (count[p] !== n) bad.push(`${p}: ${count[p]} items, the spec asks for ${n}`);
  if (set.lang !== "en") {
    if (!en) bad.push("a non-English set is checked against the English set (pass it), so its parallels can be confirmed");
    else if (parallel < PARALLEL_MIN) bad.push(`parallel items: ${parallel}, the spec asks for at least ${PARALLEL_MIN}`);
  }
  return bad;
}

/** Which side each item falls on: { holdout:Set<id>, relabel:Set<id> }, by hash rank within each (lang, part). */
export function splitOf(items) {
  const strata = new Map();
  for (const it of items) { const k = `${it.lang}/${it.part}`; if (!strata.has(k)) strata.set(k, []); strata.get(k).push(it.id); }
  const holdout = new Set(), relabel = new Set();
  const take = (ids, salt, frac, into) => { const ranked = [...ids].sort((a, b) => (sha(salt + a) < sha(salt + b) ? -1 : 1)); for (const id of ranked.slice(0, Math.ceil(ids.length * frac))) into.add(id); };
  for (const ids of strata.values()) { take(ids, "holdout:", HOLDOUT, holdout); take(ids, "relabel:", RELABEL, relabel); }
  return { holdout, relabel };
}

/** The frozen file's exact bytes: the set plus each item's side, in a stable key order. */
export function frozenBytes(set) {
  const { holdout, relabel } = splitOf(set.items);
  const items = set.items.map((it) => ({ ...it, side: holdout.has(it.id) ? "holdout" : "dev", relabel: relabel.has(it.id) }));
  return JSON.stringify({ ...set, items }, null, 2) + "\n";
}

/** A 60-item skeleton for one language; a non-English set gets 20 parallel slots pointing at English ids. */
export function skeleton(lang, { enIds = [] } = {}) {
  const items = [];
  for (const [part, n] of Object.entries(SHAPE)) for (let i = 1; i <= n; i++) {
    const it = { id: `${lang}-${part}-${String(i).padStart(2, "0")}`, lang, part, ask: "", gold: { source: { title: "", quote: "" } } };
    if (part === "trap") it.gold.flag = ""; else it.gold.answers = [""];
    if (part === "entity") it.gold.keep = [""];
    if (part === "factual" && lang !== "en" && i <= PARALLEL_MIN) it.parallelOf = enIds[i - 1] ?? `en-factual-${String(i).padStart(2, "0")}`;
    items.push(it);
  }
  return { lang, about: "", labeledBy: "", items };
}
