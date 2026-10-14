# Proposal: Wald, the watcher of the pull

Status: RATIFIED by the person 2026-10-14 ("wire it in"). Wired in SHADOW mode: Wald decides and records on every turn (`record.wald`), and the surface's gate decides as before. Results are in the section *Shadow results (2026-10-14)* below. The chorus check is still open.

## The question Wald owns

For every prompt, Wald answers one question: **what has to be pulled before this can be answered, and from where?** Wald answers nothing else.

The candidate pulls form a closed register, ordered cheapest first:

| pull | what it is | existing machinery |
|---|---|---|
| `none` | answered mechanically, with no source and no model: a computation, a self-ask, a fixed reply, a typed gap | `fold-chat-kinds.js` `evaluate`, `selfAsk`, the cold-gap modes in `planTurn` |
| `thread` | the conversation already holds the material | `planTurn` mode `thread`, `fold-chat-anaphora.js` |
| `local` | material the fold already has: an attachment, the record (muninn), a cached page | `hasMaterial`, `fold-chat-memory.js`, `fold-chat-recall.js` |
| `structured` | one typed fact for one typed slot, from a structured source (Wikidata, a dated API) | `fold-chat-primary.js`, model-rule R6_SLOT |
| `web` | search, then read | `fold-chat-web.js`, `fold-chat-route.js` |
| `model` | the mouth, in one of its three named roles (steer, residue, prosify) | `fold-chat-model-rule.js` |

`model` is not an alternative to the others. It is decided *after* the grounding pulls, by the rule that already exists (`modelCallRule`). Wald does not take that rule over. It names which grounding pulls feed it, and whether the mouth is reached at all.

The boundaries with neighbouring archons:

- **Huginn** picks *which model* once Wald has decided a model call is licensed.
- **Gary** decides what goes into the prompt once the pulls are back.
- **`fold-chat-route.js`** picks *which web sources* once Wald has licensed `web`.
- **Heimdall** is Wald's boss, as for every watcher of outward flows: a web or structured pull is an outward flow.

## Why this needs an owner

Today the decision is one boolean (`wantWeb`, `fold-chat.js` ~2532): a conjunction of seven vetoes over a default of yes. *Corrected 2026-10-14:* the proposal first said every non-greeting turn searches. That was the comment on `wantWeb` in `fold-chat-discourse.js`, but the live gate is the conjunction in `fold-chat.js`, and G1's `needlessSearch` is already one of its vetoes.

- `wantsWeb` (`fold-chat-discourse.js:111`) is retained only for callers and tests. Its own comment reads: *"the surface itself now ALWAYS grounds (every non-greeting turn searches), so this is no longer the gate."*
- Before G1 was wired, that default cost **82.1% (138/168)** of poems, stories, jokes and taglines were web-searched although they ground in nothing (`eval/ants/G1-RESULTS.md` §1). `eval/cases.json` marks its three creative cases `expect.search:false`, and the old classifier searched all three.
- The decision is spread across five places with no single record: `classifyTurn` (kind), `describeOutput` (`needsSources`), `planTurn` (`mode`, `modelMay`), `routeSources` (which sources), and `modelCallRule` (the model bar). Each one is sound locally. None of them is answerable for the whole decision, and no turn records *why it pulled what it pulled* in one place.

## The gate: low bar = possible, high bar = probable, on every prompt

This applies the house rule (two bars, never one number) to every pull in the register, on every prompt.

**Witnesses.** Each existing organ becomes one witness that votes on each pull. Wald writes no new classifier. Each witness keeps its own failure modes, and their disagreements are recorded and typed rather than averaged away:

