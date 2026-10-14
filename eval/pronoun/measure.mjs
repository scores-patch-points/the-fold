// eval/pronoun/measure.mjs — the pronoun stack measured level by level, from committed fixtures only.  (2026-10-14)
//   L0  does the gate SEE an anaphor?      recall on real treebank sentences with a personal 3rd-person pronoun; false carries on sentences with
//                                           no pronoun and on sentences whose only pronouns do not point back (reflexive, expletive, relative)
//   L2  is each referent given its KIND?   personLike(person) must be true, personLike(thing) false, in each language
//   L4  does the binding use the levels?   a pronoun binds the person and not the thing the ask names; never a source-only referent;
//                                           never a refused one
//   S   the stem matcher the binding uses: its false-positive rate on random pairs of unrelated words from the same fixture
// No local corpus is read: the sentences live in ud-fixture.json (45 KB), the classes in fold-chat-pronouns.js.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "..", "..");
const { anaphoraOf } = await import(path.join(ROOT, "fold-chat-anaphora.js"));
const { hintsFor } = await import(path.join(ROOT, "fold-chat-hints.js"));
const { personLike } = await import(path.join(ROOT, "fold-chat-mind.js"));
const { castOf, resolveCast, sameStem } = await import(path.join(ROOT, "fold-chat-casts.js"));
const fx = JSON.parse(fs.readFileSync(path.join(HERE, "ud-fixture.json"), "utf8"));
const PERSON = "Donald Trump", OTHER = "Joe Biden";
const KIND = {
  en: { ask: "say more about him losing the election", thing: "2020 presidential election" },
  es: { ask: "cuéntame más sobre él perdiendo la elección", thing: "elección presidencial de 2020" },
  pt: { ask: "conte mais sobre ele perdendo a eleição", thing: "eleição presidencial de 2020" },
  de: { ask: "erzähl mehr darüber, wie er die Wahl verlor", thing: "Präsidentschaftswahl 2020" },
  ca: { ask: "explica'm més sobre ell perdent les eleccions", thing: "elecció presidencial del 2020" },
};
const rate = (a, f) => (a.length ? a.filter(f).length / a.length : 0);
const round = (x) => Math.round(x * 1000) / 1000;
export function measure() {
  const out = { L0: {}, L2: {}, L4: {}, S: {} };
  for (const [l, v] of Object.entries(fx.languages)) {
    const run = (x) => anaphoraOf(x.text, { lang: l, hints: hintsFor(l) });
    out.L0[l] = { recall: round(rate(v.pos.map(run), (r) => r.carry)), falseCarryNoPronoun: round(rate(v.neg.map(run), (r) => r.carry)), falseCarryNonPointing: round(rate(v.neg2.map(run), (r) => r.carry)) };
    // S: unrelated word pairs, seeded
    const toks = [...new Set([...v.pos, ...v.neg, ...v.neg2].flatMap((x) => (x.text.match(/\p{L}{4,}/gu) || []).map((w) => w.toLocaleLowerCase())))].sort();
    let a = 20261014 + l.charCodeAt(0), hit = 0, n = 0; const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
    for (let i = 0; i < 20000; i++) { const x = toks[Math.floor(rnd() * toks.length)], y = toks[Math.floor(rnd() * toks.length)]; if (x === y) continue; n++; if (sameStem(x, y)) hit++; }
    out.S[l] = { falseStemRate: round(hit / (n || 1)), words: toks.length };
  }
  for (const [l, k] of Object.entries(KIND)) {
    const msgs = [{ role: "user", content: `did ${PERSON} win the ${k.thing}?` }, { role: "assistant", content: `${PERSON} lost the ${k.thing}.` }];
    out.L2[l] = { personOK: personLike(PERSON, hintsFor(l)) === true, thingOK: personLike(k.thing, hintsFor(l)) === false };
    const rec = { entities: [{ surface: k.thing, weight: 9 }, { surface: PERSON, weight: 5 }] };
    const bound = (r, opt) => resolveCast(k.ask, castOf(msgs, r), opt).carried?.[0]?.surface;
    out.L4[l] = {
      personNotThing: bound(rec, { pronoun: null }) === PERSON,
      noSourceOnly: bound({ entities: [{ surface: OTHER, weight: 99 }, { surface: PERSON, weight: 5 }] }, {}) !== OTHER,
      noRefused: bound(rec, { rejected: [PERSON] }) !== PERSON,
    };
  }
  return out;
}
if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(measure(), null, 1));
