// fold-chat-omnilingual.test.mjs — the omnilingual falsification (eval/omnilingual/PREREG.md, RESULTS.md) as a standing test.
// Every improvement the battery found to HOLD in en, es AND fr (declared tables, registered only for the run) must keep holding; the
// improvements that FALL in a language are listed with their named cause and pinned as known — if one starts holding, the test says so,
// so the record is updated rather than silently drifting. ru (function words, no table) must stay a typed null.
import test from "node:test";
import assert from "node:assert/strict";
import { run } from "./eval/omnilingual/battery.mjs";

// (improvement → languages where it FALLS, and why) — measured 2026-10-13, see eval/omnilingual/RESULTS.md
const KNOWN_FALLS = {
  "passive agent inside a relative clause": { es: "PRIOR: no stemmer — 'descubrió' (ask) never meets 'descubierta' (sentence)", fr: "PRIOR: no stemmer — 'découvert' vs 'découverte'" },
  "place: a later clause's place is not the relation's": { es: "PRIOR: 'y murió' opens a clause only if the English POS prior ranks 'murió' a verb (it has never seen it)", fr: "RULE: the fold makes 'né' the function word 'ne', so the relation is dropped" },
  "place: a possessor/kinsman is not the anchor": { fr: "RULE: the fold makes 'né' the function word 'ne', so the ask has no relation and the possessor guard (relation asks only) never runs" },
  "false premise: the kind noun must be said": { es: "PRIOR: 'primera' is a relation word only by the English POS prior, so 'mujer' is not marked a kind" },
  "a hedged row is no rival": { fr: "RULE: the tokenizer splits the inversion 'a-t-il' and the euphonic 't' becomes a name the witness must say" },
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
