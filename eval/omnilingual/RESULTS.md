# Omnilingual falsification — results (2026-10-13)

Pre-registration: `PREREG.md`. Battery: `battery.mjs` (real askFrame / bindSentence / runAnswerTurn, stub title door). Tables: `grammars.mjs`
(declared es/fr, frozen before the run, registered only through `withGrammars`). Standing test: `fold-chat-omnilingual.test.mjs`.

## What the falsification found before any improvement could be judged
1. **Every accented table word was silently unmatched.** Tokens are compared by their fold (lower case, diacritics stripped: "quién" →
   "quien", "nació" → "nacio"), but table words were compared raw — so no Spanish or French interrogative, copula or place verb ever matched
   and every es/fr ask failed at the frame. Fixed in code, not in the tables: `grammarOf` folds every table word the way tokens are folded.
2. **English shapes were in the rules, not the tables.** The binder spelled "may", "no", "been", "whose", the possessive "'s" and "n't" in
   code; they are now table fields (modalMonths, numberSigns, perfectCopulas, possessiveRelatives, possessiveSuffix, negationSuffix). Two rules
   were English-shaped and were wrong in English too: a compound tense ("Jane Austen HAS written", "Jane Austen A écrit") hid the subject
   behind its auxiliary, and a place ask needed a copula ("was born") — a one-word relation ("nació en Salzburgo") had no pivot. Both fixed.
3. **A number after the place lead** ("born in 1756 and died in Vienna") leaked a junk filler at bind level in all three languages (the title
   door caught it at turn level). A number there is a date or a count, never the place — fixed.

## The matrix (after those fixes; the tables unchanged since the pre-registration)

| improvement | en | es | fr |
|---|---|---|---|
| relative clause: the antecedent is the subject | HOLDS | HOLDS | HOLDS |
| passive agent inside a relative clause | HOLDS | FALLS (PRIOR) | FALLS (PRIOR) |
| derivative page is another entity | HOLDS | HOLDS | HOLDS |
| derivative control: the work's own page binds | HOLDS | HOLDS | HOLDS |
| place: the relation's containment phrase | HOLDS | HOLDS | HOLDS |
| place: a later clause's place is not the relation's | HOLDS | FALLS (PRIOR) | FALLS (RULE: fold) |
| place: a possessor/kinsman is not the anchor | HOLDS | HOLDS | FALLS (RULE: fold) |
| place: a description is not where | HOLDS | HOLDS | HOLDS |
| place: relation-less containment phrase | HOLDS | HOLDS | HOLDS |
| place: a calendar word is a time | HOLDS | HOLDS | HOLDS |
| place: "the capital OF X" says where | HOLDS | HOLDS | HOLDS |
| attribute qualified by an ordinal is not the attribute | HOLDS | HOLDS | HOLDS |
| attribute control: the capital | HOLDS | HOLDS | HOLDS |
| false premise: the kind noun must be said | HOLDS | FALLS (PRIOR) | HOLDS |
| a hedged row is no rival | HOLDS | HOLDS | FALLS (RULE: tokenizer) |
| dominance: the row that says the ask's scope word | HOLDS | HOLDS | HOLDS |
| control: ru (function words, no table) | typed null — no guess | | |

**11 of 16 improvements are omnilingual** (hold in es and fr with only a declared table). **5 fall**, and each fall has a named cause:
- **PRIOR (3):** the received priors are English. There is no stemmer for es/fr ("descubrió" never meets "descubierta"; "découvert" never
  meets "découverte"), and the POS prior has never seen a Spanish or French word, so "y murió" is not read as opening a clause and "primera"
  is not read as a relation (so "mujer" is not marked a kind). The fix is a received prior per language — a stemmer/lemma table and a POS
  prior — not a rule change; until then these rules are English-scoped.
- **RULE: the fold (2, French).** Stripping diacritics makes "né" (born) the function word "ne": the ask loses its relation, so the clause
  bound and the possessor guard (relation asks only) never run. The fold is shared by the whole app; distinguishing "né"/"ne", "été"/"été",
  "où"/"ou" (and Spanish "qué"/"que", "él"/"el", "sí"/"si") needs a per-language decision about which diacritics are contrastive.
- **RULE: the tokenizer (1, French).** The inversion "y a-t-il" is split at its hyphens and the euphonic "t" becomes an unknown word the
  witness must then find. The tokenizer needs the language's clitic/inversion forms.

Nothing was tuned to pass: the es/fr tables are byte-identical to the pre-registered ones; every fix above is in code and also holds in English
(the full suite by test name is unchanged).

