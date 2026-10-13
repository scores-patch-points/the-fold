# Creole salience — pre-registration (written 2026-10-13, BEFORE any measurement run)

Branch `ants-creole-salience`, parent 59d8264. Committed before `eval/creole/salience-measure.mjs` has ever been run, so the git
timestamp orders it ahead of every number in `SALIENCE-RESULTS.md`.

## 0. What I had looked at before writing this (disclosure)

Source code (the salience layer, murmur, frame, witness, typing), the four POS packs' provenance blocks and ~20 hand-picked forms
from each pack (ki, di, wetin, weh, em, se, pa, yon, nan, te, na, dem, wey, a, la, e, un, ta), file sizes and line counts of the
held-out files, and the first 30 lines of the Naija dev sample. I had NOT tokenised the gold, counted a single closed-class token,
or run any metric below. SHA-256 prefixes, so a later reader can tell the files did not move:

| file | sha256[:16] |
|---|---|
| janus/priors/pos-pcm.json | ecdf7cf6b1110dee |
| janus/priors/pos-hat.json | 7fa3dcb00dc6b998 |
| janus/priors/pos-pap.json | 9d478a4fab685793 |
| janus/priors/pos-kea.json | e74b041ef3f09594 |
| creoleval/pos_ud_naija_pcm/pcm_nsc-ud-dev_sample.conllu | 0fd23687101c20ea |
| creoleval/pos_ud_naija_pcm/pcm_nsc-ud-test_sample.conllu | 436a36e12494c6ee |
| creoleval/pos_ud_naija_pcm/pcm_nsc-ud-train_sample.conllu | 09aefa2a6e050169 |
| creoleval/mt_mit_haiti/ht-en.trg (the Haitian side) | e030ccee65d416f1 |
| creoleval/tatoeba_sentence_mining/hat-fra_sample1.tsv (column 0 is Haitian) | 9a2d599e3239658e |
| creoleval/tatoeba_sentence_mining/pap-eng_sample1.tsv | 7bf5dab04f004579 |

## 1. The premise problem, found by reading the code (not by measuring)

The task: "make the creole POS packs reach the question reader" by building `fold-chat-salience-prior-{pcm,hat}.js` the way `-es` /
`-fr` are built. Reading `scripts/build-salience-prior.mjs`: it **drops every form whose weighted score is 0**, and the weights
(PROPN 9, NOUN 7, VERB 6, ADJ 4, ADV 1) give every function class 0. So in a module built that way a function word is
**absent**. And in `fold-chat-salience-infer.js` / the witness the reading of an absent form is `salienceOf == null`, which the
witness reads as a *candidate name* (`salienceOf(t, L) == null || isName(t, L)`, fold-chat-witness.js:467, 507, 547) and the
murmur reads as "names something I have not met" (fold-chat-murmur.js:152) — unless the form is in the language's closed class,
which comes from `FUNCTION_WORDS[lang]` (13 languages, no creole) via `functionWordsOf(lang)`.

For es/fr that works only because `FUNCTION_WORDS` already has es and fr. For pcm/hat it does not. So there are two layers, and
the asked-for one is not enough on its own:

* **L1 — the salience module** (what was asked): `fold-chat-salience-prior-{pcm,hat}.js`, registered in `PRIORS`.
* **L2 — the closed class** (what is needed for "function words stop being names"): the list of forms the same pack calls
  closed-class, by the **same rule `scripts/build-function-words.mjs` already uses** (a form is a function word when ≥ 5 of its
  tokens and ≥ 50 % of them are DET/ADP/AUX/PRON/CCONJ/SCONJ/PART — no new threshold), emitted by the same builder into the same
  generated module as `CLOSED_CLASS`, exposed by `fold-chat-salience-infer.js`, and read through the existing one door
  `functionWordsOf(lang)` (fold-chat-snippets.js) and by the murmur. It is deliberately NOT merged into `FUNCTION_WORDS`,
  because `junk`, `region` and `lang-facts` union every language's function words and "na", "di", "a", "ki" must not leak into them.

PREDICTION P1 (stated now): L1 alone leaves the closed-class share that is read as a name/content word at ≈ the same value as
before; L2 is what moves it. I report L1-only as its own row so this is visible, not asserted.

## 2. Instruments — the Fold's own code, imported from a checkout root (before = parent commit extracted by `git archive`; after = this branch)

**M2 — the frame/witness predicate (language forced by the caller).** For a token `t` and language `L`:
`closed = closedClassOf(functionWordsOf(L), L)(foldText(t))` (fold-chat-frame.js, fold-chat-snippets.js);
`measured = salienceOf(t, L)`; `name_candidate = !closed && (measured == null || isName(t, L))`;
`content = !closed && measured != null && !isName(t, L)`. "Treated as a name or content word" = `!closed`. Categories reported:
closed / name-candidate / content.

