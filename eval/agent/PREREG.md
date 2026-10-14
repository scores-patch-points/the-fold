# Does the agent test its own prediction? — pre-registered 2026-10-13, before any agent run

## The claim under test

The Fold's agent mode ("Agent +" → a fold, `fold-chat-folds.js` `runPipeline` / `onePass` / `stitchKit` / `observePage`) calls a page
**Held** when it runs without throwing, renders at least 4 nodes, shows the ask's required atoms (`fold-chat-require.js` `missingAtoms`),
changes over time if the ask names a behaviour (whole-page path only), and its claims survive `falsifyAnswer` against the sources read.
It never tests its own prediction: `readAsk`'s `SATISFY:` line ("what a thing that satisfies this ask would actually DO") is only fed
back into the outline prompt, and `observePage` never clicks or types.

Two questions, in order:

1. **How often is "Held" true?** On make-asks whose real behaviour is checked by a hidden test, what fraction of Held pages fail it
   (**false-Held**) and what fraction pass it (**true-Held**)?
2. **Does a rehearsal witness help?** The claim: *mechanically turning the SATISFY sentence into actions and an expectation, executing
   them in the sandboxed frame, and re-opening the turn when the rehearsal fails, lowers false-Held without lowering true-Held.*

## Instrument (frozen now)

- **Asks:** `eval/agent/asks.json` (md5 `78acabe17a95de8a541f821f3d65cfcd`), 24 everyday make-asks ("Make a simple calculator page.",
  "Build a stopwatch.", …). The ask text is all the agent ever sees.
- **Hidden tests:** `eval/agent/hidden.json` (md5 `7fb83cdec7014200a107d9dfeb47d224`), run by `eval/agent/hidden.mjs`
  (md5 `27054b2ea550a7ad61d2af5c1dbf7de6`) on the page the turn leaves (`cur.artifact.html`), in a fresh browser context with the
  network refused. Each is a list of alternative layouts (keypad or fields; a button or Enter; a button or a checkbox); any one passing
  is a pass. Examples: calculator — press 7 + 3 = and 10 appears (or fill 7 and 3 and add); countdown — after 12 s a zero / time's-up
  appears that was not there before; to-do — type "buy oat milk", add it, and it appears as page text; km→m — enter 1 and a 1000
  appears that was not there before. No app module imports either file.
- **Controls, run before this file was committed:** `eval/agent/controls.mjs` (md5 `021cc2249b23861b980052a12f0316bb`). For each of
  the 24 asks a hand-written reference page PASSES its hidden test (positive control; a second common layout too for calc, tip, todo,
  bmi, darkmode) and the same page with its scripts removed — the right labels, no behaviour — FAILS it (negative control).
  Result: 24/24 and 5/5, both directions. A hidden test that fails its control measures nothing; none does.
- **Split, by hash, not by hand:** an ask is held-out iff the first hex digit of `sha256("eval/agent:" + id)` is 0–7. Held-out (9):
  km-m, todo, counter, bmi, wordcount, dice, mi-km, darkmode, oddeven. Dev (15): calc, tip, c-f, countdown, stopwatch, password, lb-kg,
  percent, charcount, upper, reverse, interest, traffic, timestable, circle.
- **Unit:** (ask, seed). Held-out seeds {1, 2, 3} → 27 units; dev seed {1} → 15 units. If the harness smoke test (below) shows a unit
  takes more than 15 min of wall time, held-out seeds fall to {1, 2} (18 units) — a budget rule, decided now, not a measurement.
