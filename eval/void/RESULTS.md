# The void, layer by layer: results (eval/void/PREREG.md)

Every figure here is from the offline replay of the recording (byte-exact: 0 live fetches, 0 misses). Held rows are reported as aggregates only.

## L0: the pipeline as merged (main @ 50ce24c)

| | RIGHT | WRONG | GAP (informative) | Useful |
|---|---|---|---|---|
| dev | 5 | 0 | 24 (1) | 6 |
| held | 2 | 1 | 26 (2) | 4 |

The three informative gaps are the false-premise asks, where any gap counts. Dev losses: 13 `referents_unresolved`, 7 `not_a_slot_ask` (no wh-word at the front), 3 contested or refused, 1 `unwitnessed` (Sydney).

## L1: the declared void (perception + grammar + pathos). **Admitted.**

| | RIGHT | WRONG | GAP (informative) | Useful | void-null p95 |
|---|---|---|---|---|---|
| dev | 5 | 0 | 24 (11) | **16** | 7 |
| held | 2 | 1 | 26 (12) | **14** | 5 |

Void fields declared right (dev / held, of 29): slot 28 / 28 · admits 21 / 20 · anchor 22 / 21 · relation 15 / 17 · cardinality 28 / 24.

- **V1** (Useful ↑: dev 6→16, held 4→14), **V2** (WRONG not ↑), **V3** (RIGHT not ↓), **V4** (above the void-null p95 on both sets) and **V6** (no model host fetched: Wikipedia, the cited pages and the page relay only) all hold. V5 does not apply at one layer.
- **What it does not do, by design:**
  - `admits` for a role noun stays the noun itself ("capital"), never a guessed kind; kind-induction over the universe is L2/L3's job.
  - A bare "⟨Name⟩ ⟨role⟩" ("Hamlet author") gets its slot but no anchor. This is a typed gap, pinned by a test that flips when L2 closes it.
- **Tests:** `fold-chat-void-declare.test.mjs` 9/9; 5 mutants all killed (front-only interrogative, no measure words, a role→kind table sneaked in, no experiencer, no perceiver witness).

## L2: the referent's universe (clause edges, kinds, sameAct). **Not admitted: V2 fails on held.**

| | RIGHT | WRONG | GAP (informative) | Useful |
|---|---|---|---|---|
| dev | 6 (+1) | 0 | 23 (10) | 16 (=) |
| held | 2 (=) | **2 (+1)** | 25 (12) | 14 (=) |

- V2 (WRONG never rises) fails on held. Per the pre-registration, the held row is not read; aggregates only.
- **Dev trace, why L2 earns so little:**
  - Of the 22 dev asks L2 reached, 19 bound **no edge**.
  - Its hand-built kinds are mostly noise ("choos", "known", "victim", "articl").
  - The edge it did bind (Apollo 11 → 1969) is the one new RIGHT.
  - The Titanic shows the contest working as designed: 15 April 1912 ×3 against 31 December 2025 ×1 stays a contest gap, not an answer.
