# Learned answer patterns with Wikidata as the referee — results (2026-10-13/14)

Pre-registration: [PREREG.md](PREREG.md), committed `4fd49ee` before any harvest or run. The learner, the harvest manifest and the learned table were
committed as `4c1769d` before the evaluation ran. The evaluation ran **once**; nothing below was tuned after seeing it.

## Verdict

| | strict labels (second labeler) | regex labels (gate gold) | verdict |
|---|---|---|---|
| **H1** — learned patterns **instead of** the binder (P vs R) | gained 0, lost 2, McNemar p = 1.0 | gained 0, lost 2, p = 1.0 | **FALSIFIED (not better)** |
| **H2** — learned patterns **added to** the binder (R∪P vs R) | gained 0, lost 0, p = 1.0 | gained 0, lost 0, p = 1.0 | **FALSIFIED (not better)** |

**H2 is not SUPPORTED, so no production code was changed.** The binder, `fold-chat-witness.js` and `fold-chat-answerturn.js` are untouched,
and there is no additive witness and so no suite diff.

## Paired numbers (100 in-scope pairs of the 162; one process, one title-door cache, 0 door failures)

| arm | strict: STATES (11) correct / wrong / silent | strict: NOT (89) false commit | regex: ANSWER (49) correct / wrong / silent | regex: NOT-ANSWER (51) false commit |
|---|---|---|---|---|
| **R** production binder (`HEAD` 72ce5dd + this eval dir) | 2 / 0 / 9 | 2 | 2 / 1 / 46 | 1 |
| **P** learned patterns alone | 0 / 0 / 11 | **2** | 0 / 0 / 49 | **2** |
| **R∪P** (R, else P) | 2 / 0 / 9 | 4 | 2 / 1 / 46 | 3 |
| PM mutation table (instrument) | 0 / 0 / 11 | 0 | 0 / 0 / 49 | 0 |

Tests as pre-registered:
- **H1, strict:** false commits 2 vs 2, p(more) = 0.69; wrong 0 vs 0.
- **H1, regex:** false commits 2 vs 1, p(more) = 0.50; wrong 0 vs 1.
- **H2, strict:** false commits 4 vs 2, p(more) = 0.34.
- **H2, regex:** false commits 3 vs 1, p(more) = 0.31; wrong 1 vs 1.

Condition (1) (more correct) fails everywhere, so both hypotheses are falsified as "not better". The learned layer also adds only wrong commits. The
numbers are too small for the Fisher tests to call that "more", but its every commit was wrong.

**What P committed — twice, both wrong, both namesakes:**
- *"Where was Mozart born?"*: **Vienna**, from "Franz Xaver Wolfgang Mozart was born in Vienna…". That is the son.
- *"Where was Mozart born?"*: **Augsburg**, from "Mozart was born in Augsburg on 14 November 1719…". That is Leopold, the father.

Both came through the one admitted P19 pattern, `R|c2|born in`. These are exactly the errors that modelvsrules Experiment 1 found the hand-built rules
refuse and the model makes. A surface path learned from text cannot tell an anchor's namesake from the anchor. The binder's licensing can.

Why P was silent on the other 98 in-scope pairs: no admitted pattern fired on 81, and the anchor was not mentioned on 17.

## Scope as read mechanically (PREREG: cue stems from Wikidata's own labels and aliases)

16 of the 28 asks with pairs mapped to an in-scope property:

| ask | properties | how it mapped |
|---|---|---|
| wrote *Pride and Prejudice* | P50, P86 | "written by" is an alias of both |
| painted | P170 | |
| developed relativity | P61 | |
| first president of the US | P61, P35, P6 | "first" is in P61's "first described" and P6's "first minister" |
| composed | P86 | |
| first land on the Moon | P61, P6 | via "first"; a time ask brought into scope by its cue word, as PREREG allows |
| Mozart born | P19 | |
| capital of Kenya / Egypt | P36 | Egypt by the declared anchor repair |
| invented | P61 | |
| language in Brazil | P37 | |
| currency in Japan | P38 | |
| chancellor of Germany | P6 | |
| president of Brazil / Mexico | P35, P6 | |
| king of Spain | P35 | |

## The learner (training side only; never graded on the eval)

- **Harvest** (`harvest-manifest.json`; raw file kept outside the repo, sha256 `206ba683d5c95677abbb7c02a927e2f9028409b4f9917d1bb4a9510f0543516b`):
  - Kept per property: P50 158, P170 493, P86 497, P61 490, P19 489, P36 496, P37 482, P38 446, P35 492, P6 495, P169 488.
  - 0 request failures. 57 throttles were absorbed by Retry-After: 51 in the first pass and 6 in the widened P50 pass. The manifest records only the
    final, mostly cached, pass.
  - 70 eval titles were excluded before learning.
- **Learning** used the 80% split by Q-id hash:
  - 95,323 (anchor, candidate) instances and 292,137 candidate patterns.
  - The max-T bar from 199 shuffled-label replicates was 9; replicate maxima had median 3.
