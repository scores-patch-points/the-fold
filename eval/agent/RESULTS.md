# Does the agent test its own prediction? — results (2026-10-14)

Pre-registration: [PREREG.md](PREREG.md) (committed `60d7f83` before any agent run; amendments A0 `cfa09b2` and A1 `8d4276b`, both
before any held-out run). Model: the in-tab default `gemma-2-2b-it`, served headless by its computer counterpart `gemma2:2b`
(Ollama, seeded; the page's own prompts and temperature). Arm frozen at `8d4276b`; base served from `cfa09b2` (= `72ce5dd` + the
harness hooks). Rows: `rows/*.jsonl` (copies of the run files; pages and logs stay in the ignored `results/`).
Reproduce the verdict: `node eval/agent/analyze.mjs` (reads `results/`; point it at `rows/` by copying them back).

**Verdict: FALSIFIED (not better).** On held-out units, the rehearsal witness lowered false-Held from 11 to 8 (3 units out, 0 in;
exact McNemar one-sided p = 0.125, the bar was 0.05) and left true-Held at 1. The null re-run of the base changed false-Held by 0, so
the result can be read, and it says no. Nothing was moved after seeing a result. The witness stays OFF by default (step 5 was
conditional and is not taken). The code remains in the branch behind `?rehearse=1`.

## Question 1 — how often is "Held" true?

The base (B), 42 units (15 dev asks × seed 1, 9 held-out asks × seeds 1–3), every unit settled:

| | units | Held | false-Held | true-Held | hidden test passed | false-open (works, not Held) |
|---|---|---|---|---|---|---|
| dev | 15 | 9 | 4 (44% of Held) | 5 | 6 | 1 |
| held-out | 27 | 12 | **11 (92% of Held)** | **1** | 8 | 7 |
| all | 42 | 21 | **15 (71% of Held)** | 6 | 14 | 8 |

**When the agent says "Held", the page does what was asked 6 times in 21 (29%).** On the held-out asks (counter, to-do, BMI, word
count, dice, dark mode, odd/even, two converters) it was 1 in 12. And "not Held" is no better a signal: 8 pages that work were left open.

Where the 15 false-Held pages come from:

- **6 are stitched pages, and all 6 fail.** They are "folded from the log" out of source snippets: no input, no button, only
  pasted page text (the tweet counter is the lettercount.com blurb repeated). The stitched path's test checks only that the page
  renders and shows the ask's atoms. It can only ever assemble snippets because of a base defect (below): `stitchKit`'s `draw` calls a
  name that is not in its scope.
- **9 are whole-page drawn pages** that render and show their labels but do not work: a missing external `script.js`, a submit button
  that reloads the page, a counter whose button does nothing, a word count that sums word lengths, a theme toggle that changes nothing.
  Drawn Held pages pass the hidden test 6 times in 15.

## Question 2 — the rehearsal witness (held-out, paired)

| arm | Held | false-Held | true-Held | hidden passed | model calls (median / total) | wall per unit (median) |
|---|---|---|---|---|---|---|
| B base | 12 | 11 | 1 | 8 | 16 / 339 | 277 s |
| **A witness** | 9 | **8** | 1 | 8 | 18 / 361 | 275 s |
| N base re-run (null) | 12 | 11 | 1 | 9 | — | — |

Pre-registered tests (`analyze.mjs`):

- **A vs B, false-Held:** B-only 3, A-only 0 → McNemar one-sided **p = 0.1250 → does not drop.**
- **A vs B, true-Held:** lost 0, gained 0 → McNemar p(fewer) = 1.0, Fisher p(fewer) = 0.755 → not fewer.
- **Null guard, N vs B:** false-Held 11 → 11 (0 / 0), true-Held 1 → 1 → noise does not mimic the effect. Of 27 units, the
  (held, pass) outcome differs on 1 between B and N, and on 3 between B and A.

