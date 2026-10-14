# Creole grammar tables — results (measured 2026-10-13)

Pre-registration: `GRAMMAR-PREREG.md` (frozen before the run; tables sha256 `a3164eb4…20c8`, unchanged). Tables: `grammars.mjs`.
Battery: `battery.mjs` (the REAL `askFrame` / `bindSentence`, a stub title door, never the network). Standing test:
`fold-chat-creole-grammar.test.mjs`. Reproduce: `node eval/creole/battery.mjs [--json|--mutate|--audit|--verify]`.
Nothing is registered in production: `Object.keys(GRAMMAR)` is still `["en"]` and `grammarOf("hat"|"pcm"|"tpi"|"mfe"|"jam")` is `null`
after every run (pinned by the test). The tables were **not edited after the first run**; no Version 2 was applied.

## Headline
**23 of 42 cases hold** (55%). The six questions of `prompts.json` are all read and answered — against a witness that is a corpus FRAME,
not a verbatim corpus sentence. Against verbatim corpus sentences **7 of 17 REAL cases hold**.

| creole | cases | hold | ask read (slot + a referent) | PROMPT/FRAME-prompt | REAL | FRAME | English gloss holds | falls |
|---|---|---|---|---|---|---|---|---|
| Haitian `hat` | 10 | 4 | 9 | 3/3 | 1/4 | 0/3 | 9/10 | H4 H5b H6 H7 H8 H9 |
| Tok Pisin `tpi` | 10 | 7 | 8 | 1/1 | 3/6 | 3/3 | 10/10 | T5 T8 T9 |
| Nigerian Pidgin `pcm` | 7 | 5 | 6 | 1/1 | 2/2 | 2/4 | 7/7 | P6 P7 |
| Mauritian `mfe` | 7 | 4 | 5 | 2/2 | 0/1 | 2/4 | 7/7 | M3 M6 M7 |
| Jamaican `jam` | 8 | 3 | 8 | 1/1 | 1/4 | 1/3 | 6/8 | J3 J4 J5 J7 J8 |
| **all** | **42** | **23** | **36** | **8/8** | **7/17** | **8/17** | **39/42** | 19 |

"Ask read" counts a frame with the expected slot and at least one referent; **one of the 36 (H6) is read WRONG** (first name taken as the
relation), so 35 are read as intended. Of the 39 cases whose English gloss holds (the pairs the pipeline can answer at all), the creole
side holds 23 (59%). Three falls also fall in English (H7 irregular participle, J3, J5 two-word auxiliary) — those are not creole findings.
**16 falls are creole-only**; they have seven causes (below). No creole is unreadable: every creole has a core that reads
(capital-of, who-holds, who-wrote, count in Haitian), and every creole has asks it cannot read for a structural reason.

## Per case
`got` is the first filler of the real pipeline; `pred` is the pre-registered prediction; `en` is the English gloss through the en table.

