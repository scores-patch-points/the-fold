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

## Live held-out, after the fixes (2026-10-13, no model, live web, concurrency 1)
Measured on the 32 slot + holder rows the run finished (the headless browser's GPU process crashed after row 36 under machine load; the
compound, follow-up, compute and false-premise categories were not re-run — compute was 4/4 in the earlier fixed run, compound and
follow-up 0/4 each, which is the discourse-audit session's ground). The code changed during the run (commits eb7cae6 … 61206ab landed
between rows), so this is a mixed-tree measurement, one run, live variance about ±15 points.

| 32 slot + holder rows | before the fixes (panel run) | after |
|---|---|---|
| committed and correct | 9 | **14** |
| committed WRONG | 2 | 1 |
| contest (right answer present in most) | 13 | **10** |
| typed gap | 8 | 7 |

Row-level changes: gained — first president, Moonlight Sonata, Titanic, Mozart's birthplace, capital of Egypt, longest river in Africa,
presidents of Brazil and Mexico; typed gap instead of a wrong commit — Pride and Prejudice (Zombies), chancellor of Germany; lost —
capital of Brazil (contest with the "fourth and unofficial capital"), bones (the count's copular form), both fixed afterwards in
39cfc0c but not re-measured live; "tallest mountain" is committed to Mauna Kea (the page says "tallest … from the ocean floor"), a
gold-dispute, not a defect of the binder. C1 on this slice: 14/32 = 44% (bar 60%); the oracle ceiling over what retrieval handed the
fold was 78%.

## Second re-read (final tree after 59ba780) and what it changed (bdf17b1)
Verdicts: SHIP-WITH-DISCLOSURE ×3 (panels 5, 7, 8), HOLD ×6 — each HOLD was a reproduced new regression versus 4c5050a, not a reopened old one.
All reproduced MUST-FIX items were fixed in bdf17b1 with falsifiers LIVE-28…LIVE-33 (they fail on 4c5050a or on the tree they were found in):
dominance on scope words only; the whole-name override bounded to the copula's clause (alias must begin its noun phrase, a relative left clause
never overrides, the named attribute must be said in that clause); "No." only with its period and the copular count only after "number of";
place alternatives: container of an unbroken chain first, end at any preposition, calendar words never a place; "the capital OF Egypt" says
where; a title may begin with a preposition; a page that RESOLVES (redirects) to a referent is the referent's page.

Still disclosed after this round (each reproduced, none a new wrong commit versus HEAD unless noted):
1. `personLike` admits a role noun the prior has never seen ("the throne", "the pharaoh", "the actor") when the door has its page — same as
   HEAD; the title door is the only net. A name led by its article whose words are known common nouns ("The Rock", "The Edge") gaps.
2. A page title that extends the ask's with unrelated words and does not redirect to it ("The Lord of the Rings: The Fellowship of the Ring",
   "Hamlet: Prince of Denmark") is discounted: a typed gap with no closest sentence (HEAD answered).
3. A third entity's derivative read on an unrelated page ("Seth Grahame-Smith wrote Pride and Prejudice and Zombies" on the Jane Austen page)
   still binds, as at HEAD.
4. Alternatives are tried container-first; a chain whose container is wrong ("born in Paris in France" → France) answers the wider region.
5. The copula side, the alias-begins-the-subject test, the locative cue and the adverbial test are token-position/class decisions with the
   referent consulted afterwards by the title door; a kind test (is the resolved page a place / a person) needs a kind from the door and is
   not available offline.
6. Dominance is a containment test over the ask's scope words, disclosed in the answer ("another source says X but does not say …").
7. `isVerb` is `posRankOf(...) === 6` — the received prior's tag, English only; a language without that prior has no verb test.
8. Digit-led names ("50 Cent", "21 Savage", "Louis 16") read as dates and gap.

## Third re-read (bdf17b1) and what it changed (e6328b2, ed08dac)
Verdicts: SHIP-WITH-DISCLOSURE ×4 (panels 1, 5, 8, 9), HOLD ×5 — again each HOLD was a reproduced regression versus 4c5050a introduced by the
previous round's fixes, narrower each time. Fixed with falsifiers LIVE-34…LIVE-38:
- container-first made "born in Ulm in Germany" answer Germany → a relation takes the FIRST containment phrase; only a relation-less copula
  complement is container-first; a determiner-led phrase is tried after the bare ones (the demotion flag was computed after the cursor moved —
  found by its falsifier);
- a subordinator (while/although/whereas/because …) now bounds the copula's clause; a possessor ("Mozart's father") is not a subject; the place
  walk needs the anchor to be the relation clause's subject (a relative clause's subject is its antecedent);
- "a DESERT in Africa": a word directly after a determiner is a noun, never a second predicate;
- the name after "of" says where only after a declared place noun (fold-chat-grammar-places.js); attribute-valued place asks need no cue;
- dominance reads the clause holding the filler AND needs full coverage of the ask's scope words — the clean live run crowned "Neil Armstrong" for
  "the first woman to walk on the Moon" (a C2 violation) and the guard + a falsifier that fails without it close it.

Disclosed after this round (each reproduced): a non-calendar temporal page ("Lent", "Ramadan", "Easter") is admitted as a place when the true
place does not resolve; an article-less common noun ("born in hospital in Honolulu") takes the first phrase under a relation; "50 Cent" /
"The Rock" gap; the possessor-of-the-subject case "Leopold Mozart, father of Wolfgang Amadeus Mozart, was born in Augsburg" (unchanged from
HEAD); "Jeff Williams is the COO of Apple Inc. and Tim Cook is the CEO" answers by first copula (unchanged from HEAD); a title that begins with a
function word whose later word the prior ranks a verb ("After the Gold Rush") reads as a clause and gaps.

## Live held-out on the final tree (ed08dac; clean run, one process per category, concurrency 1, no model, live web)
Slot + holder (33 rows): committed-correct **12** (before the fixes 9), committed-WRONG **1** (before 3), contest 12 (13), typed gap 7 (8),
one holder ask with no slot answer. False premises (4): **no committed answer** (1 contest, 3 typed gaps). Compute 4/4 (earlier run).
Compound 0/4 and follow-up 0/4 are unchanged — the discourse-audit session's ground.
- the one committed-WRONG is "tallest mountain" → Mauna Kea (the page says "tallest … from the ocean floor"): a gold dispute;
- "What language is spoken in Brazil?" moved from a committed-"correct" to a typed gap: the earlier "correct" was a false positive (the answer line
  was "Before the first Portuguese explorers arrived in 1500" — the gold pattern matched the word "Portuguese");
- the clean run caught one real C2 violation the earlier runs did not (the Armstrong false premise), now closed and pinned (LIVE-38).
C1 on slot + holder + compute: 16/37 = 43% (bar 60%; the oracle ceiling over what retrieval handed the fold was 78%). C2 held on this set
(0 confident-wrong outside the disputed row). One run, live variance about ±15 points.
