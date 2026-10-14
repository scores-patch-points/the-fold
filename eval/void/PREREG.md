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

## Amendment 3 (2026-10-14): two forms of every answer, the verbatim snip and a net-new paraphrase. Written before L2 runs.

**The user's direction:** "we should be able to create net new paraphrases using the EOT to NL running through all the prosification archons while also doing verbatim snips."

- **The snip.** The bound clause's own bytes, scored by the tiers above. Unchanged.
- **The paraphrase.** Every bound edge is an EOT claim: khora `gfp-claim` `claimFromTriple(anchor, relation lemma, filler)`, with grounds at the clause's address and the anchor and filler bytes at theirs. It is realized as NL by the **Callimachus writer** (khora `prose-laws.js` segments and `lintSentence`; values copied from source bytes; frames from the per-language grammar; dates through CLDR/Intl), and equated by **YadaYadaYada** (`run-dmca.js` `chaseParaphrase`, model-free, FOR the person asking). It is requested from the Callimachus session as `realizeClaim`. **This session builds no realizer.**
- **Paraphrase bars,** scored on every answered row once `realizeClaim` is vendored:
  - **P1 lawful:** `lintSentence` passes.
  - **P2 grounded:** every value or source segment re-verifies against its source bytes.
  - **P3 same claim:** `chaseParaphrase` equates it to the edge's claim row.
  - **P4 net new:** it is not character-identical to the snip. A paraphrase that only copies the snip is reported, not counted.
- **Until `realizeClaim` lands,** paraphrases are a declared, unbuilt arm. L2–L4 are scored on snips only, as pre-registered.

## Amendment 4 (2026-10-14): L2′, the universe rebuilt on organs (induction across terrains). Written after L2 failed V2, before L2′ is built or run.

**Why.** L2 failed V2 on held (WRONG 1 → 2). On the dev rows, which may be read, 19 of the 22 asks it reached bound no edge. Six dev specimens were traced to their causes, and each was a hand rule standing in for a cell organ:
- Mona Lisa: the relation is nominal ("a portrait **painting by** … Leonardo da Vinci").
- Pride and Prejudice: L1 anchored "Prejudice".
- Eiffel Tower, how tall: a quantity slot had no relation word.
- Einstein, born: "Born in Ulm" has an elided subject.
- Chernobyl, happen: a light verb, and the event is the page.
- Canada, capital: under investigation.

The user's direction: "remember the work we did on induction for ALL terrains". Its organ was renamed `terrainInduction` (khora).

**L1.1, the anchor (SIG·Figure).** When the khora perceiver's surface of the ask **strictly contains** the title door's anchor surface, and the same door resolves that longer surface, the longer name is the anchor ("Pride and Prejudice" ⊃ "Prejudice"). The longest name wins, and only with both witnesses. L1.1 is re-scored against bars V1–V4 as its own row, and must not lose anything L1 had.

