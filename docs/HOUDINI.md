# Houdini: the archon of the right shape at the right moment

Houdini projects the fold's context by NEED and by MOMENT instead of by position. The fold today sends the last 8 records and the last 4 raw messages whatever is asked. Houdini (`fold-chat-houdini.js`) reads the whole store and sends what bears on this ask, within the size the positional projection would have been.

This is the same archon as `docs/archons/dossier/houdini.json` (the skeptic who folds out sentences dressed as channelled content: `archon-rules.js::houdiniExclusivity`). That dossier now lists both organs; the exclusivity check works on the finished piece, this one on the context that goes in.

On by default (research, chat and advice turns only). Turn off with `localStorage.setItem("fold-chat:houdini", "off")`; remove the key to turn it back on. When on, it reads the whole store and exchange, so the upstream anaphora gate and salience do not pre-filter them; sources keep their own salience. Any throw falls back to the positional build.

## What it does (declared, not measured: Constitution II.11)
- NEED: content terms; function words from the UD priors; novel terms discounted and capped; referents via `activated`.
- BEAR: greedy cover clusters over record-attested terms (no share-of-the-ask floor). A record bears only if it carries at least `relFloor` (0.7) of a cluster's weight, which rejects decoys that share a single noun. An optional injected `reader` supplies semantic bearing.
- VOICE: a term in at least half of the user's own messages is how they ask, not what about; an ask in that voice is a question of its own, not a fragment of ellipsis.
- CLASS: a term that stands beside several different words across the records is a kind, not a name; a new word placed directly beside it names a new thing, and the old ones stop bearing.
- PIN: records with `unsupported` or `open` outrank the rest and are shed last (typed gap `pinned_unshown`).
- ORDER: pinned first, then the topics in the order the ask mentions them, newest first within a topic (a record's rank counts its topic's pinned records).
- RAW: 1 exchange; 2 when the ask leans on the thread (the engine's `anaphoraOf`).
- RECALL: an old raw exchange returns only through a unique anchor (a term in at most 2 exchanges, not in any record) when no record bears.
- BUDGET: never above the positional chars. Shed order: unpinned records, recalled, extra raw, summary context, flow, pinned.
- SAY: "Not shown: N other checked turns on record" always equals the true count. Records are rendered by fold.js's own builders, never reworded.

## What the first real thread showed (houdini-live, 75 asks, web search + attachments)
Run through the real page on b1a7177 (before the fixes below). It recovered old topics the positional fold cannot (callback targets rode in 9 of 10 reachable asks, 0 of 10 positional) and was honest ("Not shown" true on 76/76 turns, 0 throws, ≤15 ms), but it was WORSE on two common shapes the synthetic battery cannot show:
- a fresh "Tell me about X" carried about 4.5 off-topic records (the frame word "tell" was the only attested content term);
- short follow-ups ("how many locks does it have?") were matched on "how/when/where/tall/built" instead of the topic's own last records (previous topic carried in 5 of 12, positional 12 of 12).
Also found: the fold's referent record had admitted "The" as an entity, so every record containing "the" "bore by identity"; and "Voyager 1 still…" lost "voyager" because the dropped one-letter "1" made two words look adjacent.

Fixes (replay of that thread's saved stores, `eval/houdini` replay in the session notes): a word spread evenly through the thread with no steady companion names no topic (null: median gap against ln2·R/(n+1)); an ask Terry reads as about the thread bears on the last exchange's topic first; function-word-only entities are ignored; a one-letter token is a barrier between neighbours. Replay result (flag-off thread): off-topic records on fresh asks 4.45 → 0.45 per ask, previous topic carried 7/12 → 12/12, callback targets reached 21/22 → 22/22.
NOT fixed by this work: about half the real turns are answered by the app's mechanical lanes and never reach the projector; and the app's own gate sends NO history on a standalone ask, so Houdini's "last few always ride" adds two exchanges there (a decision, not a bug: see the brief of 2026-10-13).

## Measuring it
`node eval/houdini/run.mjs --check` (about 2 minutes; deliberately not in `node --test`). Fast checks: `node --test fold-chat-houdini.test.mjs` (13 tests, including a case for each rule that must NOT fire it).

Seeded synthetic conversations in en, el, ru, zh, ar (24/60/160 turns), gold known by construction. Metrics are black-box over the returned messages: needRecall, shapePrecision, guard (pinned ride), decoyRejection, budget, honesty, integrity, determinism, flatness, worstScriptRecall, semanticRecall, latency. Calibration seeds [1,2,101,102,103] were looked at while the rules were built; held-out seeds [201,202,203] were not (the first held-out set, 101-103, was spent: it is calibration now). Latency is CPU time of the call, not wall-clock, so a busy machine cannot fail it.

### Held-out result (seeds 201-203)
| | fold today | bigger window | Houdini | 100% (oracle) |
|---|---|---|---|---|
| needRecall | 32.1 | 100 | 100 | 100 |
| shapePrecision | 21.1 | 9.2 | 99.6 | 100 |
| guard | 19.1 | 100 | 100 | 100 |
| decoyRejection | 83.6 | 0 | 100 | 100 |
| honesty | 0 | 100 | 100 | 100 |
| budget (never above today's size) | 100 | 0 | 100 | 100 |
| flatness (size does not grow with the thread) | 100 | 16.6 | 100 | 100 |
| worstScriptRecall | 17.0 | 100 | 100 | 100 |
| integrity / determinism / latency | 100 | 100 | 100 | 100 |
| semanticRecall | 1.9 | 100 | 0 | 100 |

All 8 mutants are killed. Latency 34 ms CPU median at 640 turns.

Where the 0.4 of shapePrecision goes: a fresh ask in zh that pairs a new name with a class noun the thread has only ONE entity of (the class rule needs two different neighbours as evidence, see Open gaps 2).

## What 100% means
The oracle (built from the gold) scores 100 on every metric, and `--check` fails if it does not. Houdini is at 100% when it matches the oracle on every metric on the held-out battery, every mutant is killed, and the semantic class passes through a reader. **Today it matches on every metric except semanticRecall and 0.4 of shapePrecision.**

## Open gaps
1. **Semantic (paraphrase) recall.** Without a reader 0. The fixture's `+reader` control (a hand-written description→noun map) scores 100: that proves the seam, not a reader. Three real attempts, measured:
   - *Kind induction* (plan step 2): the chat referent record carries `kinds: []` on every entity (15/15 on the fixture); no relation structure reaches it, so Kinds do not form from chat referents as built. Nothing was built around it.
   - *Local embedding model at entity level* (`node eval/houdini/semantic-live.mjs`, nomic-embed-text): the nearest referent is the gold entity in 4/9 probes, and the gold entity is not even in the bounded referent record in 4/9; semanticRecall 0 → 44.4. A reader helps; it does not reach 100, and a wrong pick puts a decoy topic in the window.
   - *A 2B generative model as judge* (gemma2:2b, yes/no on 64 description×entity pairs): 5/8 true, 11/56 false positives. Not usable as a bearing witness.
   - *Wikipedia search on the description*: the entity's own title is in the top 5 for 0/8.
   So a paraphrase that the thread never glossed needs knowledge the thread and the lexicon do not carry; the honest route is the reader seam fed by the surface, and the bounded referent record is the first thing to widen.
2. **Class rule, single entity.** "Zanthor Mill" when the thread has exactly one mill still lets that mill's records ride (one neighbour is not evidence of a class). "The tall bridge" with two bridges is read as a new name and the bridge records do not ride: an adjective in the name slot is indistinguishable from a name without capitalisation, and capitalisation is not read.
3. **Spent held-out.** Fixtures are synthetic and every seed shares one generator; the new rules were written after reading failures on 101-103, so only 201-203 say anything about generalisation, and they have now been looked at once.

## Limits to believe
Fixtures are synthetic and the held-out seeds come from the same generator, so held-out is weak. The suite measures what rides to the model, not answer quality. Thresholds are declared. No live-model evaluation of answers was run.
