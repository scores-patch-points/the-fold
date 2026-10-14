// eval/casts/omni.mjs (was fold-chat-casts.omni.test.mjs) — DOES A PRONOUN BIND TO THE RIGHT WHOM, IN ANY LANGUAGE?  (2026-10-14)
//
//   node eval/casts/omni.mjs      (exits 1 on a failed claim; no arguments; deliberately not a *.test.mjs so npm test does not run it)
//
// The claim under test is the cast resolver's own (fold-chat-casts.js): a pronoun binds to ONE referent the person can reach — never
// one only a SOURCE asserted, never one the person refused — and, when the pronoun is a person pronoun, to a person-like referent
// and not the heavier inanimate thing beside it. The same fixture is written in five languages with each language's own pronoun.
// The resolver gets the ask exactly as the live page gives it (pronounOf(ask, gate) with a pronoun gate).
import { castOf, resolveCast, pronounOf } from "../../fold-chat-casts.js";

const FIX = [
  { lang: "en", ask: "say more about him losing the election", person: "Donald Trump", thing: "2020 presidential election", other: "Joe Biden" },
  { lang: "es", ask: "cuéntame más sobre él perdiendo la elección", person: "Donald Trump", thing: "elección presidencial de 2020", other: "Joe Biden" },
  { lang: "pt", ask: "conte mais sobre ele perdendo a eleição", person: "Donald Trump", thing: "eleição presidencial de 2020", other: "Joe Biden" },
  { lang: "de", ask: "erzähl mehr darüber, wie er die Wahl verlor", person: "Donald Trump", thing: "Präsidentschaftswahl 2020", other: "Joe Biden" },
  { lang: "ca", ask: "explica'm més sobre ell perdent les eleccions", person: "Donald Trump", thing: "elecció presidencial del 2020", other: "Joe Biden" },
];
const gate = { kind: "pronoun" };
const results = []; let fail = 0;
const claim = (name, ok, detail) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`); results.push({ name, ok }); if (!ok) fail += 1; };
for (const f of FIX) {
  const msgs = [{ role: "user", content: `did ${f.person} win the ${f.thing}?` }, { role: "assistant", content: `${f.person} ... ${f.thing}.` }];
  // S1 scope: the person is established by the user and the fold; the thing outweighs the person. A person pronoun must take the person.
  const rec = { entities: [{ surface: f.thing, weight: 9 }, { surface: f.person, weight: 5 }] };
  const pr = pronounOf(f.ask, gate);
  const r1 = resolveCast(f.ask, castOf(msgs, rec), { pronoun: pr });
  claim(`[${f.lang}] person pronoun binds the person, not the heavier thing`, r1.carried?.[0]?.surface === f.person, `pronoun recognised: ${pr ?? "NONE"} · bound: ${r1.carried?.[0]?.surface ?? r1.reason}`);
  // S2 holder scope: a referent only a SOURCE asserted never binds (it is not in the person's turns or the fold's answer)
  const rec2 = { entities: [{ surface: f.other, weight: 99 }, { surface: f.person, weight: 5 }] };
  const r2 = resolveCast(f.ask, castOf(msgs, rec2), { pronoun: pr });
  claim(`[${f.lang}] a source-only referent never binds, however heavy`, r2.carried?.[0]?.surface !== f.other, `bound: ${r2.carried?.[0]?.surface ?? r2.reason}`);
  // S3 refusal: a refused referent never binds again
  const r3 = resolveCast(f.ask, castOf(msgs, rec), { pronoun: pr, rejected: [f.person] });
  claim(`[${f.lang}] a refused referent never binds`, r3.carried?.[0]?.surface !== f.person, `bound: ${r3.carried?.[0]?.surface ?? r3.reason}`);
}
console.log(fail ? `\n${fail} claim(s) FAILED` : "\nall claims held");
process.exit(fail ? 1 : 0);
