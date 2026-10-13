# Model-free drive test — results, 2026-10-12

How far does the fold get on 96 scripted prompts when **no model is reachable**? Real page (headless Chromium) served from the working tree of `the-fold` (branch `codex/constitutive-spiral-20261010`, HEAD 620f0a4 at test time; other sessions were editing). `/v1/chat/completions` answered 503 and counted; the in-tab engine has no WebGPU. Web lanes were live (Wikipedia + the page's own search/read relay). Predictions are frozen in `prompts.json` and were written before any run; gold answers in `gold.json` were written after the pilot rows were seen, from world knowledge, not from outputs. Holder golds are as known at the test date and can go stale.

Files: `prompts.json` (96 scripts, 13 categories, predictions) · `gold.json` · `drive.mjs` (driver) · `analyze.mjs` (classifier) · `compare.mjs` (stability) · `results/run3.jsonl` (the run reported here) · `results/run1-calibration.jsonl`, `run2.jsonl` (earlier runs, kept; run 2's compound rows were caught mid-stream, which is why run 3 tightened the settle check).

## Headline (run 3, 96 scripts)

| measure | value |
|---|---|
| Correct answers **committed** without a model (answerable prompts: compute, slot, holder, compound, follow-up, multilingual = 48) | **9 / 48** (19%) |
| The right answer **visible on screen** among what the fold showed, no model | **29 / 48** (60%) |
| Confident **wrong** answers committed, any category | **0 / 96** |
| False-premise asks (6) that ended in a typed gap or contest rather than a confident answer | 6 / 6 |
| Turns that stop at "the model would phrase this" (R0), sources shown unchanged | 32 |
| Turns that want a model and show nothing (poems, drafts, jokes) | 6 |
| Turns that show a step graph and then **no answer** (no degraded path) | 6 |

"No model call made" is 96 / 96 and means nothing here, since none was reachable. The informative number is how often the turn *wanted* one.

## By category

| category | n | committed & correct | contest | typed gap / self / canned note | wanted a model (sources shown) | wanted a model (nothing) | graph, no answer | defect | gold visible |
|---|---|---|---|---|---|---|---|---|---|
| social | 8 | 0 | 0 | 0 / 4 / 3 | 1 | 0 | 0 | 0 | — |
| compute | 10 | 6 | 0 | 1 / 0 / 0 | 1 | 0 | 0 | 2 | 8/10 |
| slot | 12 | 2 | 6 | 2 / 0 / 0 | 2 | 0 | 0 | 0 | 8/12 |
| holder | 6 | 1 | 5 | 0 | 0 | 0 | 0 | 0 | 5/6 |
| compound | 8 | 0 | 0 | 0 | 4 | 0 | 4 | 0 | 1/8 |
| followup | 6 | 0 | 0 | 0 | 6 | 0 | 0 | 0 | 3/6 |
| explain | 10 | 0 | 1 | 3 / 0 / 0 | 6 | 0 | 0 | 0 | — |
| opinion | 6 | 0 | 0 | 2 | 4 | 0 | 0 | 0 | — |
| generate | 10 | 0 | 0 | 0 / 0 / 3 | 0 | 6 | 1 | 0 | — |
| url | 4 | 0 | 0 | 0 | 3 | 0 | 1 | 0 | 3/4 |
| multilingual | 6 | 0 | 0 | 1 | 5 | 0 | 0 | 0 | 4/6 |
| falsepremise | 6 | 0 | 1 | 5 | 0 | 0 | 0 | 0 | — |
| garbled | 4 | 0 | 0 | 3 | 0 | 0 | 0 | 1 (clarify list) | — |

Against the frozen floors, on the loose definition (a committed answer, contest, typed gap, self-description or canned note counts as "finished"): **met** — social 7/8, slot 10/12, holder 6/6, explain 4/10, falsepremise 6/6, garbled 4/4, generate (floor 0); **missed** — compute 7/10 (floor 80%), opinion 2/6 (50%), url 0/4 (50%), multilingual 1/6 (30%), compound 0/8 (40%), follow-up 0/6 (30%). On the strict definition (a correct committed answer) no category clears its floor; compute comes closest at 6/10.

## Findings, each with a specimen

1. **Computed value dropped on display (defect).** `What is 15% of 240?` and `What is 3/4 plus 1/8?`: the record holds `computed.value` ("36"), the process log says "computed · 15% of 240 = 36", and the page shows "No answer was written: no source could be read." The turn is routed to R1 after the evaluator already answered. Two of ten compute prompts.
2. **Slot asks end in a contest because "who/how many" are not type-checked.** Candidates that are not persons or quantities of the asked thing are admitted: *who wrote Hamlet* → "Polonius"; *who painted the Mona Lisa* → "sisters"; *who discovered penicillin* → "unstable"; *who is the king of the UK* (run 1) → "William" and a Paul King album; *UN Secretary-General* → "organization". Six of twelve slot asks.
3. **A superlative's neighbour is treated as a rival.** *largest planet* → contest between "Jupiter … is the largest" and "Saturn … is the second-largest"; *how many legs does a spider have* → "eight" vs "52,075" (species). The right answer is on screen in both.
4. **Compound asks have no degraded path.** Four of eight reach "Drawing the answer from the sources" and a step graph, then stop with empty stored content: the mouth was the writing step and there was none, and unlike the R0 turns no "shows what the sources say" fallback appears. The other four fall to the R0 fallback.
5. **Follow-ups all want the mouth.** 6 of 6 reach R0; the follow-up word ("where", "his") is correctly refused as a source chooser, but nothing binds it to the previous turn's referent without a model.
6. **Greetings are a canned note, not a greeting.** "Hello", "hi there", "Thanks!" return *Ask me something and I'll show you what the sources say.* The self-description lane works for "who are you / what can you do / how do you work / are you an AI" and misses "do you use a language model?", which went to a web search.
7. **Missing mechanical lanes the sources already contain.** *days between 1 January 2026 and 1 March 2026* ends in a typed gap although the shown sources say "59 Days"; the evaluator has no date arithmetic. *72°F in Celsius* went to chat (no temperature conversion) though 5 miles → km works.
8. **Generation is off by policy, and says so.** `ALONE_KINDS = []`: poems, haiku, email, joke, cover letter produce "No … was written: no model is available"; translate and rewrite produce the "fold does not write without sources" note. Zero model-free generation, as predicted.

## Stability

Run 1 vs run 3: 82 of 96 prompts landed in the same bucket (85%). Differences are mostly web variance and, between runs, other sessions editing the served tree: two slot/holder asks flipped between contest, gap and committed (`who is the king of the UK` was a contest of "William" and Paul King in run 1 and a correct commit in run 3); four false-premise asks went from "wanted a model" to typed gap. Single-run percentages above are therefore ±~15 points.

## Not established

- Live web only; no stubbed-world control was run in this pass, so the mechanical **ceiling** (what the fold does with perfect retrieval) is not measured here; the earlier fixture proof (3 of 3 compound, 0 model endpoints) is the only such control.
- Headless Chromium has no WebGPU; a real in-tab model would change every "wanted a model" row, and R0 turns were not run with one.
- Gold regexes are strict on compounds (all parts must appear) and lenient on slots (any shown text); "gold visible" counts the pager's stored cards, not only what was visible without clicking.
- Two summarize asks (`generate#5`, `url#3`) hit the 150 s settle cap in the graph-writing step and are counted as graph-no-answer, not measured to completion.
- Ethos/Paradigm effects, retrieval relevance and multilingual quality are not separately measured.


---

## Appended 2026-10-13 — the deterministic world, the referent restructure and the archon panel

Nothing above this line was edited.

**The deterministic world** (`world.mjs`): the real page, Wikipedia replaced by 47 fixture pages that keep the live confounders (Polonius,
Ophelia, "second-largest", "52,075 species", relation words that resolve as titles) and MediaWiki's own redirect shapes. It holds
retrieval perfect, so it measures the answering layer alone. Same 42 answerable prompts, same page, baseline 620f0a4 vs the fixes:

| | baseline | after 80a144b | after the referent restructure + panel (4019850) |
|---|---|---|---|
| committed & correct | 17 / 42 | 24 / 42 | 25 / 42 |
| committed & wrong | 1 | 0 | 0 |
| compute | 6 / 10 | 10 / 10 | 10 / 10 |
| compound (8) / follow-up (6) | 0 / 0 | 0 / 0 | 0 / 1 |

The world is too clean: the live held-out run on the same code scores 13 / 49 and commits 3 wrong answers the world never produces. The
world is a regression instrument for the answering layer, not a measure of the product (see GATE.md).

**What changed in the code** (branch `panel-fixes`, 4019850, on top of `modelless-fixes`): the ask's relation is not a referent (decided
by position, with the received POSPrior only breaking ties); anchors and attributes are separate; the passive agent is the person
filler, bounded to its verb's clause; the filler's name keeps its head; stance (hedge, condition, question) marks a row "?"; real calendar
dates only; -e verbs meet their inflections; the receipt keeps attributes and the counted noun.

**The archon panel** (83 compendium archons + Champollion + the nine revision-grid editors + Kelsen, eight panels, Gebser's arrival, 14
independent reproductions): 62 must-fix findings across panels, deduplicated by Gebser to 22; MF1–MF14 reproduced independently. Verdict
on the first read: the frame work stands as a foundation; the passive-agent path and the calendar were not to ship until MF1–MF10 closed.
All of MF1–MF10 and most of MF11–MF21 are pinned in `fold-chat-archon-panel.test.mjs` (17 falsifiers). **Disclosed, not fixed:** a title made
only of function words ("Up") is never a referent; irregular verbs (wrote/written) and found/founded need a lemma prior; surname-only
coreference ("Einstein" for "Albert Einstein") does not bind. **The archons' second read of the fixed code was still running** when
this was written; its result is not in this file.