| id | prov | ask → got | want | status | pred | cause (falls) |
|---|---|---|---|---|---|---|
| H1 | PROMPT+FRAME | Ki kapital Ayiti? → Pòtoprens | Pòtoprens | HOLDS | H ✓ | — |
| H2 | PROMPT+FRAME | (same, answer on the right) → Pòtoprens | Pòtoprens | HOLDS | H ✓ | — |
| H3 | PROMPT+FRAME | Ki moun ki ekri Les Misérables? → Victor Hugo | Victor Hugo | HOLDS | H ✓ | — |
| H4 | REAL | Kiyès Roger ye? → not read (`referents_unresolved`) | yon krikèt, past | FALLS | F ✓ | clause-final copula `ye` puts `Roger` at the relation position; with the copula first (`Kiyès ye Roger?`) it reads and answers `yon krikèt` — but `se te` reads **present** |
| H5 | REAL | Konbyen eleman biyotòp la gen? → 5 | 5 | HOLDS | H ✓ | — |
| H5b | REAL | …biyotòp la genyen? → T2, ∅ | 5 | FALLS | F ✓ | `genyen`/`gen` allomorphs ([A] ch.49 konnen/konn): the unresolved long form is a name the sentence does not say |
| H6 | REAL | Ki kote Alexandre Dumas te fèt ? → ∅ | Ayiti | FALLS | F ✓ (mechanism partly wrong) | subject + `te` + verb: with the stub's `dumas` key it reads referent `Dumas`, relation `Alexandre` (wrong); without that key, gap. Not the year: removing `1762`, or adding `an`, gives the same ∅ |
| H7 | FRAME | Les Misérables te ekri pa Victor Hugo → ∅, polarity − | Victor Hugo, + | FALLS | F ✓ | no copula for the agent rule; `pa` is agent marker AND negator (polarity −). **en also falls** (irregular participle) |
| H8 | FRAME | Kapital Ayiti se Pòtoprens la → "Pòtoprens la" | Pòtoprens | FALLS | F ✓ | postposed article glued to the filler |
| H9 | FRAME | Pòtoprens pa se kapital Ayiti → "Pòtoprens pa", − | Pòtoprens, − | FALLS | F ✓ | negator before the copula glued to the filler; polarity reads − correctly. (`Pòtoprens se pa kapital Ayiti` gives `Pòtoprens`, −) |
| T1 | PROMPT+FRAME | Wanem em kapital bilong Papua Niugini? → Port Moresby | Port Moresby | HOLDS | H ✓ | — |
| T2 | REAL | Wanem em kapitol bilong Hangari? → Budapest | Budapest | HOLDS | H ✓ | — |
| T3 | REAL | Wanem em kapitol bilong Slovakia? → Bratislava | Bratislava | HOLDS | H ✓ | — |
| T4 | REAL | Husat i praim minista bilong Tuvalu? → Apisai Ielemia | Apisai Ielemia | HOLDS | H ✓ | — |
| T5 | REAL | Wanem em kapital bilong Hangari? → ∅ | Budapest | FALLS | F ✓ | `kapital` ≠ `kapitol` (the corpus writes `kapitol`; the prompt writes `kapital`): no variant field |
| T6 | FRAME | Husat i raitim Les Misérables? → Viktor Hugo | Viktor Hugo | HOLDS | H ✓ | by a lucky path: `raitim` is read as an unresolved NAME and `i` as the pivot |
| T7 | FRAME | …i no kapitol bilong Hangari → Budapest, − | Budapest, − | HOLDS | H ✓ | — |
| T8 | REAL | We Morobe i stap? → not read | Papua Niugini | FALLS | F ✓ | clause-final copula; with `We i stap Morobe?` it reads and answers |
| T9 | REAL | Morobe i stap we? → not a slot ask | Papua Niugini | FALLS | F ✓ | wh-word in situ |
| T10 | FRAME | Husat i raitim … / Viktor Hugo i rait … → Viktor Hugo | Viktor Hugo | HOLDS | H ✓ | only through the declared `-im` stemmer (mutation) |
| J1 | PROMPT+FRAME | Weh a di capital a Jamaica? → Kingston | Kingston | HOLDS | H ✓ | — |
| J2 | REAL | Weh a di capital fi Greece? → Athens | Athens | HOLDS | H ✓ | — |
| J3 | REAL | Weh a di capital a Portugal? → ∅ | Lisban | FALLS | F ✓ | `a` = copula and 'of': both sides carry the anchor → null; `name` is no pivot. **en also falls** |
| J4 | REAL | Uu a Anna Netrebco? → ∅ (no row) | wan singa from Russia | FALLS | **H ✗** | `a` is copula AND `governs`: "Netrebco a wan singa…" reads as "role word OF X" and declares another anchor. Emptying `governs` OR `determiners` makes it hold |
| J5 | REAL | Uu a di president a France? → "Jack Sherach use" | Jack Sherach | FALLS | **H ✗** | the trim removes ONE trailing auxiliary; `use to` has two. `did bi` gives `Jack Sherach`. **en also falls** |
| J6 | FRAME | Uu rait Les Misérables? → Victor Hugo | Victor Hugo | HOLDS | H ✓ | — |
| J7 | FRAME | Kingston no a di capital fi Jamaica → "Kingston no", − | Kingston, − | FALLS | F ✓ | negator before the copula glued |
| J8 | FRAME | Weh a di kapital fi Greece? → ∅ | Athens | FALLS | F ✓ | `kapital` ≠ `capital` |
| P1 | PROMPT+FRAME | Wetin be di capital of Nigeria? → Abuja | Abuja | HOLDS | H ✓ | — |
| P2 | REAL | Who be di FACT leader? → Mahamat Mahadi Ali | Mahamat Mahadi Ali | HOLDS | H ✓ | `wey` cuts the filler (mutation) |
| P3 | REAL | Wetin be LCCI? → "di lead Chamber of Commerce and one of di leading voices for di organised private sector" | /^di lead Chamber of Commerce/ | HOLDS | H ✓ | — |
| P4 | FRAME | Who write Les Misérables? → Victor Hugo | Victor Hugo | HOLDS | H ✓ | the English table ALSO reads this ask (it is English-shaped) |
| P5 | FRAME | …capital of Nigeria? / Lagos na di biggest city → ∅ | ∅ | HOLDS | H ✓ | — |
| P6 | FRAME | Lagos no be di capital of Nigeria → "Lagos no", − | Lagos, − | FALLS | F ✓ | negator before the copula glued |
| P7 | FRAME | Di capital of Nigeria na wetin? → not a slot ask | Abuja | FALLS | F ✓ | wh in situ (`Wetin na di capital …?` reads and answers) |
| M1 | PROMPT+FRAME | Ki kapital Moris? / Por-Lwi kapital Moris → Por-Lwi | Por-Lwi | HOLDS | H (uncertain) ✓ | the ZERO COPULA reads here only because the ask's relation word `kapital` + its referent is the verb+object shape `subjectFiller` accepts |
| M2 | PROMPT+FRAME | …Por-Lwi se kapital Moris → Por-Lwi | Por-Lwi | HOLDS | H ✓ | — |
| M3 | REAL | Kisann-la Simon? → not read | Premie sa douz disip-l | FALLS | F ✓ | zero copula in the ask; `Kisann-la se Simon?` reads and answers |
| M4 | FRAME | Kisann-la ki ekrir Les Misérables? → Victor Hugo | Victor Hugo | HOLDS | H ✓ | — |
| M5 | FRAME | Por-Lwi se kapital Moris-la → Por-Lwi | Por-Lwi | HOLDS | H ✓ | only through the declared `-la` suffix (mutation) |
| M6 | FRAME | Por-Lwi pa kapital Moris → ∅, − | Por-Lwi, − | FALLS | F ✓ | the negator sits between the subject and the relation word and stops the subject walk |
| M7 | FRAME | Kot Moris? → not read | Losean Indyen | FALLS | F ✓ | zero copula / clause-final `ete` in the ask |

