# Draft-lint: pre-registration

2026-10-15. Written before any lint arm runs on a frontier draft.

Companion: `DRAFT-LINT.md` is the design (events, verdicts, lints, rollout, fork delta). Its §9 is authoritative for arms, measures, and budgets; this file holds the pre-arm snapshot, replay set, and falsifiers. Neither file scores a turn the linter helped write.

## The question

Can mechanical linting over a frontier draft — its claims and its proposed actions — cut the unsupported-claim rate and the bad-action rate, without the linter adding content, blocking sound turns, or costing more than it saves? The draft is the model's; the verdict is the machine's.

## Where this starts (measured before this file)

- The line-level fold was retired: replayed over 1,010 real tool outputs it lost the identifiers the model went on to use as often as head/tail or random lines at the same size. Plausible help, measured equal to its null.
- The rehearsal witness was falsified: 29% true holds without it, the witness lowered false holds 11→8 at p=0.125 against a 0.05 bar. A model grading its own output is a witness that read nothing.
- The contest guard bound 5/5 — all five wrong.
- What holds: `mouth-repair.js` (word-level diff, additions typed `self:model`, content-adding or source-deleting repairs refused), `reasoning-lint.js` (strict inference-form lint on passages going in), `quotes.js` (verbatim/drifted/unlocated), the Kelsen chain (no conclusion without premises).

## Harness (declared)

- **Shadow first.** Full drafts are captured through the `event` path plus unclipped text (`FOLD_SHADOW=1`, local-only `shadow.jsonl`, never shipped). Every arm lints the shadow corpus offline. No blocking, no re-ask, no user-visible change until an arm clears its bar.
- **Faithful.** Arms run the real linters (`reasoning-lint.js`, `quotes.js`, `code-goal-lint.js`, `fact-gate.js`, credit gate over dossiers) on real drafts, never summaries of drafts.
- **Held battery.** Turns with known-unsupported claims (e.g. "tests pass" with no test run, "file X says Y" with X never read), known-bad actions (edits/shell drifting from the stated goal), and human-judged-sound turns for the false-positive denominator. Gold is never edited.

## Scoring, per turn, from the arm's output alone

- **HIT:** an unsupported claim or bad action is flagged/held, with the span and the address (or its absence) named.
- **MISS:** it passes unflagged.
- **FALSE ALARM:** a flag on a human-judged-sound turn.
- **Recall** = HITS / (HITS + MISSES), reported separately for claims and actions. **Precision gate** = FALSE ALARMS / sound turns. Also reported: lint tokens via the meter (a re-ask doubles frontier cost — counted, not hidden) and lint latency p95 on long drafts (currently unmeasured).

## Layers (each admitted only by its bars)

- **L0:** draft alone. Baseline; every layer beats this or retires.
- **L1: reasoning-lint (strict).** Begging the question, non-sequitur, scope errors. Inference form only, never content.
- **L2: grounding.** Each claim about the repo is checked against bytes the turn actually read (tool results are the evidence). A claim with no address is marked "asserted", never "known".
- **L3: action lint.** Proposed edit/shell against `code-goal-lint.js` and the user's stated goal. Drift is held, not rewritten.
- **L4: credit gate.** An archon named without a dossier is refused; with one, the dossier verdict rides along.
- **L5: Wald need-check.** Did the draft skip a pull the register says was cheapest-first? Advisory only, never blocking.

## Bars (chosen, disclosed as chosen)

- Shadow findings report precision first: nothing annotates or blocks until FALSE ALARMS ≤ 5% on sound turns.
- Recall must beat L0 on dev **and** held-out; WRONG (a held good draft blocked, a sound turn re-asked into worse) must never rise.
- Latency budget: p95 ≤ 2s per draft at the current corpus sizes; above it the arm is shadow-only until profiled.
- The linter may flag, strike, hold, or re-ask once (bounded, single system note). It may never add content words — checked by diff on every repair, like `mouth-repair`.

## Falsifiers

- A lint arm that adds a content word anywhere in its output fails the transfer constraint outright.
- A precise-on-reading arm that degrades on code turns fails the transfer claim; code and prose score separately, never pooled.
- Any arm that loses to L0 on replay retires like the line-level fold, no matter how principled it sounds.
- A held-trial win scored by the generator (self-grade) concedes the rehearsal-witness refutation and is void.
