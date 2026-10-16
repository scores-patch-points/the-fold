# POS projection for creoles without a treebank — results (2026-10-13)

Pre-registration: `POS-PROJECTION-PREREG.md` (§1–10 before any run; §11 after round 1; §12 after round 2). Module
`pos-projection.mjs`, falsifiers + mutations `pos-projection.test.mjs` (31 tests, every gate has a mutant that its falsifier
catches), driver `pos-projection-run.mjs`. Full tables: `packs/CALIBRATION.md` (R1 as pre-registered, R2 beside it),
`packs/CALIBRATION.json`, `packs/CALIBRATION-R1.json`, `packs/_work/*`.

## 1. What shipped

Five packs in `packs/` (POSPrior@1; nothing under `janus/priors` touched). Each carries its method, parallel sources and licences,
held-out guard log, training size, a gold-free chance check, coverage on the language's held-out running text (read-only), and the
calibration row nearest its data size.

| pack | trained on (outside the held-out set) | forms | token coverage of the held-out text | calibrated at | all-token accuracy there (with / without identity fill) |
|---|---|---|---|---|---|
| **mfe** | 498 en–cr pairs (MorisienMT train sample, MIT) + UDHR | 377 | 0.65 | pcm C2 189 pairs (**pack has 498: beyond the calibrated range**) · hat C2 | pcm 0.47 / 0.34 · hat 0.23 / 0.19 |
| **tpi** | 79 pairs (Tatoeba via kreyol-mt) + UDHR | 146 | 0.56 | pcm bitext 50 pairs · hat C2 | pcm 0.37 / — · hat 0.23 / 0.19 |
| **gcf** | 611 gcf–fra + 69 gcf–eng pairs (Tatoeba), no UDHR exists | 194 | 0.59 | pcm C2 189 pairs (beyond range) · hat C2 | pcm 0.47 / 0.34 · hat 0.23 / 0.19 |
| **sag** | UDHR only | 144 | 0.56 | C1 (UDHR only) · pcm, hat | pcm 0.27 / 0.09 · hat 0.19 / 0.14 |
| **jam** | UDHR only | 185 | **0.27** | C1 (UDHR only) · pcm, hat | pcm 0.27 / 0.09 · hat 0.19 / 0.14 |

"All-token accuracy" counts a token the pack does not know as wrong; accuracy on covered tokens is 0.47 (pcm C1), 0.63 (pcm C2),
0.33 (hat C1), 0.36 (hat C2). 95% intervals: pcm ±0.03; hat [0.11–0.27] / [0.14–0.31] (form-cluster bootstrap, wide).
Identity fill = a creole form spelled exactly like an anchor-language word takes that word's class. It is what rescues pcm (English
spelling); it is worth little for sag and tpi, so for them read the "without" column.

Not emitted: **pap, kea** (no gold exists on disk, so "beats Wiktionary on a held-out slice" cannot be tested; the UDHR projection agrees
with the Wiktionary packs on only 55–58% of the 20–36 forms they share and adds 51/60 closed-class forms Wiktionary lacks —
`packs/_work/pap-kea-agreement.json`). **srn, cbk** have no parallel text outside the held-out set.

## 2. How good the method is where gold exists (pcm test, non-trivial tokens; hat vs `pos-hat.json` lexicon)

| per UPOS | pcm C2 P / R (N) | hat C2 P / R (N) |
|---|---|---|
| PRON | 0.94 / 0.79 (189) | 0.20 / 0.05 (9,408) |
| ADP | 0.72 / 0.75 (72) | 0.30 / 0.55 (3,960) |
| ADV | 0.68 / 0.73 (94) | 0.04 / 0.02 (3,012) |
| DET | 0.46 / 0.85 (33) | 0.72 / 0.72 (3,953) |
| CCONJ | 1.00 / 1.00 (13) | 0.50 / 0.55 (1,215) |
| SCONJ | 0.83 / 0.45 (33) | 0.57 / 0.10 (1,752) |
| AUX | 0.38 / 0.15 (155) | 0.74 / 0.46 (3,763) |
| VERB | 0.79 / 0.34 (178) | 0.55 / 0.13 (8,923) |
| NOUN | 0.37 / 0.33 (142) | 0.39 / 0.18 (9,012) |
| ADJ | 0.73 / 0.51 (37) | 0.45 / 0.17 (2,383) |
| PROPN, PART, X | ~0 | ~0 |

