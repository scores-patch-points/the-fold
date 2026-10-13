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
