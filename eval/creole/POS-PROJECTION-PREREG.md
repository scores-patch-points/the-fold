# POS projection for treebank-less creoles — PRE-REGISTRATION (2026-10-13, before any projection run)

Branch `ants-creole-pos-projection`. Written before `pos-projection.mjs` exists and before any alignment, projection or
calibration number has been computed. Nothing below may be edited after the first run; later findings go in
`POS-PROJECTION-RESULTS.md` as an addendum, and a changed decision is a NEW dated section here, never an overwrite.

## 0. What I had already looked at (so the reader can discount it)

Looked at: file shapes, line counts, the sentence-overlap counts between buildable files and the held-out set (§2), the
UPOS totals of the pcm dev+test+train samples (3,609 tokens; PUNCT 979, PRON 534, VERB 503, AUX 370, NOUN 363, ADV 192, ADP 148,
INTJ 107, DET 92, SCONJ 88, ADJ 76, PART 46, NUM 43, CCONJ 33, PROPN 21, X 14), paragraph counts of the UDHR files, and the
tokenisation shapes of `pos-hat.json` / `pos-pcm.json`. Ran no alignment, no projection, no tagger.

## 1. Claim under test

A POS lexicon (POSPrior@1: form → UPOS counts) for a creole with no treebank can be derived from parallel text that is already
on disk, by projecting the lexifier-side tag through word alignment, with an error bar measured by running the SAME method
where gold exists (pcm: UD Naija dev/test; hat: the `pos-hat.json` treebank lexicon, which the method never reads).
The error bar travels with every pack. There is no pass/fail gate on a pack: a weak pack ships with a weak bar.

## 2. Data, and what is NOT used

Anchors (lexifier-side taggers, UD gold, read-only): `janus/priors/pos-eng.json`, `pos-fra.json`, `pos-spa.json`.

Held-out (language-ID held-out set, `eval/creole/BASELINE.md`): NOT used to build any pack. A training sentence is dropped if its
key (NFKC, lower-cased, letters+digits only) equals the key of ANY creole-side sentence of ANY held-out file. Measured before the run:

| file | unique | already in held-out |
|---|---|---|
| kreyol-mt hat-eng (creole side) | 145 | 0 |
| kreyol-mt tpi-eng | 80 | 0 |
| kreyol-mt gcf-fra | 1,541 | 910 → 631 usable |
| mt_kreolmorisien en-cr_train_sample | 500 | 0 |
| mt_mit_haiti ht-fr.trg / ht-es.trg | 1,496 / 96 | 1,473 / 73 → effectively none |

Consequence, stated up front: **sag and jam have no parallel text outside the held-out set except the UDHR** (31 articles ≈
2–3k tokens); mfe has 500 sentence pairs + UDHR; tpi 80 + UDHR; gcf 631 (+ eng side) + UDHR-less (no gcf UDHR; the Saint-Lucian
file `056` is a different creole and is NOT used).

UDHR: paragraphs aligned to the anchor-language UDHR paragraphs by Gale–Church length DP (the paper's constants, declared).
pcm sentence pairs: `text_ortho` ↔ `text_en` of the UD Naija samples.

Calibration-only use of held-out text (never shipped, never used for selection, labelled S-large in the results): hat with
`ht-fr` pairs (1,473 of them held out), to see the learning curve beyond what the unheld-out data allows. This reads the held-out
creole text but emits nothing from it; if the lead rules it out, drop S-large — no other number depends on it.

## 3. Method (fixed; the arms in §4 only switch parts on or off)

1. **Tokenise**: `foldText` (the fold's, khora scope: five Latin vowels' accents only; every other script and diacritic intact);
   tokens = runs of letters/digits; hyphen and apostrophe inside a run are kept; an apostrophe splits only when the left piece is
   1–2 letters and the right piece ≥ 2 letters (`l'ekol` → `l'` `ekol`; `dat's`, `ba'y` stay whole). Pure-digit tokens → NUM and
   pure-punctuation tokens → PUNCT by script, identically in every arm and never counted as projection successes.
2. **Align**: bidirectional IBM-Model-1 EM with a diagonal distortion prior (fast_align form; λ chosen from {0,1,2,4,8,16} by
   training likelihood, NULL mass learned by EM); EM until the relative log-likelihood gain is < 1e-6 (an optimisation tolerance, not
   a decision). Keep the INTERSECTION of the two directions' argmax links.
3. **Project**: each link (creole form f, anchor form a) adds the anchor's own UPOS distribution for a (normalised counts,
   "soft vote") to f. Ambiguity is preserved, never resolved.
