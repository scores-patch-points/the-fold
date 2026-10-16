// fold-chat-salience-creole.test.mjs — the creole salience modules and the door that carries their closed class to the readers.
// Pre-registration: eval/creole/SALIENCE-PREREG.md. Every case here is a FALSIFIER written before the module existed.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { salienceOf, isName, isClosedForm, closedFormsOf, inLexicon } from "./fold-chat-salience-infer.js";
import { functionWordsOf } from "./fold-chat-snippets.js";
import { FUNCTION_WORDS } from "./fold-chat-function-words.js";
import { closedClassOf } from "./fold-chat-frame.js";
import { murmurOf } from "./fold-chat-murmur.js";
import * as PCM from "./fold-chat-salience-prior-pcm.js";
import * as HAT from "./fold-chat-salience-prior-hat.js";
import * as ES from "./fold-chat-salience-prior-es.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

test("the creole modules are generated from the packs and say so", () => {
  assert.equal(PCM.SALIENCE_PRIOR_SCHEMA, "SaliencePrior@1");
  assert.equal(PCM.SALIENCE_PRIOR_SOURCE, "pos-pcm.json");
  assert.equal(HAT.SALIENCE_PRIOR_SOURCE, "pos-hat.json");
  assert.ok(Object.isFrozen(PCM.SALIENCE_PRIOR) && Object.isFrozen(HAT.SALIENCE_PRIOR));
  assert.ok(Array.isArray(PCM.CLOSED_CLASS) && PCM.CLOSED_CLASS.length > 20, "the closed class travels with the module");
  assert.ok(Array.isArray(HAT.CLOSED_CLASS) && HAT.CLOSED_CLASS.length > 20);
});

test("pcm: content words are measured, a name is a name, a noun is not", () => {
  assert.ok(Math.abs(salienceOf("person", "pcm") - 7 / 9) < 1e-9);   // NOUN 191/191
  assert.equal(isName("nigeria", "pcm"), true);                       // PROPN 59/59
  assert.equal(isName("person", "pcm"), false);
  assert.equal(inLexicon("pikin", "pcm"), true);
});

test("pcm: the function words are closed, and a closed word is never measured as a name or content word", () => {
  for (const w of ["wetin", "di", "wey", "dem", "na", "dey", "for", "i", "e"]) {
    assert.equal(isClosedForm(w, "pcm"), true, `${w} is closed-class in the pcm pack`);
    assert.equal(salienceOf(w, "pcm"), null, `${w} carries no salience`);
    assert.equal(isName(w, "pcm"), false, `${w} is not a name`);
  }
  // falsifier for "everything is closed": a content word and a name are NOT in the closed class
  for (const w of ["person", "pikin", "nigeria", "lagos", "one"]) assert.equal(isClosedForm(w, "pcm"), false, `${w} must stay open`);
});

test("hat: ki yon nan se te are closed; pa is measured low (an adverb), never a name; di is a verb here", () => {
  for (const w of ["ki", "yon", "nan", "se", "te"]) { assert.equal(isClosedForm(w, "hat"), true, w); assert.equal(isName(w, "hat"), false, w); }
  assert.equal(isClosedForm("pa", "hat"), false);                       // ADV 612 of 684: the ≥ 50 % rule does not close it
  assert.ok(salienceOf("pa", "hat") != null && salienceOf("pa", "hat") < 0.5, "pa is a measured low-salience form");
  assert.equal(isName("pa", "hat"), false);
  assert.equal(isClosedForm("di", "hat"), false);                       // 'to say' in Haitian: VERB 200 of 205
  assert.ok(Math.abs(salienceOf("di", "hat") - 6 / 9) < 1e-9);
  assert.equal(isName("ayiti", "hat"), true);
  assert.ok(Math.abs(salienceOf("moun", "hat") - 7 / 9) < 1e-9);
});

test("the same surface is read by its language: pcm 'di' is a determiner, hat 'di' is a verb", () => {
  assert.equal(isClosedForm("di", "pcm"), true);
  assert.equal(isClosedForm("di", "hat"), false);
});

