// eval/creole/pos-projection.test.mjs — falsifiers for pos-projection.mjs, and a mutation check per gate.
//   node --test eval/creole/pos-projection.test.mjs
// Shape: each `falsifier` takes a module namespace and THROWS if the gate it guards is broken. It must pass on the real
// module and must FAIL on a mutant with that gate's marked line weakened (// GATE:<name>). A falsifier that passes on its own
// mutant is not guarding anything.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as M0 from "./pos-projection.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "pos-projection.mjs");
const FOLD = pathToFileURL(path.join(HERE, "../../fold-chat-foldtext.js")).href;

// ── a synthetic creole with a known answer: invented words, word-for-word, known tags ──────────────────────────────────
const LEX = [ // [anchor word, creole word, UPOS]
  ["the", "la", "DET"], ["a", "un", "DET"], ["dog", "chen", "NOUN"], ["cat", "chat", "NOUN"], ["man", "nom", "NOUN"],
  ["house", "kay", "NOUN"], ["eats", "manje", "VERB"], ["sees", "we", "VERB"], ["big", "gwo", "ADJ"], ["small", "ti", "ADJ"],
  ["in", "nan", "ADP"], ["with", "avek", "ADP"],
];
const anchorOf = new Map(LEX.map(([e, , u]) => [e, new Map([[u, 10]])]));
function corpus(n, seed = 7) {
  const r = M0.rng(seed), pick = (u) => { const xs = LEX.filter((x) => x[2] === u); return xs[Math.floor(r() * xs.length)]; };
  const pairs = [];
  for (let i = 0; i < n; i++) {
    const parts = [pick("DET"), ...(r() < 0.5 ? [pick("ADJ")] : []), pick("NOUN"), pick("VERB"), pick("DET"), pick("NOUN"), ...(r() < 0.5 ? [pick("ADP"), pick("DET"), pick("NOUN")] : [])];
    pairs.push({ c: parts.map((x) => x[1]).join(" "), a: parts.map((x) => x[0]).join(" ") });
  }
  return pairs;
}
const truth = new Map(LEX.map(([, c, u]) => [c, u]));

