# Wald, shadow mode: pre-registration (2026-10-14, written before any Wald code is run on gold)

Question: on every prompt, does Wald's sequential decision over the surface's own witnesses decide **whether to pull the web** at least as well as the gate the surface runs today (`wantWeb`, `fold-chat.js:2532`), and does it record possible / probable / why on every turn?

## Gold (fixed now, nothing added after the first run)

- `eval/cases.json`: 73 cases. Label = `expect.search`. 64 true, 9 false. Only the first turn is read: 66 cases are single-turn, and for the 7 multi-turn cases the earlier turns are passed as prior messages *without* an assistant reply. That is declared as a limitation.
- `eval/ants/g1/corpus.mjs` … `corpus5.mjs`: only the rows whose gold says `wants: true` (output asks). Label = `gold.needsSources`.
  **Leakage, declared:** `describeOutput` was built against these corpora (the dev split was tuned on; the held splits have been seen since). The `output` witness's likelihood ratio on G1 is therefore optimistic. Every figure is reported twice: on cases.json alone (no leak) and on G1.

## Arms

1. **gate-now**: the conjunction at `fold-chat.js:2532`, rebuilt from the same organ calls with the same inputs. The parts that need live state (recall over an empty claim store, `srcRecall`, `primaryAsk`, `bookask`) are computed as on a fresh session.
2. **wald**: `wald.js` over the same witness votes. Each witness's likelihood ratio for `web` comes from the **other** gold rows (leave-one-out), with Laplace's rule of succession (add one to each count; Laplace 1814) as the only prior. α and β are gate-now's own measured false-pull and missed-pull rates on the same rows, floored at the rule-of-succession rate 1/(n+2) when gate-now makes no errors of a kind. Then A = (1−β)/α and B = β/(1−α) (Wald 1947 §3.3). Nothing is set by hand.
3. **null**: wald with each witness's votes shuffled across rows, so each vote's base rate is kept and its link to the row is broken. Fixed seed 20261014, 200 shuffles.

## Measures

- Missed pulls (label true, decided no pull) and wasted pulls (label false, decided pull), for each arm and each gold set.
- Rows that land in Wald's **continue** region (log B < Σ < log A). These are counted apart: they are neither a pull nor a skip. They are what shadow mode would send to the cheapest further pull.
- Wald's own decision time per row (resting cost).

## Bars (must all hold to move from shadow to gate, step 4 of the proposal; shadow wiring itself needs only bar S)

- **S**: shadow mode changes no live behaviour. The search decision is byte-identical with and without Wald on the real surface (checked on a live turn). Every turn carries `record.wald`.
- **B1**: wald missed pulls ≤ gate-now missed pulls on cases.json.
- **B2**: wald wasted pulls ≤ gate-now wasted pulls on cases.json **and** G1.
- **B3**: wald beats null on (missed + wasted) beyond the null's 95th percentile.
- **B4**: Wald's decision time per row is below the cheapest measured pull. Until pulls are timed live, the comparison is against 1 ms, the floor of a thread read; this is a declared stand-in, replaced by the first measured price.

A failed bar is reported as failed. No re-run after a look, except as a new amendment written before that re-run.

## Amendment 1 (2026-10-14): a language witness. Written before any code change and before any re-run.

**Why there is an amendment.** The first run failed B1: Wald missed 3 searches and the gate missed 1 on cases.json. All three misses (e_eiffel_ja, e_wall_ja, e_cap_ja) are Japanese asks. No witness could read them. `lookupWarranted` has no closed class for Japanese, so it returns `measured: false` and abstains. `classifyTurn` reads "chat", because there is no ASCII "?". The plan's web vote has a measured ratio of about 1.0. With almost no evidence, the §3.8 sign rule skips, where the gate searches by default. **Declared:** this amendment is written after looking at those failing rows. B1 on cases.json is therefore not a blind test of the new witness. The amendment is judged by every bar together, not by B1 alone.