- **Diagnosis:** the kind and binding rules were written by hand (a copula regex, page-subject continuity, nearest argument), where the cube map (`fold-rules/cube-map/MAP.md`) already names a FILLED organ for each cell: SIG·Figure `cast.js`, NUL/SIG·Pattern `entity-kind-induction` with its null, CON·Figure `makeRelationReader`, EVA·Pattern `contest.adjudicate`, SIG·Ground `void-loop.whatWouldSettle`. The next amendment replaces the hand rules with those organs, induction across all terrains (the user's direction), before any re-run.
- khora's `kind-induction` was renamed `terrainInduction` (khora `terrain-induction` @ c12416c2) and re-vendored. The L2 replay after the rename is identical.

## L1.1: the longest name (both witnesses). **Admitted (marginally).**

| | RIGHT | WRONG | Useful | void-null p95 |
|---|---|---|---|---|
| dev | 5 | 0 | 16 (=) | 7 |
| held | 2 | 1 | **15** (+1) | 5 |

- V1–V4 hold. On dev **nothing changed**, and the specimen it was built for (Pride and Prejudice) did not fire. The khora perceiver splits names at function words (`["Pride","Prejudice"]`, `["One Hundred Years","Solitude"]`), so no perceived surface contains the door's anchor. The longer name lives in askFrame's own title-door runs, which allow an inner function word. That is Amendment 9's L1.2.

## L2′: the Born parliament (clause + engine), logos order, four corners. **Not admitted: it adds nothing (V1 is not strictly earned; RIGHT and WRONG are unchanged).**

Dev and held are identical to L1.1: no new RIGHT and no new WRONG. It is safe, and it earns nothing. Dev traces:

- **The engine witness is noise.** "who wrote Pride and Prejudice" gives *dismissal* (M = 4); "who composed The Four Seasons" gives *county*; "where was Einstein born" gives *lieserl einstein*. Causes:
  - anchor co-reference is too loose (`namesCorefer` with no `witness` lets "Prejudice" stand for "Pride and Prejudice");
  - an edge counts as its own instance even when it shares a sentence with others (Pearl);
  - edge direction is ignored.
- **The Born null as written blocks right bindings.** Titanic: "15 April 1912" is bound by 3 independent clauses (M = 3), but the null's top over *all* candidates reaches 3, because 1912 is on every line of the page and chance placement recreates the binding. Apollo 11's "1969" (M 1.5 against a null of 2) is blocked the same way. The comparison should be **per candidate**: is *this* candidate bound more than its own frequency in the universe predicts?
- **The order check refused 3 to 83 slots per ask.** Callimachus (CALLIMACHUS.md §6) measured chain closure over grammar-feature cells as **non-discriminating** (real 4.2% against shuffled 4.6%). Over the void's own fields its value is unmeasured. The pre-registered order-off arm must run before it is trusted.
- `null_unbuildable` was reached on the no-wh asks whose anchor L1 could not read: the gap is correctly typed, never a guess.


---

# CLEAN RESULTS (Amendment 10): every arm re-recorded after 84 rate-limit 429s were found frozen into the first recording

**Everything above this line was measured on a contaminated recording and is superseded.** The decisions are re-made on these figures, by the same bars. Replay is byte-exact (0 live fetches); 6 misses per arm remain, all citation follow-ups to external sites through the relay (onlinenevada.org, doi.org, washingtonpost.com) that failed the same way while recording, so record and replay agree.

| arm | dev RIGHT / WRONG / inf. gap / **Useful** | held RIGHT / WRONG / inf. gap / **Useful** | void-null p95 (dev / held) | standing |
|---|---|---|---|---|
| L0, the pipeline as merged | 7 / 0 / 1 / **8** | 5 / 1 / 2 / **7** | | baseline |
| L1, the declared void | 7 / 0 / 13 / **20** | 5 / 1 / 13 / **18** | 9 / 8 | **admitted** (+12 dev, +11 held) |
| L1.1, longest perceived name | 7 / 0 / 13 / **20** | 5 / 1 / 14 / **19** | 9 / 8 | admitted (held +1) |
| L1.2, longest name from the ask's own runs | 7 / 0 / 14 / **21** | 5 / 1 / 14 / **19** | 9 / 8 | **admitted** (dev +1; Pride and Prejudice now anchors correctly) |
| L2, clause universe, hand rules | 8 / 0 / 12 / **20** | 6 / **4** / 11 / **17** | | **not admitted**: V2 fails on held (WRONG 1 → 4), and Useful falls below L1.2 |
| L2′ (L1.1 + Born parliament) | 7 / 0 / 13 / **20** | 5 / 1 / 14 / **19** | | **not admitted**: nothing above L1.1 |
| L2c (L1.2 + strict engine, sentence instances, per-candidate null, order on) | 7 / 0 / 14 / **21** | 5 / 1 / 14 / **19** | | **not admitted**: identical to L1.2 |
| L2c-noorder (order check off) | identical to L2c | identical to L2c | | the order check removes nothing and adds nothing here |
| L2d (L2c + relation-counterfactual null) | identical to L2c | identical to L2c | | **not admitted**: identical to L1.2 |

## What the clean numbers say

- **The contaminated recording understated the baseline.** L0 was RIGHT 5 / useful 6 dev; clean it is RIGHT 7 / useful 8. L1's gain is still large and still real: +12 useful on dev, +11 on held, well above the void-null p95 (9 and 8).
- **L1.2 is the last admitted stack**: Useful 21 / 19, WRONG 0 / 1, and its anchor repairs are visible (Pride and Prejudice → "Pride and Prejudice").
- **L2c's order-off arm is identical to L2c:** the order check (Amendment 6) neither protects nor costs anything on this battery, as Callimachus measured on its own corpus (chain closure over grammar-feature cells does not discriminate real text from shuffled). It stays off the gating path until a measure says otherwise (Amendment 9 (4)).
- **L2d did what it was built to do, and it does not matter.** Under the relation-counterfactual null, the right fillers can become probable (Gray for the telephone; both 300 mi and 97 cm for the Nile), but each ask then has **two** probable fillers, so the verdict is *contested*, never an answer. The null licenses a filler; it cannot choose between two fillers that are both licensed. That is the missing witness: something that says *which* licensed filler fills **this** slot.
- **The right filler is present and unbound.** On dev, the correct value sits in the recorded pages for most of the asks that L2 reached (see `solvable`), and the witnesses cannot tell the slot's filler from the other values on the page. Callimachus's drive evaluation (khora PR #12) reached the same finding from the other end: gold is in the copied bytes on 22 to 24 of 48 records, the claims picked are *about* the figure rather than *filling the slot*, and its contest bound 5 times and was wrong all 5.

## What this settles, and what it leaves open

- **Settled:** declaring the void and what would satisfy it (L1 → L1.2) is a large, real, null-beating gain; and every layer built on the hand rules or the engine's name-to-name edges adds nothing and sometimes adds wrong answers. The order check is not yet a measured protection.
- **Open, named, and the same for both sides:** a **slot-fill witness**. Candidate designs, to be pre-registered before any is built:
  1. the declared void's `admits` as a *kind gate* read from the filler's own page (is "gray" a person? is "may" a place?) via khora `terrainInduction`;
  2. a **syntactic role witness**: the filler is the argument of the relation token's own clause in the UD EWT parse (the Callimachus english-parser), not merely co-present;
  3. Callimachus's clause segmentation (merged, PR #10) as the unit instead of my hand-cut clauses.

## L3: the slot-fill role witness (Amendment 12, Clarification 12.1). **Not admitted: identical to L1.2 in all three arms.**

| arm | dev RIGHT / WRONG / Useful | held RIGHT / WRONG / Useful |
|---|---|---|
| L1.2 (last admitted) | 7 / 0 / 21 | 5 / 1 / 19 |
| L3-soft, L3-strict, L3-noengine | 7 / 0 / 21 | 5 / 1 / 19 |

**What the gate did (dev + held, per candidate filler):** passed 12, removed 3, refused 33. Of the 33 refusals, 18 `no_verb_relation`, 8 `untrusted_parse`, 4 the verb is not attested in EWT (*sank* among them), 2 the predicate sits in a subordinate clause (so the sentence does not assert it), 1 a clause-parse disagreement. L3-strict equals L3-soft because the slots the parse refused never carried the right filler.

**How little this test had power to show.** Of the 12 passes, **11 were the weak form** (the anchor was reached by kind or pronoun and not written in the sentence, so the rule collapses to "the filler is inside some argument"). One slot got the real test (anchor and filler in different arguments). The gate removed 3 candidates in total. So this is **not a refutation of "co-argument of the predicate"**: it is an experiment whose discriminating test ran on one slot. What it does show:
- a clean parse was available for 23 of the 30 verb-relation slots, so a role witness is *buildable* on this battery: the earlier collapse was my wiring, which Clarification 12.1 fixed;
- readable predicates were mostly **not** the problem: the telephone's *invented* parsed, and both Bell and Gray (1876) are genuine arguments of it. Two true co-arguments with the same value cannot be separated by grammar.

**Where this leaves the open gap.** The remaining ambiguity in dev is between fillers that are *both* legitimate arguments of the relation: they differ in **whose claim it is**, i.e. which referent the clause is about. The unspent test is the **subject agreement** one: the anchor is the claim's subject (or, in the passive, the by-phrase's patient) and the filler is its object or oblique. It needs the parse's roles, which `readClause` already returns (`claim.voice`, `subj`, `obj`, `obls`). To be pre-registered before it is built.

**Not run, flagged:** the L1 matter found in the trace (the declared relation words include a leftover noun such as *Moon*) is still open and may be the larger lever: it contaminates every L2-family arm's relation test.

## Feasibility probe, not an arm: the structured door (Wikidata) answers by identity (`probe-wikidata.mjs`, 2026-10-14)

The old notes (project_fold_referent_identity_givers, Sep 2026) had already measured that the string and edge tiers cannot answer a slot ask ("the label slot is filled by non-verbs"), and had answered it by identity instead: Wikidata QIDs and typed, dated properties, with `hl.js` returning CONTESTED when a functional relation has more than one value. That door was never connected to the-fold's slot pipeline (the-fold's only Wikidata uses are origin/primary/hosts; khora's `current-holder.js` handles office-holders only).

Probe: anchor = the battery's gold anchor title (a real run would use L1.2's anchor); property candidates = Wikidata **property-label search** with the ask's own non-anchor words (no property table); fillers = those properties' statement values, labels resolved.