// ── falsifiers ────────────────────────────────────────────────────────────────────────────────────────────────────────
const falsifiers = {
  heldout(M) {
    const held = new Set([M.foldKey("Mwen ap manje, kounye a!")]);
    const { kept, dropped } = M.excludeHeldOut([{ c: "mwen ap manje kounye a" }, { c: "li ale" }], held);
    assert.equal(dropped.length, 1, "a sentence whose key is held out must be dropped");
    assert.equal(kept.length, 1);
    assert.equal(kept[0].c, "li ale");
  },
  intersect(M) {
    // forward: creole 0→anchor 0, creole 1→anchor 0 (two tokens fight over one); reverse: anchor 0→creole 0
    const links = M.intersectLinks(Int32Array.from([0, 0]), Int32Array.from([0]));
    assert.deepEqual(links, [[0, 0]], "only a mutual choice is a link");
  },
  null(M) {
    const real = new Map([["la", new Map([["DET", 5]])], ["chen", new Map([["NOUN", 3]])]]);
    const maxNull = new Map([["la", new Map([["DET", 5]])], ["chen", new Map([["NOUN", 1]])]]);
    const kept = M.keepAgainstNull(real, maxNull);
    assert.equal(kept.has("la"), false, "a vote that only TIES the best shuffled run is chance");
    assert.equal(kept.get("chen")?.get("NOUN"), 3, "a vote above every shuffled run is kept");
  },
  gateNeverCreates(M) {
    const kept = new Map([["xx", new Map([["NOUN", 4]])]]);
    const flags = new Map([["xx", { closedlike: true, bursty: false }]]);
    const out = M.applyGates(kept, flags, { gateClosed: true });
    assert.deepEqual([...out.get("xx").keys()], ["NOUN"], "the closed gate must not invent or erase a class it has no vote for");
  },
  bursty(M) {
    // `la` in every sentence (even); `zork` in a run of sentences (clumped). Block spread must call only zork bursty.
    const sents = [];
    const fill = ["kay", "nan", "chen", "chat", "nom", "gwo", "ti"];
    for (let i = 0; i < 64; i++) sents.push(i >= 20 && i < 28 ? ["la", "zork", "zork", fill[i % 7]] : ["la", fill[i % 7], fill[(i * 3 + 1) % 7]]);
    const flags = M.functionFlags(sents, 0.3, M.rng(3));
    assert.equal(flags.get("zork").bursty, true, "a form clumped in a run is bursty");
    assert.equal(flags.get("la").bursty, false, "a form in every sentence is not");
  },
  soft(M) {
    const anchor = new Map([["light", new Map([["NOUN", 1], ["ADJ", 1]])]]);
    const v = M.votesFromLinks([{ c: ["lumye"], a: ["light"] }], [[[0, 0]]], anchor);
    assert.deepEqual([...v.get("lumye").entries()].sort(), [["ADJ", 0.5], ["NOUN", 0.5]], "ambiguity is preserved, never resolved");
  },
  heldoutScore(M) {
    // a model trained on true pairs must score true held-out pairs above the same sentences with their translations deranged
    const cv = new Map(), av = new Map(), id = (m, w) => { let x = m.get(w); if (x === undefined) { x = m.size + 1; m.set(w, x); } return x; };
    const pairs = corpus(80).map((p) => ({ c: p.c.split(" "), a: p.a.split(" ") }));
    const C = pairs.map((p) => Int32Array.from(p.c, (w) => id(cv, w))), A = pairs.map((p) => Int32Array.from(p.a, (w) => id(av, w)));
    const n = 40, trainA = A.slice(0, n), trainC = C.slice(0, n), testA = A.slice(n), testC = C.slice(n);
    const model = M.emDirection(trainA, trainC, cv.size, 4).model;
    const der = M.derange(testA.length, M.rng(2)), shufA = der.map((i) => testA[i]);
    assert.ok(M.scoreModel(model, testA, testC) > M.scoreModel(model, shufA, testC), "true held-out pairs must be likelier than deranged ones");
  },
  clauses(M) {
    const out = M.pairClauses("Mwen pa vle sa. Li ale kay la; nou rete.", "I do not want that. He went home; we stayed.");
    assert.equal(out.length, 3, "three clauses on each side pair one to one");
    assert.equal(out[1].a, "He went home;");
  },
  bareElision(M) {
    assert.deepEqual(M.tokenize("L'ekol n'ap", { bare: true }), ["l", "ekol", "n", "ap"]);
    assert.deepEqual(M.tokenize("L'ekol", {}), ["l'", "ekol"]);
  },
  script(M) {
    assert.equal(M.scriptClass("2026"), "NUM");
    assert.equal(M.scriptClass("--"), "PUNCT");
    assert.equal(M.scriptClass("m~"), null, "a word with a stray mark is still a word");
  },
};

for (const [name, f] of Object.entries(falsifiers)) {
  test(`falsifier ${name} holds on the module`, () => f(M0));
}

