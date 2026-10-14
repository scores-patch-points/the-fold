// eval/learnedpatterns/lib.test.mjs — the instrument of PREREG.md, checked on cases whose answer is known by construction.
import test from "node:test";
import assert from "node:assert/strict";
import { tokenize, anchorMentions, candidates, keysOf, valueForms, verdictOf, learn, tableOf, scoredCandidates, sattolo, rng } from "./lib.mjs";

const AUSTEN = "Pride and Prejudice is a novel by English author Jane Austen.";

test("tokens: the possessive is its own token; marks are tokens", () => {
  assert.deepEqual(tokenize("Kenya's capital, Nairobi.").map((t) => t.fold), ["kenya", "'s", "capital", ",", "nairobi", "."]);
});

test("candidates: capitalised runs, a function word only inside, never across the anchor", () => {
  const toks = tokenize(AUSTEN);
  const ms = anchorMentions(toks, ["Pride and Prejudice"]);
  assert.deepEqual(ms.map((m) => [m.i, m.j]), [[0, 2]]);
  const blocked = new Set([0, 1, 2]);
  assert.deepEqual(candidates(toks, blocked).map((c) => c.text), ["English", "Jane Austen"]);
  assert.deepEqual(candidates(tokenize("The Bank of England said so."), new Set()).map((c) => c.text), ["Bank of England"]);
});

test("keys: the token path, its skeleton and its edges, in both directions", () => {
  const toks = tokenize(AUSTEN);
  const ks = keysOf(toks, { i: 0, j: 2 }, { i: 9, j: 10 });
  assert.ok(ks.includes("R|f|is a novel by C author"));
  assert.ok(ks.includes("R|c1|author") && ks.includes("R|c3|by C author") && ks.includes("R|a1|is"));
  assert.ok(ks.includes("R|s|is a * by C *"));
  const t2 = tokenize("Austen wrote Pride and Prejudice.");
  assert.ok(keysOf(t2, { i: 2, j: 4 }, { i: 0, j: 0 }).includes("L|f|wrote"));
});

test("referee: exact and token-suffix confirm; another part skips; anything else refutes", () => {
  const f = valueForms(["Jane Austen"]);
  assert.equal(verdictOf("jane austen", f), 1);
  assert.equal(verdictOf("austen", f), 1);
  assert.equal(verdictOf("jane", f), 0);
  assert.equal(verdictOf("english", f), -1);
});

test("sattolo: a bijection with no fixed point", () => {
  const p = sattolo(50, rng("t"));
  assert.equal(new Set(p).size, 50);
  assert.ok(p.every((x, i) => x !== i));
});

// A synthetic world: 60 books, each lead says "<Book> is a novel by <Author>." and "<Book> was praised by <Critic>." — the referee's
// value is the author. The real learner must admit "R|f|is a novel by" and never the critic's path; the mutation check (a shuffled
// referee as the "real" labels) must admit nothing.
function world(n = 60) {
  const ents = [];
  for (let k = 0; k < n; k++) {
    const book = `Book${k} Title`, author = `Author${k} Name`, critic = `Critic${k % 7} Person`;
    ents.push({ qid: "Q" + k, anchors: [book], values: [author], sentences: [`${book} is a novel by ${author}.`, `${book} was praised by ${critic}.`] });
  }
  return { P50: { entities: ents } };
}

test("learner: the real path is admitted, the decoy path is not", () => {
  const r = learn(world(), { B: 49, seed: "t" });
  const keys = r.admitted.map((a) => a.key);
  assert.ok(keys.includes("R|f|is a novel by"), JSON.stringify(r.admitted.slice(0, 5)));
  assert.ok(!keys.some((k) => k.includes("praised")));
  const t = tableOf(r.admitted);
  const sc = scoredCandidates("Emma is a novel by Jane Austen.", { pids: ["P50"], anchors: ["Emma"] }, t);
  assert.equal(sc.cands[0].text, "Jane Austen");
});

test("mutation check: a shuffled referee admits nothing", () => {
  const r = learn(world(), { B: 49, seed: "t", labelPerm: "mutation" });
  assert.equal(r.admitted.length, 0, JSON.stringify(r.admitted.slice(0, 5)));
});
