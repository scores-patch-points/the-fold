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