// ── mutation: weaken each marked gate; its falsifier must now throw ───────────────────────────────────────────────────
const MUTANTS = {
  heldout: [["if (heldKeys.has(foldKey(p.c))) dropped.push(p); else kept.push(p); } // GATE:heldout", "kept.push(p); } // GATE:heldout"]],
  intersect: [["if (i >= 0 && r[i] === j) out.push([j, i]); } // GATE:intersect", "if (i >= 0) out.push([j, i]); } // GATE:intersect"]],
  null: [["if (v > (maxNull.get(f)?.get(u) ?? 0)) k.set(u, v); // GATE:null", "if (v >= (maxNull.get(f)?.get(u) ?? 0)) k.set(u, v); // GATE:null"]],
  gateNeverCreates: [["return r.size ? r : null; }; // GATE:gate-never-creates", "return r; }; // GATE:gate-never-creates"]],
  bursty: [["bursty = T < min; // GATE:bursty", "bursty = false; // GATE:bursty"]],
  heldoutScore: [["ll += Math.log(d); // GATE:score", "ll += 0; // GATE:score"]],
  clauses: [["  if (cs.length < 2 || as.length < 2) return [{ c, a }];", "  if (true) return [{ c, a }];"]],
  bareElision: [["out.push(bare ? m[1] : `${m[1]}'`);", "out.push(`${m[1]}'`);"]],
  soft: [["for (const [u, n] of dist) m.set(u, (m.get(u) ?? 0) + (w * n) / tot);", "{ let bu = null, bn = -1; for (const [u, n] of dist) if (n > bn) { bn = n; bu = u; } m.set(bu, (m.get(bu) ?? 0) + w); }"]],
};
const src = fs.readFileSync(SRC, "utf8");
async function mutant(name, edits) {
  let s = src.replace(/from "\.\.\/\.\.\/fold-chat-foldtext\.js"/, `from ${JSON.stringify(FOLD)}`);
  for (const [from, to] of edits) {
    assert.ok(s.includes(from), `mutation anchor for "${name}" not found — the gate's line changed; update the test`);
    s = s.replace(from, to);
  }
  const f = path.join(os.tmpdir(), `pos-projection-mut-${name}-${process.pid}.mjs`);
  fs.writeFileSync(f, s);
  try { return await import(pathToFileURL(f).href); } finally { /* leave for inspection; os tmp is cleaned by the OS */ }
}
for (const [name, edits] of Object.entries(MUTANTS)) {
  test(`mutating gate ${name} makes its falsifier fail`, async () => {
    const Mx = await mutant(name, edits);
    assert.throws(() => falsifiers[name](Mx), undefined, `the ${name} falsifier passed on a module with that gate weakened — it guards nothing`);
  });
}
test("script rule has a falsifier but no mutation target (a rule, not a gate): a mutant that types everything NUM is caught", async () => {
  const Mx = await mutant("script", [['if (/^[\\p{Nd}\\p{No}\\p{Nl}]+$/u.test(f)) return "NUM";', 'if (true) return "NUM";']]);
  assert.throws(() => falsifiers.script(Mx));
});

