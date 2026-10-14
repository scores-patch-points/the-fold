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

**What the source does and does not claim about efficiency.** In 1947 the SPRT is shown to be near-optimal in the expected number of observations (Appendix A.7). Sequential tests "usually" save about 50% over a fixed-sample test of equal strength (§2.4.2). Exact optimality is the author's **conjecture** in a footnote to §2.4.1, not a result. The proof is Wald & Wolfowitz (1948), *Ann. Math. Statist.* 19(3), which has not yet been ingested because Project Euclid's bot wall refused the fetch.

**Pre-registered bar 5:** Wald's own decision cost per turn is below the measured cost of the cheapest pull.

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

## What is deliberately not taken

- Learned end-to-end routers (Self-RAG, Toolformer, RouteLLM) put the decision inside a model. The house rule keeps the decision mechanical and the model as the mouth only. These systems are prior art for *what* to decide, not for *where* the decision lives.
- No single confidence number. Every source above that collapses the decision to one threshold is cited for its signal, not for its gate.

## Build order (each step falsified before the next, after ratification)

1. `wald.js` in khora `native/organs/`. It is pure: no fetch, no DOM. It holds the register, the witnesses (injected and tested against the real organs), the two bars, and the cheapest-first sequential loop. A `// Handle:` header goes on top, plus a register entry in `solon.js`.
2. The calibration script on the gold sets, and the null per pull. Pre-registration is written first.
3. Shadow mode in the-fold: Wald decides and records on every turn while the surface still always searches. Compare Wald's decision with what the turn actually needed.
4. Wire Wald as the gate only after shadow mode beats the pre-registered bars, and say so on the record.
5. A dossier with verified sources, and a chorus check.