Predictions: 40 of 42 statuses right. I predicted 24 holds plus M1 (uncertain, leaning hold); 23 held. J4 and J5 were predicted to hold and
fell; every one of the 17 predicted falls fell. J4's cause is in the class the pre-registration named (one word, several roles) but I
mis-traced where it bites; J5's is a trim limit I had not read. H6's mechanism differs from the one predicted (a wrong reading, not a gap).

## Controls
- **No table** (the same ask, `fw` supplied, nothing registered): **42 of 42 end in the typed gap `no_grammar_for_language`**. This is the
  falsifier-first evidence: before the tables, 0 of 42 asks read; the table is what reads (and `fw`, below).
- **The lexifier's table** (en for pcm/tpi/jam, the omnilingual FR for hat/mfe) read **2 of 42** asks: P2 (`Who be …` — read, answer ∅) and
  P4 (`Who write …`, answered correctly: the ask is English-shaped). All six prompt questions are unread under the lexifier: "a creole is
  not a dialect of its lexifier" is measured, not assumed — Nigerian Pidgin is the only one close enough to be read as base for some asks.
- **ru** (function words, no table): typed null, as in the omnilingual battery.
- **English gloss**: 39 of 42 hold (above).

## Mutation (one field emptied at a time)
All 12 pre-registered gates flip the case they were registered for (the test pins them): hat interrogatives→H1 not read, copulas→H2 ∅,
auxiliaries→H3 ∅, negation→H9 polarity +; tpi copulas→T3 ∅, governs→T1 loses its attribute, suffixes→T10 ∅; jam interrogatives→J1 not
read, auxiliaries→J5 "Jack Sherach use to"; pcm clauseWords→P2 filler grows, negation→P6 polarity +; mfe suffixes→M5 ∅.
Across all five tables, 28 of ~131 declared fields flip at least one case; **~103 are untested by this battery** — containment,
placeVerbs, temporal, numerals, hedges, ordinals and the like exist because the schema has them and the sources gave entries, not because
a case exercised them (most place/time/quantity asks fall before reaching them). They are declared, unmeasured.
Attestation (`--audit`): table entries never seen in the on-disk text — hat 12/199, pcm 27/214, tpi 33/145, mfe 37/189, **jam 87/201**
(the Jamaican corpus is 4.5k tokens; many entries are APiCS-only, e.g. `kyahn`, `uda`).

