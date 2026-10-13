# Would a small model do better than the hand-built binder rules? — pre-registered 2026-10-13, before any run

## The claim under test (the user, 2026-10-13)

> "this is all hyper specific linguistic stuff, no? wouldn't we do better by putting a small model in a lot of these places? falsify"

Read as a falsifiable claim: **at the decisions where the binder uses hand-built linguistic rules, a small local model decides
better than those rules.** I am the author of the rules (the descriptor/tail name rule, the modifier-anchor rule, the filler
licence, the copular-by agent). That is a conflict of interest, so the test is built so that I cannot tune either arm to it.

## The decision tested

**Answer extraction at the binder:** given a question and ONE sentence, name the words of the sentence that answer it, or say there
is none. This is the decision every defect of 2026-10-13 sat in: a description taken for a name ("Confederate veteran"), a sentence
about a part taken for the whole ("the Nashville chapter of the Klan"), a copular "is a novel by" not read, a kind word taken for a
name ("city"). It is **not** retrieval (which sentences are fetched) and **not** discourse (who "he" is) — the second is run
separately, below, and is not part of this verdict.

## Instruments

- **Questions:** the 33 slot and holder asks of `eval/gate/chat-heldout.json` (h-slot 27, h-holder 6). Their gold regexes were
  written 2026-10-13 before any gate run and are the only labelling authority. (Compute, compound, follow-up and false-premise
  scripts are not extraction decisions and are left out.)
- **Pairs:** for each ask, the plain text of the top three Wikipedia search results; the sentences that name the ask's referent
  (the app's own `askFrame` reading) AND carry its relation word or the gold. Each pair is labelled **ANSWER** if the gold regex
  matches the sentence, else **NOT-ANSWER** (these are the hard negatives: they name the referent and are not its answer).
  Per ask at most 4 ANSWER and 6 NOT-ANSWER, taken by a fixed hash of the sentence, never by hand.
- **Labelling is by the gold regex alone** — never by the binder, never by a model, never by me reading the sentence.

## Arms (all run on the same pairs)

| arm | what it is |
|---|---|
| **R** | the production binder: `runAnswerTurn` over that one sentence, the real Wikipedia title door, current `HEAD` of `panel-fixes` |
| **M** | `gemma2:2b` (Ollama), temperature 0, fixed seed, one frozen prompt (below), asked for the answer words or NONE |
| **M+V** | M, accepted only if its answer is a verbatim span of the sentence AND the real title door resolves it to a page — the verification the Fold already applies to any filler |
| **L** | lexical baseline: the first capitalised run in the sentence that is not in the question |
| **N** | null: never answers |

The model prompt is written **once**, its md5 recorded in `RESULTS.md`, and **never edited after seeing a result**. It is the
obvious generic prompt, not one tuned to a failure.

## Metrics

On ANSWER pairs: **correct** (the arm committed an answer and the gold regex matches it), **wrong** (committed, no match),
**silent** (did not commit). On NOT-ANSWER pairs: **false commit** (the arm committed any answer).

## What falsifies the claim (decided now, applied mechanically)

The claim "a small model does better than the rules" is **supported** only if, for M or for M+V against R:

1. **correct** is higher on ANSWER pairs — exact paired McNemar, one-sided p < 0.05; AND
2. **false commit** on NOT-ANSWER pairs is NOT higher — one-sided Fisher exact p ≥ 0.05 for "more"; AND
3. **wrong** on ANSWER pairs is not higher by the same test.

If (1) fails the claim is **falsified** (no better). If (1) holds and (2) or (3) fails the claim is **falsified as stated**: it
does better only by being wrong more often, and a chat that answers is only better if its answers are right. A mixed result is
reported as mixed, with the counts, and is not rounded toward either side.

## Known biases, stated before the run

- **In R's favour:** R's rules were tuned on failures from these same gate asks, though against *different sentences* (the live
  retrieval of that day). Some pair shapes will be ones R was built to read.
- **In M's favour:** the title door in M+V is the same one that already vets R's fillers; M's raw arm gets no such help.
- **Against both:** one sentence in isolation removes the page context (title, neighbours) that R normally also gets, so R is run
  with the page title as it would be in the app.
- gemma2:2b is the app's own small model; a larger model might do better and is not tested (the standing rule is to keep the
  local model small).
- Gold regexes can miss a valid paraphrase: an arm that answers correctly in other words is scored wrong. This hurts M more.

## Amendment A2 — 2026-10-13, after Experiment 1's primary arms were run and BEFORE any second-labeler label existed

