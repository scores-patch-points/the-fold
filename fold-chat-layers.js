// fold-chat-layers.js — WHICH LAYERS OF A TURN ARE SHOWN, and the switch that moves between them.
// Pure: no DOM, no IO, no model, no clock.
//
// A turn is read as a stack, bottom to top — the same stack the fold builds for every answer:
//
//   answer      the model's own words
//   provenance  the app's source line, and the [S#]/[M] tags (never the model's words about a source)
//   standing    where the claim stands: the cube cell, and each verifiable failure's owed cell
//   sources     the passages, verbatim (the sources-only spread)
//   record      the EOT log / work tree the turn wrote
//
// The person toggles any layer. The selection is remembered under `fold-chat:layers`, and a RE-RUN reuses
// the original turn's layers unless the switch was moved since — the same discipline as the answer mode
// (fold-chat-answer.js). Nothing here decides truth: the layers are what the record carries, and the switch
// only chooses what is read, never what is true.

export const LAYERS = Object.freeze([
  { key: "answer", label: "Answer", note: "the model's own words" },
  { key: "provenance", label: "Provenance", note: "the app's source line and the [S#]/[M] tags" },
  { key: "standing", label: "Standing", note: "the cube cell a claim stands at, and the flags' owed cells" },
  { key: "sources", label: "Sources", note: "the passages, verbatim" },
  { key: "record", label: "Record", note: "the EOT log and the work tree" },
]);
export const LAYER_KEYS = Object.freeze(LAYERS.map((l) => l.key));
export const LAYER_KEY = "fold-chat:layers";
// The minimal stack: the answer and its provenance line; standing, sources and record start COLLAPSED
// (off) and the switch reveals them. Hiding is not deleting — nothing is lost, only unshown.
export const DEFAULT_LAYERS = Object.freeze(["answer", "provenance"]);

const pick = (v) => {
  const arr = typeof v === "string" ? v.split(/[,\s]+/) : Array.isArray(v) ? v : null;
  if (!arr) return null;
  const s = new Set(arr.filter((k) => LAYER_KEYS.includes(k)));
  return LAYER_KEYS.filter((k) => s.has(k)); // ordered, deduped, unknown keys dropped
};

/** A stored selection (array or comma/space string) → a normalized, ORDERED array. Null/undefined falls
 *  back; an EXPLICIT empty selection stays empty (every layer hidden is a legal state). */
export function normLayers(v, fallback = DEFAULT_LAYERS) {
  return pick(v) ?? pick(fallback) ?? [...DEFAULT_LAYERS];
}

export function isLayer(key) { return LAYER_KEYS.includes(key); }

/** Flip one layer on/off; the result is ordered by LAYER_KEYS. A non-layer key is a no-op. */
export function toggleLayer(current, key) {
  const s = new Set(normLayers(current));
  if (isLayer(key)) { if (s.has(key)) s.delete(key); else s.add(key); }
  return LAYER_KEYS.filter((k) => s.has(k));
}

export function layerEnabled(layers, key) { return normLayers(layers).includes(key); }

/** Which layers a turn actually HAS content for — a switch never reveals an empty layer. */
export function availableLayers(turn = {}) {
  const has = {
    answer: !!(turn && (turn.answer || turn.text || turn.content)),
    provenance: !!(turn && (turn.provenance?.parts?.length || turn.sentences?.length)),
    standing: !!(turn && (turn.standing || (Array.isArray(turn.flags) && turn.flags.length))),
    sources: !!(turn && (turn.snips?.length || turn.authored === "sources")),
    record: !!(turn && (turn.record || turn.grounding?.void || turn.eot)),
  };
  return LAYER_KEYS.filter((k) => has[k]);
}

/** The layers a RE-RUN uses: the original turn's, unless the switch was moved since (`changed`). */
export function resolveLayers({ original = null, current = DEFAULT_LAYERS, changed = false } = {}) {
  return changed ? normLayers(current) : normLayers(original ?? current);
}

/** The layers a stored turn was read with, else the fallback. Never throws on stored junk. */
export function layersOfTurn(turn, fallback = DEFAULT_LAYERS) {
  return normLayers(turn?.layers, fallback);
}
