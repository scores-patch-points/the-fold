// fold-chat-creole-grammar.test.mjs — the creole grammar falsification (eval/creole/GRAMMAR-PREREG.md, GRAMMAR-RESULTS.md) as a standing test.
// Tables are DECLARED and registered only through withGrammars() for a run: nothing is in production GRAMMAR. Each case's recorded
// status (measured 2026-10-13) is pinned, so a silent drift in either direction fails: a fall that starts holding must be recorded
// (and its cause re-read), a hold that starts falling is a regression. The controls are pinned: with no table every ask is the typed
// gap; the lexifier's table reads almost none; ru stays a typed null. Twelve named mutations must flip the case they were registered for.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { run, mutate, ruControl, verify, CASES } from "./eval/creole/battery.mjs";
import { GRAMMAR, grammarOf } from "./fold-chat-frame.js";

// id → why it FALLS (the named cause; GRAMMAR-RESULTS.md). Every other case HOLDS.
// H5b was recorded FALLS on 2026-10-13 and HOLDS after the creole salience merge (0c24dd1, bisected): fold-chat-snippets.js now counts the
// Haitian prior's closed-class forms (`genyen`) as function words, so the long verb form no longer reads as a name the sentence must say.
const FALLS = {
  H4: "clause-final copula `ye`: the name sits at the position the code reads as the relation (gap referents_unresolved); `se te` also reads present",
  H6: "subject + TAM marker `te` + verb: the first name is read as the relation (the do-support list is English); wrong decomposition, filler ∅",
  H7: "passive with no auxiliary: no copula for the agent rule; `pa` is the agent marker AND the negator (polarity reads -); also falls in English (irregular participle)",
  H8: "postposed article glued to the filler (\"Pòtoprens la\")",
  H9: "negator before the copula glued to the filler (\"Pòtoprens pa\"); polarity itself reads -",
  T5: "orthographic variant kapital/kapitol: no variant field; the attribute is not said",
  T8: "clause-final copula (i stap): the name sits at the relation position",
  T9: "wh-word in situ: not a slot ask",
  J3: "`a` is copula, 'of' and focus in one list: both sides carry the anchor → null; `name` is not a pivot",
  J4: "`a` is both copula and governs: the copula after the referent reads as 'role word OF X' and declares another anchor",
  J5: "two-word auxiliary `use to`: the trim removes one trailing auxiliary (also falls in English)",
  J7: "negator before the copula glued to the filler",
  J8: "orthographic variant kapital/capital",
  P6: "negator before the copula glued to the filler",
  P7: "wh-word in situ: not a slot ask",
  M3: "zero copula in the ask: the name sits at the relation position",
  M6: "negator between subject and the relation word blocks the subject walk",
  M7: "clause-final dummy copula / zero copula in the ask",
};

test("CREOLE: every case holds or falls exactly as recorded; no table is ever registered in production", async () => {
  const rows = await run();
  assert.equal(rows.length, CASES.length);
  for (const r of rows) {
    const want = FALLS[r.id] ? "FALLS" : "HOLDS";
    assert.equal(r.status, want, `${r.id} [${r.creole}] ${r.status}, recorded ${want}${FALLS[r.id] ? " (" + FALLS[r.id] + ")" : ""}: got ${JSON.stringify(r.verdict)}, wanted ${r.expect}; ${r.read ? "ask read" : "ask not read: " + r.gap}`);
  }
  // production is untouched: only en is declared, and a creole code has no table outside a run
  assert.deepEqual(Object.keys(GRAMMAR), ["en"]);
  for (const c of ["hat", "pcm", "tpi", "mfe", "jam"]) assert.equal(grammarOf(c), null, c + " must not be registered in production");
});

test("CREOLE FALSIFIER-FIRST: with no table registered not one ask reads (the typed gap), and the lexifier's table reads almost none", async () => {
  const rows = await run();
  for (const r of rows) assert.equal(r.noTable.gap, "no_grammar_for_language", `${r.id}: no-table control`);
  // "a creole is not a dialect of its lexifier": the lexifier's table reads only the two English-shaped Pidgin asks (P2, P4)
  const read = rows.filter((r) => r.asLexifier.read).map((r) => r.id).sort();
  assert.deepEqual(read, ["P2", "P4"], "asks the lexifier's table reads: " + read.join(" "));
  // …and read-as-base is no answer for P2 (∅); only P4 (the English-shaped ask) answers
  assert.equal(rows.find((r) => r.id === "P2").asLexifier.verdict, "∅");
  assert.equal(rows.find((r) => r.id === "P4").asLexifier.verdict, "Victor Hugo");
});

test("CREOLE CONTROL: ru (function words, no table) stays a typed null", async () => {
  const ru = await ruControl();
  assert.equal(ru.status, "HOLDS", JSON.stringify(ru));
});

test("CREOLE MUTATIONS: each pre-registered gate flips the case it was registered for", async () => {
  const m = await mutate();
  const at = (creole, field) => m.find((x) => x.creole === creole && x.field === field);
  const flips = (creole, field, id) => { const x = at(creole, field); assert.ok(x, `${creole}.${field} not mutated`); const f = x.flipped.find((y) => y.id === id); assert.ok(f, `${creole}.${field} emptied did not flip ${id}: ${JSON.stringify(x.flipped)}`); return f; };
  assert.match(flips("hat", "interrogatives", "H1").now, /not read/);
  assert.equal(flips("hat", "copulas", "H2").now, "∅ [+]");
  assert.equal(flips("hat", "auxiliaries", "H3").now, "∅ [+]");
  assert.match(flips("hat", "negation", "H9").now, /\[\+\]$/);
  assert.equal(flips("tpi", "copulas", "T3").now, "∅ [+]");
  flips("tpi", "governs", "T1");
  assert.equal(flips("tpi", "suffixes", "T10").now, "∅ [+]");
  assert.match(flips("jam", "interrogatives", "J1").now, /not read/);
  assert.equal(flips("jam", "auxiliaries", "J5").now, "Jack Sherach use to [+]");
  assert.match(flips("pcm", "clauseWords", "P2").now, /^Mahamat Mahadi Ali wey /);
  assert.match(flips("pcm", "negation", "P6").now, /\[\+\]$/);
  assert.equal(flips("mfe", "suffixes", "M5").now, "∅");
});

test("CREOLE PROVENANCE: the pre-registration names every case, and every REAL witness is a verbatim corpus sentence", () => {
  const prereg = fs.readFileSync(new URL("./eval/creole/GRAMMAR-PREREG.md", import.meta.url), "utf8");
  const ids = [...prereg.matchAll(/^\| ([HTJPM]\d+b?) \|/gm)].map((x) => x[1]);
  assert.deepEqual(ids.sort(), CASES.map((c) => c.id).sort(), "GRAMMAR-PREREG.md and battery.mjs list the same cases");
  const v = verify();
  const missing = v.filter((x) => x.witness === "MISSING" || x.frame === "MISSING" || x.prompt === "MISSING");
  // the corpus is on disk on the machine that ran this; where it is not, the check reports nothing rather than failing
  const anyFound = v.some((x) => x.witness === "found" || x.frame === "found");
  if (anyFound) assert.deepEqual(missing, [], "a witness, frame or prompt is not in the corpus: " + JSON.stringify(missing));
});