- speech act and kind (`classifyTurn`, `actOf`)
- output shape and `needsSources` (`describeOutput`)
- thread carry (`anaphoraOf`, `planTurn`'s thread)
- named-entity presence and its popularity or obscurity (cased runs, then a Wikidata hit or miss)
- temporal pressure ("today", "latest", "now", a date after the model's cutoff)
- material in hand (`hasMaterial`, a recall hit)
- source affinity (`routeSources` cues)
- self-knowledge: does the local model's own answer hold up under `modelCallRule`'s R1 bar?

**The low bar decides POSSIBLE.** A pull is possible if any one witness says it could help. The bar is structural: one witness firing is enough, and no number is chosen. It is cheap and broad, and on its own it never spends anything.

**The high bar decides PROBABLE.** A pull is licensed to spend only when its witnesses agree beyond a null. The null is the same witness agreement measured on the labelled turns where that pull was *not* needed. The bar is set by conformal risk control against the measured cost of a missed pull (see Calibration below), so nothing is set by hand.

**Between the bars, Wald follows Wald's own rule: take one more observation, the cheapest one.** A pull that is possible but not probable is never spent outright. Wald takes the cheapest pull that would resolve the doubt (`thread` before `local`, `local` before `structured`, `structured` before `web`), re-decides on what came back, and stops at the first pull that clears the high bar or once the possible set is empty. This is the sequential probability ratio test applied to retrieval: accept, reject, or sample once more.

**Every prompt gets a record.** It is appended to the turn's record, next to `record.modelRule`:

```
pull: { possible:[…], probable:[…], taken:[…in order], skipped:[{pull, why}],
        witnesses:{name:{vote, why}}, disagreements:[typed], cost:{ms_by_pull, ms_total, returned_ms} }
```

A pull that was possible but not taken is shown together with the reason it was not taken. This is the parliament's minority report.

## Metabolism: the currency

Read from the primary source: Wald, *Sequential Analysis* (Wiley 1947). The held excerpt is registered at `eo-teachings/manifest/wald.json`; the other loci were read from the full text, which is not held in-repo because the work is in copyright, renewed 1974 (R582266).

**Wald's own currency.** §10.4.3, footnote 2 adds the cost of experimentation into the risk itself: the expected loss from wrong decisions plus c times the expected number of observations, where c is the cost of a single observation. If cost is not proportional to the number of observations, the cost term becomes E[c(n)] for a cost function c(n). Footnote 3 adds that if you minimise the *maximum* of that total risk, no separate risk ceiling has to be imposed. Wrong decisions and looking are paid for in **one unit**, and a minimax over that unit needs no hand-set cap.

**Wald's currency for Wald the archon:**

- **The unit is measured milliseconds of the person's wait.** These are the c(n) of each pull, measured on this machine. A cold model load is charged to the call that caused it. A repeat fetch of the same key is free (`fold-chat-budget.js` already charges a key only once). Cost is not proportional to the number of pulls (a web pull costs far more than a thread pull), so the cost-function form E[c(n)] is the right one.
- **The losses w_i are priced in the same milliseconds,** measured on the ground ledger. A missed pull costs the void it caused plus the re-ask it forced. A wasted pull costs its own c and returns nothing (no passage cited).
- **Earning back:** a pull earns its cost when its result is used, through a cited passage, a recall that answers the turn, or a real gap. Return on spend per pull kind is the running record, and prices move with it.
- **Resting cost:** deciding must cost less than the cheapest pull. The witnesses involve no model and no network. Wald never calls a model to decide whether to call a model.
- **What the currency cannot buy:** off-device exposure. Consent is a gate, never a price. Privacy is not traded against milliseconds.

**The bars come from costs, not from hand-set numbers.** §3.3 derives the two thresholds from the tolerated error rates: A ≈ (1−β)/α and B ≈ β/(1−α). Wald also notes that choosing the zones and the error rates is "not a statistical problem" and rests on the practical consequences of a wrong decision (§2.3.1). Here those consequences are measured (the w_i, in milliseconds), so α and β follow from the ledger and A and B follow from α and β. The minimax form (fn. 3) removes the last free ceiling.

**Truncation is the budget ceiling** (§3.8). There is a hard upper limit on pulls per turn, with a stated rule for deciding when the limit is reached, and the change it makes to the error rates is bounded and recorded. The declared presets in `fold-chat-budget.js` become this ceiling. They are no longer the decision.

**What the source does and does not claim about efficiency.** In 1947 the SPRT is shown to be near-optimal in the expected number of observations (Appendix A.7). Sequential tests "usually" save about 50% over a fixed-sample test of equal strength (§2.4.2). Exact optimality is the author's **conjecture** in a footnote to §2.4.1, not a result. The proof is Wald & Wolfowitz (1948), *Ann. Math. Statist.* 19(3):326–339. The citation is checked, but the paper has not been ingested because Project Euclid's bot wall refused the fetch. Its optimality covers two simple hypotheses with one observation at a time, which is narrower than "the efficient budget rule".

**Pre-registered bar 5:** Wald's own decision cost per turn is below the measured cost of the cheapest pull.

## Metabolism II: what he starts with, what refills him, trails, recursive learning

Pre-registered in `eval/wald/PREREG-METABOLISM.md` before any code. Prior art for this section is in *Prior art: metabolism* below.

**What he starts with: as rich as the gate he replaces, and no richer.**
- **Knowledge:** the measured witness ratios from the 341 gold rows. Anything unmeasured is a typed gap.
- **Budget per turn (Wald's §3.8 truncation):** what today's gate actually spends on a turn, in ms, measured from the ledger. Until then the declared 1 ms stand-in stays declared.
- **α and β:** a loan from the current gate's measured error rates. They are repaid by Wald's own measured rates once the ledger holds them (arm `recal`).

**What refills him: returns, not time.**
- A pull earns its cost back only when what it fetched is used: a cited passage, a recall that answered the turn, or a typed gap that held (the next act is not a re-ask).
- A pull he skipped that the person then needed (a re-ask, a source-ask, a challenge on the same topic) costs him that next turn's ms. This is Wald's w, the loss for the wrong decision, in the same currency.
- Prices follow return on spend for each kind of pull. The ceiling grows only while the overall return is above 1, so it grows from savings and never from being trusted more.

**Pheromone trails: Wilson's layer, as one more witness.**
`kernel/stigmergy.js` (Handle: Wilson) is already vendored. Wald deposits one trail event per turn: head = kind + output type, route = the pull, ok = returned, ms = price. The trail then enters the parliament as the `trail` witness. Its weight is measured like every other witness's, so if the trail is noise its ratio comes out near 1 and it drops out on its own. A trail is never an override, so the layer adds and never degrades the base. stigmergy's alarm channel maps to a pull whose source was later contradicted.

Two of stigmergy's constants are hand-set, and Wald does not inherit them:
- **Exploration** (`EXPLORE_EPSILON = 0.1`): replaced by the CONTINUE region. Wald scouts exactly where his evidence is undecided, at the odds that evidence implies, σ(llr).
- **Half-life** (7 days): chosen prequentially from candidates taken from the ledger's own gaps between turns on the same head.

**Recursive learning: three loops, one inside the next.**
1. **Within a turn:** Wald's own sequential loop. Undecided → take the cheapest pull → its result, including a miss, is a new observation → decide again.
2. **Within a session:** trails are deposited and evaporate; prices and returns update per kind of pull.
3. **Across sessions:** ratios are re-measured, and α and β move to Wald's own rates.

Every loop scores a turn before it learns from it (Dawid's prequential principle). A re-fit is admitted only if it beats a shuffled null on the same turns (bar M1). Solon can replay the whole sequence from the ledger.

**The trap, named: he cannot learn from what he skipped.** A learner fed only on its own choices confirms itself, and gets cheaper and blinder. Two guards:
- **In shadow,** outcomes exist only for the gate's actions. Every score is reported on the turns where Wald and the gate agree, with the share where they disagree beside it (bar M4).
- **Once he gates,** the CONTINUE region is stochastic at σ(llr) and every propensity is logged, so the outcomes of other policies can be estimated without bias (inverse propensity, doubly robust). Turns outside that region are deterministic and declared unevaluable off-policy.

**Prerequisite:** a turn ledger that survives the tab. It records only the existing `record.wald` fields, plus whether a kept passage was cited and the person's next act. It keeps no ask text.

## Shadow results (2026-10-14, as pre-registered in `eval/wald/PREREG.md`)

Gold: 341 rows (`eval/cases.json` 73; G1 output asks 268). Ratios are leave-one-out; α and β are the current gate's own error rates (α = 0.0106, β = 0.0592, so log A = 4.49 and log B = −2.82). Raw output is in `eval/wald/results.json`.

| | gate now | Wald |
|---|---|---|
| cases.json: missed / wasted | 1 / 0 | **3** / 0 |
| G1: missed / wasted | 8 / 2 | 0 / 2 (the output witness leaks on G1, declared) |
| all: errors | 11 | 5 |
| shuffled-witness null, all (p05 / median) | | 149 / 167 |

- **B1 FAILS:** 3 missed against 1 on cases.json. All three are Japanese asks (`e_eiffel_ja`, `e_wall_ja`, `e_cap_ja`). No witness reads Japanese: there is no closed class for `lookup` and no `?` for `kind`, so the only vote is the plan's, which carries no information (ratio 1.0). On zero evidence §3.8's sign rule skips, where today's gate searches by default. This is a missing witness, not a bad bar: a language witness (`detectLang`) belongs in the parliament. Fixing it needs an amendment written before any re-run.
- **B2 holds** (wasted pulls are not worse anywhere). **B3 holds** (5 errors against a null whose 5th percentile is 149). **B4 holds in Node** (max 0.62 ms) but is borderline live: the first browser turn took 2.7 ms to decide and the second 0.3 ms. The 1 ms stand-in is replaced by measured prices once they exist.
- 109 of 341 rows fall in the CONTINUE region. The current gate's α is small (1%), so the bars are wide and most decisions are made by the §3.8 truncation. The cheapest-further-pull loop is where a better decision would come from.
- **Live (port 8824, 2026-10-14):** a factual turn recorded continue → truncated pull, matching the gate (3,498 ms, 3 passages kept). A poem turn recorded web *possible* (plan and lookup for, output against) and REFUSED at −4.35, also matching the gate. Bar S holds: Wald never assigns `wantWeb`.

### Amendment 1: the language witness (re-run 2026-10-14)

`eval/wald/PREREG.md` Amendment 1 was committed (9c12f18) before any code change and before the re-run. It adds one witness, `lang`. When `detectLang` names a language and `functionWordsOf` has no closed class for it, `lang` votes `web: for`. Its ratio is measured leave-one-out on the same gold: for = 2.32. The bars are unchanged.

| | gate now | Wald, first run | Wald, Amendment 1 |
|---|---|---|---|
| cases.json: missed / wasted | 1 / 0 | 3 / 0 | **0** / 0 |
| G1: missed / wasted | 8 / 2 | 0 / 2 | 0 / 2 (unchanged; no G1 row fires the witness) |
| all: errors | 11 | 5 | 2 |
| CONTINUE rows | | 109 | 100 |
| shuffled-witness null, all (p05 / median) | | 149 / 167 | 146 / 168 |

- **B1 HOLDS** (0 against 1). **B2 holds**, with no new wasted pulls. **B3 holds** (2 against a p05 of 146). **B4 holds** in Node (max 0.42 ms). The only rows that changed are the three Japanese misses, which now agree with the gate. Nothing regressed on G1.
- **Declared weakness (chorus: Diaconis).** The witness fires on 12 cases.json rows: de ×3, pt ×2, ja ×3, hi ×3, and `e_wall_sw` (langid reads it as `id`). All 12 are labelled *search*. The gold has no non-English ask that should *not* search, so the witness's ratio has never met a counterexample, and this gold cannot falsify it. It encodes "a non-English cases.json ask wants search" exactly as far as the gold does. Before Wald gates, the gold needs non-English no-search rows. That is a gold change, so it needs its own pre-registration.
- **Scope (chorus: Greenberg).** "No closed class" is a property of the surface's reader coverage, not of the language. de and pt fire because `functionWordsOf` has no set for them, not because they are hard to read. When a closed class is added for a language, this witness goes quiet for it, and the ratio must be re-measured.
- **Bar S after the hook change was not re-checked live.** The preview slots were full. The one changed line in `fold-chat.js` adds `lang` and `closedClass` inside the shadow's own `try`, and it never assigns `wantWeb`.

### Amendment 2: the read-back paths, with multi-turn gold (re-run 2026-10-14)

`eval/wald/PREREG.md` Amendment 2 was committed (3c2c7d5) before any code change and before any run on the new gold. The live record of PREREG-METABOLISM Clarification 1 showed which path fired. The refused turn 1 was stored with empty content, so the planner went to **cold-gap**, and none of the four read-back helpers ran. The amendment did two things:
- It extended the `source` witness. When the watcher's PRE reads the ask as about the last turn (`want` is inspect or challenge, or source/recall) and no read-back fired, it votes `local: for, web: against`.
- It made `calibrate.mjs` compute the read-backs from the prior messages, as fold-chat.js does, instead of leaving them null.

The new gold is `eval/wald/multiturn-gold.json`: 99 rows over 11 real stored priors, 21 labelled search. Run A is the new signals with the Amendment 1 witnesses; Run B adds the extended witness.

| | gate now | Wald, Amendment 1 | Wald, Run A | Wald, Run B |
|---|---|---|---|---|
| cases.json: missed / wasted | 1 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| G1: missed / wasted | 8 / 2 | 0 / 2 | 0 / 2 | 0 / 2 |
| old gold (cases + G1): errors · CONTINUE | 11 | 2 · 100 | 2 · 66 | 2 · 66 |
| shuffled null, old gold (p05 / median) | | 146 / 168 | 146 / 168 | 147 / 168 |
| **new gold (multi-turn): missed / wasted** | **10 / 23** | (not run) | 1 / 23 | **1 / 17** |
| new gold: CONTINUE · null p05 / median | | | 45 · 29 / 48 | 35 · 29 / 48 |
| decision time, max (median) | | 0.42 ms | 3.24 ms (0.026) | 1.36 ms (0.024) |

- **B1 holds** (0 against 1). **B2 holds** ([0, 2] against [0, 2]). **B3 holds** (2 against a p05 of 147).
- **B4 FAILS in both runs.** The max decision time is 3.24 ms in Run A and 1.36 ms in Run B, against the 1 ms stand-in. The median is 0.024 ms. The max is one per-row wall-clock outlier among 440 rows. Amendment 1 measured it over 341 rows with lighter signals. That cause is a hypothesis and has not been measured. The bar is reported failed and was not re-run. Live, the read-back turn decided in 1.0 ms and the turn before it in 4.3 ms, consistent with the 3.5–4.7 ms first-turn figures already on record.
- **Old gold.** Its decisions are unchanged from Amendment 1: no row flips between pull and skip. Four G1 rows move from CONTINUE to PROBABLE, all taken by Wald in both runs. The cause is that the ratios and α/β are now measured with the new rows in the pool. On old gold, `srcRecall` and `primaryAsk` stay null on every row, as expected.
- **The Clarification 1 row (`P3_R_0`)** is *continue → skip* in Run A, where the re-measured plan ratio alone tips it, and **REFUSED** in Run B, where the evidence is past log B. **Live re-check on :8824 (Bar S):** a fresh "Who wrote Pride and Prejudice?" was refused (unwitnessed), then "where did you get that?" was asked. The votes were `kind web:for, plan none:for, plan web:against, source local:for, source web:against`, llr −5.05 ≤ log B −2.11, so REFUSED. Wald agreed with the gate, and the web was not taken.
- **Declared: the gate's 10 misses on the new gold are an artefact of the arm.** All of them are N rows ("find a primary source") where `primaryAsk` fires. That makes `wantWeb` false, but the surface's primary finder then searches (`fold-chat.js` ~3339). The gate-now arm is the `wantWeb` conjunction as pre-registered, so these count as misses, though the live surface does pull.
- **Wald's one miss** is `P3_N_0`: "find a primary source" after a refused turn. The planner reads it as cold-gap, so no `primaryAsk` exists, and the live surface does not search either.
- **Wald's 17 wasted pulls** are rows that no witness reads, and the gate wastes the same rows:
  - 11 M rows ("what did you tell me earlier?"). Every real claim store is empty, so `recallOf` cannot fire.
  - 6 I rows on the pre-watcher priors (P6–P11). No detail is stored, so `want` is not `inspect`.
  Both are reader gaps, not witness tuning, and they are open.
- **Mutation checks.** `wald.test.mjs` adds 6 tests: the cold-gap shape, one vote per read-back with its path named, the real Clarification 1 prior, the real g2 prior, the hook's wiring, and a `sourceRecall` on the real bbc.com line. 7 mutants were each killed: (b) removed, inspect dropped, the sub check dropped, the hook unwired, a double count, the gold's `srcRecall` back to null, and the path name swapped.

## Calibration and scoring (no hand-set thresholds)

- **Gold, already labelled:** the 73 cases in `eval/cases.json` (`expect.search`) and G1's 371 phrasings (`needsSources`, 268 output asks and 103 non-asks, in five languages).
- **Null:** for each pull, the witness-agreement distribution on gold turns where that pull's label is false. The high bar is that null's tail, re-measured whenever a witness changes and never edited by hand.
- **Prequential score on live turns:** after each turn, check whether the pull earned its cost. A web pull earned it if a fetched passage was cited, or if the void it fired was real. A skipped web pull failed if the void later shows that a claim had no ground. Scores accumulate on the ground ledger (`ground-ledger.js`), with no tuning between runs.
- **Pre-registered bars to beat** (written before the build, in `eval/wald/PREREG.md`):
  1. Creative asks searched: 82.1% now, target 0 with no loss in grounded asks.
  2. `expect.search` agreement on `eval/cases.json` must not fall below the current classifier's.
  3. Live wire per turn below the current gate's (`wantWeb`, the conjunction in `fold-chat.js`). *Corrected 2026-10-14 (chorus, Ostrom):* the "always-search" baseline was the wrong scope.
  4. Zero increase in unsourced claims (✱) on checkable turns.

## Prior art

Each source below was checked against its primary page on 2026-10-13. "Verified" means the abstract or the page itself supports the use made of it here. "Partly" means the source supports a narrower claim, and that narrower claim is stated. The dossier (`docs/archons/dossier/wald.json`) is written from this table, never from memory.

**The decision rule**

- **Wald (1945), *Sequential Tests of Statistical Hypotheses*,** Ann. Math. Statist. 16(2):117–186. https://projecteuclid.org/euclid.aoms/1177731118. Verified. Wald takes its handle and its shape from this paper: two thresholds on the likelihood ratio, with "accept", "reject", and "draw one more observation" between them. **This is the only precedent here with a true middle region**, and that middle region is the cheapest further pull.
- **Chow (1970), "On optimum recognition error and reject tradeoff",** IEEE Trans. Inf. Theory 16(1):41–46. https://ieeexplore.ieee.org/document/1054406. Partly. The optimum rule is *one* threshold on the maximum posterior, and the abstention it describes is terminal. Wald takes from Chow only the idea that abstaining (the typed gap, the cold gap) is a decision with its own cost. The "gather more" middle region is Wald's, not Chow's.
- **Howard (1966), "Information Value Theory",** IEEE Trans. Systems Science and Cybernetics. Partly; the volume and pages are still unverified. Howard argues that information has a value only once probabilities are combined with consequences. Wald turns this into the cost-ordered pull sequence; the "pull only if value exceeds cost" rule is this proposal's own application, not Howard's stated rule.
- **Russell & Wefald (1991), "Principles of Metareasoning",** Artificial Intelligence 49(1–3):361–395. https://dblp1.uni-trier.de/pid/91/5566.html. Verified. A computation's utility is its effect on the actions that follow it. Wald does not assume a model call or a pull; it chooses one. (*Do the Right Thing*, MIT Press 1991, is a separate work.)
- **Simon (1955), "A Behavioral Model of Rational Choice",** QJE 69(1):99–118, https://doi.org/10.2307/1884852, **and Simon (1956), "Rational Choice and the Structure of the Environment",** Psych. Rev. 63(2):129–138. Partly. The 1955 paper introduces the aspiration level; the stopping rule and the word "satisficing" are in the 1956 paper, which is still to be verified.
- **Gigerenzer & Goldstein (1996), "Reasoning the fast and frugal way",** Psych. Rev. 103(4):650–669. https://www.dangoldstein.com/papers/FastFrugalPsychReview.pdf. Verified. Take-the-Best examines cues in order of validity and stops at the first one that discriminates. Wald orders its pulls by cost the same way and stops at the first that clears the bar.

**Where to look**

- **Pirolli & Card (1999), "Information Foraging",** Psych. Rev. 106(4):643–675. https://doi.org/10.1037/0033-295X.106.4.643. Partly. Information scent is a cue-based estimate of value; the choice rule itself sits in the patch and diet models. Wald's witnesses play the part of the scent, and the bar plays the part of the patch decision.
- **Broder (2002), "A taxonomy of web search",** SIGIR Forum 36(2):3–10. https://dl.acm.org/doi/10.1145/792550.792552. Verified for intent only: queries are navigational, informational or transactional. Broder says nothing about *whether* to search, which is exactly the gap Wald fills.
- **Callan, Lu & Croft (1995), "Searching distributed collections with inference networks",** SIGIR '95, pp. 21–28. https://ir.webis.de/anthology/1995.sigirconf_conference-95.4. Verified. This is resource selection in federated search: rank the collections, choose some, and merge the results. It is the lineage of `routeSources`.
- **Jacobs, Jordan, Nowlan & Hinton (1991), "Adaptive Mixtures of Local Experts",** Neural Computation 3(1):79–87. https://www.cs.utoronto.ca/~hinton/absps/jjnh91.html. Partly. A soft gate is trained jointly with its experts, with no cost term and no abstention. This is the weakest precedent and is cited for contrast.

**When retrieval helps a language model**

- **Mallen et al. (2023), "When Not to Trust Language Models",** ACL 2023, pp. 9802–9822. https://aclanthology.org/2023.acl-long.546/. Verified. The paper retrieves only when entity popularity is low, and it grounds the popularity witness. *Caveat:* its popularity cutoff appears to be tuned per dataset, which is a hand-set threshold (not yet verified). Wald takes the signal and replaces the cutoff with a null.
- **Wang, Li, Sun & Liu (2023), SKR,** Findings of EMNLP 2023. https://aclanthology.org/2023.findings-emnlp.691/. Partly. SKR decides from *similar questions seen before*, not from the model's own confidence. That makes it precedent for a recall witness ("has a turn like this been answered from memory before?"), not for a self-knowledge witness.
- **Kadavath et al. (2022), "Language Models (Mostly) Know What They Know".** https://arxiv.org/abs/2207.05221. Verified. A model's estimate that it knows the answer is informative, and the estimate rises when sources are supplied. This is the actual ground for the self-knowledge witness.
- **Jiang et al. (2023), FLARE,** EMNLP 2023, pp. 7969–7992. https://aclanthology.org/2023.emnlp-main.495/. Verified. It retrieves when the next sentence it predicts contains low-confidence tokens. This is the trigger for re-deciding mid-turn.
- **Asai et al. (2023/24), Self-RAG.** https://arxiv.org/abs/2310.11511. Verified; its ICLR 2024 venue is unverified. Reflection tokens decide when to retrieve. Wald keeps that decision outside the model.
- **Jeong et al. (2024), Adaptive-RAG,** NAACL 2024, pp. 7036–7050. https://aclanthology.org/2024.naacl-long.389/. Verified. A small classifier routes each query to no retrieval, single-step retrieval or iterative retrieval, trained on labels taken from outcomes. This is the closest single precedent.
- **Moskvoretskii et al. (2025), "Adaptive Retrieval Without Self-Knowledge?"** https://arxiv.org/abs/2501.12835. Verified; it is a preprint. Across 35 methods and 6 datasets, plain uncertainty estimates often match the elaborate pipelines at lower cost. This argues for cheap witnesses before expensive ones.

**Tools and model routing**

- **Karpas et al. (2022), MRKL.** https://arxiv.org/abs/2205.00445. Partly. The abstract describes neural modules alongside discrete knowledge and reasoning modules; the routing claim rests on the paper body, which has not been read yet.
- **Yao et al. (2023), ReAct** (ICLR 2023), https://arxiv.org/abs/2210.03629, **and Schick et al. (2023), Toolformer** (NeurIPS 2023), https://arxiv.org/abs/2302.04761. Verified. These are models that decide when to act or call a tool. In both, the model decides; in Wald, the witnesses decide.
- **Chen, Zaharia & Zou (2023), FrugalGPT,** https://arxiv.org/abs/2305.05176, **and Ong et al. (2024), RouteLLM,** https://arxiv.org/abs/2406.18665. Verified. These route queries from cheap models to strong ones, which is Huginn's territory. They are cited here to mark the boundary.

**Abstention and deferral**

- **Geifman & El-Yaniv (2017), "Selective Classification for Deep Neural Networks".** https://arxiv.org/abs/1705.08500. Verified. Set a target risk and derive the rejection threshold from data, with a guarantee. This is a threshold born from data rather than hand-set.
- **Madras, Pitassi & Zemel (2018), "Predict Responsibly: Learning to Defer".** https://arxiv.org/abs/1711.06664. Verified. It defers to a downstream decision-maker whose behaviour is modelled. This is the analogue of handing a turn to a costlier source.

**The bar itself**

- **Angelopoulos & Bates (2021), "A Gentle Introduction to Conformal Prediction".** https://arxiv.org/abs/2107.07511. Partly. It gives distribution-free coverage *under exchangeability*, but the target level α is still chosen. Wald does not choose α: it takes its level from the cost ratio of a missed pull to a wasted pull as measured on the ground ledger. The exchangeability assumption is tested by Solon's prequential check, never assumed.
- **Angelopoulos, Bates, Fisch, Lei & Schuster (2022), "Conformal Risk Control".** https://arxiv.org/abs/2208.02814. Verified; it is a preprint. It calibrates the threshold to control the expected value of any monotone loss. This is the method for the high bar: control the measured cost of a missed pull rather than a coverage rate.

## Prior art: metabolism (checked 2026-10-14)

Each item was checked against its primary page where one would load. Pages behind Springer, IEEE, JSTOR or T&F walls were checked through bibliographic search, and those rows are marked accordingly.

**Trails**
- **Grassé (1959), *Insectes Sociaux* 6:41–83 (pages not confirmed),** https://link.springer.com/article/10.1007/BF02223791. He coined *stigmergie*: coordination through the traces work leaves in the environment. Supported by secondary sources; the original was not read.
- **Hölldobler & Wilson (1990), *The Ants*, Belknap/Harvard.** Partly verified: the bibliography is confirmed, the trail-recruitment chapter is not. This is the namesake of khora's `kernel/stigmergy.js`.
- **Goss, Aron, Deneubourg & Pasteels (1989), "Self-organized shortcuts in the Argentine ant", *Naturwissenschaften* 76:579–581,** https://link.springer.com/article/10.1007/BF00462870. The double bridge: the shorter path wins by positive feedback, with no ant computing it. The title is unconfirmed. *Corrected:* an earlier draft credited Deneubourg et al. (1990), *J. Insect Behavior* 3:159–168 (https://doi.org/10.1007/BF01417909), which is about exploring unmarked ground, not the double bridge.
- **Dorigo, Maniezzo & Colorni (1996), Ant System, IEEE Trans. SMC-B 26(1):29–41,** https://doi.org/10.1109/3477.484436. Positive feedback over a distributed search. The deposit-by-quality and evaporation rules are the method's well-known update, but were not read on the page.
- **Di Caro & Dorigo (1998), AntNet, *JAIR* 9:317–365,** https://jair.org/index.php/jair/article/view/10217. Learned trail strength feeding a routing decision, which is the closest precedent for a `trail` witness that informs which pull to take. Confirmed through search.

**Exploration, and learning from what you did not do**
- **Thompson (1933), *Biometrika* 25:285–294,** https://doi.org/10.1093/biomet/25.3-4.285. Act with the probability that the option is best. Wald's stochastic CONTINUE region at σ(llr) is this idea applied to one pull.
- **Auer, Cesa-Bianchi & Fischer (2002), UCB1, *Machine Learning* 47:235–256,** https://doi.org/10.1023/A:1013689704352. Exploration with bounded regret, cited for the trade-off. Wald's scout is the undecided region, not an optimism bonus.
- **Horvitz & Thompson (1952), *JASA* 47:663–685,** https://doi.org/10.1080/01621459.1952.10483446. Weight each observation by the inverse of its inclusion probability. This is why every propensity is logged.
- **Li, Chu, Langford & Schapire (2010), contextual bandits for news, WWW 2010,** https://arxiv.org/abs/1003.0146, **and Li, Chu, Langford & Wang (2011), unbiased offline evaluation, WSDM 2011,** https://arxiv.org/abs/1003.5956. Replay evaluation from logs, unbiased only under randomized logging. This is why shadow-mode scores count only the turns where Wald and the gate agree.
- **Dudík, Langford & Li (2011), Doubly Robust Policy Evaluation and Learning, ICML,** https://arxiv.org/abs/1103.4601. The estimate stays sound if *either* the outcome model or the propensity model is right.
- **Lakkaraju, Kleinberg, Leskovec, Ludwig & Mullainathan (2017), The Selective Labels Problem, KDD,** https://www.cs.cornell.edu/home/kleinber/kdd17-selective.pdf. Outcomes are observed only for the action that was chosen. This is the trap named above. Their remedy, *contraction*, uses variation between decision-makers. In shadow, the gate and Wald are two decision-makers, which is the variation this design reports (bar M4).
- **Mozannar & Sontag (2020), learning to defer, ICML,** https://arxiv.org/abs/2006.01862. A classifier and a rejector learned jointly: spend or abstain, as one decision.
- **Sutton & Barto (2018), *Reinforcement Learning*, 2nd ed., MIT Press.** Partly verified. The general frame for exploration against exploitation and for credit assignment.

**Scoring and the bar**
- **Dawid (1984), the prequential approach, *JRSS A* 147(2):278–292,** https://www.jstor.org/stable/2981683. Score each forecast before its outcome is used to learn from. Every loop of recursive learning obeys this.
- **Wald & Wolfowitz (1948), Optimum character of the SPRT, *Ann. Math. Statist.* 19(3):326–339,** https://doi.org/10.1214/aoms/1177730197. This is the proof Wald conjectured in 1947. *Caveat:* optimality holds for two simple hypotheses with one observation at a time. It is cited for that case, and is not used to justify the SPRT as a budget rule in general.

## What is deliberately not taken

- Learned end-to-end routers (Self-RAG, Toolformer, RouteLLM) put the decision inside a model. The house rule keeps the decision mechanical and the model as the mouth only. These systems are prior art for *what* to decide, not for *where* the decision lives.
- No single confidence number. Every source above that collapses the decision to one threshold is cited for its signal, not for its gate.

## Build order (each step falsified before the next, after ratification)

1. **Done (khora archon/wald).** `wald.js` in khora `native/organs/`. It is pure: no fetch, no DOM. It holds the register, the witnesses (injected and tested against the real organs), the two bars, and the cheapest-first sequential loop. A `// Handle:` header goes on top, plus a register entry in `solon.js`.
2. **Done; Amendment 1 added the `lang` witness; Amendment 2 made the read-back paths vote (B1–B3 hold, B4 fails on a timing outlier).** The calibration script on the gold sets, and the null per pull. Pre-registration is written first.
3. **Done (shadow, the-fold archon/wald).** Shadow mode in the-fold: Wald decides and records on every turn while the surface's own gate (`wantWeb`) still decides. Compare Wald's decision with what the turn actually needed.
4. Wire Wald as the gate only after shadow mode beats the pre-registered bars, and say so on the record.
5. A dossier with verified sources, and a chorus check. (The first chorus ran 2026-10-14; the dossier is still open.)

Phase 2 (metabolism, pre-registered in `eval/wald/PREREG-METABOLISM.md`):

6. **Done (live-verified 2026-10-14 on :8824; `fold-chat-wald-ledger.js`, localStorage `fold-chat:wald-ledger`).** The turn ledger: `record.wald` fields plus `cited` and the person's next act, kept across tabs, with no ask text.
7. Measured prices and earn-back per kind of pull, computed prequentially from the ledger. The 1 ms stand-in retires at the first measured price.
8. The `trail` witness over `kernel/stigmergy.js`, admitted only if it beats trail-null (M1). Its half-life is chosen prequentially from the ledger's own gaps.
9. `recal`: α and β move from the gate's rates to Wald's own (M2).
10. Only after step 4: a stochastic CONTINUE region at σ(llr), with propensities logged for off-policy evaluation.
