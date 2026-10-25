
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

## 2026-10-16 — eot code-view (byte-addressed) + playback a11y/pacing + draft-lint prereg (main, staged)
fast: 11 files · 200 affected tests (196 pass, 0 fail) · law: ok (0 citations)
| lens | citation | file:line | verdict | one line |
|---|---|---|---|---|
| Feynman | numeric bounds | fold-chat-presentview.js:954 | false-positive-on-review | livePace's 1..3 is the documented pace enum (normal/slower/slowest), an input guard with a reduced-motion fallback, not a tuned constant |
| Dijkstra | stage allowlist | fold-chat-eotview.js:6 | noted | MODEL_STAGES is an explicit said-vs-observed enum matching the door's stage vocabulary; a future model stage would just glyph "·" until added — display only, not an identity substitution |
| Pearl | independence | docs/DRAFT-LINT-SPEC.md:77 | noted | "n independent drafts" is a design parameter; same-model drafts are not proven independent, and the prereg's harness does not yet measure inter-draft correlation |
| Ostrom | baseline scope | docs/DRAFT-LINT-PREREG.md:21 | clean on review | L0 = raw draft is the correct baseline; each added layer beats it or retires — no pooled baseline, no "not found" as "does not exist" |
| Alexander | composition | docs/DRAFT-LINT-SPEC.md:20 | clean | design only, nothing built; each lint returns a Finding {severity: block|mark|note}, the doorway composes them — no silent don't-compose seam |
| Simon/Chekhov | wiring | fold-chat-eotview.js | clean | new module is imported by fold-chat-folds.js and unit-tested 5/5; the door serves /v1/hooks/opencode/eot/{log,tree,file} (verified in khora/opencode-doorway.mjs + opencode-eot.mjs) — a real, wired mechanism |
clean: LeviStrauss (0 of 45 stashed pieces vs 90 open problems — nothing to reclaim here)

## 2026-10-21 — falsify: slot rivals, split pair joins, copula links (main, staged 4 files)
fast: 4 files · 16 affected test files, 55 pass 0 fail 1 todo · law: ok
| lens | citation | file:line | verdict | one line |
|---|---|---|---|---|
| Feynman | numeric constant | fold-chat-falsify-answer.js:426 | false-positive-on-review | directionSwapped is origin #30, carried into this diff to match the vendored copy; the new bounds (two-word slot frame, complement of at most two words) are disclosed scope, and controls pin both sides |
| Dijkstra | locale | fold-chat-falsify-answer.js:423 | false-positive-on-review | the same #30 line; new code compares folded tokens and stems, with no hashing or allowlist |
| Pearl | independence | fold-chat-falsify-copula.test.mjs:7 | false-positive-on-review | HELD is just the verdict names held/corroborated; the test makes no claim about independence |
| Frankfurt | placeholder | fold-chat-falsify-copula.test.mjs:19 | noted | a real gap pinned as a todo (green vs blue needs meaning relations), not a fake pass |
| Greenberg | language scope | fold-chat-falsify-answer.js:467 | fixed | the copula rule now states its English-only scope; the slot rule's capital-shape test states how it treats scripts without case |

## 2026-10-22 — vendor manifests: re-pin wordclass.js, mark janus PR #6 merged (repin-khora-wordclass, staged 2 files)
fast: 2 files · 0 affected tests (manifest data only; vendor-self-check 84/84 byte-identical, vendor-janus --check ok) · law: ok
| lens | citation | file:line | verdict | one line |
|---|---|---|---|---|
| Holmes | identity | vendor/janus/VENDOR-JANUS.json:5 | false-positive-on-review | the hit is the path "organs/identity" in a provenance note; no entity or coreference decision is made |
clean: none other routed

## 2026-10-22 — judge battery: one JSON case table + runner + CI step (judge-battery, staged 5 files)
fast: 5 files · gate tests 105 (97 pass, 0 fail, 8 todo = known breaks) · law: warn S1 (a source title in a case row, not a citation)
| lens | citation | file:line | verdict | one line |
|---|---|---|---|---|
| Feynman | skipped/constant | eval/judge/cases.json:1159 | false-positive-on-review | hit is HTML text in a source; known breaks are todo rows, reported loudly (BREAK/FIXED lines, --strict-todo in CI), never silently skipped |
| Holmes | identity | eval/judge/cases.json:402 | false-positive-on-review | a row family label |
| Pearl | independence | docs/JUDGE-BATTERY.md:6 | false-positive-on-review | the verdict names |
| Ostrom, Frankfurt, Kondo | scope/placeholder/dead | cases.json notes, workflow comment | false-positive-on-review | words inside notes/comments |
| Marshall | S1 | cases.json:726 | false-positive-on-review | "S1" is a source title |
| Simon/Chekhov | wiring | scripts/judge-battery.mjs | clean | imported and tested by fold-chat-judge-battery.test.mjs; run by the CI workflow |
Negative controls: khora committed pin 0055d480 fails 26 rows, holodeck pin 63e9309 fails 35, khora 170e0ae fails 3; the parent of each of the 12 judge fix commits fails 4-26 rows.

## 2026-10-24 — remove the "present" panels (fold-chat-presentview.js, the drawing half of fold-chat-present.js) (remove-present-panels, staged 14 files)
fast: 12 files · 34 affected test files, 402 tests, 0 fail (the ✖ lines are the judge battery's known-break todo rows) · law: ok (0 citations)
| lens | citation | file:line | verdict | one line |
|---|---|---|---|---|
| Feynman | constant | styles/answer-evidence.css:4 | false-positive-on-review | a contrast ratio inside a header comment, no comparison |
| Holmes | identity | README.md:216 | false-positive-on-review | the words "canonical khora" in prose |
| Kondo | dead | docs/PLAYBACK-STEPS.md:3 | noted | kondo scan is identical on main and the branch; the offline scripts that import the removed exports (docs/playback/*/prep.mjs, extract.mjs, nav/contact.mjs; eval/ants/falsify-checks/f1, f2, f3) are dated records, left as they are, runnable at 86c556e |
| Simon/Chekhov | untested | fold-chat-present.js | noted | what is left is salientSentences, a local rule kept only because fold-chat.js still calls it (sourcesPrompt, lattice L1); no test imports it, as before (the f2 harness reached it through the panel) |
