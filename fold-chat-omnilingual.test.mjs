// fold-chat-omnilingual.test.mjs — the omnilingual falsification (eval/omnilingual/PREREG.md, RESULTS.md) as a standing test.
// Every improvement the battery found to HOLD in en, es AND fr (declared tables, registered only for the run) must keep holding; the
// improvements that FALL in a language are listed with their named cause and pinned as known — if one starts holding, the test says so,
// so the record is updated rather than silently drifting. ru (function words, no table) must stay a typed null.
import test from "node:test";
import assert from "node:assert/strict";
import { run } from "./eval/omnilingual/battery.mjs";

// (improvement → languages where it FALLS, and why) — measured 2026-10-13, see eval/omnilingual/RESULTS.md
const KNOWN_FALLS = {
  // run 2 (version-2 priors: per-language UD POS priors, declared light stemmers, euphonic letters) — eval/omnilingual/RESULTS.md
  "passive agent inside a relative clause": { es: "PRIOR: an IRREGULAR participle — 'descubrió' (ask) and 'descubierta' (sentence) share no regular suffix; needs a lemma prior" },
  "place: a possessor/kinsman is not the anchor": { fr: "RULE: the diacritic fold makes 'né' the function word 'ne', so the ask has no relation and the possessor guard (relation asks only) never runs" },
};

test("OMNILINGUAL: every improvement that held in en, es and fr still holds; the known falls are exactly the recorded ones; ru stays a typed null", async () => {
  const { rows, control } = await run();
  assert.equal(control.status, "HOLDS", "a language with no table never guesses: " + JSON.stringify(control));
  for (const r of rows) {
    assert.equal(r.en.status, "HOLDS", `English reference fell: ${r.id} → ${JSON.stringify(r.en.verdict)}`);
    for (const lang of ["es", "fr"]) {
      const known = KNOWN_FALLS[r.id] && KNOWN_FALLS[r.id][lang];
      if (known) assert.equal(r[lang].status, "FALLS", `${r.id} [${lang}] now HOLDS — update RESULTS.md and KNOWN_FALLS (was: ${known})`);
      else assert.equal(r[lang].status, "HOLDS", `${r.id} [${lang}] FALLS: ${JSON.stringify(r[lang].verdict)} ${r[lang].why || ""}`);
    }
  }
});