| | asks | any value | gold present |
|---|---|---|---|
| the 55 answerable asks (3 false-premise asks excluded) | 55 | 45 | **26** |

For comparison, the best prose arm (L0 through L1.2) answers 12 of the 55 (7 dev + 5 held RIGHT). The gold is present as a **value of a typed property of the right entity** for 26.

What it gets right: *capital* (Canberra, Ottawa, Ankara, Bern, Wellington), *date of official opening*, *inception*, *date of birth / place of birth*, *creator*, *director*, *founder*, *author*, *currency*, *height*. The unambiguous ones come out with no contested fillers.

What fails, and why (each is a lexical or choice problem, not a retrieval one):
1. **Verb → property.** *wrote*, *composed*, *invented*, *designed*, *sank* match no property label (the labels are nouns: author, composer, inventor). The bridge is a derivation (write → writer/author, invent → inventor) and a property's **aliases**. Not tabled, not yet measured.
2. **The wrong property is licensed.** *completed* matched *inception* (1887, construction start) for the Eiffel Tower, which is not 1889. Label search offers candidates; it does not say which one the *relation* names.
3. **Quantity slots** give the wrong dimension or a part (*has part(s)* for "how many strings").
4. **Entity resolution** needs L1.2's anchor, not the gold title (done here only to isolate the property step).

