import test from "node:test";
import assert from "node:assert/strict";
import { layersControlHtml, layersLine } from "./fold-chat-layersview.js";
import { LAYERS } from "./fold-chat-layers.js";

test("a chip per layer; on layers pressed=true, off pressed=false", () => {
  const h = layersControlHtml(["answer", "provenance"]);
  assert.equal((h.match(/data-layer=/g) || []).length, LAYERS.length);
  assert.match(h, /data-layer="answer"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-layer="answer"/);
  assert.match(h, /class="layer-chip on"[^>]*data-layer="answer"|data-layer="answer"[^>]*aria-pressed="true"/);
  assert.match(h, /data-layer="record"[^>]*aria-pressed="false"/);
});

test("a layer the turn lacks is dimmed and disabled — the switch never shows an empty layer", () => {
  const h = layersControlHtml(["answer"], { text: "hi" });
  assert.match(h, /class="layer-chip on"[^>]*data-layer="answer"|data-layer="answer"/);
  assert.match(h, /class="layer-chip empty" disabled[^>]*data-layer="record"|data-layer="record"[^>]*disabled/);
  // with no turn given, no layer is disabled
  assert.doesNotMatch(layersControlHtml(["answer"]), /disabled/);
});

test("the control escapes (labels are constants, but the guard is the point)", () => {
  assert.doesNotMatch(layersControlHtml(["answer"]), /<script/);
  assert.match(layersControlHtml(["answer"]), /class="layer-switch"/);
});

test("layersLine names the shown layers, or says none", () => {
  assert.equal(layersLine(["standing", "answer"]), "answer · standing");
  assert.equal(layersLine([]), "no layers");
});