## What the slot schema CANNOT express (the real finding)
1. **Where the relation sits.** `askFrame` decides which word is the relation by position (the first content word after the wh-phrase;
   after the LAST content word only when the ask has an English `do/does/did`, a list hard-coded in code). A name before a TAM marker
   (`Ki kote Alexandre Dumas te fèt`, `Kot Todd ti viv`) or before a clause-final copula (`Kiyès Roger ye`, `We Morobe i stap`,
   `Kot Moris ete`) is read as the relation and removed from the referents. There is no table field for "these markers play do/does/did"
   or "the copula may come last". Causes of H4, H6, T8; it makes the wh + subject + TAM marker + verb shape of every creole here unreadable.
2. **The zero copula.** A table lists the copulas that exist, not the sentences that have none (APiCS feature 73/74/75 — Tok Pisin NPs,
   all of Mauritian, Haitian adjectives and locatives). It reads only where the ASK itself supplies a relation word followed by its
   referent (M1: `Ki kapital Moris?` / `Por-Lwi kapital Moris`); `Kisann-la Simon?` and `Kot Moris?` do not read (M3, M7).
3. **A word with several roles, one list per role.** Jamaican `a` is the copula, 'of', the focus marker, the locative and the
   progressive; Haitian `pa` is the negator and the agent marker; Tok Pisin `i` is the predicate marker and (declared) the pivot;
   `use to` is two words. The schema reads each list globally: `a` in `governs` AND `copulas` makes the copula after a referent read as
   "role word OF X" (J4) and both sides of "Di capital a Portugal name Lisban" carry the anchor (J3). Tok Pisin `i` works as a pivot by luck.
4. **Postposed articles and postposed plural markers.** `determiners` is read as preposed; Haitian `la/a/lan/an/nan/yo` and Mauritian
   `-la` stay glued to the filler (H8). Mauritian writes the article hyphen-joined and the tokenizer keeps it whole; the declared
   suffix stemmer is the one door (a workaround: M5 holds only through it).
5. **The negator before the copula** is not trimmed (only auxiliaries are): the filler is "Pòtoprens pa", "Kingston no", "Lagos no" (H9, J7,
   P6); between subject and relation word it stops the subject walk (M6). Polarity itself reads right.
6. **Orthographic variants and allomorphs.** `kapital`/`kapitol`/`capital`; `gen`/`genyen`; Jamaican `ina/inna`, `wah/wan/whaan`, `di/d/the`:
   a table can list variants as separate words, but a variant in the ASK never meets its sibling in the SENTENCE (T5, J8, H5b); the stemmer
   is suffix-only.
7. **wh in situ.** Interrogatives are read only at the front (or after one function word). `Morobe i stap we?`, `… na wetin?` are not slot asks (T9, P7).
8. **Zero-marked present and compound tense.** Tok Pisin and Mauritian present is unmarked (tense `unknown` for every copular sentence
   by design of the table), and `se te` reads present (first marker wins, H4). Tense is the caller's decision in this pipeline, so the harm is small.
9. **Possessor–possessum juxtaposition** (Haitian `kapital Ayiti`, Mauritian `kapital Moris`) has no token for `governs`: `kapital` becomes the
   relation word, not an attribute of an anchor. It reads (H1, H2, M1) but without the attribute reading's guards (an ordinal-qualified
   "the fourth capital", another anchor's "capital of X"). Mauritian `possessor so possessum` can only be declared through the
   `possessiveSuffix` regex, whose 3-character window misfires on every `so…` word (`sorti` 65×) — not declared.
10. **No field for pronouns and particles.** `askFrame` needs `fw`, and `functionWordsOf` has no entry for any creole: without it, a
    table does not read (the no-table control). The sets are declared in `grammars.mjs` (`FW`) — a second registration point.

