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