4. **Null filter**: B = 199 shuffles of the pairing (a random derangement of the anchor sides), full pipeline re-run each time.
   A (form, class) vote is kept iff the observed vote strictly exceeds the maximum of the 199 shuffled votes (permutation p ≤ 1/200).
   Kept counts are the observed votes. Forms with no kept class are not emitted — a typed gap, not a guess.
5. **Emit** POSPrior@1 (`schema`, `language`, `provenance`, `forms`), with `provenance.giver` = method + parallel source + licence +
   calibration. Forms are stored folded. Never writes under `janus/priors`.

## 4. Arms and the selection rule

Base = steps 1–5, single anchor per sentence-pair file (eng, or fra for gcf-fra), UDHR aligned to eng.

| arm | what it switches on |
|---|---|
| **M** multi-anchor | for UDHR pairs, anchors eng+fra+spa vote together (each with its own shuffle; votes summed before the null comparison) |
| **G1** closed gate | a form that is "closed-like" (below) keeps only closed-class votes, if it has any; never creates a class |
| **G2** open gate | a form that is significantly bursty keeps only open-class votes, if it has any |
| **I** identity fill | an attested creole form with no kept vote, whose folded string equals an anchor form, takes that anchor distribution with weight 1 |

*Function-word statistic.* Creole-side sentences in input order; for block sizes k = 1, 2, 4, … (powers of two up to the number of
sentences) the document frequency of a form over blocks of k sentences, divided by its expectation under the shuffled-text null
(tokens permuted over all positions, sentence lengths kept; B = 199); T(f) = mean over k. **bursty**(f) iff T(f) is strictly below
all 199 null values (tf ≥ 2). **closed-like**(f) iff f is not bursty AND f is in the top-frequency set whose cumulative token mass
equals the lexifier's measured closed-class token share (UPOS ∈ {ADP, AUX, CCONJ, DET, PART, PRON, SCONJ} over non-PUNCT tokens
of the anchor pack) — a measured quantity, not a typed one.

*Selection (pcm only; one dev run per factor, in the order M, G1, G2, I):* a factor is adopted iff its paired per-sentence gain in
non-trivial-token accuracy, evaluated on pcm **dev**, strictly exceeds the maximum of 199 sign-flip permutations of the paired
differences (max-T, p ≤ 1/200). M is decided in condition C1, G1/G2/I in C2 (below). Not adopted = off in every pack. The
deltas of every factor are reported on test and hat anyway ("carry the fragility"); they do not feed back.

## 5. Calibration protocol

Conditions, for each calibrating language:

- **C1 UDHR-only**: fit on that language's UDHR (hat: both versions) only. This is the condition sag and jam live in.
- **C2 small bitext + UDHR**: pcm cross-fit — fit on {train sample, the OTHER of dev/test, UDHR} and score the one left out (about
  209 sentence pairs + UDHR); hat — fit on kreyol-mt hat-eng (145) + UDHR. This is the condition mfe, tpi and gcf live in. pcm is
  also fitted on random subsets of its C2 pairs (25, 50, 100, all) to give a learning curve; each pack quotes the row at its
  own pair count (rounded down), and says when its count exceeds the largest calibrated row (mfe: 500 > ~209).

Gold. pcm: UD Naija dev and test sample tokens (FORM, UPOS). hat: `pos-hat.json` as a token-weighted lexicon (each (form, UPOS,
count) is `count` gold tokens). The method never receives gold; `buildPack` takes no gold argument (a test asserts it) and the run
script hands gold only to the evaluator. Selection uses dev; reporting uses test (pcm) and hat. hat is the second language, run
once, never tuned on.

