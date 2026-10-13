# Creole grammar tables — pre-registration (written 2026-10-13, before `battery.mjs` exists and before the first run)

Question: **can the slot pipeline (`askFrame` in fold-chat-frame.js, `bindSentence` in fold-chat-witness.js) read a creole question and its
answering sentence when — and only when — a DECLARED per-language table is registered for it?** Baseline (eval/creole/BASELINE.md): 0 of 6
creole questions answered; function words were read as names (a part-of-speech failure, not a retrieval one).

Scope: five creoles — Haitian `hat`, Nigerian Pidgin `pcm`, Tok Pisin `tpi`, Mauritian `mfe`, Jamaican Patois `jam`. TEST-ONLY: tables go
in through `withGrammars()` for a run (the omnilingual precedent); nothing is registered in production `GRAMMAR`, nothing in
`fold-chat-function-words.js`. The user signs off production registration.

## What is frozen here
- **The tables**: `eval/creole/grammars.mjs`, sha256 `a3164eb493464e6a676e7289207e7242a0a3aa435ab8956856e11bd3542e20c8`. DECLARED, not measured; each
  field cites its giver in a comment (APiCS chapter/feature, a corpus sentence with its on-disk token count, or `[U]` = unattested, the
  author's reading). They are written from the creoles' own sources, never copied from the lexifier's table.
- **The function-word sets** (`FW` in the same file): the pipeline needs `fw`, and `functionWordsOf()` has no creole entry — so the table
  alone cannot read (the battery's no-table control measures that). hat/pcm: the khora pack rule applied to pos-hat/pos-pcm, frozen.
- **The cases and expectations** below. An expectation is what the creole sentence MEANS (the right referent / slot / polarity), not what
  the pipeline happens to return. No case may be added, dropped or re-expected after the first run; a new case is a new, dated section.
- **The predictions** below, made by reading the code; where I could not resolve the path by reading it I say `uncertain`.
- The tables were **not edited after the first run** — if a table changes it is a "Version 2" section with the reason, and the v1 result stays.

## Disclosure of what ran before this text
One exploratory probe (scratch, 3 Haitian cases, a throw-away table of ~15 entries written before the sources were read): `Ki kapital Ayiti?`
read with referent `Ayiti` and relation `kapital`, and `Pòtoprens se kapital Ayiti` / `Kapital Ayiti se Pòtoprens` gave `Pòtoprens`;
`Ki kote Todd ap viv ?` gave the typed gap `referents_unresolved`. That table was discarded; none of its entries was kept by being
tuned to a result. Everything else in `grammars.mjs` was written from the sources before any pipeline run. The English-gloss control
(below) was **not** run before the cases were fixed: cases whose English gloss falls are reported as "falls in English too", not removed.

## Sources used (all on disk, no download)
APiCS Online feature tables and survey chapters (`apics/feature-tables`, `apics/surveys`): Haitian 49, Nigerian Pidgin 17, Tok Pisin 22,
Mauritian 55, Jamaican 08. CreoleVal: `mctest/CreoleTranslations` (real Haitian and Mauritian reading-comprehension questions with their
stories), `relation_classification/{tpi,jam}.csv` (real Wikipedia sentences, Wikidata-labelled: capital-of P1376/P36, position P39,
occupation P106), `mt_mit_haiti/ht_monolingual_sample.txt`, `tatoeba_sentence_mining`, `mt_kreolmorisien`, `pos_ud_naija_pcm`,
`ner_masakhaner_pcm`. khora `native/priors/pos-hat.json`, `pos-pcm.json` (READ ONLY; the POS-projection ant owns them). eWAVE was read for
feature names only; it holds no sentences that bear on a closed class the APiCS chapters do not already give. UDHR creole texts were not
needed (their closed classes are the same words). The held-out language-ID sentences of BASELINE.md are not used to build anything.

## Provenance of a case (never inflated)
`REAL` = the sentence is a verbatim corpus sentence and the ask is a question the corpus or prompts.json supplies or is a direct
question about that sentence. `FRAME` = the sentence is a corpus sentence's closed-class frame with names (and for author-of, the verb)
substituted — the exact corpus sentence it adapts is cited. `PROMPT` = the ask is one of the six in prompts.json. A `FRAME` witness is a
weaker claim than a `REAL` one: the report counts them apart.

## Controls (run for every ask, whatever the case's own result)
1. **no table** — same ask, `fw` supplied, no table registered → must be the typed gap `no_grammar_for_language` (the table is what reads).
2. **lexifier table** — the same ask read with the lexifier's table registered under the creole's code (en for pcm/tpi/jam, the
   omnilingual FR for hat/mfe). "A creole is not a dialect of its lexifier" predicts: the question word is unknown, the ask is not read.
   An ask that the lexifier's table DOES read is reported as read-as-base, with what it read.
3. **ru** (function words, no table) → typed null, as in the omnilingual battery. Kept.
4. **English gloss** — each case's English translation through the real en table. A case whose gloss falls is outside the pipeline's reach
   in any language: its creole fall is not a creole finding.
5. **Mutation** — for every table field, the field emptied and every case re-run; the fields the pre-registered gates below name must flip
   the named case. Fields that flip nothing are reported as inert in this battery (not as proven useless).

## Cases and predictions
`expect.filler` is the creole sentence's answer; `∅` means the right result is no answer. A case HOLDS when every stated check
(`filler`, `polarity`, `slot`) is right. Prediction = P(H) holds / P(F) falls, with the cause I expect.

### hat — Haitian
| id | rel | prov | ask | sentence | expect | pred |
|---|---|---|---|---|---|---|
| H1 | capital-of | PROMPT+FRAME | Ki kapital Ayiti? | Pòtoprens se kapital Ayiti. | Pòtoprens | P(H): wh + first content word is read as the relation (English verb position), `Ayiti` the referent; copula `se` splits |
| H2 | capital-of | PROMPT+FRAME | Ki kapital Ayiti? | Kapital Ayiti se Pòtoprens. | Pòtoprens | P(H) |
| H3 | author-of | PROMPT+FRAME | Ki moun ki ekri Les Misérables? | Victor Hugo te ekri Les Misérables. | Victor Hugo | P(H): `ki moun`→person, `ekri` the relation, `te` trimmed as auxiliary |
| H4 | who-is | REAL (MCTest kreyol1 story 6) | Kiyès Roger ye? | Roger se te yon krikèt. | yon krikèt, tense past | P(F) at the ask: the copula `ye` is CLAUSE-FINAL, so `Roger` sits at the position the code calls the relation (gap `referents_unresolved`); and `se te` would read present (first marker) |
| H5 | count | REAL (ht_monolingual_sample) | Konbyen eleman biyotòp la gen? | Biyotòp la gen 5 eleman ki endispansab pou lavi : Dlo, tè, limyè, lè, tanperati. | 5 | P(H): the number stands right before the counted noun |
| H5b | count | REAL | Konbyen eleman biyotòp la genyen? | (same) | 5 | P(F): `genyen` is the long form of `gen` ([A] ch.49 §6 konnen/konn); no allomorph field; the unresolved verb becomes a name the sentence must say |
| H6 | born | REAL (hat-eng_sample1 line 1) | Ki kote Alexandre Dumas te fèt ? | Alexandre Dumas, ki te fèt an Ayiti 1762, se te youn nan moun ki moun inoubliyab. | Ayiti | P(F) at the ask: subject + TAM marker `te` + verb is the shape the code reads only for English do/does/did; the subject sits at the relation position. If it did read, P(F) again: "an Ayiti 1762" has no preposition before the year and a digit in the run disqualifies the place |
| H7 | author-of (passive) | FRAME | Ki moun ki ekri Les Misérables? | Les Misérables te ekri pa Victor Hugo. | Victor Hugo, polarity + | P(F): a passive with no auxiliary has no copula for the agent rule; `pa` is both the agent marker and the negator (polarity would read `-`) |
| H8 | capital-of | FRAME | Ki kapital Ayiti? | Kapital Ayiti se Pòtoprens la. | Pòtoprens | P(F): the postposed article stays glued to the filler ("Pòtoprens la") — no trailing-determiner trim |
| H9 | negation | FRAME | Ki kapital Ayiti? | Pòtoprens pa se kapital Ayiti. | Pòtoprens, polarity - | P(F) on the filler: the negator precedes the copula and is glued to the left-side filler ("Pòtoprens pa"); polarity itself P(H) |

### tpi — Tok Pisin
| id | rel | prov | ask | sentence | expect | pred |
|---|---|---|---|---|---|---|
| T1 | capital-of | PROMPT+FRAME (tpi.csv "Budapest em i kapitol bilong Hangari") | Wanem em kapital bilong Papua Niugini? | Port Moresby em i kapital bilong Papua Niugini . | Port Moresby | P(H): `em` is the first copula, `bilong` governs the attribute |
| T2 | capital-of | REAL | Wanem em kapitol bilong Hangari? | Budapest em i kapitol bilong Hangari . | Budapest | P(H) |
| T3 | capital-of (P36) | REAL | Wanem em kapitol bilong Slovakia? | Kapitol bilong Slovakia i Bratislava . | Bratislava | P(H): `i` is the pivot |
| T4 | who-holds | REAL | Husat i praim minista bilong Tuvalu? | Apisai Ielemia i praim minista bilong Tuvalu . | Apisai Ielemia | P(H) |
| T5 | capital-of (spelling) | REAL sentence | Wanem em kapital bilong Hangari? | Budapest em i kapitol bilong Hangari . | Budapest | P(F): `kapital`≠`kapitol`; no orthographic-variant field and no stemmer can map a→o; the attribute is not said → ∅ |
| T6 | author-of | FRAME | Husat i raitim Les Misérables? | Viktor Hugo i raitim Les Misérables . | Viktor Hugo | P(H) by luck: `i` is a pivot, `raitim` an unresolved name the sentence says |
| T7 | negation | FRAME | Wanem em kapitol bilong Hangari? | Budapest em i no kapitol bilong Hangari . | Budapest, polarity - | P(H): the negator follows the copula here |
| T8 | where | REAL (tpi.csv "Morobe em i wanpela provins long Papua Niugini") | We Morobe i stap? | Morobe em i wanpela provins long Papua Niugini . | Papua Niugini | P(F) at the ask: `Morobe` at the relation position before a clause-final copula |
| T9 | where (in situ) | REAL | Morobe i stap we? | Morobe em i wanpela provins long Papua Niugini . | Papua Niugini | P(F): the wh-word is not initial → not read as a slot ask |
| T10 | author-of (-im) | FRAME ([A] §6.2 ex.16–17 luk/lukim alternation) | Husat i raitim Les Misérables? | Viktor Hugo i rait Les Misérables . | Viktor Hugo | P(H) only through the declared `-im` suffix stemmer (mutation gate) |

### jam — Jamaican Patois
| id | rel | prov | ask | sentence | expect | pred |
|---|---|---|---|---|---|---|
| J1 | capital-of | PROMPT+FRAME (jam.csv "Athens a di capital fi Greece") | Weh a di capital a Jamaica? | Kingston a di capital fi Jamaica . | Kingston | P(H) |
| J2 | capital-of | REAL | Weh a di capital fi Greece? | Athens a di capital fi Greece . | Athens | P(H) |
| J3 | capital-of | REAL | Weh a di capital a Portugal? | Di capital a Portugal name Lisban . | Lisban | P(F): the first `a` is the preposition 'of' but is the copula in the list → both sides carry the anchor → null (one word, five roles) |
| J4 | who-is | REAL | Uu a Anna Netrebco? | Anna Netrebco a wan singa from Russia . | wan singa from Russia | P(H) |
| J5 | who-holds | REAL (jam.csv "Jack Sherach use to bi di president ah France") | Uu a di president a France? | Jack Sherach use to bi di president ah France . | Jack Sherach | P(H) only with `use`,`to` declared auxiliaries (mutation gate) |
| J6 | author-of | FRAME | Uu rait Les Misérables? | Victor Hugo rait Les Misérables . | Victor Hugo | P(H) |
| J7 | negation | FRAME | Weh a di capital a Jamaica? | Kingston no a di capital fi Jamaica . | Kingston, polarity - | P(F) on the filler ("Kingston no"); polarity P(H) |
| J8 | capital-of (spelling) | FRAME | Weh a di kapital fi Greece? | Athens a di capital fi Greece . | Athens | P(F): kapital/capital are both in the corpus (2×/20×) and the table lists both as place nouns, but stems differ |

### pcm — Nigerian Pidgin
| id | rel | prov | ask | sentence | expect | pred |
|---|---|---|---|---|---|---|
| P1 | capital-of | PROMPT+FRAME (UD "Di Ebute - Metta Station na di biggest station …") | Wetin be di capital of Nigeria? | Abuja na di capital of Nigeria . | Abuja | P(H) |
| P2 | who-is | REAL (MasakhaNER dev) | Who be di FACT leader? | FACT leader na Mahamat Mahadi Ali wey be ogbologbo insurgent wey don live for France befor . | Mahamat Mahadi Ali | P(H): `wey` cuts the filler (mutation gate) |
| P3 | what-is | REAL (MasakhaNER dev) | Wetin be LCCI? | LCCI na di lead Chamber of Commerce and one of di leading voices for di organised private sector ( OPS ) for Nigeria . | /^di lead Chamber of Commerce/ | P(H) |
| P4 | author-of | FRAME | Who write Les Misérables? | Victor Hugo write Les Misérables . | Victor Hugo | P(H) |
| P5 | negative | FRAME | Wetin be di capital of Nigeria? | Lagos na di biggest city for Nigeria . | ∅ | P(H): the attribute `capital` is not said |
| P6 | negation | FRAME (UD "No be only say na …") | Wetin be di capital of Nigeria? | Lagos no be di capital of Nigeria . | Lagos, polarity - | P(F) on the filler ("Lagos no"); polarity P(H) |
| P7 | capital-of (in situ) | FRAME ([A] §7 ex.13 wh-in-situ) | Di capital of Nigeria na wetin? | Abuja na di capital of Nigeria . | Abuja | P(F): wh-word not initial → not a slot ask |

### mfe — Mauritian
| id | rel | prov | ask | sentence | expect | pred |
|---|---|---|---|---|---|---|
| M1 | capital-of (zero copula) | PROMPT+FRAME ([M] "Ana ti enn tifi intelizan") | Ki kapital Moris? | Por-Lwi kapital Moris . | Por-Lwi | **uncertain**: no copula token, but the ask's relation word `kapital` followed by the referent is the verb+object shape `subjectFiller` accepts → P(H) by that path; if that path does not fire, P(F) |
| M2 | capital-of | PROMPT+FRAME ([H] "Premie sa douz disip-l se Simon") | Ki kapital Moris? | Por-Lwi se kapital Moris . | Por-Lwi | P(H) |
| M3 | who-is | REAL (en-cr) | Kisann-la Simon? | Premie sa douz disip-l se Simon , so ti-nom Pier . | Premie sa douz disip-l | P(F) at the ask: zero copula in the ask, `Simon` at the relation position |
| M4 | author-of | FRAME | Kisann-la ki ekrir Les Misérables? | Victor Hugo ti ekrir Les Misérables . | Victor Hugo | P(H) |
| M5 | capital-of (hyphen article) | FRAME ([M] "fet-la", "lavil-la") | Ki kapital Moris? | Por-Lwi se kapital Moris-la . | Por-Lwi | P(H) only through the declared `-la` suffix (mutation gate) |
| M6 | negation | FRAME | Ki kapital Moris? | Por-Lwi pa kapital Moris . | Por-Lwi, polarity - | P(F) on the filler: the negator between subject and relation word blocks the subject walk |
| M7 | where | FRAME ([A] ex.22 zero copula; [M] "Kot Todd reste?") | Kot Moris? | Moris enn pei dan Losean Indyen . | Losean Indyen | P(F) at the ask: zero copula in the ask, `Moris` at the relation position |

The six prompts: "Ki kapital Ayiti?" = H1/H2, "Ki kapital Moris?" = M1/M2, "Wanem em kapital bilong Papua Niugini?" = T1,
"Weh a di capital a Jamaica?" = J1, "Ki moun ki ekri Les Misérables?" = H3, "Wetin be di capital of Nigeria?" = P1.

## Predicted totals (so a surprise is visible)
HOLDS predicted: H1 H2 H3 H5 · T1 T2 T3 T4 T6 T7 T10 · J1 J2 J4 J5 J6 · P1 P2 P3 P4 P5 · M2 M4 M5 (+ M1 uncertain) = 24 of 42, plus M1.
FALLS predicted: H4 H5b H6 H7 H8 H9 · T5 T8 T9 · J3 J7 J8 · P6 P7 · M3 M6 M7 = 17.
The predicted falls fall into six schema causes — (1) the relation-position rule is English do-support (wh + subject + TAM marker + verb
and a clause-final copula both put the name at the relation position); (2) one word, several roles (Jamaican `a`, Haitian `pa`);
(3) a negator or postposed article glued to the filler; (4) no orthographic/allomorph variant field; (5) wh-in-situ; (6) the zero copula
in the ASK. If the measured falls have another cause, that is the finding.

## Mutation gates (named before the run)
For each, emptying the field must change the named case's result: hat interrogatives→H1 not read · hat copulas→H2 ∅ · hat auxiliaries→H3
∅ · hat negation→H9 polarity `+` · tpi copulas→T3 ∅ · tpi governs→T1 `attributes` []  · tpi suffixes→T10 ∅ · jam interrogatives→J1 not read ·
jam auxiliaries→J5 "Jack Sherach use to" · pcm clauseWords→P2 filler grows · pcm negation→P6 polarity `+` · mfe suffixes→M5 ∅.
The battery also runs the full field × case matrix and reports the fields that flip nothing as inert.

## What is reported
Per creole: cases read (ask level), cases answered right (witness level), by provenance; each falling case with its named cause; the
control table; the mutation matrix; the prediction-vs-measure table; and — separately — **what the schema cannot express**, as a list,
because that is the likely real finding. A creole whose table cannot be made to read is reported as such.

## Version rule
If a fall's cause is an English-shaped rule in code (named above), a Version 2 may move it into a table field with the English value as
the default so en/es/fr stay byte-identical (proved by the omnilingual suite and the full suite by test name, before and after). That
would be pre-registered as a dated section here before it is wired, as the omnilingual precedent did. No v2 is registered now.
