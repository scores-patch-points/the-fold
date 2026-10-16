# Can the Fold LEARN the sentence patterns that answer a relation question? — pre-registered 2026-10-13, before any harvest or run

## The claim under test

The binder answers "who wrote X", "where was X born", "capital of X" by matching the question's shape to a sentence's shape with
hand-written English rules (`fold-chat-witness.js`, `fold-chat-answerturn.js`). Each failure so far has needed a new hand rule; the open
one is *"Pride and Prejudice is a novel by English author Jane Austen"* not answering *"who wrote"*. Replacing the rules with a small model
at the binder was falsified today (`eval/modelvsrules/`). fold-rules learned checkers and chess by proposing rules and letting the game
refute them; its ledger names the **text gap**: text has no referee (`fold-rules/world/results/frankenstein_khora/REPORT.md`, L27).

**Claim:** with Wikidata as the referee, answer patterns can be *learned* from encyclopedic text, and the learned patterns answer the held-out
relation questions better than the hand-written binder without being wrong more often.

## Two hypotheses, one rule

- **H1 (instead of):** the learned patterns **alone** (arm **P**) against the production binder (arm **R**).
- **H2 (in addition to):** **R∪P** — R's answer when R commits, otherwise P's — against R. This is the form production would take (an
  additive witness: the binder unchanged when the layer is off). **Production code changes only if H2 is SUPPORTED.**

## Relations (scope), fixed now

The relation asks of the English held-out gate set (`eval/gate/chat-heldout.json`) whose answer is a Wikidata item:

| property | ask(s) in the set |
|---|---|
| P50 author | Who wrote Pride and Prejudice? |
| P170 creator | Who painted The Starry Night? |
| P86 composer | Who composed the Moonlight Sonata? |
| P61 discoverer or inventor | Who invented the telephone? · Who developed the theory of general relativity? |
| P19 place of birth | Where was Mozart born? |
| P36 capital | What is the capital of Kenya / Egypt (also Japan, Brazil: no pairs) |
| P37 official language | What language is spoken in Brazil? |
| P38 currency | What currency is used in Japan? |
| P35 head of state | Who is the president of Brazil / Mexico? · Who is the king of Spain? |
| P6 head of government | Who is the chancellor of Germany? (prime minister of India: no pairs) |
| P169 chief executive officer | Who is the CEO of Tesla? (no pairs) |

Out of scope, declared: time-valued asks (Titanic, Berlin Wall, Magna Carta, Moon landing — their values are dates, not items), quantity
asks, superlatives (largest ocean, longest river, tallest mountain), "where is X" (no relation word), the chemical symbol (a string).

**Which property an ask asks for is read mechanically, not assigned by hand.** The cue stems of a property are the `stemOf` stems of the
content tokens of its English label and aliases, read from Wikidata (`wbgetentities`, recorded in RESULTS.md). An ask maps to every in-scope
property one of whose cue stems equals the stem of an ask token outside its referent. Several properties → all are tried ("wrote" reaches
P50 *author* and P86 *composer* through the alias "written by"). An ask that maps to none is out of scope; "Who was the first president of the
United States?" maps to P35/P6 by its cue and is therefore IN scope (the layer may answer it wrongly; that is part of the test).

**The ask's anchor** is the production reading (`askFrame` referents: surface, title, title without its parenthetical, redirect), read through
the same cached title door. One declared repair: a referent whose own tokens contain a cue token of a mapped property ("capital of Egypt",
"president of Brazil") is replaced by its remainder after the last cue token and any following function words ("Egypt"), re-read through the
door. If the door yields no referent, P is silent on that ask (counted).

## Training data and the referee

- **Entities:** per property, items carrying that property, from Wikidata's own search (`haswbstatement:<P>`, sorted by incoming links), kept
  in that order if they have an English Wikipedia article, until **500** per property. Excluded before learning: any item whose English article
  title is a page of `eval/modelvsrules/pairs.jsonl` or an ask's referent title (the eval never enters training).
- **Text:** the article's lead (`prop=extracts&exintro&explaintext`), split by the pair builder's own `sentencesOf`.
- **Referee values:** the property's *truthy* values (preferred-rank statements if any exist, else normal-rank; never deprecated) and each
  value's English label and aliases.
- **Anchor mentions in training:** the item's article title (with and without its parenthetical), English label and aliases, matched as
  case-folded token sequences; plus a declared closed set — a sentence-initial *he, she, it, they, his, her, its, their* in the item's own lead.
- **Candidate fillers** (identical at training and inference): maximal runs of capitalised tokens, a function word allowed inside a run only
  between two capitalised tokens, leading function words dropped; runs overlapping an anchor mention are not candidates.
- **The referee's verdict on a candidate:** CONFIRMED if its case-folded tokens equal a value surface or are a token-suffix of one ("Austen" of
  "Jane Austen"); SKIPPED (no verdict) if they are another contiguous part of a value surface; REFUTED otherwise. Wikidata is incomplete, so a
  true filler can be refuted; that noise falls on both the real arm and the null alike.

## Candidate patterns (the token path)

For an anchor mention and a candidate in one sentence: the direction (anchor before candidate, or after) and the middle tokens between them,
case-folded, a capitalised run inside the middle written `C`, a number `0`. Each instance yields these keys, each a candidate pattern of its
property: the full middle; its function-word skeleton (open-class tokens → `*`, runs collapsed); the 1, 2, 3 middle tokens next to the
candidate; the 1, 2, 3 middle tokens next to the anchor; and the token next to the anchor with the token next to the candidate.

## Admission (no hand-set thresholds)

