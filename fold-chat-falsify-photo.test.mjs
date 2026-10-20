// The photosynthesis essay: true sentences came out "contradicted".
import test from "node:test";
import assert from "node:assert/strict";
import { falsifyAnswer } from "./fold-chat-falsify-answer.js";

const V = (claim, text) => falsifyAnswer([claim], [{ ref: "a", title: "a", url: "", text }]).claims[0].verdict;
const OK = ["held", "corroborated"];

test("active and passive tellings of one event are not a role swap", () => {
  const text = "The light reaction converts solar energy into chemical energy; the reaction also produces ATP and NADP+. Chlorophyll absorbs energy from the light waves, which is converted into chemical energy in the form of the molecules ATP and NADPH.";
  assert.ok(OK.includes(V("The light reaction converts solar energy into chemical energy and produces ATP and NADP+.", text)));
});
test("CO2 is one name however a page spells it", () => {
  const claim = "CO2 is fixed in the Calvin cycle using the energy produced as ATP and NADPH.";
  for (const co of ["CO₂", "CO2", "CO<sub>2</sub>"]) assert.ok(OK.includes(V(claim, `In the Calvin cycle, ${co} is fixed into glucose using the energy produced as ATP and NADPH.`)), co);
});
test("a verbatim sentence naming CO2 elsewhere is not 'swapped' by a truncated CO", () => {
  const text = "Chlorophyll absorbs energy from the light waves, which is converted into chemical energy in the form of the molecules ATP and NADPH. In the Calvin cycle, CO2 is fixed into glyceraldehyde-3-phosphate using the energy produced as ATP and NADPH.";
  assert.ok(OK.includes(V("Chlorophyll absorbs energy from the light waves, which is converted into chemical energy in the form of the molecules ATP and NADPH.", text)));
});
