# Creole salience — results (measured 2026-10-13; pre-registered in SALIENCE-PREREG.md, commit 0c066e9, before any run)

`node eval/creole/salience-measure.mjs all --before <git archive 59d8264> --json out.json` (36 s), `… pap`, and
`eval/modelless/drive.mjs` + `eval/creole/live-inject.mjs` against two servers (this branch :8821, the parent tree :8822).
Everything below is deterministic except the live page's web lanes.

## 0. What was built

| piece | what |
|---|---|
| `scripts/build-salience-prior.mjs` | new flags `--closed` (emit `CLOSED_CLASS` by the **same rule as `build-function-words.mjs`**: ≥ 5 tokens, ≥ 50 % DET/ADP/AUX/PRON/CCONJ/SCONJ/PART; closed forms are omitted from the salience table), `--shuffle SEED` (the null), `--out`. Rebuilding es and fr with it is **byte-identical** to the committed modules. |
| `fold-chat-salience-prior-pcm.js` | 3,637 salient forms + 163 closed-class forms, from `janus/priors/pos-pcm.json` (UD Naija-NSC **train** split, 111,916 tokens). |
| `fold-chat-salience-prior-hat.js` | 2,179 salient forms + 89 closed-class forms, from `janus/priors/pos-hat.json` (UD Haitian_Creole-Adolphe train split, 55,527 tokens). |
| `fold-chat-salience-infer.js` | registered like es/fr (`PRIORS.pcm`, `PRIORS.hat`; the detector's Haitian labels `ht`, `hatkreyol`, `hatpopular` resolve to the one module); `closedFormsOf`, `isClosedForm`, `hasPrior`. |
| `fold-chat-snippets.js` | `functionWordsOf(lang)` falls back to the module's closed class when `FUNCTION_WORDS` has no entry — the one door the frame, witness, answerwire and pivot already read. `FUNCTION_WORDS` itself is **not** widened. |
| `fold-chat-murmur.js` | reads the ask's function words and salience in the detected language when the Fold holds a prior for it (was: always English salience). |
| `fold-chat-salience-creole.test.mjs` | 16 falsifier tests, written first and failing (module not found), then green. |

**pap and kea: refused** (§5). **fold-chat-langid.js, fold-chat-lang-priors.js, fold-chat.js, index.html: not touched.**

## 1. The premise problem (why there are two layers)

The task as written ("build `-pcm`/`-hat` the way `-es`/`-fr` are built") would not have fixed function words. The builder drops every
function-class form (weight 0), so a function word is *absent* from the module, and an absent form is "unmeasured" — which the witness
reads as a candidate name and the murmur as "names something I have not met". es/fr escape this only because `FUNCTION_WORDS` already
has es and fr. Measured below: **the salience module alone (L1) moves nothing; the closed class (L2) does it.**

## 2. pcm — held-out gold (UD Naija dev+test samples)

216 sentences, 2,187 letter-bearing tokens; closed-class gold **N = 1,079**, content-class gold N = 988, PROPN gold N = 13.
Null = 20 seeded builds (tag distributions permuted across forms). L1 only = `-pcm.js` built the way es/fr are (no closed class).

| quantity | before | L1 only | after (L1+L2) | null min / mean / max |
|---|---|---|---|---|
| **A** closed-class gold tokens the Fold still reads as a name or content word (M2) | 100.0 % | 100.0 % | **2.0 %** | 82.8 / 94.4 / 99.2 % |
| A′ … of which as a name candidate | 100.0 % | 85.4 % | 1.3 % | 12.0 / 25.3 / 44.8 % |
| **C** content-class gold tokens called closed (false-closed) | 0.0 % | 0.0 % | **10.0 %** | 0.7 / 3.3 / 9.4 % |
| **D** PROPN gold tokens called closed (of 13) | 0 | 0 | 0 | 0 / 0.55 / 5 |
| **E** precision of the closed set on running tokens | — | — | **91.4 %** | 19.1 / 55.7 / 86.0 % |
| B closed-class gold read as name/content/unknown by the murmur, language as detected (M1) | 49.0 % | 48.8 % | 47.2 % | 48.8 / 49.4 / 49.7 % |

Gates (pre-registered, rank-based vs the 20 nulls): **A met** (2.0 % < 82.8 %), **D met**, **E met**. Each gate was mutation-checked
by rewriting the saved run (null := after → A and E not met; PROPN swallowed = 5 → D not met; precision 10 % → E not met; no effect →
A not met). Note D is a harm gate (≤): with only 13 PROPN tokens in the sample it is weak evidence.

What the 22 misses (A) and the 100 false-closed tokens (C) are:

* misses: `weh`×8 (SCONJ, only 2 train tokens: under the ≥ 5 floor), `one`×4 (DET, but NOUN/NUM/ADJ in 74 % of the train tokens), `so`×3,
  `wah`×3, one each of ourself/come/anytin/beside.
* false-closed: **`go` ×56 and `dey` ×35 are 91 of the 100.** The pack tags `go` AUX 70 % / VERB 30 % and `dey` AUX 77 % / VERB 23 %; the
  rule closes them. They are tense/aspect markers in most uses, but "go" the verb ("go school") is now closed-class, i.e. never a
  referent and never the ask's relation. That is the cost of C = 10 % and it is a real one — see §6.

M1 is bound by language ID, not by the module: the murmur's own detector called **6 of 216** pcm sentences pcm (204 English).
On those 6 sentences (30 closed-class tokens) the share still read as name/content fell **77 % → 10 %** (23/30 → 3/30). With the
existing thread parameter `prior:"pcm"` injected, 35 of 216 sentences end up in pcm (the detector overrides the prior whenever the
text has evidence of its own — Naija is full of English-looking words) and there 47/81 → 3/81. Added after the prereg run as
clearly-labelled exploration; not gated.

**Held-out check of the pack's provenance.** `pos-pcm.json` provenance: `giver: "…UD_Naija-NSC (train split)"`, `sentences_read:
7279`, `tokens_read: 111916` → built from TRAIN only. Exact-sentence overlap of dev+test with the staged train sample (90 sentences):
dev 0, test 1 (`okay //`, a one-word utterance). The staged files are `_sample` subsets (104 + 112 sentences), so N is ~1,000 tokens, not the
treebank.

## 3. hat — no staged gold; held-out text only, nothing hand-tagged

2,558 lines (`mt_mit_haiti/ht-en.trg` + `hat-fra_sample1.tsv` col 0), 34,481 letter-bearing tokens.

| quantity | before | L1 only | after | null min / mean / max |
|---|---|---|---|---|
| G2 token mass the Fold treats as closed-class (**coverage, not accuracy**) | 0.0 % | 0.0 % | 42.3 % | 1.0 / 3.8 / 7.5 % |
| tokens read as a name candidate (unmeasured or PROPN-dominant) | 100.0 % | — | 21.9 % | 26.6 / 32.4 / 40.7 % |

G1, the named forms (M2 category; "null seeds" = how many of 20 shuffled builds also close it):

| form | before | after | null seeds that close it |
|---|---|---|---|
| ki | name | **closed** | 0 |
| yon | name | **closed** | 0 |
| nan | name | **closed** | 1 |
| se | name | **closed** | 4 |
| te | name | **closed** | 5 |
| pa | name | content (ADV 89 % → salience 1/9: "low", never a name) | 0 |
| di | name | content (VERB 97 % in hat — 'to say'; **closed in pcm**) | 0 |
| a, la, e | name | closed | 1, 1, 1 |
| moun / ayiti | name | content / name (correct) | 0 / 1 |

**G3 failed its pre-registered expectation.** I said capitalised mid-line tokens (name evidence) called closed would be ~0; they are
**54 of 1,901**, null 13–69 (so not below the null min either). All 31 distinct forms are function words (Pou ×8, Lè, Yon, Li, Devan,
Ki, Nan, Se, Si…), and all 31 also occur lower-cased in the same text (a diagnostic added after the run): sentence-initial or title-case
capitals inside lines my boundary test did not split. So the proxy is confounded, not evidence of names being swallowed — but the
pre-registered number did not come out as predicted and the proxy cannot be used to certify "no names swallowed" for hat. No gold
exists to do better.

## 4. The live page (no model reachable; `eval/creole/prompts.json`)

| ask | before (parent tree) | after (this branch) | detector said |
|---|---|---|---|
| Ki kapital Ayiti? | names "ki", "ayiti"; "kapital" not met | **same** | unknown |
| Ki kapital Moris? | names "ki", "moris"; "kapital" not met | **same** | unknown |
| Wanem em kapital bilong Papua Niugini? | names wanem/papua/niugini; em/kapital/bilong not met | **same** | unknown |
| Weh a di capital a Jamaica? | names weh/di/jamaica | **same** | unknown |
| Ki moun ki ekri Les Misérables? | "arrives in hu"; names ki/les/miserables | **same** | hu |
| Wetin be di capital of Nigeria? | names wetin/di/nigeria | **same** | en |

0 of 6 changed (answers/rules differ between runs only by web-lane variance: #0 and #4 flipped R0↔R1 in opposite directions).
Heimdall was not mounted in either server (sibling path missing in this worktree layout), the same for both.
**Prediction P4 held:** the language never reaches the packs on the live page — `murmurOf` is called without a thread prior
(fold-chat.js:2302, not editable here) and `detectLang` returns unknown/en/hu for all six.

With the language injected through the existing `prior` parameter and the modules **as the running server serves them**
(`eval/creole/live-inject.mjs`):

| ask (prior) | before | after |
|---|---|---|
| Ki kapital Ayiti? (hat) | names ki, ayiti; unknown kapital | names **ayiti**; content **kapital** |
| Ki kapital Moris? (hat) | names ki, moris; unknown kapital | names **moris**; content **kapital** |
| Ki moun ki ekri Les Misérables? (hat) | detector overrides the prior → hu | **same** (hu) |
| Wetin be di capital of Nigeria? (pcm) | detector overrides the prior → en; wetin, di names | **same** |
| Tok Pisin and Jamaican asks | no pack exists (tpi, jam) | **same**: em, bilong, weh, di still names |

## 5. pap and kea — refused

Pre-registered rule (§6): wire only if H1 (no name swallowed) and H2 (no form in the half-token-mass set is given a salience > 0) hold;
kea has no staged held-out text so it is refused by rule 3.

* **kea**: refused, no held-out text, so no check could be run.
* **pap**: closed class **0 of 789 forms** (every form has a count of 1; the ≥ 5-token rule can never fire), so H1 is vacuously 0 and
  L2 does nothing; **H2 fails**: of the 47 forms making up half the 18,457 Tatoeba tokens, 12 are given a salience > 0:
  `ta`(737, VERB→6) `por` `lo` `tabata`(142) `tin` `bisa` `hasi` `yuda` `mester` (verbs/aspect markers) and `hende` `ora` (nouns) `otro`.
  `ta` alone is 4 % of all tokens and is the copula/progressive marker: it would be scored a verb (the witness's relation-verb logic is
  `posRankOf == 6 && !closed`). The pack is a headword list (one Wiktionary POS per form), not a corpus distribution.
* **Caveat on H2, stated plainly:** run on the good packs as a control, H2 flags 10 forms in pcm (say, work, school, money…) and 32 in
  hat (moun, manje, bondye, …) — frequent *content* words. So H2 as registered cannot tell a harmful pack from a good one; the pap
  refusal rests on the rule, on the empty closed class, and on the specific `ta`/`tabata`/`por`/`lo`/`tin` evidence — not on H2 alone.

## 6. What needs the user's decision

1. **go / dey (C = 10 %).** The pack's own majority reading closes them. Option: exclude forms that are also VERB ≥ 20 % from the
   closed class (a new threshold — I did not add one without a null for it), or accept. Until the pcm grammar table exists nothing
   reads `go`/`dey` as a relation anyway.
2. **The murmur now reads es/fr asks through the es/fr salience prior** (it read every language through English before). The suite is
   green; this is a behaviour change beyond the creoles that came with "read the detected language through its own prior".
3. **Language ID is the bottleneck.** On the page the packs act on 0 of 6 asks; in the murmur on 6/216 (35/216 with the thread prior).
   That layer, the grammar tables, and POS projection for tpi/mfe/jam/gcf/srn are other owners' (`weh`, `em`, `bilong` stay names).
   Any pack they produce plugs in the same way: `build-salience-prior.mjs --closed`, then one line in `PRIORS` and one in `CLOSED`.
4. **No hat gold.** G2/G3 are coverage and a confounded proxy. A few hundred UD_Haitian_Creole-Adolphe *dev/test* sentences would
   make hat as measurable as pcm: the dev and test splits of github.com/UniversalDependencies/UD_Haitian_Creole-Adolphe (CC BY-SA 4.0;
   file names and sizes not checked from here) — not downloaded, needs your yes.

## 7. Suite

`node --test --test-reporter=tap $(ls *.test.mjs)` before (59d8264): 2,327 tests, 8 not ok; after: 2,343 tests (+16 new), the same 8
not ok, none newly failing, none missing. The 8: `every archon dossier passes the disclosure rule` and seven file-level load
failures (`constitutive-cycle`, `essay-seam`, `fold-e2e-essay`, `fold-experiment`, `mechanical-telling`, `prove-upstream`,
`telling`) that import `../../janus/...`, which does not resolve from a worktree two levels deeper than the main checkout —
pre-existing and unrelated. `race over the real heimdall bridge` passed in both runs.
