# Archon compliance read of the live-gate fixes — 2026-10-13

Charge to every panel: (1) our reading policies (P11, P12, no hand-set thresholds, no case read, tables declared with a giver, the
model never decides); (2) no regressions against committed HEAD (4c5050a) and baseline 620f0a4; (3) no span treated as the thing in
itself — a decision must consult the referent. Nine panels (83 compendium archons, the nine revision-grid editors, Kelsen), each
running its own probes against the real code; every finding below was reproduced, not argued.

## First read: nine panels, nine HOLDs
The uncommitted changes (derivative-page discount, relative-clause copula skip, person-like filler, place alternatives, attribute
apposition, `for`-governs, unresolved-anchor gap, title merge) regressed answers HEAD gave and committed new wrong ones:

| mechanism | what it did | disposition |
|---|---|---|
| relative-clause copula skip | killed every appositive ("Canberra, which is the capital…"); "Penicillin, which was discovered by Fleming…, is an antibiotic" committed *antibiotic*, "Macron, who is the president…, was born in Amiens" committed *Amiens* | **removed** (HEAD behaviour; the antecedent is the subject) |
| attribute apposition | took the head noun (*city*), a neighbour's attribute (*Jakarta*), the last occurrence (*Melbourne*), function words (*there*, *it*, *as*) | **removed entirely**; the sodium → "Na" gate row is a typed gap again |
| place alternatives | crossed clauses/relatives/other persons: *Vienna*, *Augsburg*, *Princeton*, *home*, *hospital* | bound to the relation's own clause; containment prepositions only; no indefinite-led, no digit-bearing (egress), no wider appositive phrase, full anchor name must begin the subject |
| person-like filler (prior rank ≥ 8) | refused Jobs/Musk/Brown/Cary Grant/Hope Solo | no prior: a digit-led run is a date; a determiner-led run is a description unless it holds a name-like word |
| longer-title discount | fired on every title that extended the ask's ("Attack on Pearl Harbor", "Tesla, Inc." on its own page) | consults the referent: no discount when the page IS a frame referent's resolved title or the extra words are the ask's own |
| unresolved-anchor gap | fired on any uncovered first word after "of" ("capital of western Australia") | fires only when NO content word after the governing word is in a chosen run; a run inside an earlier governor's tail is skipped |
| title merge | grouped candidates by title but contests were still computed by string equality | rival/negation checks consult the resolved title (`fold-chat-falsify.js`) |
| English tables inlined in code | `LOC`, `PREP`, `AUX`, role verbs, place verbs | moved to `GRAMMAR.en` (`roleVerbs`, `placeVerbs`, `prepositions`, `containment`, `indefinites`, `subordinators`, `governsAtHead`); a field a language does not declare means the rule does not fire |

## Re-read (same nine panels re-ran their probes on the redesigned code)
Closed: the relative clause, apposition, cross-clause places, `personLike` on surnames, the unresolved-anchor modifiers, the longer-title
discount on its own page / role pages / event pages, the inline tables. After the re-read the remaining reproduced items were fixed:
described passive agents ("by the Scottish physician Alexander Fleming"), the contest merge, "United States of America", "a day when …",
"Louis Napoleon", "A. Fleming".

## Disclosed, not fixed (each reproduced; none commits where HEAD committed the right thing)
1. **A name led by its article** whose words are all known common nouns ("The Rock", "The Edge") gaps; "The Beatles"/"The Weeknd" keep their name.
2. **A common noun the prior has never seen** is admitted as a person or a place: "the incumbent", "the monarch", "at the hospital in
   Honolulu" → *hospital*, "born in January in Salzburg" → *January*. The title door is the only net; a kind test is the referent-level repair.
3. **First resolvable alternative wins by position** within the relation's clause (a venue before its city).
4. **A derivative of a third entity's page** ("Seth Grahame-Smith wrote Pride and Prejudice and Zombies" read on the Jane Austen page) still binds,
   as at HEAD; a title that extends the ask's with unrelated words ("The Lord of the Rings: The Fellowship of the Ring", "Harvard University")
   is discounted and gaps with no closest sentence.
5. **`isVerb` is `posRankOf === 6`** and `isName` is the prior's own predicate: both are the received prior's tag, not a new constant, and both are
   English-prior reads (a language with no prior has no verb test; its tables simply do not declare the rule).
6. **Pre-existing, unchanged**: irregular verbs and four-letter -e verbs miss denials (MF10), the surname-only coreference, "Louis 16" (digit-led name).

## Suite
Full suite by test name against baseline 620f0a4: 2315 tests, the same 11 failures as baseline (all in the thinker/narration files),
nothing that passed at baseline fails or is missing. 16 falsifiers in `fold-chat-live-gate-fixes.test.mjs`; one existing assertion was
changed (`fold-chat-witness.test.mjs`: "the one that acceded" is a pronoun-like run, no longer a person filler; the clause-boundary trim is
pinned on a name instead).
