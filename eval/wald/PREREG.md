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
