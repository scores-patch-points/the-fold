# Creole baseline — measured 2026-10-13 on panel-fixes 1556bdd+ (before any creole work)

Why: the product must work for languages that are not "standard" (user, 2026-10-13). A creole is not a dialect of its lexifier, and
the Fold's tables, priors and detector were built for standard, treebanked languages.

## 1. Language detection, held out (`node eval/creole/id-heldout.mjs`)

Sentences from CreoleVal (not UDHR, so the UDHR-built priors cannot have seen them), creole side, 150 per language where available.

| language | n | right | sibling | as-base | other-wrong | abstain | most common wrong labels |
|---|---|---|---|---|---|---|---|
| Haitian | 150 | 39 | 0 | 6 | 56 | 49 | mt×27 af×11 tr×8 |
| Mauritian | 150 | 16 | 0 | 1 | 95 | 38 | mt×50 af×17 tr×8 |
| Nigerian Pidgin | 150 | 4 | 0 | 135 | 3 | 8 | en×135 |
| Tok Pisin | 150 | 49 | 0 | 7 | 84 | 10 | id×79 en×7 cy×3 |
| Papiamentu | 150 | 10 | 0 | 21 | 80 | 39 | id×31 es×21 it×20 |
| Sango | 150 | 53 | 0 | 0 | 72 | 25 | sl×22 sk×11 id×10 |
| Guadeloupean | 150 | 0 | 30 | 13 | 9 | 98 | fr×13 |
| Jamaican | 84 | 9 | 0 | 0 | 66 | 9 | id×31 mt×31 |
| **all** | **1134** | **180 (16%)** | **30 (3%)** | **183 (16%)** | **465 (41%)** | **276 (24%)** | |

So: 16% named, 41% confidently called an unrelated language (Haitian "Maltese", Tok Pisin "Indonesian"), 24% abstained.
The harm is the 41%, not the abstentions.

Caveats: the Tatoeba `*_sample1.tsv` files are web-mined pairs and carry noise (some rows are not the creole); the clean sources are
`mt_mit_haiti/ht-en.trg`, `mt_kreolmorisien/en-cr_{dev,test}.jsonl` and the UD Naija dev/test samples. One sample per language, no
repeats. The "as-base" bucket for Nigerian Pidgin (reading it as English) is arguably tolerable.

HELD-OUT FILES (under `live_priors-latest/11-multi-language/dialects-pidgins-creoles/creoleval/`; build nothing from them):
`mt_mit_haiti/ht-en.trg`, `tatoeba_sentence_mining/{hat-fra_sample1,tpi-eng_sample1,pap-eng_sample1,sag-eng_sample1,gcf-fra,jam-eng}.tsv`
(creole column), `mt_kreolmorisien/en-cr_{test,dev}.jsonl`, `pos_ud_naija_pcm/pcm_nsc-ud-{test,dev}_sample.conllu`.

## 2. Six creole questions through the live page, no model reachable (`eval/creole/prompts.json`)

`node eval/modelless/drive.mjs --prompts eval/creole/prompts.json --only creole --conc 1` — **0 of 6 answered.**

- "Ki kapital Ayiti?" (Haitian): "ki" and "ayiti" read as names; "kapital" "not met". It did ask ht.wikipedia.org (7 requests).
- "Ki kapital Moris?" (Mauritian): honest typed gap, "I can't read the grammar of this language yet". No search.
- "Wanem em kapital bilong Papua Niugini?" (Tok Pisin): "wanem", "papua", "niugini" names; "em", "bilong" "not met".
- "Weh a di capital a Jamaica?" (Jamaican): "weh", "di" read as names.
- "Ki moun ki ekri Les Misérables?" (Haitian): **believed to be Hungarian**; "ki", "les" names.
- "Wetin be di capital of Nigeria?" (Nigerian Pidgin): "wetin", "di" names.

Function words are read as names of things to look up: a part-of-speech failure, not a retrieval one.

## 3. What already exists (do not redo)

POS packs in `janus/priors/pos-<code>.json` (POSPrior@1): pcm (UD Naija-NSC train, 111,916 tokens, 4,255 forms), hat (UD
Haitian_Creole-Adolphe, 55,527 tokens, 2,486 forms), pap (Wiktionary, 789 forms), kea (Wiktionary, 883), bis/pis/crs/pov (UDHR
projection, 67–108 forms), lin (UniMorph). None for mfe, tpi, sag, jam, gcf, srn, cbk. The Fold's salience layer
(`fold-chat-salience-prior-{es,fr}.js`, built by `scripts/build-salience-prior.mjs --lang`) has no creole module, so none of these
packs reach the question reader.
