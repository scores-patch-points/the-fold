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
