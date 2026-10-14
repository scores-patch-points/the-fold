
## 2026-10-14 — Wald, the watcher of the pull, wired in shadow (archon/wald, 381aac7..HEAD + khora archon/wald)
fast: 12 files · 177 affected tests pass · law: ok (0 citations) · note: eval/wald/calibrate.mjs, scripts/vendor-khora.mjs untested (a script a person runs; the vendor tool's own --check)
| lens | citation | file:line | verdict | one line |
|---|---|---|---|---|
| Ostrom | pre-registered bar 3 | docs/archons/WALD-PROPOSAL.md:113 | fixed | baseline named "always-search" — the live gate is the `wantWeb` conjunction; scope corrected |
| Alexander | composition seam | khora native/organs/wald.js (waldDecide) | fixed | an ask no witness reads composed to a silent "take nothing"; now a typed gap, with its test (khora 06bc7122, re-vendored) |
| Simon/Chekhov | new source untested | fold-chat-wald-calibration.js | fixed | the shipped calibration is now imported by wald.test.mjs: schema, separable bars, a creative ask refused the web |
| Diaconis | null | eval/wald/calibrate.mjs (null arm) | noted | the shuffled-witness null is a weak bar (p05 149 vs gate 11); B3 holding says little — gate-now is the comparator that bites (B1, which FAILS) |
clean: none routed beyond the four

## 2026-10-14 — Wald Amendment 1: a language witness (archon/wald, 40f128f..HEAD)
fast: 8 files · 180 affected tests pass · law: ok (0 citations) · note: eval/wald/calibrate.mjs untested (a script a person runs)
| lens | citation | file:line | verdict | one line |
|---|---|---|---|---|
| Diaconis | null / measurement | eval/wald/PREREG.md Amendment 1; eval/wald/calibration.json (lr.lang) | noted | the lang witness fires on 12 cases.json rows, all label=search; no non-English no-search row exists, so its ratio (2.32) cannot be falsified on this gold — declared in the proposal; needs gold + a new prereg before gating |
| Simon/Chekhov | new signal in the surface | fold-chat.js:2540 | noted | `lang`/`closedClass` wired into the shadow hook; unit-tested via witnessVotes (4 mutants killed); not re-checked on a live turn (preview slots full) — declared |
| Greenberg (not routed, read anyway: the diff is about language) | language scope | fold-chat-wald.js (lang witness) | noted | "no closed class" is reader coverage, not a language property (de, pt fire); e_wall_sw is read as `id` by langid, so the why names the wrong language — scope declared in the proposal |
clean: Pearl (lang and lookup do not double-count: lookup abstains exactly where lang votes)

## 2026-10-14 — Wald's turn ledger (archon/wald, 965c8fd..HEAD)
fast: 5 files · 170 affected tests pass · law: ok
| lens | citation | file:line | verdict | one line |
|---|---|---|---|---|
| Feynman | swallowed error | fold-chat.js (waldLedgerUpdate) | fixed | a full/blocked store dropped ledger turns silently; now counted and stamped on the next entry that lands (`droppedBefore`), tested |
| Feynman | numeric constant | fold-chat-wald-ledger.test.mjs:47 | false-positive-on-review | `cap: 3` is test data |
clean: Simon/Chekhov (the new module is imported by its test)

## 2026-10-14 — Wald Amendment 2: read-back paths vote, multi-turn gold (archon/wald, 3c2c7d5..HEAD)
fast: 10 files · 193 affected tests pass · law: WARN P6 P11 cited (false positive: prior ids P6–P11 in the proposal's table text, not policy citations)
| lens | citation | file:line | verdict | one line |
|---|---|---|---|---|
| Diaconis | null / measurement | eval/wald/calibrate.mjs (waldLOO over mt) | noted | leave-one-out drops a ROW, but the new gold clusters 9 rows per prior: the other 8 rows of the same thread stay in the pool, so the source ratio is optimistic on mt; the labels of L1 rows also coincide with the watcher's own category. Both declared in PREREG Amendment 2; a leave-one-prior-out run would need Amendment 3 |
| Diaconis | bar B4 | eval/wald/results.json (restingCost) | noted | B4 FAILS (max 3.24 ms run A, 1.36 ms run B, median 0.024 ms); reported failed, not re-run; the outlier cause is unmeasured |
| Ostrom | scope of "unchanged" | docs/archons/WALD-PROPOSAL.md:172 | clean on review | checked by diffing the old-gold disagreement lists: 4 G1 rows change verdict (continue→probable) and none flips between pull and skip |
| Greenberg | language scope | fold-chat-wald.js (source (b)); eval/wald/calibrate.mjs:57 | noted | (b) reads watcherPre.want, whose cue lists are English (sourceask.js and watch.js declare this); a non-English source-ask casts no vote, an abstention and not a guess. The `.split(/(?<=[.!?])\s+/)` is the surface's own line, copied verbatim so the gold computes what the surface computes |
| Pearl (not routed, read anyway) | shared cause | fold-chat-wald.js (plan, source) | noted | on cold-gap, plan web:against and source web:against both descend from planTurn/threadOf, so they are not independent observations; Wald's naive sum double-counts them. Declared; it is the same limitation as every witness pair |
| Kondo | stray files | eval/wald/results-amendment2-runA.json | clean | kept on purpose: the pre-registered baseline run's raw output |
| Marshall | P6/P11 citations | docs/archons/WALD-PROPOSAL.md | false-positive-on-review | prior labels, not law |
clean: Simon/Chekhov (every changed source is imported by a test; 7 mutants killed)

## 2026-10-14 — the void, L1 (declared void: perception + grammar + pathos), void/universe @ b3c453a..HEAD
fast: 15 files · 90 affected tests pass · law: WARN P4 cited (false positive on review: khora's own law inside vendored void-shape.js)
| lens | citation | file:line | verdict | one line |
|---|---|---|---|---|
| Pearl | independence | fold-chat-void-declare.js (anchor.by) | fixed | "title-door"+"perceiver" read as two witnesses of the referent; the perceiver only witnesses the surface, the title is the one door's — said so in the header |
| Holmes | coreference | fold-chat-void-declare.js:85 | noted | the perceiver-led anchor still takes its title from the title door: no alias merge by surface |
| Diaconis | null | eval/void/null-void.mjs | noted | derangement keeps every void's base rate; 200 shuffles pre-registered |
clean: Feynman (200 is the prereg's), Dijkstra (folding is declared English-scope), Kondo (vendored file is wired), Simon/Chekhov (module tested 9/9, 5 mutants)