Not tested here (named so they are not mistaken for passes): serial verbs (APiCS features 82–86; Jamaican/Pidgin `tek … kam`), clitic
elision (`m'ap`, `pa'n` — the tokenizer keeps them whole), cleft answers (`Se Pòtoprens ki kapital Ayiti`, `Na … wey`), yes/no
particles (`èske`, `abi`), time and "what year" asks (no creole form is attested in the on-disk sources, so none is declared), tone marks.

## Honest limits
- The title door is a STUB with keys I supplied (surface → title). A real ht/pcm/tpi/jam/mfe Wikipedia door may resolve differently (it may
  turn `kapital` into a redirect that `agrees` rejects, or resolve a bare first name). H6's read depends on the stub key `dumas`.
- A FRAME witness is a corpus frame with names substituted; it shows the closed-class skeleton reads, not that a real page's sentence does.
  The 17 REAL cases are the stronger evidence: 7 hold.
- 42 cases, one run, deterministic. The tables are short (~200 entries each); the Jamaican corpus is four orthographies in 4.5k tokens.
- No POS prior exists for any of these languages, so every content word is "unmeasured" and the name-vs-relation heuristics fall back to
  position and to "never seen → name". A common noun can be accepted as a person filler (`yon krikèt`, `wan singa from Russia`).
- The language-ID problem (BASELINE.md §1) is untouched: these tables are keyed by `hat/pcm/tpi/mfe/jam`, and the detector today calls
  Haitian "Maltese". A table nobody routes to reads nothing.

## Full suite, by test name, before and after (this checkout, `node --test --test-reporter=tap`)
Before (HEAD 59d8264): 2593 tests, 2569 pass, 15 fail, 9 skipped. After: 2598 tests, 2574 pass, 15 fail, 9 skipped. The set of failing
names is identical (15): the known `every archon dossier passes the disclosure rule`, and 14 more that already fail at HEAD
(`telling.test.mjs` fails on this worktree's relative path to the khora — module not found; I did not diagnose the others:
`mechanical-telling`, `prove-upstream`, `constitutive-cycle`, `essay-seam`, `fold-e2e-essay`, `fold-experiment`,
`experiments/mind-wandering/{holograph,janus,penelope,wander}`, `eval/ants/falsify-checks/f4`, `E2 diff 5`, `E2 diff 9`).
The timing-flaky `race over the real heimdall bridge` passed in both runs. The five new tests are the only additions; the omnilingual
suite (`fold-chat-omnilingual.test.mjs`) passes unchanged (2/2).

## What the user must sign off before production registration
1. **Registering the five tables** in `GRAMMAR` (fold-chat-frame.js) — they are declared, ~6–43% of their entries unattested on disk
   (listed by `--audit`; `[U]` in the comments). Haitian and Tok Pisin are the best-sourced; Jamaican the worst.
2. **A creole function-word door**: `fold-chat-function-words.js` is generated from committed khora POS packs. hat and pcm packs exist (UD);
   tpi, mfe, jam have none, so their `FW` sets are declared. Registering tables without this reads nothing.
3. **Language ID** has to name these languages (it does not today), and **the salience/POS priors** (other ants) have to exist, or every
   content word is "never seen → name".
4. **Whether to change the schema** for the seven creole-only causes. None is applied. Candidates, each a table field with the current
   English behaviour as its default so en/es/fr stay byte-identical (provable with the omnilingual suite and this full-suite diff):
   (a) `doSupport` — the markers that play do/does/did (replaces the hard-coded set at the relation-position rule);
   (b) a flag for a clause-final copula; (c) trailing determiners trimmed from a filler's right edge (and a negator trimmed from its left);
   (d) per-role disambiguation for a word listed in two roles; (e) a variants map (orthography/allomorph) folded before stemming;
   (f) wh in situ; (g) the one-auxiliary trim, which also fails English ("will have been"). Each is a pre-registered Version 2 first.
5. **Accepting the wrong-by-luck reads**: T6/T10 (Tok Pisin `i` as pivot, verb as an unresolved name) and H1/H2/M1 (the relation word as a
   verb) answer correctly through paths that were not designed for the language.
