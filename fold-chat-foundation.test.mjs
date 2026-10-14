// fold-chat-foundation.test.mjs — the mind is consulted, and consulting it changes the answer only where it should.
//
// Pre-registered (2026-10-14, before the first run). The user's bar: "make the fold's runtime load the foundation weft or
// hyperlexicon so the mind is actually used, with a falsifiable test that an answer changes."
//
//   F1  WITH the mind, the mechanical answer strand (snipsOf — no model, no network) for a question the foundation read answers
//       contains the sentence that answers it, verbatim, and its minimal clause carries the fact; WITHOUT the mind the same
//       call returns nothing. Breaks if the strand is empty with the mind, or non-empty without it.
//   F2  NULL: questions the foundation does not hold (a treaty, a king, a one-word ask) add NOTHING — the passage list is
//       exactly what it was. Breaks if the mind volunteers anything for them.
//   F3  every passage the mind returns is verbatim at its address: the sentence is in the file's bytes at (or just after)
//       the address it cites. Breaks if any passage's text is not in its file (a memory that does not survive the byte).
//   F4  MUTATION: change one retrieved sentence's text in the index → F3's check must fail; delete the matching sentence
//       → F1's answer must disappear. Breaks if the answer does not follow the index (it would be coming from elsewhere).
//   F5  the loader never throws and a page without an index has no mind: ensureFoundation(fetch that 404s / throws) → null
//       and mergeMind([]) is [].
//   F6  the chat's wiring is present: fold-chat.js imports the consumer and merges at the web-read seam.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { indexOf, mindPassagesFor, mergeMind, ensureFoundation, resetFoundation, contentStems } from "./fold-chat-foundation.js";
import { snipsOf } from "./fold-chat-strand.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INDEX = path.join(HERE, "mind", "foundation-index.json");
const CORPUS = "/Users/mlacy/Documents/3.0/Zenodotus";
const have = fs.existsSync(INDEX);
const raw = have ? JSON.parse(fs.readFileSync(INDEX, "utf8")) : null;
const idx = raw ? indexOf(raw) : null;

// questions whose answers are STATED in the foundation (checked by hand against the source sentence, below)
const ASKS = [
  { q: "When was the South African Council on Sport established?", fact: "1973" },
  { q: "When was the Cocoa Research Scheme set up?", fact: "1928" },
  { q: "When did the International Table Tennis Federation recognise the non-racial South African Table Tennis Board?", fact: "1956" },
];
const NULLS = ["When was the Treaty of Westphalia signed?", "Who is the king of the UK?", "tell me about drought", "What is the boiling point of water in kelvin?"];

test("F1 with the mind the mechanical answer strand holds the answering sentence; without it, nothing", { skip: !have }, () => {
  for (const { q, fact } of ASKS) {
    const none = snipsOf([], q);
    assert.equal((none.snips ?? []).length, 0, `no passages, no strand: ${q}`);
    const mp = mindPassagesFor({ question: q, index: idx });
    assert.ok(mp.passages.length > 0, `the mind holds something for: ${q} (${mp.gap})`);
    const strand = snipsOf(mergeMind([], mp), q);
    const texts = (strand.snips ?? []).map((s) => s.text);
    assert.ok(texts.some((t) => t.includes(fact)), `the strand carries "${fact}" for: ${q}\n  got: ${JSON.stringify(texts).slice(0, 300)}`);
    assert.ok(mp.passages.every((p) => p.mind === true && p.address?.file && Number.isFinite(p.address.at)));
  }
});

test("F2 null: what the foundation does not hold adds nothing", { skip: !have }, () => {
  for (const q of NULLS) {
    const mp = mindPassagesFor({ question: q, index: idx });
    assert.equal(mp.passages.length, 0, `${q} → ${JSON.stringify(mp.passages.map((p) => p.text.slice(0, 60)))}`);
    const web = [{ url: "https://example.org/a", text: "a web page" }];
    assert.deepEqual(mergeMind(web, mp), web, "the passage list is exactly what it was");
  }
});

