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