- **Admitted: 22 patterns, for 4 of the 11 properties.**
  - P36 has 11, e.g. `capital … is` (44 confirmed / 11 refuted), `capital and largest city is` (21/0), and the loose `R|c1|is` (83/60).
  - P37 has 7. Most are `L|…|pronunciation`, an artefact of how leads gloss a language's own name.
  - P61 has 3, e.g. `by C de`.
  - P19 has 1: `born in`.
  - **None** for P50, P170, P86, P38, P35, P6 or P169.
- **Instrument check 1 (mutation):** the same learner with a shuffled referee admitted **0** patterns and committed 0 times on the eval. The admission
  rule does not admit noise.
- **Instrument check 2 (training-side held-out, 20% of entities graded by Wikidata):** 44 commits: 25 confirmed, 18 refuted, 1 skipped. The
  learned patterns carry some signal across entities, at a precision (~0.57) no one would commit on.
- **Instrument check 3 (R reproduces):** R on all 162 pairs (strict labels) gave 8 / 0 / 12 on STATES and 4 false commits on NOT. Experiment 4
  recorded 7 / 0 / 13 and 4. The one extra correct answer is *"Claudia Sheinbaum Pardo"*. That run had 14 title-door failures and this one had 0, which is
  the door trap Experiment 3 documented, not a code change.

## Why so little was admitted — POST-HOC, training data only, decides nothing (`diagnose.mjs`, `diagnose.json`)

1. **The max-T bar was set by one noisy relation.**
   - P36's own null maximum is 9; most other properties' own null maxima are 1–5.
   - A per-property family would have admitted more, but it would not have changed this eval. That is point 2.
2. **The paths the eval needed are starved in article leads.** Here are the training scores of the keys each in-scope STATES sentence needed:
   - *"…is a novel by English author **Jane Austen**"*: `by C author` occurs **2** times (2/0) in 128 P50 leads.
   - *"**Beethoven** wrote the Moonlight Sonata"*: `L|c1|wrote` is 0/2 for P86.
   - *"**Einstein** developed general relativity"*: `L|c1|developed` is 0/2 for P61.
   - *"**Portuguese** is the official … language of Brazil"*: `is the official` is 4/0 for P37.
   - *"**Felipe**, King of Spain"*: `, C of` is 2/1 for P35.
   - *"Dr. **Bell**, the veteran inventor of the telephone"*: the candidate reader took "Dr" (the full stop splits the run). That is a candidate-reading gap.

   Leads state a fact once, mostly with the subject as a pronoun or as the sentence's own topic. The surface paths that answer a question are each attested a
   handful of times, below any null's coincidence level. **The referee works; the text does not present the needed shapes often enough to be refereed.**
3. **What did get admitted is the wrong kind of generality.**
   - `born in` admits the namesake.
   - `R|c1|is` and `L|c1|pronunciation` are positional habits of lead sentences, not relations.

## What this establishes and what it does not

- **Establishes:** under the pre-registered design, surface token paths learned from 500 article leads per relation, refereed by Wikidata and admitted by a
  max-T null, do not answer the held-out relation questions better than the hand-written binder. Added to it, they contribute only false commits (2 of 2 namesakes).
- **Does not establish:**
  - that learning cannot work;
  - that Wikidata cannot referee text.

  The mutation check and the training-side held-out show both the referee and the null doing their jobs. The binding limit is the **text** (leads,
  named-anchor sentences, ~500 entities). The **representation** is part of it too: a surface path has no notion of *which* Mozart. The path also skips
  the morphology and syntax a reader would normalise ("wrote", "developed" and "is a novel by" are different paths).
- **Power, as predicted in PREREG:** there were 11 in-scope STATES sentences. Even a perfect learned layer could have gained at most the 9 that R missed.
- **Deviations from PREREG, all disclosed:**
  - **P50 kept 158, not 500.** Wikidata's search window (10,000 hits) is dominated by scholarly works without English articles; the declared procedure
    ran out.
  - **The WDQS outage rule (1 request/min)** moved the values lookup to one SPARQL query per property. These are the same truthy (`wdt:`) values the
    PREREG names.
  - **"Learning on the 80%"** was read as: one table, learned on 80%, both validated on the 20% and used for the eval. There is no second table on 100%.
- **No human labels exist.** Both labelings are model or author labels fixed before this experiment.

## The next falsifiable step (not run)

The ledger entry below names what would change the result. Train on text that states each relation many times with the anchor *named*: whole articles,
or sentences retrieved for (anchor, value) pairs, which is distant supervision proper. Represent the path after normalisation (the lemma table already in
production; a dependency path instead of a token path). Then pre-register again on the same pairs. Before spending a run, measure on the training side
whether the keys of the 11 STATES sentences reach the null's coincidence level.

## Files

- `PREREG.md`, `preflight-proposal.json`, `preflight-output.txt`: the pre-registration and the fold-rules preflight (WARN, answered there).
- `lib.mjs`, `lib.test.mjs`: the instrument and 7 tests, including the synthetic mutation check.
- `net.mjs`: one paced fetch, generic User-Agent, throttles counted.
- `harvest.mjs` → `harvest-manifest.json`.
- `learn.mjs` → `patterns.json`.
- `run.mjs` → `rows.jsonl`, `summary.json`.
- `diagnose.mjs` → `diagnose.json` (post-hoc).