**The new witness, `lang`.** It is one witness that casts one vote:
- **Inputs.** Only values that fold-chat.js already computes on the turn: `lang`, which is `lang0` (`detectLang(said, { prior: threadLanguage })`), and `closedClass`, which is whether `functionWordsOf(lang0 === "unknown" ? "en" : lang0)` returned a non-empty set. Both are passed into `witnessVotes` from the surface. The witness computes nothing itself.
- **Its vote.** When `lang` names a language (not `unknown`) and that language has no closed class, it votes `web: for`, with the why "an ask in ⟨lang⟩ that no closed-class reader reads". In every other case it abstains, and it casts no vote on any other pull.
- **Its ratio.** Like every other witness's, it is measured leave-one-out on the same gold by the same `calibrate.mjs`, with Laplace's rule as the only prior. Nothing is set by hand. The direction of the vote is a name; its weight is whatever the gold measures. That weight may come out at or below 1, and then the witness does not help.
- **The null.** It shuffles the new witness's column like every other column (same seed, same 200 shuffles).

**Unchanged:** the gold, the arms, α and β (the gate's own rates), the measures, and bars S, B1, B2, B3 and B4, word for word. One re-run follows this amendment. Every bar is reported pass or fail exactly as measured, together with any change on G1 (new misses or new wasted pulls) beside the first run's figures. If a bar still fails, it is reported as failed. Any change to the witness after this re-run needs Amendment 2, written before its own re-run.

## Amendment 2 (2026-10-14): the read-back paths, and multi-turn gold. Written and committed before any code change and before any run on the new gold.

**Why there is an amendment.** PREREG-METABOLISM Clarification 1 recorded one live turn where the gate read back and Wald would have searched. The live record has now been read (the shadow preview's ledger and sessions on localhost:8824, session `mv7o6ovcju1q`, turn 2). Turn 1 ("When did the Great Wall of China start being built?") was refused (unwitnessed), and its assistant message was stored with empty content. So `threadOf` found no answer, and `planTurn` planned "where did you get that?" as **cold-gap**. The reply was `coldFollowUpNotice`. **None of `sourceRecall`, `batonReply`, `inspectReply` or `challengeReply` fired**: each needs mode `web` or `thread`, and `srcRecall` stayed null. The ledger's votes were `kind web:for`, `plan none:for` and `plan web:against`. Wald's web sum was log 48.3 (kind for) + log 1.24 (plan against) = 4.09, between log B −2.82 and log A 4.49, so it was CONTINUE, truncated to pull. That gives two defects:
1. No witness reads that the ask is **about the last turn**. The watcher's PRE has read it that way (`want: source, sub: recall`), but that reading is not passed to Wald. The plan witness's "against" lumps cold-gap, clarify and thread together, and the gold measures it at 1.24, so an "against" vote pushes toward the web. That measurement comes from the 7 cases.json follow-ups, which are read without their assistant replies (the declared limitation).
2. When a read-back does fire, the `source` witness votes, but its ratio was never measured. `calibrate.mjs` hard-codes `srcRecall: null, primaryAsk: null`, so no gold row carries a source vote. Live, its term is dropped as "witness not in calibration".
**Declared:** this amendment is written after reading that one live record. No run has been made on the new gold.

**New gold (frozen with this amendment): `eval/wald/multiturn-gold.json`.** It has 99 rows over 11 real prior threads, with label `expect.search` (21 true, 78 false). The priors are stored messages, including the assistant replies, from three sources:
- `eval/wald/multiturn-live-2026-10-14.json`: the three live sessions above, exported from localStorage. Only the fields the read-back paths read are kept, and the export's hash was checked against the browser's copy.
- `eval/ants/watch-fixture-before-fix.json`: the 2026-10-06 live run. Each turn is rebuilt as {user: ask} and {assistant: spoken, provenance, authored}.
- `eval/ants/g2/repro-control-1791355297096.json`: the telephone turn, rebuilt the same way.

Each prior gets the same nine follow-ups:
- R: "where did you get that?", "source?" and "how do you know?"
- I: "what did you search for?" and "which pages did you read?"
- C: "are you sure?"
- N: "find a primary source"
- F: one new fact on the thread's topic
- M: "what did you tell me earlier?"

The labels come from rules L1–L4 in the file, not from any arm:
- **L1** (R, I, C → false): an ask about the last turn itself is answered from the record, whether or not the record holds a verified source.
- **L2** (N → true): an ask for new evidence searches, unless the last written answer already stored a primary-tier pointer on a non-tertiary host. Only P7 meets that, and it is read back (false).
- **L3** (F → true): a new fact on the topic searches.
- **L4** (M → false): an ask for the fold's own earlier words is a read of the record.

**Declared limits of the new gold:**
- Most asks are the author's. Only the real follow-ups are the person's: P3's "where did you get that?", P6's "find a primary source", P7's "where did you get that?", P9's "source?" and P11's F row.
- The rows cluster nine to a prior, so they are not independent.
- L2's exception mirrors `sourceRecall`'s own `hasPrimary` rule, so the gate agreeing on N rows is not independent evidence.
- P6–P11 come from a run made before the watcher existed, so no baton or detail is stored, and the inspect and baton paths cannot fire on them.
- Every real claim store is empty, so recall (L4) cannot fire anywhere. Those rows are kept as they are.

**The witness change: the `source` witness is extended. No witness is added.**
- (a) Unchanged: when `srcRecall` is set it votes `local: for, web: against`, and when `primaryAsk` is set it votes `web: for`. Its why now names which read-back fired (`sourceRecall`, `baton`, `inspect`, `challenge`), from the flags `srcRecall` already carries.
- (b) New: when neither is set and the watcher's PRE reads the ask as about the last turn, it votes `local: for, web: against`, with the why "the ask is about the last turn's own record". "About the last turn" means `want` is `inspect` or `challenge`, or `want` is `source` with `sub` `recall`. This is the cold-gap shape. A `source/new` ask without `primaryAsk` casts no (b) vote.
- **Inputs:** `want` = `watcherPre.want` and `wantSub` = `watcherPre.sub`. fold-chat.js already computes both. They are passed into `witnessVotes`, and the witness computes nothing.
- **Its weight:** measured leave-one-out like every other witness, with Laplace's rule as the only prior. Nothing is set by hand. The witness is still the one column `source` in the null shuffle.

**The calibration change.** `signalsOf` in `calibrate.mjs` now computes `watcherPre` (`watchPre`), the `srcRecall` chain (`sourceRecall` → `batonReply` → `inspectReply` → `challengeReply`) and `primaryAsk` from the prior messages, exactly as fold-chat.js does at lines 2528–2539. They are no longer null. `gateNow` keeps its formula, which already reads `srcRecall` and `primaryAsk`. On old-gold rows these come out null, because no prior there has an assistant reply. Any old-gold row whose gate or signals change is listed. The ratios are measured leave-one-out over old and new gold together, α and β are the gate's own rates on the other rows as before, and the shipped calibration uses all rows.

**Runs (two, both pre-registered here):**
- **Run A**: the new `signalsOf` with the Amendment 1 witness set, so `source` votes only on `srcRecall` and `primaryAsk`. This is the baseline. It shows how far computing the read-backs alone goes.
- **Run B**: Run A plus the extended `source` witness (b).

**Bars:** S, B1, B2, B3 and B4 are unchanged word for word. They are computed on the old gold sets exactly as defined (cases.json, G1, and all = cases + G1), for both runs. The new gold is reported **separately** with the same measures: missed, wasted and continue for gate-now and Wald, and the same shuffled null (same seed, 200 shuffles) on the new gold alone. The Clarification 1 row (`P3_R_0`) is reported by name. No bar is added for the new gold in this amendment, and Wald does not gate on the strength of it. A failed bar is reported as failed. Any change after Run B needs Amendment 3, written before its own re-run.