// ── behaviour ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test("tokenize: elision splits, clitic stays whole, accents fold at the fold's scope only", () => {
  assert.deepEqual(M0.tokenize("L'ekol la, dat's Ba'y!"), ["l'", "ekol", "la", "dat's", "ba'y"]);
  assert.deepEqual(M0.tokenize("Tèt-chaje à Zürich ñ"), ["tèt-chaje".replace("è", "e"), "a", "zurich", "ñ"]);
});
test("derange never leaves a fixed point", () => {
  const r = M0.rng(1);
  for (let n = 2; n < 40; n++) { const p = M0.derange(n, r); assert.ok(p.every((x, i) => x !== i)); assert.equal(new Set(p).size, n); }
});
test("galeChurch: equal lists pair 1-1; a paragraph split in two on one side pairs 2-1", () => {
  const eq = M0.galeChurch([50, 80, 60], [52, 79, 61]);
  assert.deepEqual(eq.map((b) => [b[0], b[1]]), [[[0, 1], [0, 1]], [[1, 2], [1, 2]], [[2, 3], [2, 3]]]);
  const merged = M0.galeChurch([50, 60, 80], [112, 79]);
  assert.deepEqual(merged[0], [[0, 2], [0, 1]]);
});
test("pipeline recovers a known creole: every kept form carries its true class, and the commonest form is kept", () => {
  const anchor = M0.anchorIndex(Object.fromEntries([...anchorOf].map(([k, m]) => [k, Object.fromEntries(m)])));
  const pack = M0.buildPack([{ name: "syn", anchor, pairs: corpus(60) }], { B: 19 });
  assert.ok(pack.stats.forms > 0);
  for (const [f, d] of Object.entries(pack.forms)) {
    const top = Object.entries(d).sort((a, b) => b[1] - a[1])[0][0];
    assert.equal(top, truth.get(f), `${f} should be ${truth.get(f)}, pack says ${top}`);
  }
  assert.ok(pack.forms.la, "the commonest function word must survive the null");
});
test("a shuffled pairing carries no information: far fewer forms survive than with the true pairing", () => {
  const anchor = M0.anchorIndex(Object.fromEntries([...anchorOf].map(([k, m]) => [k, Object.fromEntries(m)])));
  const real = corpus(60), r = M0.rng(5), p = M0.derange(real.length, r);
  const fake = real.map((x, i) => ({ c: x.c, a: real[p[i]].a }));
  const good = M0.buildPack([{ name: "g", anchor, pairs: real }], { B: 19 });
  const bad = M0.buildPack([{ name: "b", anchor, pairs: fake }], { B: 19 });
  assert.ok(bad.stats.forms < good.stats.forms, `shuffled ${bad.stats.forms} vs real ${good.stats.forms}`);
});
test("chanceDiscoveries: the true pairing out-discovers every shuffled draw; a shuffled pairing does not", () => {
  const anchor = M0.anchorIndex(Object.fromEntries([...anchorOf].map(([k, m]) => [k, Object.fromEntries(m)])));
  const real = corpus(60), r = M0.rng(9), p = M0.derange(real.length, r);
  const fake = real.map((x, i) => ({ c: x.c, a: real[p[i]].a }));
  assert.equal(M0.chanceDiscoveries(M0.projectBase([{ name: "g", anchor, pairs: real }], { B: 19 })).beatsChance, true);
  assert.equal(M0.chanceDiscoveries(M0.projectBase([{ name: "b", anchor, pairs: fake }], { B: 19 })).beatsChance, false);
});
test("pairedMaxT adopts a uniform gain and refuses a tie", () => {
  const a = Array.from({ length: 40 }, () => 1), b = Array.from({ length: 40 }, () => 0);
  assert.equal(M0.pairedMaxT(a, b, M0.rng(1)).adopt, true);
  assert.equal(M0.pairedMaxT(b, b, M0.rng(1)).adopt, false);
});
test("tally/summarise: hand-computed precision and recall; abstention counts against recall", () => {
  const forms = { la: { DET: 3 }, kay: { NOUN: 2 }, nan: { NOUN: 1 } }; // nan is wrong (gold ADP)
  const gold = [[{ form: "la", upos: "DET" }, { form: "kay", upos: "NOUN" }, { form: "nan", upos: "ADP" }, { form: "zzz", upos: "VERB" }, { form: ".", upos: "PUNCT" }]];
  const s = M0.summarise(M0.tally(forms, gold));
  assert.equal(s.tokens, 4); assert.equal(s.covered, 3); assert.equal(s.correct, 2); assert.equal(s.trivial, 1); assert.equal(s.trivialTp, 1);
  assert.equal(s.perClass.NOUN.precision, 0.5);      // kay right, nan wrong
  assert.equal(s.perClass.NOUN.recall, 1);
  assert.equal(s.perClass.VERB.recall, 0);           // abstained
  assert.equal(s.perClass.VERB.precision, null);     // never predicted
  assert.equal(s.perClass.ADP.recall, 0);
});
test("a word named like an Object.prototype member is looked up as a word, not as the prototype", () => {
  const s = M0.summarise(M0.tally({ la: { DET: 1 } }, [[{ form: "constructor", upos: "NOUN" }, { form: "valueOf", upos: "NOUN" }]]));
  assert.equal(s.covered, 0);
});
test("gold isolation: buildPack has no gold parameter and never mentions one", () => {
  assert.ok(M0.buildPack.length <= 2);
  assert.ok(!/gold/i.test(M0.buildPack.toString()));
});
test("no hand-set thresholds: the only numeric literals in the module are declared, or are math constants of rng/erf", () => {
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/export const DECLARED = Object\.freeze\(\{[\s\S]*?\n\}\);/, "")
    .replace(/export function rng[\s\S]*?\n\}\n/, "")
    .replace(/const erf = [^\n]*\n/, "")
    .replace(/"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`|\/(?:\\.|[^/\\\n])+\/[gimsuy]*/g, '""'); // strings, templates, regex literals
  const allowed = new Set(["0", "1", "2", "-1", "0.5"]); // indices, counting, a fair coin, the half in a mean
  const lits = [...code.matchAll(/(?<![\w.$])-?\d+(?:\.\d+)?(?:e-?\d+)?(?![\w])/g)].map((m) => m[0]).filter((x) => !allowed.has(x));
  assert.deepEqual(lits, [], `undeclared numeric literals: ${lits.join(", ")}`);
});
