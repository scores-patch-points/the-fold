# Candidates — what would make the creole POS packs better, and is NOT on disk

A REQUEST for the user, not a download. Nothing here was fetched. "Size" and "licence" are as reported by the gap analysis
(`live_priors-latest/digested/CREOLE-PRIORS-GAP-ANALYSIS.md`, agent-reported, partly unverified) or by the project's own page where
noted; re-open the link before relying on a row. Ranked by what it would change for the packs in this directory.

## 1. Gold POS for a language that has none on disk (turns "calibrated on pcm/hat" into "calibrated on this language")

| what | filename / where | source URL | licence | size | what it fixes |
|---|---|---|---|---|---|
| UD Haitian Creole **Autogramm** | `ht_autogramm-ud-{dev,test}.conllu` | https://universaldependencies.org/treebanks/ht_autogramm (repo `UD_Haitian_Creole-Autogramm`) | CC BY-SA 4.0 (UD page) | 144 sentences (UD page) | hat gold that is **not** the Adolphe train split: a real held-out check for the hat error bar (today it is scored against the lexicon the Adolphe train built) |
| UD Haitian Creole **Adolphe** dev/test | `ht_adolphe-ud-{dev,test}.conllu` | https://universaldependencies.org/treebanks/ht_adolphe | CC BY-SA 4.0 | 3,314 sentences total, ~300k words, programmatically annotated, Bible-related (UD page) | the same, larger; note the annotation is automatic, so it is a silver standard |
| UD **Naija-NSC** full train/dev/test | `pcm_nsc-ud-{train,dev,test}.conllu` | https://universaldependencies.org/treebanks/pcm_nsc | CC BY-SA 4.0 | 9,242 sentences, 140,729 tokens (UD page); on disk: ~96/105/113-sentence samples | error bars on pcm with ~30× more gold; tighter intervals and a real learning curve |
| **Singlish** STB-ACL full | `{train,dev,test}.conll` (gold_pos) | https://github.com/wanghm92/Sing_Par | MIT (confirmed in the staged PROVENANCE) | on disk: `train_sample`, `dev`, `test` only | a third English-lexified calibration language (a contact variety, not a canonical creole) |
| Any gold UPOS for **mfe, tpi, sag, jam, gcf** | — | none found: my UD search surfaced no treebank for Tok Pisin, Singlish-as-UD, Papiamento or Sango (UD pages for ht and pcm only) | — | — | THE gap: without it the error bar for these five stays "the method on pcm/hat", never "on this language" |

## 2. Parallel text that is not held out and would lift the five packs

| what | filename / where | source URL | licence | size | what it fixes |
|---|---|---|---|---|---|
| KreolMorisienMT **full train** (mfe) | `en-cr_train.jsonl`; also `fr-cr` and mono `cr` | https://huggingface.co/datasets/prajdabre/KreolMorisienMT | MIT (dataset card, per staged PROVENANCE) | 21,810 en-cr; 15,239 fr-cr; 45,364 mono (gap analysis); on disk: first 500 en-cr | mfe from 500 pairs to ~22k: the single biggest improvement available. `fr-cr` also gives a French anchor, which is the lexifier |
| **FLORES+** dev/devtest | `dev/*.tpi_Latn`, `*.sag_Latn`, `*.mfe_Latn`, `*.hat_Latn`, `*.pap_Latn`, `*.kea_Cabv` | https://github.com/openlanguagedata/flores | CC BY-SA 4.0 (reported) | ~1k sentences per language, parallel with English (language list UNVERIFIED by me) | ~1k clean parallel sentences for tpi and sag (today 80 and 0 outside the held-out set). **Check it is not already in the held-out ID set** — it is not in BASELINE's list |
| Tatoeba **full per-language exports** | `tpi_sentences.tsv`, `sag_…`, `jam_…`, `gcf_…` + `links.csv` | https://downloads.tatoeba.org/exports/per_language/ | CC BY 2.0 FR | tpi 135, pap 89, hat 167, cbk 4,071, srn 198, crs 66 (gap analysis; sag/jam/gcf counts not listed) | small but clean; sag/jam are the unlucky ones — their staged Tatoeba files are the held-out set |
| JW-style web-mined Sango/Tok Pisin/… (already staged as `*_sample1.tsv`) | — | — | web-mined, licence unstated | 1,000 pairs each | **the decision for the lead**: split the held-out files (build on half, evaluate language-ID on the other half) and sag/jam stop being UDHR-only |
| Wikipedia dumps: `sg`, `jam` (Jamaican Patois), `tpi`, `mfe` (Incubator) | `sgwiki`, `jamwiki`, `tpiwiki` | https://dumps.wikimedia.org/ | CC BY-SA | sg 376 articles, jam 1,720, tpi 1,417 (gap analysis) | monolingual, not parallel: it cannot project, but it gives real DOCUMENTS for the function-word spread statistic and a coverage test set for each pack |

## 3. Things I did NOT propose

- Kreyòl-MT's HuggingFace parquet (licence "other", blended with `private`-marked JHU Bible rows; gated per the staging note).
- Bible corpora (BY-NC-ND or unlabeled for most creoles; the manifests already gate them).
- CreoleVal's own `nlu/pos` task splits for other creoles — the staged PROVENANCE says the pos task covers only Naija and Singlish.
