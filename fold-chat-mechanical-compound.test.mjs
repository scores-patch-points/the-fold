// F-D2 (compound parts): a compound turn ("who is X and where was he born") answers each part from its own row; its joined answer.text is not one
// sentence of one page. mechanicalUnits must give every answered part a claim at ITS row's address (the first version read only the first part's row).
import test from "node:test";
import assert from "node:assert/strict";
import { runSlotParts, splitSlotParts } from "./fold-chat-split.js";
import { claimsOfTurn, mechanicalUnits } from "./fold-chat-record.js";
import { fetchImpl, passage, NOW } from "./eval/modelless/fetch-world.mjs";

test("F-D2: a compound turn's every answered part is a claim at its own row's address", async () => {
  const parts = splitSlotParts("Who is the president of France and where was he born?");
  const wp = [passage("President of France"), passage("Emmanuel Macron")];
  const t = await runSlotParts({ parts, lang: "en", webPassages: wp, searchQ: "president of France", now: NOW, fetchImpl });
  const answered = t.parts.filter((p) => p.answer);
  assert.equal(answered.length, 2, "both parts answered: " + JSON.stringify(t.parts.map((p) => p.gap && p.gap.kind)));
  const mech = mechanicalUnits({ slotTurn: t, strand: { snips: [], slotTurn: t }, webPassages: wp, line: t.answer.text });
  assert.equal(mech.length, 2);
  const material = wp.map((p) => ({ ref: p.ref, source: p.source, text: p.text }));
  const claims = claimsOfTurn({ turn: 1, pivot: null, record: null, material, mechanical: mech });
  assert.equal(claims.length, 2);
  for (const c of claims) assert.equal(typeof c.basis.cited, "string");
  assert.notEqual(claims[0].basis.support, claims[1].basis.support);
});

