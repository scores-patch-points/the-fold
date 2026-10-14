# The void, rebuilt in the referent's universe: pre-registration

2026-10-14. Written before any arm is run on the battery. Battery: `eval/void/battery.mjs`, 58 asks (29 dev / 29 held, 3 false-premise), frozen at sha256 `ae21197e…` in `battery.sha`.

## The question

Can the Fold define the void a slot ask names, both **the slot and what would satisfy it**, and then find what satisfies it? Can it do that with no model, through layers that each give a useful answer alone, that get more useful as they stack, and in which higher layers recursively adjust the probabilities of the layers below?

## Where this starts (measured before this file, 2026-10-14)

- "When was the Sydney Opera House opened?" → refused, "no source says when". The date sentence on the article's own page says "*the building* was formally opened … on 20 October 1973". Replacing "the building" with the name makes it the top candidate, with fillers 1973 and 1957, and it is *still* refused: nothing ties 1973 to "opened" and 1957 to "Utzon's selection".
- "What is the capital of Australia?" answered "the Australian Capital Territory" before the-fold#5. Nothing in the frame says the filler must be a city.
- The chat's frame (`fold-chat-frame.js` askFrame) is `{slot, referents, predicate}`. The slot is read only from a front wh-word, in English. The hyperlexicon is never read on the slot path. khora's nine-field `declareVoid` (`void-shape.js`) is not vendored.

## Harness (declared)

- **Faithful.** Each arm runs the surface's own `runSlotTurn` (fold-chat-answerwire.js) with its own `slotDeps`, plus the new layers. No stand-ins.
- **Record, then replay.** One live recording pass logs every response the pipeline fetches (URL, status, body, sha256) to `eval/void/recording/`. Every arm then replays offline. A URL a layer needs that was not recorded is a typed `unrecorded` miss; a layer that needs new URLs records them in a declared pass of its own before it is scored.
- **Scope.** `webPassages` is empty, because the chat's web search is not reproducible. The slot pipeline reads only what its own deps fetch. English only: GRAMMAR has no other table, and other languages are a typed gap, not scored here.

## Scoring: three tiers per ask, from the arm's output alone

- **RIGHT:** an answer is given, and its text contains an accepted filler (case- and space-folded).
- **WRONG:** an answer is given and contains no accepted filler, or any answer on a false-premise ask.
- **GAP:** no answer. A gap is **informative** if it carries a declared void (EOVoidDeclaration@1) whose `slot`, `anchor` and `admits` all agree with gold. `slot` must be equal; `anchor` must resolve to the gold title; `admits` must be equal. Otherwise it is a **plain** gap. On a false-premise ask, any gap counts as right.
- **Useful = RIGHT + informative GAP.** Reported per set and per slot.
- Also reported: the void-definition score, meaning how many of the five gold void fields each arm declares correctly, whether or not it answers. And `solvable`: whether an accepted filler occurs anywhere in the recorded bytes, as a column. Gold is never edited.

## Layers (each admitted only by its bars)

- **L0:** the pipeline as merged (50ce24c). Baseline.
- **L1: the declared void.** From the ask's own grammar, a nine-field `declareVoid` (khora void-shape.js, `cellOf` injected from kernel/cube.js) is declared: `slot`, `anchor`, `relation`, `admits` (from the interrogative and the role noun), `cardinality` (grammatical number) and `extent` (the ask's time words). Fields it cannot read are typed gaps. The void is also read when there is no front wh-word ("capital of Australia?", "Hamlet author"). Every turn carries the void, including the gap turns.
- **L2: the referent's universe.** The recorded pages are read into a hyperlexicon of edges `end1 —label→ end2` (khora relations reader plus received-prior attested verbs; the rich default, S50), with kind edges (`X is a K`) and definite descriptions resolved by kind on the anchor's own page ("the building" → the page's subject, when the page says its subject is a building). The void becomes an open edge `anchor —relation→ ?`, and fillers bind **by edge**, not by sentence proximity.
- **L3: admission.** A candidate stands only if it is shown to be the admitted kind, by a kind edge in the universe (its own page's `X is a K`) or by structured data (Wikidata P31) as a second witness. Otherwise it is refused, never assumed.
- **L4: hops, bounded by a null.** The universe expands outward from the anchor, one hop at a time. It stops at the first hop whose added edges do not beat a shuffled-edge null. No hop count is set by hand.

## Recursion (the user's direction, 2026-10-14: "higher layers recursively adjust the lower layers' probabilities")

- Every layer holds **weights over its own candidates**, not a single pick. L1: the anchor resolutions and the slot reading. L2: edges, and fillers per edge. L3: admitted kinds per filler.
- Each layer's verdict is passed **down** as a likelihood ratio on the candidates below it:
  - L3 refusing a filler down-weights the L2 edge that offered it;
  - L2 binding a definite description to the anchor up-weights L1's anchor reading;
  - L4 finding no hop that beats the null leaves the lower layers as they are.
- **Possible / probable** (the house's two bars, the same ones Wald uses). A candidate is **possible** once any layer gives it weight. It is **probable**, and licensed to be the answer, only past the upper bar after the loop settles. The loop repeats until no weight changes, truncated at Wald's §3.8 limit.
- The ratios each layer sends down are **measured on the dev set** (Laplace's rule as the only prior), never set by hand. They are frozen before the held set is scored.

## Arms

1. **L0** (baseline).
2. **L1, L1+2, L1+2+3, L1+2+3+4, feed-forward:** each layer passes up, with no feedback.
3. **The same stacks, recursive:** with feedback down, as above.
4. **Nulls**, same seed 20261014 and 200 shuffles where a null shuffles:
   - **void-null:** each ask carries another ask's void (it tests that an informative gap describes *this* ask);
   - **universe-null:** edge ends shuffled within the universe;
   - **feedback-null:** each layer's down-going ratios applied to shuffled candidates.

## Bars (a layer or the recursion is admitted only if every bar for it holds; a failed bar is reported as failed)

- **V1 (every stage useful):** each admitted stack's Useful ≥ the stack below it, on dev **and** held.
- **V2 (never more wrong):** each admitted stack's WRONG ≤ the stack below it, on dev and held.
- **V3 (RIGHT never falls):** each admitted stack's RIGHT ≥ the stack below it, on dev and held.
- **V4 (beats its null):** each layer's gain over the stack below (Useful for L1, RIGHT for L2–L4) is above the 95th percentile of its null.
- **V5 (the recursion earns its place):** recursive ≥ feed-forward on Useful and RIGHT, and ≤ on WRONG, on held. Its gain must beat the feedback-null's 95th percentile. If it does not, the stack ships feed-forward and the recursion is reported as not earned.
- **V6 (no model):** every arm makes zero model calls, counted.

No re-run after a look, except under an amendment written before that re-run. Held per-row results are not read until a stage's bars are computed; aggregates only.