Prediction for a gold token = the arg-max class of its folded form in the pack (ties → alphabetical UPOS, declared), else
ABSTAIN. Reported per UPOS: N gold, N predicted, precision, recall (abstentions count against recall), and overall token
coverage, accuracy on covered tokens, macro-F1 over UPOS present in gold, with a 95% sentence-bootstrap interval (B = 1000;
the interval is a report, not a gate). PUNCT and NUM are scored by the script rule and excluded from the headline
("non-trivial tokens"), and shown in a separate row.

Baselines in the same table: **B0** tag everything with the training-gold majority class; **B1** identity lookup only (forms equal
to an anchor form take its dominant class, nothing aligned).

## 6. Falsifiers (the method is declared broken for a language if one fires — and the pack for that language is not emitted)

- **F1 chance**: the pack fitted on the SHUFFLED pairing must score strictly below the real pack on non-trivial-token accuracy
  (max-T over 199 pairing shuffles). If not, the "projection" carries no information beyond frequency.
- **F2 leakage**: no emitted training sentence has a key in the held-out set (test + run-time count printed).
- **F3 gold isolation**: `buildPack` never sees gold; the hat gold file is never opened by the builder.
- **F4 no-overwrite**: the run refuses any output path under `janus/priors`.
- **F5 beats the trivial**: the pack must beat B0 on non-trivial-token macro-F1 in C1 AND C2 on pcm test; if it only beats B0
  and not B1 it is reported as "identity-lookup-equivalent".

Each gate in the module has a test that fails first and a source mutation that must break it (`pos-projection.test.mjs`).

## 7. Predictions (guesses, written so the result can embarrass them)

pcm test, non-trivial tokens: C2 coverage 0.45–0.65, covered accuracy 0.55–0.75, macro-F1 0.30–0.50; C1 coverage 0.25–0.45,
accuracy 0.45–0.70, macro-F1 0.20–0.40. hat is harder than pcm in C1 (fewer cognates with eng/fra, UDHR-only). mfe at 500 pairs
should land between pcm C2 and hat C2. Function classes (DET, ADP, PRON, AUX) beat open classes on precision; NOUN/VERB/ADJ
recall is low because hapax forms fail the null. G1 helps AUX/ADP; I helps pcm and hurts hat.

## 8. What this does NOT claim

Domain shift is not calibrated: a pack built from news snippets (mfe) is scored on speech (pcm). The calibration is the error
bar of the METHOD at that data scale, not of the target language. Type-level lexicon only: no context disambiguation. Forms not
in the training text are absent (OOV is the main failure at question time and is reported as coverage). A projected label is
the label of the lexifier-side translation, not a verdict about the creole's own grammar (e.g. a TMA marker aligned to an English
auxiliary is labelled AUX, which UD may call PART or AUX).

## 9. Outputs

`eval/creole/packs/pos-<code>.json` (POSPrior@1) for each language whose F1–F5 hold; `packs/CALIBRATION.json`;
`POS-PROJECTION-RESULTS.md`; `packs/CANDIDATES.md` (what is not on disk, as a request).

## 10. Pre-run amendments (2026-10-13, written after the module + falsifiers exist and before ANY calibration or pack run)

- **A1 (compute).** Inside the 199 shuffled-pairing draws the diagonal sharpness λ is fixed at the value the REAL fit chose, not
  re-selected per draw. Selecting λ by grid inside every draw multiplies the null's cost twelvefold; the grid selection stays in
  the real run. Direction of bias unknown; reported.
- **A2 (F1 as implemented).** The chance falsifier compares the real pack's count of correct non-trivial tokens (abstention =
  wrong) with the same count for the RAW vote lexicon of each of the 199 shuffled-pairing draws (argmax per form, no filter).
  The real pack must exceed the maximum over draws. (Re-fitting the full filtered pack under 199 shuffles would need 199² runs.)
- **A3 (units).** Creole sentences are deduplicated by key, first occurrence wins (kreyol-mt gcf lists several French renderings
  per creole sentence). A source with fewer than 2 pairs is dropped (it cannot be shuffled, so it cannot be filtered). For the
  spread statistic one creole text is read per group (UDHR paired with three anchors is one document) and consecutive repeated
  sentences are collapsed.