- Score of a pattern: **S = confirmations − refutations** over its training instances.
- **Null:** 199 replicates; in each, every property's value sets are reassigned among its entities by a random cyclic permutation (Sattolo; a
  bijection, so the shape of the value sets is preserved — L25), every instance re-refereed, every pattern re-scored. T_b = the largest score
  of ANY pattern of ANY property in replicate b (max-T: one family across everything tested).
- **Admitted:** S > max_b T_b **and** S > 0 (more right than wrong; the point at which committing beats abstaining when a wrong answer costs
  what a right one gains). Family-wise error of admitting any pattern on association alone ≤ 1/200, whatever the number of patterns, which is
  why the replicate count is fixed (the L26 warning is answered by the max-T construction, stated here).

## Inference (arm P)

For a (question, sentence) pair: map the question to properties and anchor (above); find the anchor's mentions in the sentence; for each
candidate, its score = the largest S among its admitted keys for any mapped property; candidates ordered by score; the first whose surface
resolves to a non-disambiguation page through the **same cached title door** R uses is committed; a tie between distinct candidates at that
score → silent. No Wikidata at inference: the layer reads only the sentence, the question and the title door.

## Evaluation — the held-out human-gate set ONLY, never graded by Wikidata

- **Pairs:** the 162 (question, sentence) pairs of `eval/modelvsrules/pairs.jsonl`, restricted to the asks in scope (above). They come from
  the held-out gate set, which was written before any gate run and never used to tune anything; no sentence, page or anchor of theirs is in
  training. *A note on "held-out half":* the brief named a hash-split half of an English set. The relation asks with sentence-level labels are
  the gate's held-out set, which is held out **as a whole** from this learner; the `eval/sets/` draft has a 30% hash holdout but no
  sentence-level labels and is labelled only by its builder, so it is not used. Instrument checks (below) use training-side data only.
- **Labels — both fixed before this experiment, neither by me now:** (a) the gate's gold regex (ANSWER / NOT-ANSWER, written with the gate);
  (b) the independent second labeler's STATES / NOT (blind file md5 `7c93cb6d6b1eedbae6d3697184644a2f`). Neither is human-reviewed; there is no
  human-labelled sentence set in the repository.
- **Metrics** (exactly as `eval/modelvsrules/run.mjs` and `rerun-r.mjs`): on ANSWER/STATES — *correct* (committed and matches: gold regex for
  (a); overlap with the labeler's answer words for (b)), *wrong* (committed, no match), *silent*; on NOT-ANSWER/NOT — *false commit*.
- **R** = `runAnswerTurn` at `HEAD` over the one sentence with its page title, the real Wikipedia title door, **one cache shared by every arm in
  one process** (Experiment 3's trap: never compare a stored run with a fresh one against a rate-limited door). Door failures are counted and
  reported; a failure is never read as "no page".

## What decides (applied mechanically)

For each of H1 (P vs R) and H2 (R∪P vs R), on **each** labeling:
1. **correct** higher — exact McNemar, one-sided p < 0.05; AND
2. **false commit** not higher — one-sided Fisher exact p(more) ≥ 0.05; AND
3. **wrong** not higher — the same test.

**SUPPORTED** only if all three hold on **both** labelings. If (1) fails on either labeling: **FALSIFIED (not better)**. If (1) holds and (2) or (3)
fails: **FALSIFIED AS STATED (better only by being wrong more often)**. A split between labelings is reported as mixed and counts as not supported.
The verdict is run once; a failed run stays on the record; any later change is a dated amendment.

## Instrument checks (L10), declared now — they validate, they do not decide

1. **Mutation check:** the same learner with a shuffled referee (one fixed Sattolo permutation as the "real" labels) must admit (almost) nothing;
   its admitted count and its eval commits are reported next to the real learner's.
2. **Training-side held-out:** entities are split 80/20 by a hash of the Q-id; learning on the 80%, the admitted patterns' commits on the 20%
   are graded by Wikidata (precision, commits) — a check that the patterns generalise across entities, not a verdict.
3. **R reproduces:** R's counts on the 162 pairs must match the last recorded paired run (Experiment 4: STATES 7 correct / 0 wrong, NOT 4 false
   commits) up to door failures, which are reported.

## Preflight (fold-rules ledger, `preflight-proposal.json`) — WARN, answered here

- L10 instrument not validated → the three checks above.
- L15 per-type resolution → every relation has fewer than 6 STATES sentences (most 0–2): **no per-relation claim is made**; only pooled counts.
- L26 replicates fixed → max-T family-wise construction (above).

## Predictions, written now

- The learner admits patterns for most of the 11 properties; the mutation check admits none or almost none.
- P commits on few eval sentences. Plausible gains: "a novel by English author **Jane Austen**", "**Portuguese** is the official … language of
  Brazil", "**Felipe**, King of Spain". Plausible false commits: passing mentions next to the anchor.
- **Expected verdict: FALSIFIED (not better)** for H1 (P alone reads few relations and is silent elsewhere) and probably H2: at most ~10 in-scope
  STATES sentences exist, and H2 needs ≥ 5 gains with none lost on the strict labels to reach p < 0.05. That is a statement of power, written so
  a null result is not later read as evidence that learning cannot work.

## Biases, stated before the run

- **For R:** R's rules were tuned on failures from these gate asks (against different sentences).
- **For P:** the anchor repair for "capital of Egypt"-style referents is a hand rule on the *question* side; the cue map uses Wikidata's own
  aliases, which include words the eval asks use. Both are declared and applied identically to every ask.
- **Against P:** training is on article leads; the eval sentences come from anywhere in three pages. Wikidata's incompleteness refutes true fillers.
- **Against both:** one sentence in isolation; the loose gold regex credits mentions (hurts whoever stays silent on a mention, helps whoever commits).