- **Harness:** `eval/agent/drive.mjs`. The real page from this worktree (`node server.mjs`), Playwright headless, the fold started with
  `window.__folds.create(ask)` exactly as "Agent +" starts it, and waited on until it stops running (wall: 45 min, else
  `settled:false`). The model: every `/v1/chat/completions` the page makes is answered by the **local small model** (Ollama
  `gemma2:2b`, the app's own floor) with the unit's seed added — the page's own prompts, temperature (0.2) and token limits are
  untouched. No bigger model anywhere. The web: every outside request is recorded per ask on its first run and **replayed** on later
  runs (`results/webcache/<id>.json`), so the arms read the same world; misses are fetched live and counted.
- **Harness hooks (behaviour-neutral, in the base too):** `window.__folds.isRunning()` and `cur.lastTurn = { held, passes, stop }`,
  recorded at the end of `runPipeline`. **Held** = `lastTurn.held`. Nothing else in the base is changed.
- **Smoke test:** one ask NOT in the set ("Make a page with a button that says hello.") is run once on the base to check the plumbing
  and the time per unit. Its result is not part of any measure.

## Arms

| arm | what it is |
|---|---|
| **B** | base: the agent pipeline at `72ce5dd` + the harness hooks; the witness OFF |
| **A** | the rehearsal witness ON (`?rehearse=1`), otherwise identical |
| **N** | null: **B re-run** on the held-out units, same seeds, same replayed web — how much two runs of the SAME code disagree |

## The witness (arm A) — constraints fixed now, details developed on dev only

- **Mechanical.** The SATISFY sentence the turn already produced is turned into **actions** (the page's own control labels and inputs,
  as `observePage` reports them, matched against the sentence's words the same way `missingAtoms` matches) and an **expectation**
  (numbers / words the sentence says should appear after the actions; a response to the actions). No new model call, no JSON or
  structured output from the model: the model still only speaks; extraction and judging are code.
- **Executed in the sandboxed frame** (`sandbox="allow-scripts"`), by dispatching clicks and input events from the injected observer.
- **A failed rehearsal is a finding** that fails the build's test (stitch path) or the round (whole-page path), so the turn re-opens with
  the finding, like any other.
- **An un-extractable SATISFY is a named gap on the log, never a pass.** It does not by itself un-hold a page (the base's other checks
  still decide); it is counted.
- **Regression check:** within a turn, a later page must not lose a required atom or a rehearsal that an earlier page held; a loss is a
  finding.
- **Additive:** with the witness off the pipeline is unchanged (a standing test asserts the off path adds no rehearsal).
- **Development:** the extraction rules are developed by reading **dev** logs and pages only (B on dev, then any number of A runs on dev,
  each kept under its own tag). Held-out logs and pages are not opened, and held-out B is **not run**, until A is frozen (its commit
  hash recorded in RESULTS.md). No rule may name an ask, a dev ask's words, or a hidden test.

## Order of runs

1. Smoke test (outside the set). 2. **B on dev** (seed 1). 3. Develop A on dev. 4. **Freeze A** (commit). 5. **B on held-out**, **A on
held-out**, **N on held-out** (27 units each). 6. RESULTS.md.

## Metrics (per unit)

`held` (the turn's own verdict), `pass` (the hidden test on the page the turn left; no page = fail), **false-Held** = held ∧ ¬pass,
**true-Held** = held ∧ pass; also false-open (¬held ∧ pass), passes per turn, model calls, wall time, rehearsal outcomes and named gaps.
Question 1 is answered from B (dev + held-out, every unit): false-Held and true-Held as counts and as rates of all units and of Held units.

## What falsifies the claim (decided now, applied mechanically, held-out units only, paired A vs B)

Units that did not settle in either arm are dropped pairwise and counted.

1. **false-Held drops:** exact McNemar, one-sided: b = units false-Held in B and not in A, c = the reverse; p = P(X ≥ b | n = b + c, ½)
   **< 0.05**.
2. **true-Held does not drop:** with b′ = units true-Held in B and not in A, c′ = the reverse, the one-sided McNemar p for "A has fewer"
   = P(X ≥ b′ | n = b′ + c′, ½) **≥ 0.05**, AND the one-sided Fisher exact p for "A has fewer true-Held" (as `fisherMore` in
   `eval/modelvsrules/run.mjs`) **≥ 0.05**.

**Supported** only if 1 and 2 both hold. If 1 fails: **falsified (not better)**. If 1 holds and 2 fails: **falsified as stated** (it
lowers false-Held only by holding less of what is true). The raw true-Held counts are printed beside the tests; a raw drop is said
plainly even when it is not significant.

**The null guard:** the same two tests are run B vs N. If B vs N alone shows a significant false-Held "drop" (test 1, p < 0.05), the
run-to-run noise is as large as the effect and the A-vs-B verdict is reported as **uninterpretable**, whatever it says.

## Only if supported (step 5)

The witness becomes on by default; a standing test is added; the full suite is diffed **by test name** against the base (`72ce5dd`):
no test that passes on the base may fail. Nothing is pushed.

## Known biases, stated before the run

- **I wrote the hidden tests AND the witness.** Mitigations: the tests and their controls are frozen above (md5) before any run; the
  witness is developed on dev only, held-out B is not even run until A is frozen, and no rule may name an ask. A witness that "learns
  the hidden tests" through the dev asks would be shaped like them — the held-out asks are different kinds of page (counter, to-do,
  dice, dark mode, odd/even, BMI, word count, two converters).
- **The hidden tests are permissive about layout** (alternatives) **and strict about values** (7+3 must show 10). A correct page in an
  unanticipated layout (e.g. BMI in pounds and inches; a counter labelled "Tally") fails — this inflates false-Held equally in B and A.
- **gemma2:2b only**, through Ollama with a fixed seed; Ollama's determinism with a seed is not assumed — N measures it.
- **The replayed web** removes live-web variance between arms; a rung climb that searches something new is fetched live.
- **27 held-out units is small.** With no reverse discordance, the primary test needs at least 5 units moved from false-Held to not
  false-Held to reach p < 0.05; a real but small effect can be missed.
- The witness's extra checks cost re-draws (more model calls, more time); this is reported, not judged.
