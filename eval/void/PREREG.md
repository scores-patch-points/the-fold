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

## Amendment 1 (2026-10-14): the full stack (perception, logos, pathos). Written before any L1–L4 arm has run.

The user's direction, given mid-build: "remember to use the full stack of perception, logos and pathos". The layers above are built from the khora's **own organs**, all already vendored in `vendor/khora/native/`, and never from hand-rolled substitutes. A layer that needs an organ that is missing or broken reports it as a typed gap.

**Perception** (the khora's perceiver: model-free, addressed). This is how L1 and L2 read.
- **The ask:** `adapters/text/surfaces.js` (extractSurfaces) reads the ask's surfaces, beside askFrame's title door. This gives two witnesses for the anchor, not one.
- **The pages:** `adapters/text/spans.js`, `surfaces.js` and `relations.js` (extractSurfaces, discoverRelationVocab, extractRelations) read every recorded page into addressed surfaces and relation notes. The universe is made only of these, each with a byte address.

**Logos** (the reasoning organs). L2–L4 are these, wired:
- `kernel/hyperlexicon.js` (Xushen): the edges, with standing (candidate / given).
- `kernel/kind-induction.js` (Kanada): an entity's kind is induced from what its instances share. This is where "the building" is the Opera House, and where "a capital is a city" comes from. It replaces any role-to-kind table.
- `kernel/gfp-claim.js` (Talmy): the void's open edge, figure against ground (`claimFromTriple`).
- `organs/grounding.js` (Mozi): a filler stands only on what was witnessed.
- `organs/corroboration.js` (Bukhari): competing fillers and independent chains.
- `kernel/contest.js` (Tungara, `adjudicate` / `nullAdjudicate`): two fillers for one edge (1973 vs 1957) are settled by the contest organ against its own null, never by proximity.
- `kernel/perspective.js` (Mahavira): standpoints kept apart.
- `kernel/stigmergy.js` (Wilson): trails from the turn ledger, as a witness, later.

**Pathos** (for whom the void exists).
- `organs/experiencer.js` (Panini, requireExperiencer / withExperiencer): every declared void carries its experiencer, the person asking. A claim about an attitude ("X believed …") carries its holder.
- `organs/pathos.js` (Abhinavagupta): the felt shape of the exchange.
- In the recursion, pathos is the **top** layer. The person's next act on an answer (re-ask, source-ask, challenge, moving on, from the Wald turn ledger) is evidence passed down to every layer below. The frozen battery has no next acts, so pathos's down-going evidence is **wired and recorded on the battery but scored only live** (declared). Its battery contribution is the experiencer field, which is recorded, not scored, because gold carries no experiencer.

**Unchanged:** the battery, the scoring, the arms, the nulls, bars V1–V6. The L1 grammar reader keeps its declared word tables only where no organ answers the question: measure adjectives, request verbs, time nouns. `admits` for a role noun ("capital" → city) is **not** in any table. It must come from kind-induction over the universe (L2/L3), or stay a typed gap.

## Amendment 2 (2026-10-14): L2's unit is the clause. Written before L2 is built or run.

**Measured before this amendment.** The engine's own rich relation reader (khora `native/the-fold/reader-bundle.js` `engineRelationsFor`: S50 attestedVerbs, UniMorph, the POS prior, clause-aware GFP mode) read the Sydney Opera House lead into 27 edges, and every one is **name → name**. The date and the referring expression land inside connector text ("peter hall —, the building was formally opened by→ queen elizabeth"; "queen elizabeth —ii on 20→ october"). So the hypergraph alone cannot hold "anchor —opened→ date". L2's unit is therefore the **clause**, read with these organs:

- **Perception:** khora `splitSentences` (spans.js) and `extractSurfaces` (surfaces.js) over the anchor's pages.
- **Clauses and fillers:** the-fold's shipped readers `clausesOf`, `datesIn` and `quantitiesIn` (fold-chat-answerspan.js).
  - `admits` date / era → `datesIn`.
  - A measure → `quantitiesIn`.
  - person / place / thing → the perceived surfaces in the clause, other than the anchor's own.
- **Relation identity:** khora's lemmatizer (`morphology.js` `createLemmatizer(...).sameAct`, over the received `janus/priors/morphology-eng.json`), so "sank" is "sink" and "written" is "write". This is never a stemmer and never a word list.
- **Kinds:** a copula sentence on the anchor's own page ("⟨anchor⟩ is a / an / one of the … K") is recorded as khora `kindEvidence` (`explicit_classification`, kindKey K, entityRef the anchor, witnessed by its address). The anchor's kinds are exactly those witnessed records.
- **Reference by kind:** on the anchor's own pages, a definite description "the K" / "this K", with K among the anchor's witnessed kinds, refers to the anchor.

**An edge** is one clause that holds all three:
- the anchor, by name, alias or kind-description;
- a token that is `sameAct` with one of the void's relation words;
- a filler from the reader for the void's `admits`.

The edge's address is `ref#clauseStart-clauseEnd`.

**L2's answer (feed-forward, additive):**
- L2 speaks only where L0 gave no answer.
- If the edges hold **exactly one** distinct filler (case- and space-folded), the answer is that clause's verbatim text.
- If they hold two or more, L2 gives a **contest gap**, never an answer. Choosing between them is L3/L4's job, or the recursion's.
- An L0 answer is never replaced at L2 (V3).

**Pages:** the surface's own `searchPassages({ referents: [anchor], predicate })` for L1's anchor, recorded in a declared L2 pass.

**universe-null:** each ask's edges keep their clauses, but the fillers are drawn from another ask's universe (a seeded derangement, 200 shuffles). RIGHT must collapse.

**Declared limits:** English only; number words ("eleven", "two") are not quantities to `quantitiesIn`; the morphology prior is read from the workspace's `janus/priors`, which the browser surface must reach through the khora's door, never ship.
