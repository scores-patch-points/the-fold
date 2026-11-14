# VERDICT: frontier-like answers from a context window that never grows

The numbers are in [RESULTS.md](RESULTS.md) and the predictions in [PREREG.md](PREREG.md). Every number below comes from generated, seeded worlds on one Apple M3 running qwen3:4b. **No public benchmark and no frontier model was run.** Those parts of the brief are typed gaps, listed in RESULTS.md with what each needs (download approval, an API key, the hyphae VM). So no claim of frontier parity is made here.

## The short answer

The apparatus held the context flat and turned the model's misreadings into honest gaps. Then, at the user's request, the reading itself was taken out of the model. The arms below where Janus reads and the fold answers were added after pre-registration (see RESULTS.md):

- On those worlds, Janus reading and the fold answering gave **96/96 on the scored seed and 96/96 on the held-out seed, with zero model calls**, from 10³ to 10⁶ tokens.
- Deductions from depth 2 to 50 came out **15/15 on both seeds**, with every planted fault caught.
- The model-reading apparatus reached 80% on the same questions, plain retrieval 58%, and the whole text in one call 12% (it cannot run above 10⁴ tokens).

That strongly supports the thesis's weaker form: *the apparatus holds the task, not the model*. It also shows the thesis's real boundary. The perfect scores hold only where a declared reading frame covers the sentences. Synthetic worlds are built that way. Real text is not.

## Hypotheses