## Run 2 — version-2 priors (PREREG.md §Version 2)
- **Per-language POS priors** (UD Spanish-AnCora, UD French-GSD, the received janus/priors POSPriors compiled by the same builder as English):
  turned three PRIOR falls into holds — Spanish "y murió" now opens a clause (es later-clause), "primera" is a relation so "mujer" is a kind
  (es false premise), and the French later-clause case. (Disclosed: wired and run once before the §Version 2 text was written.)
- **Declared light stemmers**: French "découvert"/"découverte" now meet — the French passive agent holds. Spanish "descubrió"/"descubierta"
  still falls, as pre-registered: an irregular participle no suffix rule can reach; it needs a lemma prior (UD lemmas — not on disk; a download).
- **Euphonic letters**: the pre-registered expectation was FALSIFIED as stated — the tokenizer does not split "a-t-il", it keeps it whole, so the
  run-1 diagnosis ("splits the inversion") was wrong. The fix is structural: a hyphen-joined form whose every part is closed class (by the
  language's own table — "a", euphonic "t", "il") is closed class. French hedged row now holds.

| improvement | en | es | fr |
|---|---|---|---|
| passive agent inside a relative clause | HOLDS | FALLS (PRIOR: irregular participle — needs a lemma prior) | HOLDS |
| place: a possessor/kinsman is not the anchor | HOLDS | HOLDS | FALLS (RULE: the fold makes "né" the function word "ne") |
| every other improvement (14 rows) | HOLDS | HOLDS | HOLDS |

**14 of 16 improvements are omnilingual after run 2.** The two that remain need, respectively, a received lemma prior for Spanish (a download of
the UD lemma column, not on disk) and a per-language decision that some diacritics are contrastive (French "né"/"ne", "où"/"ou"; Spanish
"qué"/"que", "él"/"el") — a change to the fold the whole app shares, scoped by a table field so English is untouched.
English is unchanged by every v2 change (full suite by test name: same 11 pre-existing failures).

## Run 3 — contrastive accents (v3) and the possessor guard for every place ask
A declared `contrastive` list keeps an accented form distinct only when it is WRITTEN with its accent (French "né" ≠ "ne"); a missing accent
reads exactly as before, and a contrastive table word also answers to its plain fold. The French possessor case now holds: **15 of 16
improvements are omnilingual** — only Spanish "descubrió"/"descubierta" (irregular participle; needs a lemma prior) remains.
The first perturbation run then showed that an accentless French ask ("Ou est ne Mozart ?") COMMITTED the father's place ("Augsbourg"): the
possessor guard ran only for asks with a relation word, and the unaccented "ne" had removed it. The guard now runs for every place ask.

## Run 4 — the perturbation arms and the typing layer (v4)
Positive cases only (an answer is expected; 9 per language). Before v4 nearly every typo/leet hold was vacuous (a broken ask gapping where no
answer was expected).

| arm (only the ask is perturbed) | en | es | fr |
|---|---|---|---|
| as written | 9/9 | 8/9 | 9/9 |
| caps, no punctuation | 9/9 | 8/9 | 9/9 |
| accents stripped | 9/9 | 6/9 | 5/9 |
| one transposition in the longest content word | **8/9** | **7/9** | **5/9** |
| leetspeak (4/3/1/0/5) | **9/9** | **7/9** | **5/9** |

The typing layer (`fold-chat-typing.js`): leetspeak decoded by a declared per-script table in tokens that mix letters and digits; an
out-of-lexicon word read as its UNIQUE one-edit neighbour in the language's received lexicon (UD POS-prior forms, function words, the table),
transpositions asked first; a closed-class form and a name the title door resolved are never touched; the reading is used only when it
changed something and its frame resolves; every change is disclosed in the turn's trace ("I read 'M0z4rt' as 'Mozart'."), and the person's
words are never rewritten. Falsifiers: `fold-chat-typing.test.mjs` (a name no lexicon knows — "Zelda" — is never corrected).

What still breaks, by cause:
- **A misspelled NAME** ("Mzoart", "Ciare", "Mhaal", "pneicilina"): names are mostly absent from a POS lexicon and the title door matches exact
  titles and redirects only. The fix lives at the door: ask the encyclopedia's own spelling suggestion when a run does not resolve.
- **Accentless names** ("Espana", "Bresil", "futbol", "Prejuges"): the stub door holds only accented titles; production depends on the
  encyclopedia's own accentless redirects (common, not universal) — unmeasured here.
- **A typo that is another real word** ("prejuicio" → "perjuicio" is a Spanish word): no lexicon can tell; left as typed, as it must be.
- **French leet/typo on words the fr prior lacks** ("terrain", "joueurs" decode fine; "capitale" with 1 → i|l ambiguity): partly the
  ambiguity rule refusing to guess.
