// fold-chat-layersview.js — the layer switch, drawn. Pure: no DOM, no IO, no model. Every label is a
// declared constant, escaped and rendered as text, so nothing a source or a model wrote can become markup.
import { LAYERS, LAYER_KEYS, normLayers, availableLayers } from "./fold-chat-layers.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/**
 * A chip per layer: `on` = shown, off = hidden, `empty` = the turn has no content for it (dim + disabled,
 * so the switch never offers a layer that would show nothing). `turn` may be null (no content check).
 * Each chip carries `data-layer` and `aria-pressed`, so one delegated handler can flip it.
 */
export function layersControlHtml(selected, turn = null) {
  const on = new Set(normLayers(selected));
  const avail = new Set(turn ? availableLayers(turn) : LAYER_KEYS);
  const chips = LAYERS.map((l) => {
    const shown = on.has(l.key);
    const has = avail.has(l.key);
    const cls = "layer-chip" + (shown ? " on" : "") + (has ? "" : " empty");
    return `<button type="button" class="${cls}" data-layer="${esc(l.key)}" aria-pressed="${shown ? "true" : "false"}" title="${esc(l.note)}"${has ? "" : " disabled"}>${esc(l.label)}</button>`;
  }).join("");
  return `<div class="layer-switch" role="group" aria-label="layers">${chips}</div>`;
}

/** The layers a stored turn was read with, as a short word for a header ("answer · provenance · standing"). */
export function layersLine(selected) {
  const on = normLayers(selected);
  return on.length ? on.join(" · ") : "no layers";
}
