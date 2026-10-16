import test from "node:test";
import assert from "node:assert/strict";
import { LAYER_KEYS, DEFAULT_LAYERS, PRESETS, normLayers, toggleLayer, layerEnabled, availableLayers, resolveLayers, layersOfTurn, isLayer, presetOf, forPreset } from "./fold-chat-layers.js";

test("normLayers: ordered, deduped, unknown keys dropped; empty stays empty; junk falls back", () => {
  assert.deepEqual(normLayers(["standing", "answer", "answer", "bogus"]), ["answer", "standing"]);
  assert.deepEqual(normLayers("sources, record , answer"), ["answer", "sources", "record"]);
  assert.deepEqual(normLayers([]), [], "an explicit empty selection is a legal state, not a fallback");
  assert.deepEqual(normLayers(null), [...DEFAULT_LAYERS]);
  assert.deepEqual(normLayers(undefined, ["record"]), ["record"]);
});

test("toggleLayer flips one layer and keeps the order", () => {
  assert.deepEqual(toggleLayer(["answer", "provenance"], "standing"), ["answer", "provenance", "standing"]);
  assert.deepEqual(toggleLayer(["answer", "provenance", "standing"], "provenance"), ["answer", "standing"]);
  assert.deepEqual(toggleLayer(["answer"], "record"), ["answer", "record"]);
  assert.deepEqual(toggleLayer(["answer"], "nope"), ["answer"], "a non-layer key is a no-op");
  assert.equal(isLayer("standing"), true);
  assert.equal(isLayer("bogus"), false);
});

test("layerEnabled reads the selection", () => {
  assert.equal(layerEnabled(["answer", "sources"], "sources"), true);
  assert.equal(layerEnabled(["answer"], "record"), false);
});

test("availableLayers: only layers the turn has content for", () => {
  assert.deepEqual(availableLayers({ text: "hi", sentences: [{ type: "self:model" }], flags: [{ kind: "unverified_pass" }], snips: [1], record: {} }),
    ["answer", "provenance", "standing", "sources", "record"]);
  assert.deepEqual(availableLayers({ text: "hi" }), ["answer"]);
  assert.deepEqual(availableLayers({}), []);
  assert.deepEqual(availableLayers({ authored: "sources", snips: [1] }), ["sources"]);
});

test("resolveLayers: a re-run keeps the original turn's layers unless the switch moved", () => {
  assert.deepEqual(resolveLayers({ original: ["answer"], current: ["answer", "record"], changed: false }), ["answer"]);
  assert.deepEqual(resolveLayers({ original: ["answer"], current: ["answer", "record"], changed: true }), ["answer", "record"]);
  assert.deepEqual(resolveLayers({ original: null, current: ["sources"] }), ["sources"]);
});

test("presets: chatbot is the model's words alone; a named set is recognised, a custom mix is not", () => {
  assert.deepEqual([...PRESETS.chatbot], ["answer"]);
  assert.deepEqual([...PRESETS.record], ["answer", "provenance", "standing", "sources", "record"]);
  assert.equal(presetOf(["answer"]), "chatbot");
  assert.equal(presetOf(["provenance", "answer"]), "provenance");
  assert.equal(presetOf(["answer", "sources"]), null, "a custom mix has no preset name");
  assert.deepEqual(forPreset("chatbot"), ["answer"]);
  assert.deepEqual(forPreset("nope", ["answer", "provenance"]), ["answer", "provenance"]);
});

test("a message overrides the session norm; absent, it inherits it", () => {
  const norm = ["answer", "provenance", "standing"];
  assert.deepEqual(layersOfTurn({ layers: ["answer"] }, norm), ["answer"], "the message's own view wins (chatbot)");
  assert.deepEqual(layersOfTurn({}, norm), norm, "no override → the session norm");
});

test("layersOfTurn never throws on stored junk", () => {
  assert.deepEqual(layersOfTurn({ layers: "sources record" }), ["sources", "record"]);
  assert.deepEqual(layersOfTurn({}), [...DEFAULT_LAYERS]);
  assert.deepEqual(layersOfTurn(null), [...DEFAULT_LAYERS]);
});