- **A4 (hat gold).** `pos-hat.json` is a lexicon, so its tokens are resampled as clusters: each form with all its gold tokens is
  one unit. This bootstraps type-level uncertainty and is wider than a sentence bootstrap would be.
- **A5 (guard superset).** The held-out key set is a SUPERSET of the BASELINE list: every `source_sent` column of every tatoeba
  file (hat-eng, cbk, gcf-eng included), `ht-en.trg`, `ht-fr.trg`, `ht-es.trg`, `en-cr_{dev,test}`, and for pcm both `# text` and
  `# text_ortho` of dev and test — except that the pcm dev/test creole text is, by the prereg §5, read for calibration alignment
  in the cross-fit (never for any shipped pack).
- **A6 (pap, kea).** No gold for either exists on disk, so the "beats Wiktionary on a held-out slice" condition cannot be tested
  and no pap/kea pack is emitted. The projection is run and reported only as type-level agreement with the Wiktionary packs and
  as the count of closed-class forms the Wiktionary packs lack.
- **A7 (S-large).** Calibration-only run on hat with the held-out ht-fr creole sentences is reported separately and feeds nothing.
- **A8 (correction to A5, pre-run).** `tatoeba_sentence_mining/gcf-eng.tsv` is not in BASELINE's held-out list and is a build source for
  gcf; it is therefore NOT part of the guard key set (its overlap with `gcf-fra.tsv`, 27 of 96 sentences, is dropped by the key
  guard). The guard set is BASELINE's tatoeba files + `hat-eng_sample1` + cbk files + `ht-{en,fr,es}.trg` + `en-cr_{dev,test}`.

## 11. ROUND 2 — written after Round 1 (R1) results were seen; R1 is kept verbatim as `packs/CALIBRATION-R1.json`

What R1 showed (selection on pcm dev, report on pcm test and hat; all numbers are in `CALIBRATION-R1.json`, `_work/selection-R1.json`):
adopted M, G1, I; non-trivial-token accuracy (abstention = wrong) pcm test C1 0.27 / C2 0.47, hat C1 0.19 / C2 0.23, hat S-large
0.47; the chance falsifier held everywhere; **B1 (identity lookup alone) beat the method on pcm C1** (0.31 vs 0.27) and the
diagonal sharpness hit the top of the declared grid (λ = 16) in every fit. Reading the alignments by eye on hat UDHR
(`le~whereas  paske~contempt  moun→AUX`) showed paragraph-length units (~50 words) are too long for IBM-1 to learn from.

R1 numbers were seen before the changes below. They are therefore NOT a clean pre-registration; they are repair arms. The R1 table
stays the headline "as pre-registered" row; R2 is reported beside it, never instead of it. hat was "run once, never tuned on" —
**T below is informed by the shape of hat's gold forms and R2's hat numbers are therefore contaminated by that knowledge**; the
R1 hat row is the untouched one.

- **T (convention, always on in R2).** An elision splits into a BARE clitic and the word (`l'ekol` → `l` `ekol`, `n'ap` → `n` `ap`):
  the Fold's tokeniser keeps `l'ekol` whole and a consumer splits elision itself, and UD Haitian's gold tokens are `l` + `'` +
  word (`l` PRON 1,215 vs `l'` 2). Anchor-side forms ending in an apostrophe pool with their bare form (`qu'` → `qu`).
- **S (arm).** UDHR pairs are cut again below the paragraph: each matched paragraph pair is split at `. ; : ! ?` and the clauses
  are aligned by the same Gale–Church DP, where both sides have more than one clause.
- **L (arm).** λ is chosen by 2-fold HELD-OUT likelihood (train on half the pairs, score the other half, both ways) rather than
  training likelihood, because training likelihood rewards a sharper position prior without limit on tiny data.
- **Selection in R2.** Same rule (max-T, B = 199, paired per-sentence correct counts on pcm dev), order M, S, L, G1, G2, I; S and L
  are decided on C1 and C2 dev concatenated (one test, two conditions), the rest as in §4.
- **Not done, on purpose:** the λ grid is NOT extended (a sharper prior is not evidence the alignments are better), no new
  tagger, no threshold. If R2 is not better than R1 on pcm test, R1 packs ship.