| H | verdict | evidence |
|---|---|---|
| **H1 flat context** | **held** (to 10⁶ tokens; 10⁷–10⁸ not run) | The largest apparatus call grew from 293 to 301 estimated tokens (240 to 268 by the engine's count) as the corpus grew 1,000-fold. B = 4000 was never exceeded, by the estimate or by the engine. Long context reached 10,498 engine tokens at 10⁴ and does not fit above that. Conversations of up to 500 turns were not run. |
| **H2 flat accuracy** | **held** | With the model reading (after fix 2): 75/79/92/75% at 10³/10⁴/10⁵/10⁶. The pre-registered test (no fall of more than 10 points from 10³ to 10⁶) passes: 75 to 75. With Janus reading: 100% at every size. Retrieval stayed at 54–71%. Long context fell from 33% to 17%, then could not run. |
| **H3 apparatus over weights** | **not tested as registered** | No 14B or frontier row ran. The strongest evidence available is indirect. Inside the apparatus, removing the model entirely (Janus reads) **raised** accuracy from 80% to 100%. On this task family, the weights were the weakest component. |
| **H4 frontier parity at lower energy** | **not tested** | No frontier arm. Energy is an estimate: engine seconds × 20 W (±50%). It came to about 130–250 J per correct answer for the model-reading apparatus, against about 1,200–1,300 J for long context. Janus arms used no GPU, and their CPU energy was not metered. |
| **H5 honest failure** | **held after fix 2** | The model-reading apparatus answered 16/16 planted unanswerables with a gap, and only 2 of 96 answers were wrong (17 were gaps). Before the fix, the witness passed values that merely occurred in a cited sentence: 23 wrong, and 11/16 unanswerables answered. A frontier comparison was not run. |
| **H6 compounding** | **held on cost; accuracy was already at ceiling** | Janus setup, 200 related questions: 200/200 in every arm. Reusing reads cut Janus sentence reads from 800 to 526, and late questions read 46 against 96. With the stand-in mouth (stage 8): repeating a question cost 0 calls, and extending a chain paid only for its new hops. The model-reading compounding run was stopped for time and not completed. |
| **H7 stigmergic depth** | **held with Janus and the instrument; partly with the model** | With qwen3:4b choosing steps: correct to depth 20, out of step budget at depth 50 (decoy dead ends). Chain-of-thought in one call matched it to depth 20 and failed at 50; a plain one-call answer failed from depth 5. With Janus reading and a reachability instrument: 15/15 on both seeds, depth 50 included. Logos caught every planted circular step and contested premise it reached. With logos off, none were caught. |

## What logos rules caught, and what they did not

- **Caught:** the planted circular steps (begging the question; khora `findClaimCycle`), contested premises (khora `regimeOf`/`isSettled`), and unlicensed inferences when the inference was declared (khora `lintInferences`). Each was disclosed, never rewritten. A contest is routed and never resolved. A chain through a contested premise ends `filled_with_flags`, never `filled`.
- **Not caught: the pre-registered H7 risk, confirmed.** A wrong step that *looks* licensed passed logos **50/50 times**. In 41 of those 50 runs the ledger reported the goal cleanly proven through it. Logos checks structure, not truth. Only a **step-witness** caught them (50/50): it checks that each step's conclusion is what its cited rule says. With the real model, the step-witness also caught qwen3:4b's own misreadings at depths 5, 20 and 50. **Logos without a witness should never be trusted to say "proven".**

## Where a small local model fell short, and why

The failures were readings, not reasoning. qwen3:4b, shown "Orkadra's mentor is Marmarten." and asked for Marmarten's mentor, answered "Marmarten": it confused subject and object. 3-hop chains were 2/16 with the model reading and 16/16 with Janus reading. Arithmetic left to the model went wrong: with instruments removed, it got 3 of 4 differences wrong. Unanswerables left without a witness were invented: 2 of 4. Each of these is something the apparatus does better without the model.

## Pre-registered failure categories

- **Non-decomposable insight / gestalt tasks:** not tested; there were none in these worlds.
- **Fluent long-form generation:** out of scope; the mouth emits only schema values.
- **World knowledge absent from the log:** became typed gaps (16/16).
- **Valid-but-unsound chains:** confirmed as a logos blind spot, closed by the step-witness.
- **Premature stops, fold drift, ledger sprawl:** the stop rule never changed an answer here (in the ablation, removing it changed nothing). Ledger sprawl showed up as the depth-50 step-budget exhaustion with the model.
- **Trail lock-in versus random pick:** identical results up to depth 20. At depth 50 the random arm stopped earlier (18 calls) and the trail arm wandered longer (149 calls). Neither filled the goal.
- **Surf misses:** none in the Janus arms. Retrieval recall was not separately instrumented. That is a gap.

## Organs that changed nothing here

Removing these left accuracy the same in these worlds:

- the stop rule
- memo
- witnesses, in the Janus arm (the Janus path does not go through the model-read witness)

Write-back and memo changed cost, not accuracy. These are reported as no-change results, not hidden.

## Energy and time per correct answer

These are estimates; no meter was available.

| arm | engine time per question | estimated energy per correct answer |
|---|---|---|
| model-reading apparatus | about 5–9 s | 127–250 J |
| plain retrieval | about 2–5 s | 83–187 J |
| long context | about 11–20 s | about 1,170–1,320 J |

Retrieval was cheaper per call but answered 58% against 80%. The Janus arms made no model calls; their CPU time was not metered. Wall times were distorted by other sessions' load (load average 70–300), so they are not compared. **No frontier comparison is stated.** No frontier arm ran, and a cited per-token estimate alone spans about an order of magnitude.

## Three changes most likely to close the remaining gaps

Each comes with its test.

1. **Widen Janus's reading frames past one sentence shape, on real documents.** This is the gap that matters. Project more of Janus's own arcs (transitive verbs, `obl` dates, appositives, negation) into slot facts, each frame declared. *Test:* the reading-exam's labelled sentences, or Metro Nashville documents, read through `janus-read.mjs`. Measure the share of sentences that yield a fact and the share of facts matching a blind label, with a pre-registered floor of 95% precision. Sentences with no frame go to the mouth or become gaps; the gap rate is reported, not hidden.
2. **When the model must read, retry without the line the witness vetoed.** This is the same move that rescued the depth ledger. *Test:* the `apparatus-v2` scaling questions with Janus off. The prediction: chain3 rises from 2/16, with wrong answers staying ≤ 2/96. A rise in wrong answers falsifies it.
3. **Run the public benchmarks and the frontier arm.** These are the parts of the brief this session could not reach without approval: LongMemEval-S (abstention pre-registered as the best category), BABILong, MuSiQue, ProofWriter at stated depths, and a frontier row inside and outside the apparatus. *Test:* official scorers, a blinded judge, contamination noted per benchmark. The prediction stands: the apparatus column rows close, and the no-apparatus column rows far apart.

## Not done, plainly

- Public benchmarks, MINE-1, the Metro beat tasks, frontier/14B/gemma2:2b rows, 10⁷–10⁸ tokens, 500-turn conversations. Each needs downloads, a key or the hyphae VM.
- The model-reading ablations were stopped after 5 of 7 arms. The model-reading compounding run did not run. Both were superseded by the Janus arms.
- **Pharos:** frontier's events do not reach it yet. They go only through Penelope's mark door (Michael's rule), and her door is not running on this machine.
- The cell mapping (which EOQL command each event kind carries) is a proposal.