**Only one of the three units that left false-Held did so because of the witness.** counter#1 had 6 rehearsal findings ("pressing
“Click Me” changed nothing on the page") and the turn ended open: un-held, not fixed. todo#1 and darkmode#2 diverged with **no**
rehearsal finding — a run-to-run difference (todo#1: a live search miss on a rung-climb subject, then empty model replies). Credited
strictly, the witness moved one unit.

### Why the witness could do so little here

On held-out, A ran 30 rehearsals: **3 passed, 8 failed, 19 were named gaps**, and **18 of the 19 gaps were pages that offer nothing to
do** (0 controls, 0 inputs) — the stitched pages. The sentence ("the calculator should calculate and display the user's BMI…") predicts
an action; the page has nothing to act on. The pre-registered rule says a gap does not by itself un-hold a page, so every stitched
false-Held page stayed Held in A. Of A's Held pages:

| what the witness said about the final page | Held pages | of them false-Held |
|---|---|---|
| a gap: the page offers nothing to do | 6 | 6 |
| rehearsed and passed (it responded) | 3 | 2 |

**The two that passed and are still wrong are word counters that respond with the wrong number** (wordcount#1 and #3: the "word count"
is the sum of word lengths, so five words give 27, not 5). The rehearsal only checks a value the SATISFY sentence names, and gemma's
sentences never named an example ("…output the number of words in that text"); "it responded" was all it could check.

### Dev, for contrast (not evidence)

On dev, after the rules were developed there, A took false-Held from 4 to 0 and true-Held from 5 to 8 (c-f, lb-kg, percent: rehearsed,
failed, re-opened, came back working). The dev false-Held pages were mostly drawn pages with dead buttons and reloading forms — what the
witness can see; the held-out ones were mostly stitched pages — what it cannot. The splits differ in the composition of failures, and nine
held-out asks are too few to have balanced it.

## What was built (kept, off by default)

- `fold-chat-rehearse.js` (pure; tests in `fold-chat-rehearse.test.mjs`). `planRehearsal` turns the SATISFY sentence mechanically into
  actions — the controls whose labels the sentence names (stemmed words via the app's `stemOf`, exact digits/symbols, in the sentence's
  order); if it names none and the page offers exactly one, that one; inputs filled with the sentence's numbers, else a probe — and an
  expectation: respond, show the sentence's numbers (one of them, or a number in their range), no throw, no NaN/undefined, no form
  submit that reloads the page. `judgeRehearsal` gives pass / finding / named gap. `regressionFinding`: a later page in the turn may not
  lose an atom or a passing rehearsal an earlier page held (it never fired in these runs). No model call is added; the model writes no plan.
- Wired in `fold-chat-folds.js` behind `?rehearse=1`, in the stitch test and the whole-page loop; the rehearsal frame has the canvas's
  sandbox (`allow-scripts allow-forms`). Off, the pipeline is unchanged and the observer's injected script is byte-identical.
- Instruments: `hidden.json`/`hidden.mjs` (24 hidden behavioural tests, each passing a hand-written reference page and failing it with
  its scripts removed: `controls.mjs`), `witness-controls.mjs` (the witness never fails a correct reference page and never passes a
  stripped one), `witness-replay.mjs` (dev only), `drive.mjs` (headless harness: web-llm shim + replayed web), `analyze.mjs`.
- **Full suite by test name, base `72ce5dd` vs `8d4276b`**, both run in the same directory: 2,695 → 2,711 tests; **no test that passes on
  the base fails on the branch**; the same 14 failures that predate this work on both; 16 new passing (the witness's own).

## Defects the runs exposed (reported, not fixed here)

1. **`stitchKit`'s `draw` is out of scope** (`fold-chat-folds.js`). Its `draw` member calls an identifier `draw` that does not exist in
   `stitchKit`'s scope (the pipeline's `draw` is local to `runPipeline` and is passed to `tryStitch` but never into `stitchKit`). The
   ReferenceError is swallowed by `createBuild` and every unit without a field snip is "refused … empty draw". So the stitched path — the
   default page builder — never reaches the model and can only hold pages of pasted source snippets: 6 of the 15 false-Held pages, all failing.
2. **`readAtoms` turns ask words into required labels** ("calculator", "app", "list", "converter"), so a working page that does not
   print the word is never Held. 7 held-out pages pass the hidden test but were left open; calc on dev was rejected on "the page does not
   show calculator" nine times.
3. **The page is in-browser-only** (`fold-chat.js` `NO_HEIMDALL`): headless Chromium has no WebGPU, so any headless eval needs the web-llm
   shim (`webllm-shim.mjs`). `eval/modelless/drive.mjs` answers `/v1/chat/completions`, which this page never calls.
4. **Run-to-run noise** comes from live search misses (rung-climb subjects not in the replay) and occasional empty model replies. At
   the (held, pass) level B and N differ on 1 unit in 27, but the logs diverge earlier.

## Exploratory, post hoc — NOT part of any verdict

*Written after the held-out result was known; it would need its own pre-registered run on fresh asks before anyone relied on it.*

If a rehearsal gap on a page that offers **nothing** to do (0 controls, 0 inputs) were a failure instead of a gap, the five stitched
false-Held pages left in A-held would have been un-held (A's false-Held 8 → 3). That only un-holds them; whether a re-opened turn then
builds a working page was not run. It would also fail every static make-ask (a flyer, a menu, a handbook page), and this set has none,
so its cost there is unmeasured. The cleaner remedy is upstream: fix defect 1, and do not hold a page of pasted snippets.

## What this does NOT establish

- One model (gemma2:2b via Ollama, standing in for the in-tab gemma-2-2b), one SATISFY prompt (the app's), 9 held-out asks × 3 seeds.
- The hidden tests were written by the author of the witness. They were frozen with controls before any run; they are strict about values
  and permissive about layout, so a correct page in an unanticipated layout fails both arms alike.
- The witness's ceiling is set by what the sentence names. A sentence with an example ("pressing 7 + 3 = shows 10") would give it values
  to check, but changing the prompt changes the base, and it was not tried.