**M1 — the murmur, end to end (language NOT forced).** `murmurOf({ question: sentence })` with the language `detectLang`
returns; a token is "treated as a name/content word" when it is in the returned `names ∪ content ∪ unknown` (the murmur's "about
this", "this names" and "names something I have not met" lines). Reported with the share of sentences whose detected language was
the target (the part of the problem that belongs to the language-ID ant) — M1 can only improve where the language reaches it.

## 3. Data and what "held out" means here

* **pcm**: UD Naija-NSC `dev` + `test` samples (UPOS gold). Closed-class gold tokens = UPOS ∈ {DET, ADP, AUX, PRON, CCONJ,
  SCONJ, PART} with at least one letter. **The pack was built from the TRAIN split only** — verified from its provenance block:
  `giver: "…UD_Naija-NSC (train split)"`, `sentences_read: 7279`, `tokens_read: 111916`. I additionally count exact-sentence
  overlap between dev+test and the staged train sample (96 sentences) — a lower bound on leakage, reported, expected 0.
  Limit: the staged files are `_sample` subsets (105 dev + 113 test sentences), so N is a few thousand tokens, not the whole split.
* **hat**: no staged held-out gold. Held-out text = `mt_mit_haiti/ht-en.trg` (Haitian side, children's stories) +
  `hat-fra_sample1.tsv` column 0 (web-mined Tatoeba/JW-style pairs; noisy, baseline caveat). Nothing is hand-tagged. Reported:
  (G1) the named forms ki/yon/nan/se/te/pa (+ di, a, la, e as controls) before/after through M2 and how many of the null builds
  also close them; (G2) the share of held-out token mass M2 calls closed — a COVERAGE number, **not an accuracy**; (G3) names
  swallowed: held-out tokens written with an initial capital that are NOT the first word of their line and not after an opening
  quote/dash, called closed (expected 0; compared with null).
* **pap, kea**: Wiktionary headword packs (789 / 883 forms, token mass 835 / 951 — one count per form). Held-out text =
  `pap-eng_sample1.tsv` column 0 (Papiamentu); no staged kea text exists (`kea` has no Tatoeba file in the folder).

## 4. The null

Same module, same builder, same measurement, but built from the pack with the **tag distributions permuted across forms**
(`--shuffle SEED`: Fisher–Yates over the form keys with mulberry32(SEED), distributions carry their counts, so form set, count
mass and the ≥ 5-token rule are all preserved; only which form owns which tag mix is destroyed). 20 seeds (1..20). A gate is met
only when the real value beats the **minimum of the 20 null values** — rank-based, one-sided exact p ≤ 1/21; no number is
chosen by hand. N, the null min/mean/max and the real value are printed together.

## 5. Gates and predictions (direction only; numbers come from the run)

| id | quantity (pcm held-out gold) | prediction | gate |
|---|---|---|---|
| A | closed-class gold tokens still read as name/content by M2 | before = 100 % by construction (no pcm closed class exists) → after clearly lower; L1-only ≈ before | after < min(null) |
| B | the same through the murmur (M1) | improves only in the sentences where `detectLang` returns pcm; likely a small share (the 41 % wrong-language baseline) | reported, not gated (confounded by langid) |
| C | false-closed: gold NOUN/PROPN/VERB/ADJ/ADV/NUM tokens M2 calls closed | small, because the rule needs ≥ 50 % closed-class | after ≤ null mean is NOT required; reported with precision; gate = precision(after) > max(precision(null)) |
| D | PROPN gold tokens called closed | ~0 | after ≤ min(null) |
| E | precision of the closed set on running tokens (called-closed that are gold-closed) | high | after > max(null) |

If A fails (after ≥ min(null)) the conclusion is "the pack does not carry the closed class across splits"; I will say so and not
wire L2. If C/E fail, L2 is not wired and L1 alone is shipped (and said to do nothing for function words).

## 6. Decision rule for pap and kea (declared now; no gold exists, so "no harm" is proxied by two mechanical checks)

Build both in a scratch directory first; wire a language only if ALL hold on its held-out text:
1. **H1** — names swallowed (G3) = 0.
2. **H2** — no function word is made content: sort the held-out forms by frequency, accumulate until half of the token mass is
   covered (the median cut: a definition, not a tuned value); no form inside that set may carry a salience > 0 in the pack.
   The most frequent forms of any running text are overwhelmingly closed-class (Zipf); a headword list that scores one of them as a
   noun/verb/adjective would make a function word a content word.
3. kea has no held-out text staged, so H1/H2 cannot be run → kea is refused (no check, no wiring), whatever pap does.

Expected: pap fails H2 (the pack lists `ta` as a VERB; Papiamentu `ta` is the copula/progressive marker and top-frequency). If it
passes, it is wired and says so; if it fails the failing forms are listed in the results.

## 7. The live page

`node eval/modelless/drive.mjs --prompts eval/creole/prompts.json --only creole --conc 1`, with `FOLD_URL` pointing at a server
started from THIS worktree (port 8821; the :8814 server serves `the-fold-panel-fixes`, not this checkout) and, for the "before",
at a server started from the `git archive` of the parent commit (port 8822). Per prompt I record the stored turn's shown text,
`lang`, `kind`, and the murmur lines naming ki / di / wetin / weh / em / bilong as a name or as "not met".

PREDICTION P4: the end-to-end page does NOT change for most of the six asks, because the language never reaches the packs:
`detectLang` returns `unknown`/`en`/`hu` for them (measured at the start of this session: 4 unknown, 1 hu, 1 en), the page calls
`murmurOf` without a thread prior (fold-chat.js:2302, not editable here), and no pcm/hat grammar table exists for the frame. The
packs can only act where the language is right. To separate the two failures I also run the SAME served modules in the page
with the language injected through the existing `prior` parameter, for the six asks, and report both.

## 8. What would count as having failed

* A moves less than the null can explain → the closed class does not transfer; report.
* The full suite shows any failure beyond the two known pre-existing ones (`every archon dossier passes the disclosure rule`,
  timing-flaky `race over the real heimdall bridge`) → fix or revert the wiring, not the test.
* Any es/fr module byte differs from the parent → I regenerated something I should not have.