**What this settles:** the hang-up is not witnesses or nulls. The prose tiers choose among co-present values with no way to know which value is the *property's*; the structured door has the typed value already, and the open problem is choosing the **property**, a closed, small, label-addressed space. That is a different and far more tractable gap than the one L2–L4 were attacking.

## L4 (anchor must be a core argument, morphology backoff, verbal relation words): **not admitted, identical to L1.2** (`L3m`, `L4`, `L4r`)

All three arms: dev RIGHT 7 / WRONG 0 / Useful 21, held 5 / 1 / 19. Gate: passed 15 (12 the weak "implied anchor" form), removed 3, refused 30. **Strong-form passes: 3**, below the pre-registered 10, so the arms are **underpowered** and the null is not a refutation. The morphology backoff made *sank* parse; the L1 relation-word fix (Amendment 13's L1.3) changed nothing in outcome.

## L5: the keyed door (Amendment 14, Clarification 14.1). **Not admitted under the rule as written: WRONG is one higher on each set. RIGHT more than doubles.**

First run (before Clarification 14.1) is kept: L5-keyed dev RIGHT 19 / WRONG 3 / Useful 22, held 15 / 5 / 20; L5-open 16 / 1 / 23 and 13 / 5 / 20. Its wrongs were closed-class lemma leaks (`where` → `be`, `of` → `have` in EWT's gold lemma sets) and a bare modifier (*first*).

| arm | dev RIGHT / WRONG / inf. gap / **Useful** | held RIGHT / WRONG / inf. gap / **Useful** |
|---|---|---|
| L1.2 (last admitted) | 7 / 0 / 14 / **21** | 5 / 1 / 14 / **19** |
| **L5-keyed** (14.1) | **18** / 1 / 5 / **23** | **15** / 2 / 7 / **22** |
| L5-open (the ablation) | 15 / 1 / 8 / **23** | 13 / 3 / 8 / **21** |

- **The user's rule holds in the ablation:** keyed beats open on RIGHT on both sets (18 vs 15, 15 vs 13) and on held WRONG (2 vs 3). A kind is its parameters, and restricting a relation to the kind's own keys is better than searching all properties.
- **Where the gain is:** 11 of 12 changed dev rows went from a gap to RIGHT: *capital* (Canberra), *creator* (Leonardo), *author* (Austen, García Márquez, Cervantes), *discoverer or inventor* (Fleming; Bell), *place of birth* (Ulm), *currency* (yen), *length* (6650 km), *UTC date of spacecraft landing* (24 July 1969). 11 of 18 dev RIGHTs and 10 of 15 held RIGHTs are the door's.
- **The one dev WRONG is the battery's gold being narrower than the truth, not a false claim:** *Where is Machu Picchu located?* → "located in the administrative territorial entity: Urubamba Province; Cusco Department; Machupicchu District", while gold is "Peru" (property *country*, which the ask's word *located* does not name). It is a correct, finer-grained answer scored WRONG by a frozen single-filler gold. The gold is not edited.
- **Generosity, declared:** the scorer counts an answer RIGHT if it *contains* an accepted filler. One RIGHT per set is a **set answer** (*who invented the telephone*: Reis; Gray; Bell; Meucci). That is the correct shape for a contested attribution, but it counts as RIGHT, and a stricter scorer would not.
- **What still gaps (dev, typed, each informative):** 6 `no_matching_key` and 2 `datatype_mismatch`. The lexical failures are verbs and adjectives with no noun label: *sink* (the kind's open void lists *service retirement*, *dissolved, abolished or demolished*), *tall* (the open void lists **height**), *composed*, *located* for a country. Each is a derivation (*tall* → *height*, *compose* → *composer*) the door does not guess.
- **The admission rule, as written, is not met** (V2: WRONG dev 0 → 1, held 1 → 2). Whether to relax it for this arm, add a labelled second gold with accepted-sets, or fix the matcher for *located* is the user's decision, not the arm's.

## L5-intl: the omnilingual door (Amendment 16, Clarification 16.1). **38 of 54 RIGHT on 9 languages; no slot reader, no model, no per-language question grammar.**

Battery: 6 asks × 9 languages (en es fr de ru ja ko tr hi), language-free gold (property + Q-id/year), frozen by `battery-intl.sha`. Both runs kept (`results-intl-run1.json`, `results-intl.json`). Replay offline: 1203 hits, 0 misses, 0 live.

| lang | RIGHT | WRONG | GAP | non-RIGHT cells (traced cause) |
|---|---|---|---|---|
| en | 6 | 0 | 0 | control |
| es | 6 | 0 | 0 | |
| de | 6 | 0 | 0 | |
| ja | 4 | 0 | 2 | LABEL creator (作者 matched the title page, not the key), LABEL opening (開館日 has no alias) |
| hi | 4 | 0 | 2 | LABEL creator (रचयिता), LABEL opening (तिथि) |
| ko | 4 | 2 | 0 | WRONG:PROPERTY creator (작가 matched external-id P2963, Goodreads author ID); WRONG:VALUE birthplace (prefix anchor 아마데 resolved to 알폰스 아마데) |
| tr | 5 | 1 | 0 | WRONG:PROPERTY opening (anchor Sidney, P571 inception) |
| fr | 3 | 1 | 2 | LABEL capital (elision l'Australie), ANCHOR creator (La Joconde), WRONG:PROPERTY opening (anchor Sydney, P571) |
| ru | 0 | 1 | 5 | five LABEL/ANCHOR (genitive Австралии has no page; inflection needs a per-language lemma prior); WRONG:PROPERTY opening (Опера) |

Causes: RIGHT 38, LABEL 9, PROPERTY 4, ANCHOR 2, VALUE 1. Production path (L0) on the same asks: answered 1, no_grammar_for_language 48, none 5. The door, not the old slot path, is what answers non-English.

**What this settles.** EOT-as-pivot works at the front end: ICU segmentation + the title door + the kind's keys reach the right claim in es/de perfectly and in ja/hi/ko/tr mostly, with no question grammar. The 5 wrongs are one family, **anchor selection accepts any entity that has a matching key** (it returns the first title whose item has *some* key the rest of the ask names), plus one identifier-datatype leak. Neither is a slot-fill problem.

**Declared asymmetries.** English uses EWT dominant-UPOS and the morphology lemmatizer; the other languages use exact-token match against their own POS prior and no lemmatizer. ru/fr/ja/hi losses are therefore partly the missing per-language morphology prior, not the door.

**Not yet fixed (to pre-register, not built):** prefer the anchor whose title equals the longest run; exclude external-id datatype from relation matching; per-language lemma prior (ru, fr elision); relation lexicon by distant supervision; interrogatives received from UD PronType=Int.

Front-end tests: `fold-chat-void-intl.test.mjs` 6/6 (with `fold-chat-void-keyed.test.mjs` 9/9).

### Amendment 17 (third replay): identifier keys held, nested-anchor rule refuted

Same battery and recording. RIGHT 38 / WRONG 4 / GAP 12 (was 38 / 5 / 11). **Held:** excluding `external-id` keys turns ko creator-mona from a wrong answer (Goodreads ID) into a typed TYPE gap. **Refuted and reverted:** rejecting a run nested in a longer run whose title equals its surface lost fr currency-jp (RIGHT 38 → 37) and did not fix the opening-syd wrongs, whose anchors are unrelated entities the ask's words resolve to (Karstadt for *Quelle*, Опера, Sidney). Next lever, not built: rank candidate anchors by joint coverage of the ask by anchor + matched key. Tests 15/15.
