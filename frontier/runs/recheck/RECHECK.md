# Independent recheck, 2026-11-14

Repo: the-fold, branch frontier-bounded-context, HEAD a5360cc (khora d3ce14a). Node v24.10.0. No model was called (`--model none`, Janus reader). No code or committed file was edited. Only this folder was written.

## What was run (from the-fold root)

1. `node frontier/exp/run.mjs scaling --model none --seed 1 --sizes 1e3,1e4 --n 24 --arms apparatus --label recheck-janus --switches '{"janus":true,"janusOnly":true}' --out runs/recheck/scaling.csv`
2. `node frontier/exp/depth.mjs --model none --depths 2,5,10,20,50 --seed 2 --arms ledger-janus --out runs/recheck/depth.csv`
3. `node frontier/exp/run.mjs ablate --model none --size 1e5 --n 24 --label janus --base '{"janus":true,"janusOnly":true}' --arms -identity,-instruments,-writeBack --out runs/recheck/ablations.csv`
4. `node --test frontier/tests/*.test.mjs frontier/wilson/*.test.mjs`

All exited 0. Row-by-row comparison was done with a small Node CSV reader (quote-aware).

## Comparisons

**1. Scaling, Janus w2, seed 1.** MATCH, 48/48 rows, 0 differing on q, status, value, correct, calls. 48/48 correct, 0 calls.
Note on the brief: the committed `apparatus-janus-w2` rows are at size_tokens **1034 and 10065**, not 1035/10068 (those sizes belong to the other arms). The rerun produced 1034/10065 too. Committed rows carry fold_sha d8d1b62, the rerun a5360cc, so the result holds across that code change.

**2. Depth, held-out seed 2, ledger-janus.** MATCH, 15/15 rows vs depth-heldout.csv, 0 differing on depth, instance, status, answer, correct, flags, planted_circular_caught, planted_contest_caught. 15/15 correct.

**3. Ablations at 1e5, seed 1.** MATCH, 0 differing rows on q, status, value, correct.

| arm | rows | correct (old/new) | janus_reads (old/new) |
|---|---|---|---|
| janus-identity#pass1 | 24 | 20/20 | 262/262 |
| janus-identity#pass2 | 24 | 20/20 | 0/0 |
| janus-instruments#pass1 | 24 | 16/16 | 282/282 |
| janus-instruments#pass2 | 24 | 16/16 | 0/0 |
| janus-writeBack#pass1 | 24 | 24/24 | 296/296 |
| janus-writeBack#pass2 | 24 | 24/24 | 32/32 |

## Tests

52 tests, 52 pass, 0 fail, 0 skipped.

## Spot-check of RESULTS.md "Headline numbers" (recounted from runs/results/)

| claim | recount | |
|---|---|---|
| apparatus (before fix 2) 66/96, 23 wrong | 66/96, 23 ok-but-wrong | agrees |
| apparatus-v2 77/96, 2 wrong, 17 gaps | 77/96, 2 ok-but-wrong, 17 incorrect gaps (33 gap rows total; 16 are correct typed gaps on "dentist" questions) | agrees |
| retrieval 56/96, 40 wrong | 56/96, 40 ok-but-wrong | agrees |
| whole text 12/96, 12 wrong | 12/96, 12 ok-but-wrong (56 gap, 24 error) | agrees |
| Janus-w2 96/96, 0 calls | 96/96, 0 calls | agrees |
| held-out 96/96, 0 calls (heldout.csv) | 96/96, 0 calls | agrees |
| ledger-janus 15/15 seed 1 (depth.csv) | 15/15, 0 calls, seed 1 | agrees |
| planted circular 4/4, contest 5/5 | 4/4 and 5/5 in both depth.csv and depth-heldout.csv | agrees |

Small wording point, not an error: "gaps" in the v2 row means incorrect gaps. Gap rows that are the right answer are counted as correct.

## Verdict

All three reruns reproduce the committed results exactly, the suite passes 52/52, and every headline number checked recounts correctly. The only discrepancy is in the brief itself: the w2 sizes are 1034/10065, not 1035/10068.