Learning curve, pcm test (bitext pairs added to UDHR): 25 → 0.35, 50 → 0.37, 100 → 0.42, 189 → 0.47 all-token accuracy; UDHR alone
0.27. hat with 2,188 pairs (calibration-only; reads held-out text; nothing shipped): 0.47, macro-F1 0.40. More parallel text is the
lever; every curve was still rising.

Falsifiers: **F1 chance held in every fit** (real correct tokens exceed the best shuffled-pairing lexicon by 2×; for hat C1 only by
15%: 9,373 vs 8,165 — at UDHR scale hat's gain over chance is thin). **F5**: beats the all-majority baseline everywhere; beats
identity-lookup-only (B1) on pcm C2 and hat, but **not on pcm C1** (0.27 vs 0.31) — so the jam pack, which lives in C1 and shares
English spelling, is no better than looking each form up in `pos-eng`; it adds the alignment-projected classes on top. F2 (no held-out
sentence in training): guard dropped 899 + 27 gcf sentences, 0 elsewhere; F3/F4 by test and by `writeSafe`.

Predictions (§7): pcm C2 coverage/accuracy/macro-F1 landed inside the guessed ranges; pcm C1 coverage 0.57 was above (0.25–0.45), accuracy on
covered 0.47 inside, macro-F1 0.32 inside. hat harder than pcm: yes. I did not check the per-class effect of G1.

Selection (pcm dev, max-T): adopted M multi-anchor (UDHR vs eng+fra+spa together), G1 closed-class gate, I identity fill; rejected
G2 open gate, S clause-level UDHR, L held-out λ (the last two made dev worse by 66 and 99 tokens).

## 3. What the method cannot do

- **Tense/aspect markers** (`ka`, `ap`, `te`, `ke`, `dey`…) have no lexifier counterpart, so nothing projects onto them: `ka` is 218 tokens of
  the gcf held-out text and is absent from the pack. The spread statistic flags almost none of them as closed-like (0–1 forms per fit;
  as a function-vs-content detector the pack alone has precision 0.77–0.89, recall 0.46–0.70 on closed-class tokens;
  `_work/closedlike-calibration.json`). This is the original harm (function words read as names), and it is NOT fixed here.
- **Context**: type-level lexicon; a form keeps every class it earned, no disambiguation.
- **Open-class recall** is low everywhere (NOUN/VERB R 0.13–0.34); hapax forms cannot beat the shuffle null by construction.
- **Domain and orthography**: jam's UDHR spelling (`evribadi`, `ina`, `di`) is not the Tatoeba spelling (`deh`, `wah`, `mi`): 0.27 coverage.
  mfe is news-snippet text scored against speech; the calibration is the method's, not the language's.
- **The error bar is not the language's**: no gold exists for any of the five. The pcm and hat numbers say what this method does at
  this data size on two other creoles.
- The IBM-1 diagonal prior chose its grid maximum (λ = 16) in every fit; a longer grid was NOT tried, as it would be a post-hoc search
  rewarded by training likelihood (§11).

## 4. For the lead / user to decide

1. **Held-out files vs sag and jam.** Without them both are UDHR-only (≈ 0.09–0.14 all-token accuracy projection-only). Their staged
   Tatoeba samples hold ~1,000 (sag) and ~146 (jam) pairs; hat's curve says 1,000+ pairs roughly doubles accuracy. A split (half to
   build, half to evaluate language-ID) would change the ID baseline's denominator.
2. **Downloads** (nothing fetched): MorisienMT full train (21,810 en–cr, MIT; mfe from 498 → ~22k pairs), FLORES+ dev/devtest for
   tpi/sag/mfe (~1k pairs each), the full UD Naija-NSC and UD Haitian-Autogramm (gold to calibrate on a second held-out set).
   `packs/CANDIDATES.md` has filenames, URLs, licences and sizes.
3. **S-large** (hat, 2,188 pairs) read held-out Haitian text for calibration only; if that is not acceptable, drop that row — no pack,
   selection or other number depends on it.
4. **Wiring**: the packs are not reachable by the fold's salience layer yet (that is the salience ant's lane); `pos-<code>.json` is
   drop-in for `scripts/build-salience-prior.mjs --lang`. Read `provenance.calibration` before trusting a class.
