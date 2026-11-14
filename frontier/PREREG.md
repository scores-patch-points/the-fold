# Pre-registration: bounded-context apparatus (frontier/)

Committed before any scored run, 2026-11-14. Each run's commit SHA is in its CSV rows (`fold_sha`), so a reader can check that this file came first (`git log -- frontier/PREREG.md`). The smoke run (`n=6`, size 10³, seed 1) was a harness check, and its numbers are not reported as results.

## Fixed before the runs

- **B = 4000** context tokens per call, counted by the declared estimator (`tokens.mjs`, ceil(bytes/3)). Calibration on harness prompts (not test items): the estimator ran 291 against ollama's own count of 238, so it overestimates by about 1.22x. A call over B is refused, never truncated.
- **Model:** qwen3:4b (ollama, `think:false`, temperature 0, seed 7). It is the only small model installed. gemma2:2b and qwen2.5:14b are absent, and pulling them needs the user's approval. **qwen3:4b stands in for the gemma2:2b class. That is a deviation from the brief, recorded here.**
- **Scoring:** exact match after trim and lowercase, with numbers compared numerically. A secondary *lenient* score (the truth occurs as a substring of the answer) is reported beside it, never instead of it. A typed gap is counted apart from a wrong answer. On a planted unanswerable, a gap is correct and any value is wrong.
- **Seeds:** world seed 1, question seed 5 (world seed + 4). The held-out split uses world seed 2, which nothing touches until the final check. Nothing is tuned on any seed: the apparatus code is frozen at the commit that carries this file, apart from bug fixes, which are logged in RESULTS.md with their effect.
- **Energy:** the M3 has no RAPL. `powermetrics` needs root. Energy is reported as an estimate only: engine seconds (ollama `total_duration`) × 20 W declared (M3 package power under GPU inference, ±50%). It is labelled an estimate wherever it appears.

## Nulls and baselines (declared)

- **Plain retrieval:** BM25 top-8 for the question text, one call, same model, same output schema.
- **Plain long context:** the whole corpus in one call, only where it fits a 32k window. Above that it is a typed gap, `exceeds_model_window_32k`, which is itself the H1 contrast.
- **Ablation null:** the full apparatus. Each organ is removed one at a time on a fresh log, and each question is asked twice: pass 2 exercises memo and write-back.

## Predictions

| H | prediction | what would falsify it here |
|---|---|---|
| H1 | Apparatus max context per call ≤ B at every size from 10³ to 10⁶ tokens, flat, and not rising with size. Long context rises with size and exceeds the window by 10⁵. | Any apparatus call over B, or a max context per call that grows with size |
| H2 | Apparatus accuracy is flat across sizes (within ±10 points). Long context falls with size before it overflows. Retrieval falls on chain3 and the aggregates as distractors grow. | Apparatus accuracy falling more than 10 points from 10³ to 10⁶ |
| H5 | On planted unanswerables, the apparatus returns a gap ≥ 90% of the time. Retrieval and long context return a value more often. | Apparatus answering an unanswerable more than 10% of the time |
| H6 | With write-back and memo on, pass-2 calls are 0 for every question that pass 1 answered. With write-back off, pass 2 costs what pass 1 cost. | Pass-2 calls > 0 with write-back on |
| H7 | On generated deductions (depth 2–50), the ledger with logos on finishes at every depth, with all calls ≤ B. A planted circular step and a planted contested premise are flagged at every depth. With logos off, neither is flagged. Plausible-but-wrong steps whose inference is declared licensed **pass logos** (logos checks structure, not truth), and only a step-witness (premise/conclusion consistency) catches them. | A planted circular step or contested premise passing logos at any depth |
| Ablations | Removing witnesses raises wrong answers on unanswerables and on fabricated reads. Removing instruments moves arithmetic to the model (calls up; accuracy predicted down on diff/sum). Removing identity breaks alias questions. Removing write-back and memo raises pass-2 calls with no change in accuracy. The stop rule changes walked steps but not accuracy here. | An organ whose removal changes nothing is reported as changing nothing |

## Expected failures, pre-registered

- **Non-decomposable insight** (gestalt tasks): the apparatus decomposes into slots, and a question with no slot shape becomes an `unmet_shape` gap. Not tested here: no such task is in the synthetic world. Reported as untested.
- **Fluent long-form generation:** out of scope. The mouth emits schema-constrained values only.
- **World knowledge absent from the log:** a typed gap (`absent_fact` / `surf_needed`), never an answer. Planted unanswerables measure this.
- **H7 main risk:** logos checks structure, not truth. Chains of plausible wrong steps can pass. This is measured with planted wrong steps.
- **Retrieval recall:** a hop fails when BM25 top-8 misses the stating sentence. Recall is reported separately from accuracy wherever it can be computed.

## Not run in this session (typed gaps, not silent shrinkage)

These need the user's approval (downloads, the hyphae VM, a frontier API key) or more compute than this Mac had (load average 70–300, shared with a scored run in another session): LongMemEval-S, NovelQA, BABILong, NoLiMa, MuSiQue/HotpotQA, AmbigQA, MINE-1 blinded, ProofWriter/FOLIO, GSM8K, StrategyQA, the Metro Nashville beat tasks, the frontier and qwen2.5:14b rows of the grid, and corpus sizes 10⁷–10⁸. RESULTS.md lists each one with what it needs.
