# Wald, phase 2 (metabolism, trails, recursive learning): pre-registration

2026-10-14. Written before any phase 2 code exists and before any live turn is logged for it. Design: `docs/archons/WALD-PROPOSAL.md`, section *Metabolism II*. Phase 1 (`PREREG.md` and Amendment 1) is unchanged. This document governs only what is added on top of it.

## Prerequisite: a ledger that survives the tab

Phase 2 learns from turns, so turns must be kept. Each turn's `record.wald` is appended to a turn ledger with `turn`, `at`, the decision, `gateNow`, `webTaken`, `turnMs`, `passagesKept`, `cited` (whether any kept passage was cited by the answer) and the person's next act (`reask` / `sourceAsk` / `challenge` / `moveOn` / `none`). The ledger keeps no ask text, only the record's existing fields, so it is not a new exposure. Nothing below is measured until the ledger holds at least one full session written after this file's commit.

## What is measured, and on what

**Turns are scored prequentially (Dawid 1984).** Each logged turn is scored by the model as it stood *before* that turn, then learned from. No turn is ever scored by a model that has already seen it.

**Outcome per turn, per pull taken** (the earn-back):
- `returned`: true if the pull yielded something kept and used. For web, a passage is cited. For local or thread, the answer came from it. For none, the typed gap was real, meaning the next act is not a re-ask on the same topic.
- `missCost`: for a pull *not* taken, the next act is a re-ask, a source-ask or a challenge on the same topic, priced at that next turn's measured ms.

**Prices:** the median measured ms per pull kind, over the ledger so far, prequentially. No price is ever declared after the first measured one.

## Arms

1. **static:** phase 1 Wald, with calibration frozen at `fold-chat-wald-calibration.js` as committed.
2. **trail:** static plus one new witness, `trail`. It reads `kernel/stigmergy.js` (Wilson): head = kind + output type, route = the pull, ok = `returned`, ms = price. Its vote is `for` when the trail strength for (head, pull) is the strongest among the routes tried for that head, and `abstain` otherwise. Its ratio is measured prequentially like every witness. Laplace's rule is the only prior.
3. **trail-null:** trail, with each deposit's `ok` shuffled across deposits (same seed 20261014, 200 shuffles).
4. **recal:** static, with ratios and α, β re-measured prequentially from the ledger. α and β become Wald's *own* measured error rates, no longer the gate's.

## Exploration and the feedback trap (declared before any data)

In shadow, the only outcomes observed are for the actions the **gate** took. Because the gate decides deterministically, a pull it skipped is never observed. Off-policy evaluation of any arm is therefore possible only on turns where that arm's action and the gate's agree. Every result is reported with its count of agreeing turns, and nothing is claimed about the turns where they disagree.

When Wald is promoted to gate (not before), the CONTINUE region becomes stochastic. Wald pulls with probability σ(llr), the posterior implied by the summed log-likelihood ratio at even prior odds, which is a measured quantity, not a chosen rate. That probability is logged as the propensity, so inverse-propensity and doubly-robust estimators (Horvitz & Thompson 1952; Dudík, Langford & Li 2011) can evaluate other policies from the log. Outside the CONTINUE region the decision is deterministic, and those turns cannot be evaluated off-policy. That is declared, not hidden. This replaces stigmergy's hand-set `EXPLORE_EPSILON = 0.1` for Wald's use: the scout is the undecided region, at its own measured odds.

**Evaporation.** stigmergy.js declares a 7-day half-life. For Wald, the half-life is chosen prequentially from a candidate set taken from the data itself: the 25th, 50th and 75th percentiles of the ledger's gaps between turns on the same head. Whichever candidate gives the best prequential score so far is used, and the choice is logged each turn. The 7-day constant is used only until the ledger has a head with at least two turns.

## Bars (each must hold for its arm to be admitted; a failed bar is reported as failed)

- **M1 (lessons must make a difference):** trail's prequential score beats trail-null's 95th percentile on the same turns. If it does not, the trail witness is not admitted.
- **M2:** recal's prequential score is no worse than static's on the same turns. If it is worse, recalibration waits.
- **M3 (metabolism):** over the ledger, Wald's return on spend (returned ms / spent ms, counting only turns where Wald's action and the gate's agree) is reported per pull kind. The budget ceiling may grow only while the overall return is above 1. No other growth rule exists.
- **M4 (no blindness):** for every arm, the share of turns where its action differs from the gate's, and is therefore unobservable in shadow, is reported beside its score.

No re-run after a look, except under a new amendment written before that re-run.

## Clarification 1 (2026-10-14): before any measurement. The ledger had held one live session, no score had been computed.

**`cited` becomes `used`.** On the first live turn, a sources-only answer (`authored: "sources"`: the answer *is* the kept passages' own words) had no `record.cited`, so the ledger read the most direct possible use of a web pull as a waste. A kept passage is now `used` if the answer cites it **or** the answer is the sources' own words, and `usedBy` names which (`cited` | `sources`). The definition of `returned` for web reads `used` wherever it read "a passage is cited". No bar, arm or null changes.

**Recorded, not fixed:** on the same session's second turn ("where did you get that?"), the gate answered from the record with no search, while Wald's web verdict was CONTINUE, truncated to *pull*. No source or recall witness voted, because that read-back ran through a path no witness reads. That is a wasted pull Wald would have made, on a multi-turn shape the phase 1 gold does not contain. It is logged as a phase 1 finding, which needs multi-turn source-ask gold and an amendment of its own. It is not patched here.

**Status (2026-10-14):** the finding above is taken up by PREREG.md Amendment 2 (3c2c7d5). The path that fired was the planner's cold-gap, not a read-back helper. The results are in WALD-PROPOSAL.md, *Amendment 2*. No bar, arm or null of this document changes.