test("F3 every retrieved passage is verbatim in its file at its address", { skip: !have }, () => {
  let checked = 0;
  for (const { q } of ASKS) {
    for (const p of mindPassagesFor({ question: q, index: idx }).passages) {
      const file = path.join(CORPUS, p.address.file);
      if (!fs.existsSync(file)) continue;                      // the corpus is local; a checkout without it cannot check
      const seg = fs.readFileSync(file).subarray(p.address.at, p.address.at + Buffer.byteLength(p.text) + 200).toString("utf8").replace(/\s+/g, " ");
      assert.ok(seg.includes(p.text.replace(/\s+/g, " ").slice(0, 40)), `not at its address: ${p.address.file}#${p.address.at}`);
      checked += 1;
    }
  }
  assert.ok(checked > 0 || !fs.existsSync(CORPUS), "at least one passage was checked against bytes");
});

test("F4 mutation: the answer follows the index, not anything else", { skip: !have }, () => {
  const { q, fact } = ASKS[0];
  const mp = mindPassagesFor({ question: q, index: idx });
  const answering = mp.passages.find((p) => p.text.includes(fact));
  assert.ok(answering);
  // (a) delete every unit that carries the fact → the strand loses it
  const cut = { ...raw, units: raw.units.filter((u) => !(u[2].includes(fact) && /South African Council on Sport/.test(u[2]))) };
  const mp2 = mindPassagesFor({ question: q, index: indexOf(cut) });
  const strand2 = snipsOf(mergeMind([], mp2), q);
  assert.ok(!(strand2.snips ?? []).some((s) => s.text.includes("established in 1973")), "the fact is gone when the index no longer holds it");
  // (b) corrupt the sentence's text in place → the byte check (F3's) must disagree
  const bad = { ...raw, units: raw.units.map((u) => (u[2] === answering.text ? [u[0], u[1], u[2].replace(fact, "1873")] : u)) };
  const mp3 = mindPassagesFor({ question: q, index: indexOf(bad) });
  const p3 = mp3.passages.find((p) => p.text.includes("1873"));
  if (p3 && fs.existsSync(path.join(CORPUS, p3.address.file))) {
    const seg = fs.readFileSync(path.join(CORPUS, p3.address.file)).subarray(p3.address.at, p3.address.at + 400).toString("utf8");
    assert.ok(!seg.includes("1873"), "a corrupted memory is caught by the bytes it claims to be from");
  }
});

test("F5 the loader never throws; no index means no mind", async () => {
  resetFoundation();
  assert.equal(await ensureFoundation({ fetchImpl: async () => ({ ok: false }) }), null);
  resetFoundation();
  assert.equal(await ensureFoundation({ fetchImpl: async () => { throw new Error("offline"); } }), null);
  resetFoundation();
  assert.equal(await ensureFoundation({ fetchImpl: async () => ({ ok: true, json: async () => ({ schema: "nope" }) }) }), null);
  resetFoundation();
  assert.deepEqual(mergeMind([], { passages: [] }), []);
  assert.equal(mindPassagesFor({ question: "When was it?", index: null }).gap, "no_index");
});

test("contentStems keeps years and drops the shape of a question", () => {
  const s = contentStems("When was the 2015 drought in the Virgin Islands?");
  assert.ok(s.includes("2015") && s.includes("drought") && s.includes("virgin"));
  assert.ok(!s.includes("when") && !s.includes("was"));
});

test("F6 the chat imports the consumer and merges at the web-read seam", () => {
  const src = fs.readFileSync(path.join(HERE, "fold-chat.js"), "utf8");
  assert.ok(/from "\.\/fold-chat-foundation\.js"/.test(src));
  assert.ok(/mergeMind\(webPassages, mp\)/.test(src), "the mind is merged into the turn's passages");
  assert.ok(/ensureFoundation\(\)/.test(src), "the index is loaded for the turn");
});
