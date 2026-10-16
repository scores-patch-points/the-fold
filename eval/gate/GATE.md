# The MVP gate — pre-registered 2026-10-13, before any gate run

**Question:** when can the fold replace the basic functionality of a chatbot and of a coder?
"Usable" is defined here as numbers, fixed before the first run. Results are appended below the line; nothing above it changes.

## Why a held-out set

The fixes on branch `modelless-fixes` were developed against the 96-prompt battery (`eval/modelless/prompts.json`) and its
deterministic stub world (`eval/modelless/world.mjs`). Those numbers are therefore training numbers. The gate's chat bars are
measured on prompts the fixes never saw (`chat-heldout.json`, written today, frozen with this file), live, with no stub.

## Chatbot bars (MVP = all of C1–C4 pass; C5 is descriptive; C6 is the model arm)

| bar | what | MVP threshold | measured on |
|---|---|---|---|
| C1 | factual asks (slot, holder, compute) answered correctly AND committed | ≥ 60% | held-out, live |
| C2 | confident WRONG answers (committed, gold absent; or any committed answer to a false premise) | ≤ 1 per 100 turns | held-out + 96, live |
| C3 | follow-ups and compound asks answered correctly and committed | ≥ 50% | held-out, live |
| C4 | turns that end (no hang past 150 s, no empty output) | ≥ 99%; p90 latency ≤ 20 s | everything run |
| C5 | WildChat sample (50 real asks, every Nth standalone ask under 600 characters of `tools/wildchat-battery.json`, N chosen to give 50 (`wildchat-sample.json` records N)): how they end | reported, no bar | live |
| C6 | with the in-tab model: explanation asks answered with grounded prose | ≥ 60% grounded (pivot-checked) | UNMEASURED until a WebGPU browser run |

Why these numbers: C1 at 60% is the measured ceiling of today's answering layer with perfect retrieval (24/42 = 57%); passing it live means
retrieval has caught up with the answer layer. C2 at 1/100 encodes the lineage's standing invariant (it is 0 today and must stay near it).
C3 at 50% because follow-ups were 0/14 — half is the first point where conversation is not broken. C4 because a chatbot that hangs is not one.

## Coder bars (MVP = K1 and K3 pass)

Tasks are cut from REAL fix commits of this week (the-fold, khora, penelope): the commit's test file is kept, its source change is
reverted to the parent, and a task is admitted only if that test passes at the fix and FAILS after the revert (fail-to-pass). The task
statement is the commit's own subject line — the developer's words, not ours. The coder is the fold's own door: `POST /v1/code`
(khora proxy, `native/the-fold/code-loop.js`), the local mouth it picks, `maxRounds: 3`, `ground: true`. The judge is the test command,
re-run by the harness after the door returns — never the door's own verdict.

| bar | what | MVP threshold |
|---|---|---|
| K1 | tasks solved (the fail-to-pass test passes after the door's edits) | ≥ 50% |
| K2 | median wall time per solved task | reported, no bar |
| K3 | tasks where the door leaves the workspace unparseable (a `node --check` failure in a touched file) | 0 |
| K4 | the door's own "done" verdict agrees with the harness's re-run | reported (honesty of the loop) |

## Predictions (made now)

- C1: 25–40% (live retrieval is the binding constraint; it was 19% before the fixes).
- C2: 0–1 per 100.
- C3: 0–15% (cross-turn binding is not built; compound asks still end at the step graph).
- C4: passes on ending; p90 latency near 15 s.
- K1: 10–25% (the local mouth is qwen2.5-coder 1.5B; small models fail multi-file fixes).
- K3: 0.

So the prediction is: **neither MVP passes today.** The gate exists to say by how much, and to be re-run after each cycle.

---

## Results (appended; nothing above this line changes)

### Run of 2026-10-13 (first gate run; live web, no model reachable, headless Chromium without WebGPU)

Code under test: `modelless-fixes` 0320a6e (pre-panel) and `panel-fixes` 4019850 (after the archon panel's must-fix findings); baseline
620f0a4. Held-out set: `chat-heldout.json` (49 scripts, 53 turns). Live Wikipedia and the page's own web lanes; the model endpoint answered 503.

| bar | measured | threshold | verdict |
|---|---|---|---|
| C1 factual asks committed AND correct (held-out, live) | **13 / 49 scripts = 26%** at 0320a6e and at 4019850; baseline 8 / 49 = 16%. Of the answerable factual classes: slot 9/27, holder 0/6, compute 4/4 | ≥ 60% | **FAIL** |
| C2 confident WRONG answers per 100 turns | **3 in 53 held-out turns** at 4019850 (and at 0320a6e); baseline 2; plus 1 false-premise commit in the 96-prompt live battery at 0320a6e | ≤ 1 per 100 | **FAIL** |
| C3 follow-ups + compound asks committed and correct | **0 / 8** (compound 0/4: graph shown, no answer; follow-up 0/4: R0 with sources shown) | ≥ 50% | **FAIL** |
| C4 turns end; p90 latency | 4 of 205 turns did not settle in 150 s (2 of 102 in the 96 battery, 2 of 50 WildChat; all long "write/summarize" asks that wait on a mouth that is absent); p90 latency 13–21 s, p50 8–10 s | ≥ 99% end; p90 ≤ 20 s | **FAIL (marginal)**: 98% end; p90 21 s on the 96 battery |
| C5 WildChat sample (50 asks), how they end | 24 sources shown for a mouth that is absent · 12 typed gap · 5 wanted a model, nothing shown · 4 canned note · 2 contest · 2 graph shown, no answer · 1 other · **0 committed** | reported | — |
| C6 in-tab model, grounded prose | not run (no WebGPU) | ≥ 60% | **UNMEASURED** |
| K1–K4 coder | the in-process coder gate (`coder-gate.mjs run --direct`, qwen2.5-coder:1.5b, `maxRounds: 3`) probed ONE task (the-fold-09853ea): 540 s, no edit applied, not solved. The full 20-task run died with its session; a second run was relaunched and had not finished at the time of writing | K1 ≥ 50%, K3 = 0 | **UNMEASURED** (1/1 failed) |

Predictions made before the run: C1 25–40% (observed 26%, inside the range); C2 0–1 per 100 (observed ~6 per 100: outside, worse); C3 0–15%
(observed 0%, inside); C4 passes (observed marginal fail); K1 10–25% (unmeasured). **Neither MVP passes**; that prediction held.

What binds C1, measured: on the held-out slot asks the right answer was on screen for 22 of 27 but committed for 9; the other 13 ended in a
contest (10) or a typed gap (7). The answering layer's contest policy declines to pick whenever any rival filler is in the pool, and the
live pool carries junk fillers; retrieval and rival typing, not the committing rule, are the lever. The three confident-wrong answers are
live-only shapes the fixture world does not contain: a derivative page whose title CONTAINS the asked title ("Pride and Prejudice and
Zombies" for "who wrote Pride and Prejudice"), a definitional sentence about the role instead of its holder ("chancellor of Germany"), and
a product sentence for a company ("Tesla Semi" for "CEO of Tesla").

Not established: one run per condition (live web varies about ±15 points between runs); the held-out set was frozen before the run but
written by the person who also tuned the fixes; golds for office holders are as known on 2026-10-13.
