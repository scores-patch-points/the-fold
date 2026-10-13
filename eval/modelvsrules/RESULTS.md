# Model vs rules — results (2026-10-13)

Pre-registration: [PREREG.md](PREREG.md). The claim (the user): *a small model would do better than the hand-built linguistic rules in
many of these places.* Model: `gemma2:2b` (Ollama), temperature 0, seed 7. Nothing below was tuned after seeing a result.

## Experiment 1 — answer extraction from one sentence — PRIMARY (gold-regex labels, as pre-registered)

162 pairs from 28 of the gate's 33 slot/holder asks (87 ANSWER by the gate's gold regex, 75 hard-negative NOT-ANSWER). `gemma2:2b`, prompt
md5 `f7cbe9eb0edb3d5a42d526e9b1c8fed3`, title-door failures 16 (rate limit; the door is the app's own, with a generic User-Agent).
R ran the production binder at `HEAD` `4d129f9` (production code identical to HEAD).

| arm | ANSWER pairs (87): correct / wrong / silent | NOT-ANSWER pairs (75): false commit | median ms |
|---|---|---|---|
| **R** production binder | 6 / 1 / **80** | **1** | — |
| **M** gemma2:2b | **65** / 12 / 10 | 29 | 1528 |
| **M+V** M, verbatim + title door | 39 / 7 / 41 | 11 | — |
| L lexical baseline | 31 / 46 / 10 | 60 | — |
| N null | 0 / 0 / 87 | 0 | — |

Pre-registered tests: M vs R — correct-only-M 60, correct-only-R 1, McNemar p < 0.0001 → **better**; false commit 29 vs 1, p(more) < 0.0001 →
**more**; wrong 12 vs 1, p(more) = 0.0012 → **more**. **Verdict M: FALSIFIED AS STATED (better only by committing and being wrong more often).**
M+V vs R — correct-only-MV 34, correct-only-R 1, p < 0.0001 → better; false commit 11 vs 1, p(more) = 0.0023 → more; wrong 7 vs 1, p(more) = 0.032 →
more. **Verdict M+V: FALSIFIED AS STATED.**

What the cases show (read before interpreting the numbers):

- **The production binder is precise and almost silent**: 1 false commit in 75, but it commits on only 7 of 87 answer-bearing sentences.
  Some of that silence is real recall loss ("Pride and Prejudice is a novel by English author Jane Austen" is a plain statement it does not
  read — the known gap noted in `fold-chat-filler.test.mjs`); some is correct, because many regex-"ANSWER" sentences only *mention* the
  answer ("Van Gogh sent The Starry Night to Theo in Paris").
- **The model's false commits are the errors the rules exist to prevent**: the namesake ("Mozart was born in Augsburg on 14 November 1719" is
  Leopold; "Franz Xaver Wolfgang Mozart was born in Vienna" is the son), a different relation with the same verb ("Charlotte Brontë … wrote that
  Pride and Prejudice was a disappointment"), a list/navigation fragment.
- **The gold regex is loose** (a mention matches), which credits a model that answers from a salient name or from knowledge. Amendment A2
  re-scores on an independent second labeler's strict `STATES` / `NOT` labels.

## Experiment 1 — Amendment A2: re-scored on an independent second labeler's labels

A fresh agent that saw ONLY the question and the sentence (blind file md5 `7c93cb6d6b1eedbae6d3697184644a2f`; no gold regex, no label, no
arm output, no page) labelled each of the 162 pairs `STATES` (the sentence by itself asserts the answer) or `NOT`. PREREG A2, written before any
label existed, fixed how they would be used. **The labeler is a language model, not a human**; its labels are a second instrument, not truth.

- **The regex labels were loose**: of the 87 sentences the gold regex called ANSWER, only **20 were judged to state the answer** (67 only
  mention it); none of the 75 regex-NOT-ANSWER sentences was judged to state it.

| arm | STATES (n=20): correct / wrong / silent | NOT (n=142): commits anyway |
|---|---|---|
| **R** production binder | 4 / 0 / **16** | **4** (3%) |
| **M** gemma2:2b | **20** / 0 / 0 | **86** (61%) |
| **M+V** M, verbatim + title door | 13 / 0 / 7 | **44** (31%) |
| L lexical | 9 / 6 / 5 | 122 (86%) |

M vs R: correct-only-M 16, correct-only-R 0, p < 0.0001 → better; false commit 86 vs 4 → **more**. M+V vs R: correct-only-MV 9, p = 0.002 → better;
false commit 44 vs 4 → **more**. **Verdict on the independent labels: FALSIFIED AS STATED for both** (better only by committing on sentences that
state nothing).

### What the two instruments say together (the plain reading)

1. **The two jobs separate cleanly.** *Reading* a sentence that does state the answer: the model gets 20 of 20, the rules 4 of 20. *Judging
   whether a sentence states anything*: the rules commit wrongly on 3% of non-statements, the model on 61% (31% even behind verbatim + a real title
   page). The rules are a strong judge and a weak reader; the model is the reverse.
2. **So "a small model in these places" is right about the reading and wrong about the licence.** What the hand-built rules do badly is the
   morphology and syntax of reading (wrote/written, sank/sink, "is a novel by"); what they do well is refusing (the namesake, the part for the
   whole, the passing mention). A model asked to both read and decide whether to commit does the second badly.
3. **Experiment 2 agrees from another side**: on discourse the model fails as a decider (5/59) and as a chooser among mechanically extracted names
   (39/59, with 20 leaks on 73 standalone asks); the rules are 54/59 with 0 leaks.

### What this does NOT establish

- One model (gemma2:2b), one frozen prompt per arm; a larger model or a different formulation may do better and was not tried (the standing rule is
  a small local model).
- 28 asks, 162 sentences, **20** statement sentences: the STATES result is small, and the sentences were chosen by referent/relation filters.
- The second labeler is one model; no human has reviewed its labels.
- Retrieval, ranking, the contest/falsification stage and the model-free *whole turn* are not tested here — only the extraction decision, and
  discourse in Experiment 2.

## Amendment A3 — EXPLORATORY, POST-HOC, INCONCLUSIVE: pooled cross-source agreement

Asked whether the Fold's existing agreement rule (≥ 2 distinct pages, strictly more than any rival) repairs the model's over-commitment.
Per ask, over the sampled pairs (`pooled.mjs`):

| arm | any single page: correct / wrong / silent (28 asks) | ≥ 2 distinct pages: correct / wrong / silent |
|---|---|---|
| R | 4 / 2 / 22 | 0 / 0 / 28 |
| M | 8 / 6 / 14 | 3 / 2 / 23 |
| M+V | 8 / 5 / 15 | 2 / 0 / 26 |

It commits on too few asks (the pairs are a sample, a few sentences per page) to say anything. **No claim is made.** To test the
design properly it must run on the whole retrieved pool of a live turn, not on sampled pairs — that is the experiment worth running next.

## Experiment 2 — discourse (who is "he"?) — PRIMARY ARMS, recorded before Amendment A1 was run

G3 corpora (`eval/ants/g3/corpus.mjs` 113 sequences + `corpus2.mjs` 56), en/es/fr. Prompt md5 `dbb96e55552fed7d149c679175c8e600`.

| arm | follow-ups with a known referent (n=59): correct / wrong / silent | follow-ups with no named referent (n=8): committed | standalone asks (n=73): leak |
|---|---|---|---|
| **R** production `planTurn` | **54** / 0 / 5 | 8 | 0 |
| **M** gemma2:2b, free recall | 5 / **9** / 45 | 1 | 0 |
| **M+V** M, verbatim only | 5 / 9 / 45 | 1 | 0 |
| N null | 0 / 0 / 59 | 0 | 0 |

By language, correct on follow-ups with a referent: en R 39/41 · M 2/41; es R 7/9 · M 1/9; fr R 8/9 · M 2/9.

Pre-registered tests: M vs R — correct-only-M 0, correct-only-R 49, McNemar p = 1.0 → **not better**; wrong 9 vs 0, Fisher p(more) = 0.0014 →
**more**. **Verdict on M and on M+V: FALSIFIED (not better; and wrong more often).**

What the result does and does not say, stated plainly:

- It says: *as a free-standing decider, with one generic prompt, gemma2:2b does not do this job* — it answers NONE for most follow-ups
  (45 of 59) and, when it answers, is wrong 9 of 14 times.
- It does **not** say a model has no place here: R was developed against these corpora (a bias in R's favour that PREREG.md names),
  and the formulation (free recall of a name) is the weakest way to use a small model. Amendment A1 tests the hybrid formulation.
- A 54 vs 5 gap is far larger than the development bias could explain.

## Experiment 2 — Amendment A1 (exploratory hybrid arm H), run after the primary arms above

H = the model **chooses one of the names the referent record extracted mechanically**, or NONE. H prompt md5 `0281832bdae175ac9c6924912c6414bc`.
Declared exploratory in PREREG.md before it was run; one arm added after seeing a result.

| arm | follow-ups with a referent (59): correct / wrong / silent | no named referent (8): committed | standalone asks (73): leak |
|---|---|---|---|
| R | **54** / 0 / 5 | 8 | **0** |
| H | 39 / **13** / 7 | 5 | **20** |

By language, correct / leak: en R 39/41, 0/49 · H 26/41, 17/49; es R 7/9, 0/12 · H 7/9, 0/12; fr R 8/9, 0/12 · H 6/9, 3/12.

H vs R: correct-only-H 3, correct-only-R 18, McNemar p = 0.9999 → not better; leak 20 vs 0 (p(more) < 0.0001) → more; wrong 13 vs 0 (p(more) = 0.0001)
→ more. **Verdict on H: FALSIFIED (not better; and leaks/wrong more).**

One observation worth keeping, flagged as a hypothesis and not a result: the rules were silent on 5 follow-ups with a referent and H was
right on 3 of those 5. The leak is the price of asking the model about every ask; it is **0 by construction** if the model is consulted
only after the mechanical gate has already said "this points back" and the rules found nothing to carry. That is a testable design
(model as a fallback inside a mechanical gate, its answer accepted only if it is one of the mechanically extracted names and the
person can refuse it). It has not been tested; N = 5 here is far too small to promote it.