Primary result of Experiment 1 is recorded in `RESULTS.md` first. Reading the cases showed that the gold-regex label over-credits sentences
that only MENTION the answer ("Van Gogh sent The Starry Night to Theo in Paris" matches `Gogh`), which rewards a model that answers from
a salient name or from knowledge, and the Fold's rule is that an answer must be STATED by the source. The regex labels were written by
the gate's author; the ground rules require labels by someone other than the builder. So:

- **A second labeler** (an independent agent that sees ONLY the question and the sentence — no gold regex, no label, no arm output, no page)
  labels every pair `STATES` (the sentence by itself asserts the answer to the question) or `NOT`, with the answer words it found.
  Blind file md5 `7c93cb6d6b1eedbae6d3697184644a2f`. It is told not to use world knowledge, and to say `NOT` when unsure.
- **Re-score on those labels, with the same rule:** on `STATES` items an arm is *correct* if its answer overlaps the labeler's answer words;
  on `NOT` items any commit is a *false commit*. The same McNemar/Fisher tests, M and M+V against R.
- **What this amendment may change:** the *interpretation* (it is a stricter, independently-labelled instrument). The primary verdict
  stands as pre-registered and stays in `RESULTS.md`; both are reported side by side, and the agreement between the two labelings is reported.
- A third rule, declared now: if the second labeler's `STATES` set is smaller than 20 items, no test of it is run (too few to say anything).

## Experiment 2 — discourse (who is "he"?) — added 2026-10-13, BEFORE any result of Experiment 1 existed

Same claim, second decision: **given a conversation so far and a follow-up, does the follow-up lean on something earlier, and on what?**

- **Items:** the G3 corpora (`eval/ants/g3/corpus.mjs` 113 sequences, `corpus2.mjs` 56). *follow* items carry the right referent (`ref`);
  *switch* items are standalone asks that must inherit nothing. Gold is the corpora's own `cls`/`ref`, fixed by the G3 ants on 2026-10-07.
- **Arms:** **R** the production `planTurn` with a real referent record (the exact call `eval/ants/g3/measure.mjs` makes, at `HEAD`);
  **M** gemma2:2b, temperature 0, seed 7, one frozen prompt (md5 recorded) shown the prior turns and the follow-up and asked for the
  exact name it refers back to, or NONE; **M+V** M accepted only if its answer is a verbatim span of the conversation shown; **N** null.
- **Metrics:** follow items — **correct** (committed, contains `ref`), **wrong** (committed, no `ref`), **silent**; switch items —
  **leak** (committed any referent). `ref` missing (elliptical asks with no named referent) are scored only for leak/silent.
- **Falsification:** identical to Experiment 1: the claim is supported only if M or M+V is better on *correct* (exact McNemar one-sided
  p < 0.05) AND not more on *leak* and not more on *wrong* (one-sided Fisher p ≥ 0.05 for "more").
