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