test("the Haitian labels the detector emits today all resolve to the one hat module", () => {
  for (const code of ["hat", "ht", "hatkreyol", "hatpopular"]) {
    assert.equal(isClosedForm("ki", code), true, code);
    assert.equal(isName("ayiti", code), true, code);
  }
});

test("a language with no module stays unmeasured and has no closed class (never read through English)", () => {
  assert.equal(salienceOf("person", "xx"), null);
  assert.equal(closedFormsOf("xx"), null);
  assert.equal(isClosedForm("di", "xx"), false);
});

test("es/fr/en are untouched: their modules carry no closed-class export and closedFormsOf says null", () => {
  assert.equal(ES.CLOSED_CLASS, undefined);
  assert.equal(closedFormsOf("es"), null);
  assert.equal(closedFormsOf("fr"), null);
  assert.equal(closedFormsOf("en"), null);
  assert.equal(salienceOf("france"), 1);
});

test("the reader's one door: functionWordsOf falls back to the closed class, and never overrides a committed prior", () => {
  const pcm = functionWordsOf("pcm");
  assert.ok(pcm instanceof Set && pcm.has("wetin") && pcm.has("di"));
  assert.equal(pcm.has("person"), false);
  const hat = functionWordsOf("hatkreyol");
  assert.ok(hat instanceof Set && hat.has("ki") && !hat.has("moun"));
  assert.equal(functionWordsOf("xx"), null);
  assert.deepEqual([...functionWordsOf("en")].sort(), [...new Set(FUNCTION_WORDS.en)].sort());
  assert.deepEqual([...functionWordsOf("es")].sort(), [...new Set(FUNCTION_WORDS.es)].sort());
  assert.equal(FUNCTION_WORDS.pcm, undefined, "the all-language function-word table is NOT widened (junk/region/lang-facts union it)");
});

test("the frame's closed-class reader sees the creole closed class through that door", () => {
  const closedHat = closedClassOf(functionWordsOf("hat"), "hat");
  assert.equal(closedHat("ki"), true);
  assert.equal(closedHat("moun"), false);
  const closedPcm = closedClassOf(functionWordsOf("pcm"), "pcm");
  assert.equal(closedPcm("wetin"), true);
  assert.equal(closedPcm("pikin"), false);
});

test("the murmur no longer reads a Haitian function word as a name when the language reaches it", () => {
  const m = murmurOf({ question: "Ki kapital Ayiti?", prior: "hat" });   // the existing thread-language parameter
  assert.equal(m.lang, "hat");
  assert.ok(!m.names.includes("ki"), `ki must not be a name: ${JSON.stringify(m.names)}`);
  assert.ok(!m.unknown.includes("ki"), "ki is not 'something I have not met'");
  assert.ok(m.names.includes("ayiti"), "the name stays a name");
  assert.ok(m.content.includes("kapital"), "kapital is NOUN in the hat pack: read through the hat prior, not through English (where it is unknown)");
});

test("the murmur reads Naija function words as function words when the language reaches it", () => {
  const m = murmurOf({ question: "Wetin be di capital?", prior: "pcm" });
  assert.equal(m.lang, "pcm", "the existing prior parameter carries the language in");
  assert.ok(["wetin", "di", "be"].every((w) => !m.names.includes(w) && !m.unknown.includes(w) && !m.content.includes(w)), JSON.stringify(m));
  assert.ok(m.unknown.includes("capital") || m.content.includes("capital") || m.names.includes("capital"), "the content word is still read");
});

