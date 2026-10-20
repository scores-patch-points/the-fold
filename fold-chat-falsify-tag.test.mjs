// A closing source tag is provenance: it must not make a verbatim quote "unsupported".
import test from "node:test";
import assert from "node:assert/strict";
import { falsifyAnswer, withoutSourceTag } from "./fold-chat-falsify-answer.js";

const LINE = "Dolphins are a diverse group of animals, ranging from the small Māui’s dolphins (1.7 m) to large Orcas (8 m).";
const SRC = [{ ref: "a", title: "a", url: "", text: "General notes: " + LINE }];
test("a trailing source tag is stripped; a figure in parentheses is kept", () => {
  assert.equal(withoutSourceTag(LINE + " (MarineBio, “Dolphin Biology”)."), LINE);
  assert.equal(withoutSourceTag(LINE + " ([MarineBio](https://www.marinebio.org/creatures/dolphins/biology/))."), LINE);
  assert.equal(withoutSourceTag("Aconcagua is 6,961 m (22,838 ft)."), "Aconcagua is 6,961 m (22,838 ft).");
});
test("a quote with a source tag is judged like the bare quote", () => {
  const bare = falsifyAnswer([LINE], SRC).claims[0].verdict;
  assert.ok(["held", "corroborated"].includes(bare));
  for (const t of [LINE + " (MarineBio, “Dolphin Biology”).", LINE + " ([MarineBio](https://www.marinebio.org/creatures/dolphins/biology/))."]) assert.equal(falsifyAnswer([t], SRC).claims[0].verdict, bare, t.slice(-40));
});
