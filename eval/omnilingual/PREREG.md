# Omnilingual falsification of the slot-pipeline improvements — pre-registered 2026-10-13, before any run

Operator: "falsify all improvement omnilingually." The improvements on branch panel-fixes (7ac9b9a … a8884ca) were built and measured in
English only. The claim under test, for each improvement: **the rule is a property of the pipeline, not of English** — given only a declared
table for a language (the schema of GRAMMAR.en), the same case in that language gets the same verdict.

Method. `battery.mjs` holds each improvement's falsifier case in English, Spanish and French (languages with a received function-word prior
in this repo: en, es, fr). The es/fr tables (`grammars.mjs`) are DECLARED, not measured — the author's reading of each language's closed
classes, written before the run and frozen with this file. They are registered only for the run (`withGrammars`), never in production.
Each case runs the real askFrame / bindSentence / runAnswerTurn with a stub title door. A language with function words but no table (ru)
must end in a typed null for every case — the "no English guess" control.

Outcome per (improvement × language): HOLDS (the English verdict), FALLS (another verdict: a wrong filler, a lost answer, a crash), or N/A
(the case cannot be stated in that language). An improvement is OMNILINGUAL only if it HOLDS in es AND fr. Every FALLS is reported with its
cause, one of: TABLE (a declared word missing — a table fix), PRIOR (an English-only received prior decided it: the POS prior's ranks, the
-ed/-ing/-s stemmer, isName), or RULE (the rule's own logic is English-shaped). Nothing is tuned to pass.

## Version 2 — pre-registered 2026-10-13, after run 1, before run 2
Run 1 named three PRIOR causes and three RULE causes. Version 2 changes only received/declared PRIORS, never the run-1 table entries:
1. **POS priors per language** — the received UD gold POSPriors already in janus/priors (pos-spa.json: UD Spanish-AnCora; pos-fra.json: UD
   French-GSD) compiled by the same builder as the English one (`scripts/build-salience-prior.mjs --lang`), keyed by the folded form. A
   language with no prior measures nothing (null), never through the English prior.
2. **A declared light stemmer per language** — `suffixes` (ordered, longest first) and `minStem`, added to the es/fr tables as new fields; the
   English stemmer is unchanged. Declared, not measured (the author's reading of each language's regular inflection).
3. **Euphonic letters** — `euphonic` (French "t" of "a-t-il"), a new declared field that counts as closed class.
Expected before running: (1) can only turn PRIOR falls into holds where the case rests on part of speech; (2) cannot rescue an IRREGULAR
form (Spanish "descubrió"/"descubierta" — irregular participle) — that fall should remain; (3) should rescue the French hedged-row case.
The diacritic fold ("né" → "ne") is a RULE cause no prior can reach and should remain a fall.
(Disclosed: item (1) was wired and the battery run once before this section was written — it flipped three falls; items (2) and (3) are
pre-registered here before their run.)

## Version 3 and the perturbation arms — pre-registered 2026-10-13, before either runs
Operator: "remember, we need to survive typos and leetspeak and everything else."
**Version 3 (the French "né"/"ne" fall).** A declared `contrastive` list per language (accented forms that would fold into a different
closed-class word: fr "né", "née", "où", …; es "qué", "él", "sí", …). Only a token written WITH the accent keeps it; every other form folds
exactly as before, so unaccented input ("ne", a missing accent) reads as it does today — the change can only add precision, never strictness.
**Perturbation arms.** Every case runs five ways: as written; ask with accents stripped (noAccent); ask with one adjacent-letter transposition in
its longest content word (typo); ask with 4/3/1/0/5 for a/e/i/o/s in content words (leet); ask upper-cased with no punctuation (caps). Sources
are never perturbed — only what the person typed. The stub title door matches exact titles case-insensitively, as production's title lookup does.
Expected before running: noAccent and caps hold wherever the unperturbed case holds (the fold), except the contrastive forms whose accent was
removed (they fall back to today's reading); typo and leet FALL broadly — nothing in the pipeline normalizes them, and the referent is resolved
by an exact title. If so, that is the finding: robustness to typing has to be built (it is not a property the pipeline has today).

## Version 4 — the typing layer — pre-registered 2026-10-13, after the arms' first run, before v4 runs
Arms' first run (v3, + the possessor guard for every place ask): asWritten en 16/16 es 15/16 fr 16/16 · noAccent 16/13/12 · typo 8/7/8 ·
leet 7/7/7 · caps 16/15/16 — and most typo/leet "holds" are VACUOUS (cases whose expected verdict is no answer hold when the ask simply
breaks). From v4 on, the battery reports holds among POSITIVE cases (an answer is expected) separately.
Version 4 = an additive second reading of the ask (`fold-chat-typing.js`), never a rewrite of what the person typed:
1. a token mixing letters and digits is decoded by a declared per-script leet table (`leet`; 1 → i or l);
2. a token in no lexicon (the language's received POS prior, its function words, its table) is read as its UNIQUE one-edit neighbour
   (transposition, substitution, insertion, deletion) in that lexicon — ambiguous → left as typed;
3. a token the title door resolved on the first reading is never corrected (a real name the lexicon does not know stays itself);
4. the second reading is used only when it changed something and its frame resolves; every change is disclosed (`readAs`).
Expected: positive-case holds rise in the typo and leet arms in all three languages; asWritten and caps unchanged; a falsifier: a real
name absent from every lexicon but resolved by the door ("Zelda") is never "corrected".