// ── the builder (scripts/build-salience-prior.mjs) on a tiny synthetic POSPrior, so no external file is read ──────────────
const BUILD = path.join(HERE, "scripts", "build-salience-prior.mjs");
function pack(dir) {
  const forms = {
    four: { DET: 4 },                       // 4 tokens, all closed: below the ≥ 5-token floor
    half: { DET: 3, NOUN: 2 },              // 5 tokens, 60 % closed: closed (≥ 50 %)
    edge: { DET: 5, NOUN: 5 },              // 10 tokens, exactly 50 % closed: closed (≥ 50 %)
    under: { DET: 4, NOUN: 6 },             // 10 tokens, 40 % closed: open
    noun: { NOUN: 9 }, name: { PROPN: 9 }, verb: { VERB: 9 }, advb: { ADV: 9 },
  };
  const file = path.join(dir, "pos-zzz.json");
  fs.writeFileSync(file, JSON.stringify({ schema: "POSPrior@1", language: "zzz", provenance: { source: "synthetic" }, forms }));
  return file;
}
const build = (src, out, ...rest) => spawnSync(process.execPath, [BUILD, src, "--lang", "zzz", "--out", out, ...rest], { encoding: "utf8" });
const load = async (file) => import(`${file}?${Math.random()}`);

test("builder: --closed emits exactly the forms with ≥ 5 tokens and ≥ 50 % closed-class UPOS (the build-function-words rule)", async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "sal-"));
  const out = path.join(d, "out.js");
  const r = build(pack(d), out, "--closed");
  assert.equal(r.status, 0, r.stderr);
  const m = await load(out);
  assert.deepEqual([...m.CLOSED_CLASS].sort(), ["edge", "half"]);
  assert.equal(m.SALIENCE_PRIOR.noun, 7); assert.equal(m.SALIENCE_PRIOR.name, 9);
  assert.equal(m.SALIENCE_PRIOR.advb, 1);
  assert.equal(m.SALIENCE_PRIOR.four, undefined, "a function word carries no salience");
  assert.equal(m.SALIENCE_PRIOR.edge, undefined, "a closed-class form is omitted from the salience table even when 50 % of its tokens are nouns");
});

test("builder: without --closed the module is exactly what es/fr are (no CLOSED_CLASS export)", async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "sal-"));
  const out = path.join(d, "out.js");
  assert.equal(build(pack(d), out).status, 0);
  const m = await load(out);
  assert.equal(m.CLOSED_CLASS, undefined);
});

test("builder: --shuffle is a seeded permutation of the distributions across forms (the null), deterministic, count-preserving", async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "sal-"));
  const src = pack(d);
  for (const n of ["a", "b", "c"]) fs.mkdirSync(path.join(d, n));
  const [a, b, c] = ["a", "b", "c"].map((n) => path.join(d, n, "m.js"));
  assert.equal(build(src, a, "--closed", "--shuffle", "7").status, 0);
  assert.equal(build(src, b, "--closed", "--shuffle", "7").status, 0);
  assert.equal(build(src, c, "--closed", "--shuffle", "8").status, 0);
  assert.equal(fs.readFileSync(a, "utf8"), fs.readFileSync(b, "utf8"), "same seed, same module");
  fs.mkdirSync(path.join(d, "r")); const real = path.join(d, "r", "m.js"); build(src, real, "--closed");
  const [ma, mc, mr] = [await load(a), await load(c), await load(real)];
  // the shuffled module keeps the multiset of distributions: the number of closed forms and of salient forms is unchanged
  assert.equal(ma.CLOSED_CLASS.length, mr.CLOSED_CLASS.length);
  assert.equal(Object.keys(ma.SALIENCE_PRIOR).length, Object.keys(mr.SALIENCE_PRIOR).length);
  // and the owner of each distribution moves (compared as DATA: the header of a null build differs from a real one anyway)
  const data = (m) => JSON.stringify({ s: m.SALIENCE_PRIOR, c: [...m.CLOSED_CLASS].sort() });
  assert.ok(data(ma) !== data(mr) || data(mc) !== data(mr), "at least one seed must move a distribution to another form");
  assert.notEqual(data(ma), data(mc), "different seeds, different nulls");
  assert.equal(mc.CLOSED_CLASS.length, mr.CLOSED_CLASS.length);
});

test("builder: a missing --out writes the language module next to the others, never anywhere else", () => {
  const src = fs.readFileSync(BUILD, "utf8");
  assert.match(src, /fold-chat-salience-prior-\$\{LANG\}\.js/);
});
