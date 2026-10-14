# THE MODELLESS REASON LINT + THE MODEL-CALL RULE (2026-10-11)

Wired at the `modelBarred` site of `fold-chat.js`, running once per turn on the FINAL passages
(the search's reads + the encyclopedia's originals + the thread's carried passages).

## The lint

- `fold-chat-reason-lint.js`: derive claims in the turn's own language (per-language relation
  lexicons, script-aware spans — no case heuristics for han/hebrew; clause-span subjects nearest
  the verb; prep/adverbial tails curated off), lint every inference with the vendored Kelsen
  linter (`vendor/khora/native/organs/reasoning-lint.js`, byte-identical) at **strict** (the
  standard ladder hides begging-the-question).
- The murmur speaks the language that was read (`fold-chat-murmur-i18n.js`): per-language
  templates (en de es fr ru uk zh ja he), a typed gap in-language when nothing is recoverable.
- `record.reasonLint = { claims, findings, ok, lang }` — what was actually found, never a
  fabricated finding; a no-passages turn simply has nothing to lint.

## THE RULE: when do we get model calls?

`fold-chat-model-rule.js` — the model has ONE job: to SPEAK what the fold has already
established. It is never asked to know, to decide, or to reason. Every barred turn names its
rule on the record (`record.modelRule`):

| rule | when barred |
|---|---|
| R0_MOUTH | the fold established the material — the model only phrases it |
| R1_NO_SOURCE | no source reached; the model may not answer from memory (only a named ALONE_KIND may) |
| R2_SOURCES_ONLY | the answer IS the sources' own words (a strand) |
| R3_ALONE_WRITTEN | a written output may not be produced by the model alone |
| R4_UNREADABLE | the murmur could not read the ask; no model guesses what the machine misread |
| R5_CLARIFY | the term names several things; the machine asks WHICH — no model writes the options |
| R6_SLOT | one fact for one typed slot; the slot pipeline answers mechanically |
| R7_GATE | the output gate refused; nothing is written by a model past it |

An allowed call is R0 and only ever one of three roles (`MODEL_ROLES`):
**steer** (fed the perfected context — lessons + the fold's reading), **residue** (only the
small residue the box and the field cannot hold, pivot-realised, quotes verbatim or struck),
**prosify** (phrases mechanical content — a computed value, a record's facts — into natural
words). It NEVER decides standing: earning is a measured consequence, not a sentence.

## ANGELICA, THE SEALED JUDGE (2026-10-11)

Consulted ONLY on an R0 turn (the mouth will speak), ONLY at a real decision gap, ONLY when the
fold holds an Anthropic token (`fold-chat-sealed-judge.js`, a browser reports none through its own
bridge). Her word is advisory — never standing, never an execution:

- she may judge topic (on / drift / undecided) and PROPOSE one tool; a proposal is a feed line, a
  drift is a notice — R0–R7 still decide alone (falsified: a glowing verdict cannot unbar R1).
- SEALED: the payload carries counts, the canonical reading, tool names, the topic line — no raw
  passage ever leaves (falsified by test on the payload bytes).
- TYPED: only `EOSealedJudgeVerdict@1` parses; garbage/prose/unknown topics are a typed gap and the
  machine's own decision stands (falsified). A slow Angelica (timeout 3.5s) never blocks the turn.
- LEARNED: every landed judgement appends a lesson (`hd:fold-judged`); the identical decision
  signature is then answered FROM THE LESSON — she is consulted once for N identical decisions
  (falsified: 3 turns, 1 consult). Her own prompt carries the lessons, so she steers the same way
  the fold already learned — the system needs her less and less, auditable turn by turn on
  `record.angelica` (a `covered_by_lesson` verdict is kept and stored).
