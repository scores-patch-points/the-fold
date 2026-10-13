// fold-chat-lemmas.test.mjs — Experiment 3 (eval/modelvsrules/PREREG.md): a form→lemma table MINED from a UD treebank, not hand-written, so
// the binder's light stemmer can read irregular forms ("wrote/written/write") without a model. Only forms the stemmer cannot already unify,
// that are unanimous, verb-only in the treebank, and never a noun in the English POS pack, enter. Everything else stems exactly as before.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { stemOf, lightStemOf, askFrame } from "./fold-chat-frame.js";
import { bindSentence } from "./fold-chat-witness.js";
import { LEMMAS_EN, LEMMAS_EN_PROVENANCE } from "./fold-chat-lemmas-en.js";
import { functionWordsOf } from "./fold-chat-snippets.js";

const fw = functionWordsOf("en");

test("irregular forms meet their lemma: wrote ~ written ~ write, took ~ take, began ~ begin", () => {
  assert.equal(stemOf("wrote"), stemOf("write"));
  assert.equal(stemOf("written"), stemOf("write"));
  assert.equal(stemOf("took"), stemOf("take"));
  assert.equal(stemOf("began"), stemOf("begin"));
  assert.equal(stemOf("brought"), stemOf("bring"));
  assert.equal(stemOf("built"), stemOf("build"));
  assert.equal(stemOf("went"), stemOf("go"));
  // regular forms the light stemmer cannot unify (consonant doubling, -ied) meet too
  assert.equal(stemOf("dropped"), stemOf("drop"));
  assert.equal(stemOf("denied"), stemOf("deny"));
  // …and the light stemmer alone could not (this is the gap the table closes)
  assert.notEqual(lightStemOf("wrote"), lightStemOf("write"));
  assert.notEqual(lightStemOf("took"), lightStemOf("take"));
});

test("Experiment 4: UniMorph's complete paradigms close what the 1,000-sentence treebank could not — sank ~ sunk ~ sink, and the sources agree", () => {
  assert.equal(stemOf("sank"), stemOf("sink"));
  assert.equal(stemOf("sunk"), stemOf("sink"));
  assert.equal(stemOf("wrote"), stemOf("write"));                    // PUD and UniMorph give the same lemma
  assert.ok(LEMMAS_EN_PROVENANCE.unimorph && /^[0-9a-f]{64}$/.test(LEMMAS_EN_PROVENANCE.unimorph.sha256), "the UniMorph file's sha256 is recorded");
  assert.equal(LEMMAS_EN_PROVENANCE.unimorph.dropped.disagreeWithTreebank, 0);
  assert.ok(Object.keys(LEMMAS_EN).length < 20000);
  assert.ok(fs.statSync(new URL("./fold-chat-lemmas-en.js", import.meta.url)).size < 400 * 1024, "the declared size bound (PREREG Experiment 4)");
});

test("a word absent from the table stems EXACTLY as before — additive, byte for byte", () => {
  const words = ["walked", "walking", "walks", "cities", "houses", "leaving", "composed", "composing", "painted", "founded", "founders", "river", "rivers",
    "capital", "capitals", "president", "presidents", "born", "bones", "strings", "violin", "continents", "language", "spoken", "currency", "symbol",
    "mountain", "ocean", "invented", "discovered", "developed", "directed", "building", "buildings", "singing", "sang", "ends", "ended", "ending", "legs",
    "Nashville", "kenya", "x", "1989", "ab", "ies", "ing", "the", "a"];
  for (const w of words) if (!(w in LEMMAS_EN)) assert.equal(stemOf(w), lightStemOf(w), w);
});

test("the table is unanimous, verb-only and lighter-stemmer-defeating — every entry", () => {
  const entries = Object.entries(LEMMAS_EN);
  assert.ok(entries.length > 100, `${entries.length} entries`);
  for (const [form, lemma] of entries) {
    assert.notEqual(form, lemma);
    assert.notEqual(lightStemOf(form), lightStemOf(lemma), `${form} → ${lemma} is already unified by the stemmer`);
    assert.match(form, /^\p{L}+$/u);
  }
});

test("a form that is also a NOUN is never in the table: 'saw' (a tool), 'left', 'lie', 'spring', 'made' (also an adjective) keep their own stem", () => {
  for (const w of ["saw", "left", "lie", "spring", "wound", "ground", "bound", "rose", "made"]) {
    if (w in LEMMAS_EN) assert.fail(`${w} → ${LEMMAS_EN[w]} must not be in the table (it is also a noun/adjective)`);
  }
});

test("provenance is recorded: the source, its licence, and that the module is generated", () => {
  assert.match(LEMMAS_EN_PROVENANCE.source, /ud-english-pud|en_pud/i);
  assert.match(LEMMAS_EN_PROVENANCE.license, /CC BY-SA/);
  assert.ok(LEMMAS_EN_PROVENANCE.tokens > 10000);
  assert.match(fs.readFileSync(new URL("./fold-chat-lemmas-en.js", import.meta.url), "utf8").slice(0, 400), /GENERATED/);
});

test("BINDER: 'was written by English author Jane Austen' now answers 'who wrote Pride and Prejudice' — the passive of an irregular verb", async () => {
  const door = async (c) => new Map(c.map((x) => [x, /^pride and prejudice$/i.test(x) ? { title: "Pride and Prejudice", redirectedFrom: null, disambiguation: false } : null]));
  const f = await askFrame("Who wrote Pride and Prejudice?", { fw, lang: "en", resolveTitles: door });
  const s = "Pride and Prejudice was written by English author Jane Austen.";
  const r = bindSentence({ text: s, start: 0, end: s.length }, f, { fw, lang: "en", page: "Pride and Prejudice" });
  assert.ok(r && r.tier === "T1" && r.filler, JSON.stringify(r && { tier: r.tier, filler: r.filler }));
  assert.match(r.filler.text, /Jane Austen/);
});

test("CONTROL: the namesake rule still holds with the table on — 'Leopold Mozart was born in Augsburg' is not Wolfgang's birthplace", async () => {
  const door = async (c) => new Map(c.map((x) => [x, /^mozart$|^wolfgang amadeus mozart$/i.test(x) ? { title: "Wolfgang Amadeus Mozart", redirectedFrom: null, disambiguation: false } : null]));
  const f = await askFrame("Where was Mozart born?", { fw, lang: "en", resolveTitles: door });
  const s = "Leopold Mozart was born in Augsburg in 1719.";
  const r = bindSentence({ text: s, start: 0, end: s.length }, f, { fw, lang: "en", page: "Leopold Mozart" });
  assert.ok(!r || !r.filler, JSON.stringify(r && r.filler));
});