**L2′, three witnesses (a parliament; disagreements typed, never averaged):**
1. **Clause witness** (L2's clause unit, with its hand rules replaced):
   - **Relation identity:** khora `sameAct` (inflection), **or** shared gold lemma in UD English-EWT r2.14 (khora `native/eval/fixtures/ud-english-ewt`). A clause token and the relation word are one relation when the treebank attests a form of each with the same lemma (painting → paint).
   - **Quantity slots:** for a measure ask, the measure's dimension **is** the relation. A quantity of the admitted dimension in a clause about the anchor witnesses it.
   - **Reference:** khora `resolvePronouns` (pronouns.js) over the anchor's own pages replaces the "page-subject continuity" rule. A participial clause with no subject ("Born in Ulm, …") takes its sentence's main subject; this is declared grammar.
2. **Engine witness** (CON·Figure): khora `engineRelationsFor` (reader-bundle.js, the rich S50 reader). An edge with one end co-referring with the anchor (`namesCorefer`) and a connector holding a relation-identical token (as in 1) offers its other end as the filler, if it is of the admitted kind.
3. **Kind witness** (terrainInduction): the anchor's kinds remain witnessed `terrainEvidence` records. When a kind's lemma is relation-identical to the void's relation (painting ~ paint), the kind phrase's "by"-agent is a filler. This is the relation carried by the anchor's own kind, a composition of the Kind and Link terrains.

**Contest (EVA·Pattern):**
- Two or more distinct fillers go to khora `contest.js` `adjudicate`, against its own `nullAdjudicate`.
- A filler stands only if the contest crowns it above its null. Otherwise it stays a contest gap.
- One distinct filler, with at least one witness, answers as before.

**Not built (typed gaps, declared):** an event's own time for light verbs (happen / occur / take place) has no organ, so it stays a gap.

**Unchanged:** the battery, the scoring, V1–V6, and the universe-null. L2′ re-uses the recorded pages. New fetches, if any, get their own declared recording pass. L2′ is admitted only if it beats **L1**, the last admitted stack, on every bar.

## Amendment 5 (2026-10-14): no hand-set thresholds; the Born rule and DMD all the way up and down. Written before L2′ is built or run.

**The user's direction:** "no handset thresholds — born rule, dmd all the way up and down." It supersedes every numeric choice in Amendment 4.

**Amplitudes, not scores.** Every layer holds an amplitude ψ_c for each of its candidates. A witness w that supports candidate c n_{w,c} times contributes amplitude √n_{w,c}. Amplitudes from different witnesses **add** (ψ_c = Σ_w √n_{w,c}), so independent witnesses that agree reinforce one another more than one witness repeating itself. Probability is the **Born rule**: p_c = |ψ_c|² / Σ_c′ |ψ_c′|².

**Possible / probable, with no constant:**
- **Possible:** p_c > 0, meaning some witness supports c.
- **Probable:** p_c is greater than the top candidate's p in **every** draw of the Born null.
- **The Born null:** the same layer, run on the same material with each witness's filler-to-clause links shuffled. It is built fresh per ask, from what that ask's universe actually holds.
- The only declared quantities are the null's draws and seed (the null-arm's own discipline: the result's resolution is 1/draws), and they are never tuned. Draws: 200, seed 20261014. A null that cannot be built (fewer than 2 clauses or 2 candidates) is a typed gap. It never licenses anything.

**Organs whose gates are declared numbers:**
- `resolvePronouns` (minActivation, minMargin) and contest `adjudicate` / `nullAdjudicate` (minActivation, margins, alpha) are called with their gates **open**: 0 and 0, with alpha = 1/(draws+1), meaning "beats every draw".
- Their **activations** are kept, and the decision is moved to the Born null above.
- The engine's own constants (`PRONOUN_MIN_ACTIVATION = 0.05`, `PRONOUN_MIN_MARGIN = 0.2`) are **not** borrowed.

**DMD, up and down (the recursion, V5):**
- A recursive stack's state is the Born probability vector over every layer's candidates. One pass is up: L1 → L2′ → L3 …, each layer's probabilities feeding the next layer's amplitudes as a witness. One pass is down: each higher layer's probabilities re-weight the lower layer's amplitudes the same way.
- The passes form a trajectory of states, which is decomposed by khora `kernel/dmd.js` (`dmd`, with rank `"numerical"`, derived from the spectrum, never declared).
- **Stopping and standing come from the spectrum, not from a counter.**
  - The loop stops when the trajectory's dominant mode has |λ| ≥ every other mode and the remaining modes have decayed (|λ|<1), as read from the decomposition.
  - A recursion **has structure** only if its Born-rule coherent mass (|λ|² of the dominant mode, `for-whom.js` `coherentMass`) beats the order-shuffled null (`trajectoryNull`).
  - A recursion without structure ships feed-forward, and is reported as such (V5).

**Unchanged:** the battery, the scoring, V1–V6, the witnesses and organs of Amendment 4, and the universe-null. Wald §3.8 truncation is no longer the stopping rule for this stack; the spectrum is.

## Amendment 6 (2026-10-14): logos, the dependency order. Written before L2′ is built or run.

**The user's direction:** "logos is good for catching grammar problems because they violate the dependency order of what makes sense."

**The order** is khora `kernel/cube.js` `OPERATOR_CHAIN` (NUL → SIG → INS → SEG → CON → SYN → DEF → EVA → REC), derived from the cube's own tables. It is never restated here. The void's nine fields sit on those operators: slot = NUL, anchor = SIG, admits = INS, extent = SEG, relation = CON, composition = SYN, cardinality = DEF, admission = EVA, reopensOn = REC.

**Every binding is checked against the order before it can carry any amplitude.** For each operator a binding fills, every earlier operator that the void **declared** must also be filled by that same binding.
- A filler of the admitted kind (INS) whose anchor was reached by nothing (SIG empty) is a **dependency violation**, as is a relation token (CON) in a clause with no admitted filler (INS empty). Either way the binding is refused with a typed `order_violation` that names the first missing operator.
- Operators the void left undeclared (typed gaps) are skipped, not counted as missing.
- No number is involved: the check is structural (prefix closure over the chain).

**The paraphrase** (Amendment 3) gets the same check from the other side. The realized sentence's parsed features map to cells through `CELL_OF_GRAMMAR` (case, person, voice, tense…). A sentence whose cells fill a later operator without the earlier ones it depends on fails as ungrammatical. This check is passed to the Callimachus writer as part of `realizeClaim`'s reverse parse.

**Reported:** the count of bindings refused by the order check, per witness. L1.1 and L2′ are scored with the check on; an "order off" arm on dev shows what it removes.

## Amendment 7 (2026-10-14): the Born statistic is the coherent mass |ψ|², not the normalized p. Written while building L2′, before any L2′ run.

**Found while writing the null, before any run:** Amendment 5's "p_c greater than the top candidate's p in every null draw" is degenerate. A lone candidate has normalized p = 1, and so does whatever the null drops into the same binding clause, so nothing could ever be probable.

**The decision statistic is the unnormalized coherent mass** M_c = |ψ_c|² = (Σ_w √n_{w,c})². It is compared with the maximum, over the draws, of the null's top M.
- Amplitudes from independent witnesses add before squaring. So agreement makes **more** mass than its parts (two agreeing single witnesses give 4; one gives 1).
- A candidate is **probable** iff its M is greater than the null's top M in every draw. It follows that a candidate bound by one clause alone is **possible, never probable**: independent agreement is required. This is Bukhari's independent-chains rule, arising from the Born rule, not added as a rule.
- p_c = M_c / Σ M is still reported, for reading only; it decides nothing.

**Independence (chorus, Pearl):** two clauses from the **same sentence**, or the same sentence repeated on two pages (identical folded text), count as **one** witness instance.

**The four corners** (khora `interpretation/hl.js` `verdictOfSupport(for, against)`; Nagarjuna, per the user's correction):
- for = a probable candidate exists;
- against = either (i) a second candidate is also probable, or (ii) candidates exist and every one was refused (by the order check or by its kind).
- The outcomes are bound (is), contested (both), unbound (neither), and contradicted (is-not: every candidate refused, none probable).

## Amendment 8 (2026-10-14): the final level, an LLM that repairs grammar. Its additions are snipped, entered into the EOT, and folded in. Declared now; built last.

**The user's direction:** "the final level we can add is a LLM that fixes grammar with its additions snipped and added to the EOT and folded into the final output."

**L5, the mouth as grammar repair, and nothing more.** It takes the stack's mechanical output (the snip and the Callimachus paraphrase) and returns a repaired sentence. Then:
- **Every token the model added or changed** (a mechanical diff against its input; never the model's own account of what it changed) is **snipped**. Each snip carries its own address in the output and is typed `self:model` (Koestler, `output-holograph.js`).
- **The snips are entered into the EOT** as the model's own claims, typed and for-whom, beside the claims the stack established. Nothing the model adds is ever folded in as a source's words.
- **The final output is the fold** of the stack's claims and the model's typed snips. A reader always sees which words were the model's.

**Its bars (it is admitted only if all hold; the rule that the model is just the mouth):**
- **G1 (grammar only):** every model addition is closed-class (function words, punctuation) or an inflection of a word already present (khora `sameAct`, EWT gold lemma). A new content word is refused, and the input stands.
- **G2 (no new claim):** the repaired sentence's reverse parse (Callimachus `realizeClaim`'s equate) yields the same claim as its input, with every value equal to its source bytes.
- **G3 (logos):** the repaired sentence passes the `OPERATOR_CHAIN` / `CELL_OF_GRAMMAR` order check that its input failed, or passes as its input did.
- **G4:** Useful does not fall and WRONG does not rise against the stack below (V1–V3). G5: prose-law lint passes (`lintSentence`) at least as often as below, against a null of identical inputs passed through unrepaired.
- **The model** is the house's local small model (Huginn picks it; Gary builds its prompt, information not prohibition, the sentence last). It is the only layer allowed a model call, so V6 is reported per layer and is zero below L5.

## Amendment 9 (2026-10-14): four fixes from the L1.1 / L2′ dev traces. Written after reading only dev rows and held aggregates, before any re-run.

1. **L1.2, the longest name from the ask's own runs.** The khora perceiver splits names at function words, so L1.1 never fired. L1.2 builds candidate runs from the ask's own tokens: contiguous, whitespace-joined, content words at both edges, inner function words allowed, with no length cap other than the ask itself. Only runs that **strictly contain** the anchor's surface are kept, and they go to the **same title door** in one call. A run is taken when it resolves (not to a disambiguation page) and its title shares a content stem with the run (askFrame's own `agrees` discipline). If several resolve, the longest wins. The two witnesses are the ask's own contiguous bytes and the title door.
2. **Engine witness discipline (Pearl, Holmes).**
   - An edge end co-refers with the anchor only if its folded tokens **contain every content token of one of the anchor's aliases**. `namesCorefer`'s bare single-token subset is no longer enough.
   - All edges from one source sentence are **one instance**. Edges carry their refs; edges sharing a ref and a sentence offset count once, and where an offset is missing, the edge's text is the key.
   - Direction is not enforced, as declared: a relation token in the connector with the anchor at either end.
3. **A per-candidate Born null.** The decision statistic stays M_c = (Σ_w √n_{w,c})², but each candidate is compared with **its own** null: M_c in every draw of the same shuffle (each witness's candidate lists permuted among its own slots). A candidate is **probable** iff its real M_c exceeds its null M_c in every draw. This asks whether c is bound more than its own frequency in this universe predicts, not whether it beats the luckiest placement of any candidate. Draws stay at 200, seed 20261014.
4. **The order check's value is measured before it gates anything.** Two arms run on the same code:
   - **L2c:** fixes 1–3, with the order check on;
   - **L2c-noorder:** the same, with the order check off.
   Both are reported on dev and held. The check is kept only if L2c's WRONG ≤ L2c-noorder's and its Useful ≥ L2c-noorder's on both sets. Otherwise it is dropped, and the stack ships without it (Callimachus measured chain closure over grammar-feature cells as non-discriminating; its arc-order check, `logosOrder` in khora PR #7, is a later candidate).

L2c is admitted only against **L1.2** (or L1.1, if L1.2 is not admitted) on bars V1–V4. Unchanged: the battery, the scoring, the recording, and V1–V6.

## Amendment 10 (2026-10-14): the recording froze rate limits. Every arm is re-recorded and re-run. Written before the re-record.

**Found while tracing L2c's misses:** 88 of the recorded responses are not material. 84 are Wikipedia **429s** (rate limiting); the rest are 2 relay 500s and 2 403s. The 429s include title-door lookups ("capital of Australia", "Mars"), searches, and page reads (the Pride and Prejudice pages). A replay of a 429 is an environment failure dressed as evidence. It produced spurious `referents_unresolved` and `unreached` gaps in **every** arm from L0 on.

**The fix (harness only; no arm changes):**
- In record mode, a 429 or 5xx is **never saved**. It is retried, honoring `Retry-After` when sent, otherwise with exponential backoff from 1 s, up to 6 tries. Recording runs **one ask at a time**.
- A 403 is the site's real refusal, so it is kept as material.
- A response that still fails after the retries is left unrecorded, and its replay is a typed `unrecorded` miss, counted per arm.
- Every non-200 file in `eval/void/recording/` is deleted except the 403s. Then L0, L1, L1.1, L1.2, L2, L2′, L2c and L2c-noorder are re-recorded **with their code unchanged**, then replayed offline.

**Consequence, declared:** every figure in RESULTS.md before this amendment was measured on a contaminated recording. Those figures are superseded. The admission decisions (L1, L1.1, L1.2; L2 and L2′ not admitted) are **re-decided** on the clean numbers by the same bars, and RESULTS.md keeps both, marked.

## Amendment 11 (2026-10-14): L2d, the relation-counterfactual Born null. Written before L2d is built or run.

**Why:** the per-candidate filler-shuffle null (Amendment 9) removes the very signal the void asks for. The right filler is often the page's dominant value (1912 on the Titanic page), so shuffling fillers recreates its binding by chance, and nothing is ever probable. The void's question is *what fills **this** edge*, not *is this value unusual on the page*.

**The counterfactual:** keep every filler where it is, and replace the **relation**.
- Each null draw replaces the void's relation words with one verb drawn uniformly from the universe's **own attested verb vocabulary**: tokens in the anchor's pages whose EWT gold UPOS is majority VERB, other than the relation itself.
- The bindings are recomputed with the same witnesses, the same reach, the same fillers, and the same Born mass.
- A candidate c is **probable** iff its real mass M_c exceeds its own mass under the counterfactual relation in **every** draw.
- This is the house's "matched counterfactual": does *sank* pick out 1912 more than *launched*, *built* or *departed* do?

For **measure** slots the relation is the dimension. Their counterfactual swaps the admitted dimension for each other dimension the page's quantities carry ("length" against "mass", "time"…), with the same rule.

Draws: 200, seed 20261014. A universe with fewer than 2 attested verbs (or fewer than 2 dimensions) cannot build the null: a typed gap that licenses nothing.

**Everything else is L2c's:** L1.2, the strict engine co-reference and sentence instances, the order check (kept by Amendment 9's tie rule, with its value reported as unmeasured). L2d is scored on the clean recording against L1.2's clean numbers, on V1–V4.

## Amendment 12 (2026-10-14): L3, the slot-fill role witness. Written after the L2d clean results and after probing `readClause` on seven specimen sentences by hand; before any L3 arm runs.

**What was learned before this amendment.** The clean results (RESULTS.md) say a null can license fillers but cannot choose between them. Callimachus (khora PR #12) found the same from the other end. A hand probe of `readClause` (khora `native/organs/claim-realize.js`, main @ d7a71d4d, the English-EWT parser with the two-parse agreement check) on seven sentences showed:
- a passive verb reading (*opened*): subject *the building*, agent *by Queen Elizabeth II*, date *on 20 October 1973* as three separate obliques;
- refusals, typed: an adjectival predicate (*tall*, *long*), a verb EWT does not attest as a verb in that form (*sank*), a nominal predicate (*painting*), and a sentence-parse versus clause-parse disagreement (*designed*).

**The witness is a GATE, not a second amplitude (Callimachus's two-reader rule).** The clause witness's bindings and this parse are both EWT-derived, so they are not independent. The role witness therefore removes bindings. It never adds amplitude. The independent witness in this repo stays `relations.js` (the engine witness).

**The rule, structural, with no constant.** For a clause slot with a sentence `S`, the relation token `r` in it (the token the relation test accepted, as it stands in `S`), and a candidate filler `f`:
1. `readClause(S, address, { model, predForm: r })`.
2. A **refusal** or an `untrusted` claim is typed `role_refused`, with its reason counted.
3. Otherwise the arguments are `A = [subj, obj, ...obls]` (UTF-16 spans into `S`). The filler's span must lie **inside** one argument `a_f`.
4. The anchor must lie in a **different** argument `a_a`. If the anchor is not written in `S`, it was reached by kind or pronoun, so it is *implied* by the predicate's subject; then the filler need only lie inside **some** argument. The count of such slots is reported separately.
5. A filler that passes 3 and 4 is **co-argument** with the anchor of the relation's predicate: it fills a role of the same predicate and not a neighbour clause.

**Arms (each against L1.2, on V1–V4; replayed on the clean recording; relation-counterfactual Born null as in L2d):**
- **L3-soft** (the additive reading): a binding is removed only on **positive** evidence: a successful parse in which the filler is *not* a co-argument. A refusal leaves the binding as L2d had it.
- **L3-strict**: a refusal also removes the binding. Reported as the ablation: it measures what the parse's refusals cost.
- **L3-noengine**: L3-soft with the engine witness removed.

**Reported, not decided on:** refusals by typed reason; slots passed / removed / refused; for each ask the filler with the greatest mass and whether it is gold (a diagnostic only; the decision is made by the null).

**Honest expectation, stated now:** every adjectival or measure relation (*tall*, *long*) refuses, so the measure asks will stay informative gaps under L3-strict, and under L3-soft will behave as in L2d (contested). The experiment may therefore move only the person, date and thing asks. A null result (identical to L1.2) is as informative as a gain and will be reported as such.

**Vendoring:** the parse prior is 16 MB, node-only, and the eval is node-only. L3 imports `readClause` and `loadModel` from a khora checkout (the commit above) and does not vendor them into the-fold. The browser surface would reach this witness through the khora's door.

## Clarification 12.1 (2026-10-14): which accepted token is the predicate. Written after the first L3 run was read on dev rows only; no held row has been looked at.

**First L3 run (all three arms identical to L1.2).** The role gate refused 19 of 21 dev slots. A trace of the predicate forms passed to `readClause` showed:
1. **A wiring error, mine.** Amendment 12 says the predicate is "the token the relation test accepted". The relation words of "Apollo 11 land on the Moon" are *land* and *Moon* (the title door resolved only "Apollo 11", so *Moon* is a leftover content word). The first accepted token in 11 slots was the noun **Moon**, which is not a predicate. The same happened with *Sinks* (a TV series title) and *sinking* (a noun).
2. **A parser coverage limit, not mine.** `sank` is refused as "a word EWT never attests as a verb": the parser's prior does not hold that irregular past form (the full treebank has it once, so it is presumably outside the training split). It is a typed refusal and is left as one.

**The clarification.** Among the clause's accepted relation tokens, the predicate is the first whose **EWT gold UPOS is majority VERB or AUX** (the same `ewt()` table the relation test already uses, so no new source). If none is, the slot is typed `no_verb_relation`, which the gate counts apart from parser refusals. The role rule, the arms, the bars and the null are unchanged. The three arms are re-run once on this wiring and reported beside the first run, which is kept.

**Separate finding, not fixed here:** the declared void's `relation` words include participant nouns (*Moon*) when the title door resolves a shorter anchor. That is an L1 matter (the leftover content words of the ask are not all relations) and goes in its own amendment.

## Amendment 13 (2026-10-14): L4, the anchor is a CORE argument of the claim; and L1.3, relation words from the predicate that is a predicate. Written after the L3 null and after probing `readClause` on five specimen sentences; before any arm runs.

**What was learned (probe, khora main @ a227897f; Callimachus supplied the morphology backoff and the voice-normalised `slotsOf`):**
- With the morphology prior (`loadModel(parser, { morphology })`) the plain irregular past *sank* parses: subject *The Titanic*, oblique *on 15 April 1912*. Without it, it was a refusal.
- *awarded the patent for the invention of the telephone in 1876*: the anchor *telephone* lies **inside the object's adjunct** (`obj.adjuncts`), not in the object. *invented the telephone* (active): the anchor is the object itself. *The telephone was invented by Bell* (passive): the anchor is the subject. So the question "is this claim about the anchor?" has a **structural** answer: is the anchor a core argument or only something a core argument's adjunct mentions?

**L4's rule, with no constant.** On a successful parse (the L3 gate's refusals are unchanged, and under L3-soft a refusal keeps the binding), the anchor, **as written in the sentence**, must lie inside the span of the subject or the object (the passive's by-oblique is the agent) and **not** inside any of that argument's `adjuncts` or `appositives`. A filler must lie in a **different** argument than the anchor. An anchor that is only inside an adjunct or an oblique fails: the claim is *about something else* that mentions the anchor. When the anchor is not written in the sentence (reached by kind or pronoun) the L3 weak rule applies and is counted apart, as before.

**L1.3 (relation words).** The declared void's `relationWords` contain every leftover content word of the ask; *Moon* in "land on the Moon" became a "relation". For the fill (not for the declared void's `relation` field, which is scored as before), the relation words are the leftover words whose **EWT gold UPOS is majority VERB, AUX or ADJ**, plus the role noun. A leftover word that is majority NOUN or PROPN is a participant, not a relation. If nothing is left, the role noun alone.

**Arms (each against L1.2, replayed on the clean recording; relation-counterfactual Born null; V1–V4):**
- **L3m**: L3-soft with the morphology backoff. Measures only the coverage fix.
- **L4**: L3m + the core-anchor rule.
- **L4r**: L4 + L1.3. The arm that tests whether the contaminated relation test was the larger lever.

**Reported:** per arm, passes by the strong form (anchor written, core, different argument) and the weak form; removals by rule; refusals by reason; each ask's top two fillers and whether the verdict is bound, contested or unbound. The number of **strong-form passes** is the arm's power, and an arm with fewer than **10** strong-form slots across dev and held is reported as underpowered and is not read as a refutation. (10 is the count that would let one in ten slots move a rate of 0.1; it is reported, not tuned.)

**Admission.** An arm is admitted only if its Useful is at least L1.2's on dev and on held, and WRONG is no higher, with at least one set strictly better.

## Amendment 14 (2026-10-14): L5, the keyed door. Written after the Wikidata feasibility probe (RESULTS.md, f2d14d4) and after the user's rule; before anything is built or run.

**The user's direction:** "make it so", and: "kinds have specific parameters (keys) that's what makes them a kind."

**Why.** The probe (property-label search over all of Wikidata, filtered by presence on the entity) held the gold for 26 of 55 answerable asks, against 12 answered by the best prose arm. Its failures were choice of property: a verb with no noun label (*wrote*), a wrong licensed property (*completed* → *inception*). The user's rule says what constrains that choice: **a kind is its parameters**. The anchor's kind licenses exactly the keys it has; a relation is a parameter of the kind or it is nothing.

**The door, with no table and no constant.**
1. **Identity.** L1.2's anchor title → its Wikipedia `pageprops.wikibase_item` (exact; no search) → the item's claims.
2. **The kind's parameters** (khora `terrainInduction` evidence: `structural_feature`, `featureKey` = property id):
   - the item's own keys (the property ids it carries); and
   - the **declared parameters of each of its classes**: `P31` → class item → `P1963` ("properties for this type").
   Their union is the kind's key set. A key the class declares and the item lacks is a **typed void**: *the kind has this parameter; this instance has no value*.
3. **Matching the relation to a key.** Fetch labels and aliases of the key set. A relation word (the ask's relation words, its role noun, its question words) matches a key when it equals the key's label or an alias, or shares a lemma with a token of either (khora `sameAct` over the received morphology prior; EWT gold lemmas). **No derivation table**: *wrote* does not match *author* unless an alias says so, and that is a typed refusal, not a guess.
4. **The property's own value type is the `admits` kind.** `time` for date/era/year asks; `quantity` for length/count/mass; `wikibase-item` for person/place/thing. A matched key of another datatype is refused.
5. **Values and verdict (Nagarjuna's four corners, `hl.js`).** One value: bound. More than one value for a property Wikidata marks single-valued (a `P2302` single-value constraint, `Q19474404`): contested. More than one for a non-single-valued property: bound as the **set**. No value for a declared key: the typed void above (neither). No key matches: unbound, listing the kind's keys of the right datatype as the open void.
6. **The answer line is mechanical.** `<anchor> — <property label>: <value>` (a time is rendered at its own recorded precision). Its grounds are the statement address (`Q…#P…`), not a source sentence: it is a claim, not a snip. Callimachus's `realizeClaim` is the paraphrase, later.

**Arms (each replayed from a sha-pinned recording of the Wikipedia and Wikidata responses; additive: an L0 answer is never replaced):**
- **L5-keyed**: the door as above.
- **L5-open** (the ablation of the user's rule): the property candidates come from Wikidata's property-label search over **all** properties, not the kind's keys, then are filtered by presence on the entity (the probe's method). If L5-keyed does not beat L5-open, the rule "a kind is its keys" has not earned its place in this door.
- **L5-keyed + L1.2** is what is scored; L5 only speaks where L0 had no answer.

**Admission** against L1.2, as before: Useful at least L1.2's on dev and on held, WRONG no higher, at least one set strictly better. Reported besides: asks where the kind had the key but the instance no value; asks refused for no matching key (the lexical failures, by relation word); the gold-present ceiling from the probe, so the gap between "present" and "answered" is visible.

**Declared limits:** one hop of classes (`P31`, not `P279`); English labels and aliases only; the encyclopedia's `wikibase_item` is the identity witness (a second one, a Wikidata `sitelink` check, is reported, not required).

## Clarification 14.1 (2026-10-14): which words may name a key. Written after the first L5 run was read on dev rows (3 WRONG) and held aggregates only (1 → 5 WRONG); before any re-run.

**First L5 run.** L5-keyed: RIGHT dev 7 → 19, held 5 → 15; WRONG dev 0 → 3, held 1 → 5; Useful dev 21 → 22, held 19 → 20. L5-open: RIGHT 16 / 13, WRONG 1 / 5. Admission fails on V2 (WRONG rose). The ablation holds: keyed has more RIGHT than open on both sets (19 vs 16, 15 vs 13).

**Dev WRONG specimens, traced** (each a leak in which words may license a key, none a property-choice failure):
1. *Where is Machu Picchu located?* → **instance of**, *Where was Albert Einstein born?* → **languages spoken**: the interrogative *where* licensed a key by "sharing a lemma". Cause: EWT's gold lemma set for *where* includes `be` (from *where's*) and for *of* includes `have`, `or`. A closed-class word is bridged to an unrelated label token through a closed-class lemma.
2. *Who was the first president of Antarctica?* (a false premise) → **discoverer or inventor**: the bare modifier *first* shares a token with an alias.

**The clarification (structural; no constant).**
- **Content tokens only.** A word may name a key only if its EWT gold UPOS is majority open-class (NOUN, PROPN, VERB, ADJ, ADV, NUM); the key's label/alias tokens are held to the same rule. Interrogatives and the khora's closed-class words never name a key. The lemma overlap is taken **only between the dominant lemma of each content word** (the lemma of its majority-UPOS entry), not the whole lemma set.
- **A modifier is not a relation.** When the relation words include a word that is majority NOUN or VERB, the words that are majority ADJ or NUM are dropped (*first*, *official*, *tallest*). If every relation word is ADJ (*tall*), it is kept.
- The arms, the null, the admission rule and V1–V6 are unchanged. L5-keyed and L5-open are re-run once on the clarified matcher (the first run is kept in RESULTS beside it).

## Amendment 15 (2026-10-14): the principle, and the door's out-grammar. Written and built the same turn; it changes no scored output.

**The user's direction:** "we need to respect every language's grammar; we can go from any grammar in to EOT and out to any grammar and language as we want."

- **EOT is the pivot.** English is one output grammar. The words "englished" and "P-id → English label" in earlier text of this file mean a language-free claim rendered for one target. A language with no declared grammar is `no_grammar_for_language`, never a fall-through to English.
- **The keyed door emits a language-free claim** (`EOClaim@1`: anchor Q-id, property P-id with datatype, typed values, `Q…#P…` grounds). The line a person reads is `realizeClaim(claim, { lang, labels })`: item and property labels in that language (Wikidata, `languages=xx|en`), dates and numbers through CLDR (`Intl`) in that language, and the colon and full stop of the language's script (CJK full-width). Identity is the question's own Wikipedia edition.
- **Declared, not measured:** `en` formats dates as en-GB (day month year, as the battery's gold shows), and the CJK punctuation set.
- **Scored behaviour is unchanged:** L5-keyed replays identically (dev RIGHT 18 / WRONG 1 / Useful 23; held 15 / 2 / 22). `fold-chat-void-keyed.test.mjs` 9/9; mutants killed: datatype gate off, English host pinned, dates always English, open-class filter off, declared interrogatives ignored (one more, the label fallback, is equivalent: the claim's label is already in the language).
- **Not measured, and said so:** no non-English ask has been run end to end; no SOV question has been read by the slot frame; the door's relation-to-key matching in another language uses that language's labels and aliases but, in the arm, still the EWT POS prior. The omnilingual battery (`eval/omnilingual`) covers es and fr only. The plan to change this is in VOID-WORK.md "Omnilingual".

## Amendment 16 (2026-10-14): the door on a non-English battery. Written after the Wikidata label and alias spot-check of the gold ids and before any arm ran on `battery-intl.mjs`.

**What this is.** The omnilingual falsification of the keyed door, in the shape `eval/omnilingual` set: a matrix of asks against languages, each fall assigned a **named cause**, and nothing tuned. It is a measurement, not an admission trial: no layer is admitted or refused by it.

**Battery (`battery-intl.mjs`, frozen at the sha in `battery-intl.sha`).** Six asks (capital of Australia, capital of Canada, creator of the Mona Lisa, opening date of the Sydney Opera House, place of birth of Mozart, currency of Japan) in English as the control and in es, fr, de, ru, ja, ko, tr, hi: **54 rows**. Gold is language-free: a property id (`P36`…) and a value item id, or a year. The questions are the author's and not native-reviewed (declared). They use the noun form of the relation so that the language question is separated from the verb → noun derivation gap (a verb stratum is future work). The Sydney Opera House ask is dated, and Mozart is named by his full name so that no edition resolves a disambiguation page.

**Scoring, on the EOT claim, never on the surface string.**
- **RIGHT:** the door is bound, the claim's property id equals `goldP`, and the claim's value is an item in `goldQ` (or a time whose year equals `goldYear`).
- **WRONG:** bound, and not RIGHT. Reported with whether the property was right.
- **GAP, with a named cause**, assigned mechanically from the door's own refusal:
  - **GRAMMAR**: no declared question grammar for the language (the production path);
  - **ANCHOR**: no entity resolved for any candidate run of the ask in that language's edition (segmentation or title door);
  - **LABEL**: the item has keys but none matches a word of the ask in the language (lexical coverage of Wikidata labels and aliases, or the language's morphology);
  - **TYPE**: a key matched and its datatype is refused;
  - **NOVAL**: the kind declares the key and the instance has no value;
  - **CONTEST**: more than one value for a single-valued property.

**Arms.**
- **intl-L0:** the production path (`runSlotTurn` with the detected language): expected `no_grammar_for_language` for every non-English row. It is the baseline and the proof of the gap.
- **intl-door:** the keyed door with no slot reader (the question's interrogative is not needed to know what kind of value a property holds), through:
  - **segmentation:** ICU/CLDR `Intl.Segmenter(lang, word)`, a received facility, declared;
  - **open-class words:** the language's own POS prior (`janus/priors/pos-<iso3>.json`: spa, fra, deu, rus, jpn, kor, tur, hin; eng for the control), dominant UPOS, closed class = ADP, DET, AUX, PRON, CCONJ, SCONJ, PART, PUNCT, SYM;
  - **anchor:** candidate runs of up to five segments, content edges, whitespace or none between them, the longest non-overlapping run that the language's own edition's title door resolves; for the two agglutinative languages in the battery (**ko, tr**: declared), every prefix of two characters or more of a run is also a candidate, and the title door is the witness (the longest resolving prefix wins);
  - **identity:** that edition's `wikibase_item`; **labels and aliases** in that language, English as fallback;
  - **relation to key:** exact equality of the ask's open-class word with the key's label or alias, or with a token of one (casefolded, NFKC): **no lemmatizer for any language but English** (none is received for the others), so the English control uses the dominant EWT lemma and the others do not (declared asymmetry, reported as a cause when it bites);
  - no admits gate (there is no slot reader): the property's own datatype stands.
- **Control inside intl-door:** the six English rows, through the same code, so "slot-free" and "language" are separable.

**Reported:** the language × ask matrix with the cause of every non-RIGHT cell; per language RIGHT / WRONG / GAP counts; per cause counts; for each LABEL gap, the open void (the kind's keys of the matching datatype), because that is the lexicon the door lacks; the `Intl` realization of every bound claim in its own language (so the out-grammar is visible on the same rows).

**Not claimed:** nothing about verbs, about questions without the interrogative being read, or about native acceptability of the questions.

## Clarification 16.1 (2026-10-14): three defects in the first omnilingual run, found by the English control. Written after the first run was read in full (the matrix is a full report, there is no held split here); before the second run.

**First run (kept as `results-intl-run1.json`):** English control 2 RIGHT / 2 WRONG / 2 GAP, es 3/2/1, fr 0/2/4, de 6/0/0, ru 0/1/5, ja 3/0/3, ko 0/0/6, tr 1/2/3, hi 4/0/2; production `no_grammar_for_language` on all 48 non-English rows. Causes: LABEL 24, RIGHT 19, WRONG:PROPERTY 9, ANCHOR 2.

**The control is the instrument.** The English slot-reader arm already answers "capital of Australia" and "place of birth of Mozart"; the slot-free door on the same English words did not. Three defects of the new front end, each visible in the English rows:
1. **The anchor was discarded by my own containment rule.** *capital of Australia* resolves, in every edition, as a redirect to **Canberra** (askFrame's `agrees` rule exists for this). The Amendment's "longest non-overlapping run wins" kept that run and dropped *Australia*, so the item tried had no capital key. The arbiter that the Amendment itself names (the entity whose kind has the key the rest of the ask names) can only work if every resolved entity is tried. **Fix:** try every distinct resolved **title** (deduplicated), longest run first, up to six.
2. **Two keys matched the same word and the door took the first.** *place of birth* and *date of birth* both match *birth*; with no slot reader nothing preferred *place* (the ask has the word). **Fix:** among matched keys with values, rank by **label coverage**: the share of the label's open-class tokens that the ask's words equal, then the count of ask words matched. A tie between keys whose values differ is `CONTEST` between properties, never an arbitrary pick. No constant.
3. **A suffix glued to the noun** (ko 수도는, tr başkenti): the ask word is the label token plus a particle or possessive. **Fix, for the declared agglutinative languages only (ko, tr):** an ask word matches a label token when the word **begins with** the token (at least 2 characters). The label is the witness, exactly as the title door was for the anchor prefixes.

Both runs are reported. The second run's arms, scoring and causes are unchanged. The Amendment's claim that the language question and the slot-free question are separable is now tested properly: the English control is read first.

## Amendment 17 (2026-10-14): anchor-selection leak and the identifier key. Written after reading the second omnilingual run's five WRONG cells; before the third run. Same frozen battery, same recording (replay only; any miss is reported, not fetched).

**Defects (named causes in `results-intl.json`):** (a) a run nested inside a longer run that itself names an entity (*Sydney* inside *Sydney Opera House*) is tried as an anchor when the longer entity's kind lacks the matched key, and the shorter entity answers a different question (fr/tr/ru opening-syd, P571 of Sydney); (b) an external-identifier property (datatype `external-id`, e.g. P2963 Goodreads author ID) matches an ask word by label (ko 작가).

**Rules:**
1. **Nested-anchor rejection.** A resolved anchor whose span lies strictly inside another resolved run's span is not tried when that longer run's title equals its own surface (casefolded, NFKC): the longer run names an entity, and the shorter one is a modifier of it. A longer run that redirects (title ≠ surface, e.g. *capital of Australia* → Canberra) does **not** reject the nested anchor.
2. **Identifier keys are not relations.** In slot-free mode a key whose datatype is `external-id` is dropped from the match set before ranking. (A relation answered with an identifier string is never what a question asks for.)

**Expected:** the 4 WRONG:PROPERTY cells become GAP or RIGHT; WRONG falls from 5 to ≤ 1; RIGHT does not fall (any RIGHT cell lost is reported with its cause). **No tuned parameters.** If RIGHT falls or WRONG does not, the rule is reported refuted and reverted.

### Amendment 17 outcome (replay, same recording; 11 replay misses reported, not fetched)

- **Rule 2 (identifier keys are not relations): HELD.** ko creator-mona WRONG:PROPERTY → GAP:TYPE. RIGHT 38 → 38, WRONG 5 → 4, no cell lost.
- **Rule 1 (nested-anchor rejection): REFUTED, REVERTED**, as pre-registered. With it RIGHT fell 38 → 37 (fr currency-jp: *Japon* nested in the entity-page *Monnaie du Japon*, a relation phrase that is itself a page) and WRONG did not fall (fr/tr/ru opening-syd persist). Diagnosis from the traces: the leaking anchors are not nested in an equal-title longer run; they are **other entities the ask's words happen to resolve to** (fr *Quelle* → Karstadt, whose item has P571; ru *оперы* → Опера; tr *Sidney*, *Opera*). Containment is the wrong witness; what the right anchor has is that it is the entity that satisfies the *most* of the ask's words (anchor + key together), which is a coverage rank across anchors, not a nesting test.
- **Open, not built:** rank candidate anchors by joint coverage (anchor surface ∪ matched key label tokens over the ask's open-class words); a closed-class-but-capitalised word (*Quelle*) is not an anchor candidate (needs the per-language closed-class prior, the same missing lemma/POS prior as ru/fr).