- **Biases, stated now:** R was developed against these corpora (G3 tuned the gate on them; today's channel work was checked on them):
  strongly in R's favour. The corpora are en/es/fr; gemma2:2b may do better or worse across them, and the result is reported per language.
  The corpora's `ref` is a substring label; a correct paraphrase scores wrong (hurts M).
- **What this does NOT cover:** the *ask on a tie with clickable options* — R has it, M has no analogue here — so a result in M's favour
  is an upper bound on its worth, never a verdict that the clarification path is unneeded.

## Amendment A1 — 2026-10-13, AFTER the primary arms of Experiment 2 were run (the failed run stays on the record)

Primary result recorded in `RESULTS.md` first: R 54/59 correct, 0 wrong; M 5/59 correct, 9 wrong, 45 silent; verdict on M and M+V:
FALSIFIED. A model that answers NONE nearly always may be failing the *formulation* (free-text recall of a name), not the *idea*.
So one further arm is added, **declared exploratory, and not part of the verdict above**:

- **H (hybrid):** the candidate names are extracted **mechanically** by the same referent record R reads (`admitReferents`, the entities
  of the prior turns); gemma2:2b, temperature 0, seed 7, one frozen prompt (md5 recorded) is shown the conversation, the new message
  and the numbered candidate list, and must reply with ONE candidate or NONE. Scored exactly as M.
- Its result is reported next to R and judged by the same rule, but it is **one arm added after seeing a result**, so a "SUPPORTED"
  would be recorded as *exploratory support*, to be re-run on fresh items before anyone relies on it.

## Amendment A3 — 2026-10-13, declared after A2's labels were scored: an EXPLORATORY pooled-agreement analysis

`pooled.mjs` asks whether the Fold's existing cross-source agreement rule repairs the model's over-commitment, on the same sampled pairs, at
ask level. It is post-hoc, uses the loose gold regex at ask level, and is **not** part of any verdict. Its result is reported as inconclusive
if it commits on too few asks to say anything (it did).

## Experiment 3 — a treebank-derived irregular-form table for the binder — pre-registered 2026-10-13, BEFORE it was built

**Why:** Experiments 1–2 located the rules' weakness in *reading* (morphology and syntax), not in *licensing*. The binder's light stemmer
cannot make "wrote/written" meet "write" or "sank" meet "sink" (its own header calls that "a limit, not a bug"). The alternative to a
model is **received data**: a form→lemma table mined from a UD treebank, hand-written nowhere.

**The change (frozen here):** `scripts/build-lemma-table.mjs` mines `en_pud-ud-test.conllu` (English PUD, on disk, 21,180 tokens, CC BY-SA 4.0)
into `fold-chat-lemmas-en.js`; `stemOf` consults it first. A form enters only if (a) its lemma is not already unified by the light stemmer,
(b) every attestation gives the SAME lemma (unanimous, no threshold), (c) it is a verb/auxiliary there, and (d) the English POS pack
(UD EWT) has never seen it as a noun, proper noun or adjective — so "saw" (a tool) never becomes "see". Nothing else changes.

**Instruments (all fixed by Experiments 1–2):** the 162 pairs; the independent second labeler's STATES (20) / NOT (142) labels; the G3 corpora;
the whole test suite.

**What is predicted, now:** a small gain, **0 to 2** more correct on the 20 STATES sentences, because PUD's 21k tokens do not contain "sank"
and "is a novel by" is syntax, not morphology; and **no harm**.

**What would falsify "this change is safe and helps":** 
1. *harm* — any increase in false commits on the 142 NOT sentences (one-sided Fisher p < 0.05 for "more") or in wrong answers on the STATES
   sentences, OR any change in the G3 corpora's carried-right / wrong / leak counts, OR any new failing test by name; → **rejected, reverted**.
2. *no help* — fewer than 1 additional correct on STATES → **kept only if it harms nothing AND a binder-level test shows a plain
   statement the old stemmer could not read now binds** (otherwise reverted as dead weight).
A larger source (UniMorph English, an 18 MB download that needs the user's explicit yes) is the obvious next step and is NOT used here.

## Experiment 4 — the same table, mined from UniMorph English — pre-registered 2026-10-13, BEFORE the file was downloaded

**Authorised by the user ("make it so", 2026-10-13) as proposed:** `eng` from `github.com/unimorph/eng`, 18,022,905 bytes, English only.
The raw file is kept OUT of the repository (its own directory, scratchpad) and its sha256 is recorded in the generated module.

**The change (rules unchanged from Experiment 3, now over a complete paradigm source):** `scripts/build-lemma-table.mjs` additionally reads
UniMorph rows `lemma<TAB>form<TAB>features`. A UniMorph form enters only if (a) the light stemmer does not unify it with its lemma, (b) **every**
UniMorph analysis of the form — verb, noun, adjective, any — gives the SAME lemma and is a verb analysis (`V…`), so "saw" (N;SG saw / V;PST see)
and "leaves" are out by construction, (c) the English POS pack has never seen it as NOUN/PROPN/ADJ. The PUD entries are kept; a form two sources
disagree on is dropped (unanimity across sources). Nothing is hand-edited.

**Predictions, written now:**
1. **Help:** the three Titanic STATES sentences ("RMS Titanic *sank* …") move from silent to correct for "When did the Titanic sink?": **+3** on
   the 20 STATES sentences (R: 5 → 8), with no other STATES change expected.
2. **No harm:** false commits on the 142 NOT sentences not more (Fisher one-sided p ≥ 0.05); wrong answers on STATES not more; G3 corpora
   unchanged (44/45, 18/22, 0 wrong, 0 leaks); no new failing test by name.
3. **Size:** the table stays a small module (declared bound: under 400 KB); if it grows past that, only the unanimous irregulars are kept
   (forms whose stem differs from the lemma's by more than a suffix), and the change is reported.

**Falsified if** the paired run shows < +2 on STATES (the benefit claim fails; the table is then kept only if it harms nothing, as in
Experiment 3), OR any harm criterion above fails (→ reverted).

## Not tested here, and why

Discourse (who "he" is) is Experiment 2 above and has its own verdict. Nothing in Experiment 1 is evidence about it.
