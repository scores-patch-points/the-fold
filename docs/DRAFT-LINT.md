# DRAFT-LINT — the model's output is a draft; the fold decides what ships

Status: proposal (2026-10-15). Nothing here is built. Every number below is a bar to be pre-registered, not a result.

Companion: `DRAFT-LINT-PREREG.md` holds the pre-arm snapshot, replay set, and admission bars for the trial. §9 here is authoritative for arms, measures, and budgets; the PREREG is authoritative for the starting measurements and falsifiers.

§13 verified 2026-10-15 by reading `opencode-fold/packages` (plugin API in `plugin/src/effect/*.ts`, dispatch in `core/src`). Fork-delta consequences: `act` needs no upstream change; draft pre-finalize needs a new hook point (deferred to §10 step 4).

---

1. Thesis
A model's turn is a draft. The fold derives the draft's claims and actions, checks them mechanically against the bytes the turn actually read and against the user's stated goal, and returns a verdict. The model may be small. The checker costs zero tokens, so a small model behind a reliable checker is stronger than its raw accuracy, and the frontier is bought only where the checker says the small model cannot satisfy the law.

Non-goals:

The fold does not write. It flags, strikes, holds, re-asks or escalates. It never adds a content word to a draft (the mouth-repair.js rule).
It does not claim to out-reason a model on open-ended work. It claims to beat the model only where checking is cheaper and more reliable than generating.

2. Surfaces

| Surface | Role |
|---|---|
| opencode-fold plugin `packages/core/src/plugin/fold.ts` | forwards draft and tool-call events to the door; applies the verdict; no fold logic |
| khora/opencode-doorway.mjs | new events draft and act; composes the lints below |
| khora/native/organs/* | the lints themselves (existing organs; one new composer, draft-lint.js) |
| record (state/opencode/record.jsonl) | stores draft, findings, verdict, delta; new row kind draft-lint |

The contract handshake on GET /v1/hooks/opencode lists draft and act in events. A door that lacks them is treated as upstream (fail open).

3. Events

3.1 draft
Sent after the model finishes a text part, before it is shown or committed.

in : { event:"draft", sessionID, ask, text, evidence:[{id,tool,path?,bytesAddr,text}], attempt, model }
out: { verdict, findings:[Finding], spans:[{start,end,mark}], reask?:string }
evidence is what the turn really read: tool results with addresses. The plugin sends full text (not the 4,000-char clip used for event).

3.2 act
Sent before a proposed tool call executes.

in : { event:"act", sessionID, ask, tool, input, evidence, attempt }
out: { verdict:"allow"|"hold"|"reject", findings:[Finding], reason?:string }
Scope of v1: edit, write, shell. Read-only tools are never gated.

3.3 Verdicts

| verdict | effect |
|---|---|
| pass | draft ships unchanged |
| annotate | draft ships; unsupported spans are marked and a short footnote lists findings |
| reask | one bounded re-draft with reask (findings only, no rewrite) |
| escalate | route this turn to the frontier model |
| hold / reject | (act only) the call does not run; reason is shown |

Fail open: timeout, malformed body, or door down answers pass/allow.

4. Lints
Each lint returns Finding = { id, kind, span, claimId?, law, evidence?, severity }. severity is block | mark | note. No lint may use a model.

Reason — derive claims (claim-deriver.js, output-claims.js), lint every inference with reasoning-lint.js at strict. Finds begging the question, non-sequitur, scope shifts.
Ground — each claim about the workspace must resolve to an address in evidence. Unresolved claims are asserted, never known. Claims of execution ("tests pass", "I ran X") require a matching tool result.
Act — a proposed edit or command is checked against code-goal-lint.js and the ask's stated goal; destructive or out-of-scope shapes are hold.
Credit — an archon named in the draft must have a dossier that passes scripts/archon-dossier-check.mjs; the dossier verdict and bends are attached. No dossier means refused (AntiStrauss gate). Only gate-passing archons are speakable.
Need — Wald (shadow): did the ask need a pull the draft skipped? Recorded, not enforced, until its own amendment ratifies.
Lints 1–3 are the load-bearing set; 4–5 ship in shadow first.

5. Policy
attempt 1:  pass → ship
            mark-only findings → annotate
            block findings → reask (attempt 2)
attempt 2:  pass → ship; else escalate (if a larger model is configured) or annotate
Hard caps per turn: one re-ask, one escalation. The re-ask message is the typed findings only (target ≤ 80 tokens) — it never contains a rewrite or the draft back. For small-model routing, n independent drafts (default 1, max 4) may be generated and the first passing one kept; this is off unless configured.

6. The write rule
A verdict may remove, mark or refuse. It may not insert prose. Any text the fold shows (footnotes, hold reasons) is a template filled from finding fields, byte-addressed and typed self:fold, never model-authored.

7. Record
Row kind:"draft-lint": ask address, attempt, model, draft hash, findings, verdict, escalated?, tokens (draft, re-ask), lint ms. The draft text is stored once per turn. Nothing is promoted to a skill from these rows without the held-trial rule in THE-ONE-TIME-TEACHER §XII.

8. Budgets

| item | bar |
|---|---|
| lint latency, p95, 4k-char draft | ≤ 150 ms (to be measured; bar is a proposal) |
| draft timeout | 1,500 ms then pass |
| act timeout | 800 ms then allow |
| extra frontier tokens per turn | counted in the meter, shown in /fold |

9. Pre-registered trial (before any blocking is enabled)
Replay set: recorded turns from state/opencode/record.jsonl plus the 1,010 tool outputs used by scripts/opencode-fold-replay.mjs. A held-out third is sealed before any lint is tuned.

Arms: (A) model alone; (B) model + lint, re-ask, no escalate; (C) B + escalate. Models: the small model under test and the current frontier as reference.

Measures, scored by checks authored before the run:

unsupported-claim rate (claim has no address, or contradicts evidence);
bad-action rate (hold-worthy calls that would have run);
false-positive rate on turns a human marked sound;
escalation rate and total tokens including retries;
p95 added latency.
Pass bars (proposals, to be fixed before data): false-positive rate ≤ 5% on the sound set for any blocking lint; unsupported-claim rate in arm B at or below the reference frontier's arm A; escalation ≤ 25% of turns; total tokens in C below the frontier-alone arm. If a bar is missed, that lint stays note-only.

10. Rollout
Ordered by what the fork supports today (see §13.1).

Shadow: the plugin forwards unclipped session.text.ended and observes execute.before; the door lints and records, verdicts ignored. Measure per §9.
Late annotate: the context hook injects the previous draft's mark findings as a system note on the next step.
act holds for edit/shell via execute.before, per-tool opt-in, only for lints that cleared §9.
Pre-finalize draft with re-ask and escalate: requires the new session hook point (§13.2); build only if 1–3 show it is worth a fork delta.
FOLD_DRAFT=0 disables the new events; FOLD_OFF=1 still disables everything.

11. What this does not fix
Missing knowledge, capability gaps in synthesis, and anything with no checkable ground (style, taste, open design). A lint with weak recall selects bad drafts with confidence; the ceiling is the checker's recall, which §9 measures.

12. Open decisions
May a hold reason be shown inline in the TUI, or only under /fold?
Which small model(s) are the trial's arm A, and is escalation to the current frontier the only escalation target?
Does n>1 sampling belong in v1 or wait for the shadow results?
Callimachus is unregistered and Wald is in shadow: confirm lint 4 speaks only the 83 gate-passing archons.
Where the new lint composer lives: khora/native/organs/draft-lint.js (assumed here) versus the-fold's vendored seam.

13. Fork delta (contract with UPSTREAM.md)
Verified 2026-10-15 by reading opencode-fold/packages (plugin API in plugin/src/effect/*.ts, dispatch in core/src). Not run; no test executed.

13.1 What the plugin API exposes today

| Need | Exposed? | Where | Notes |
|---|---|---|---|
| Pre-execute tool hook (act) | Yes | ctx.tool.hook("execute.before"); ToolHooks in plugin/src/effect/tool.ts; triggered at core/src/tool.ts:104 | event.input is mutable, and the callback may fail with Tool.Error, which rejects the call before it runs (ToolFailures). core/src/plugin/tool-input-repair.ts already uses it. Event carries tool, sessionID, agent, messageID, id, input. |
| Permission gate (act, alternative) | Yes | ctx.permission.hook("evaluate") (permission.ts) | Sets effect on a permission evaluation; fits hold as "ask the user" instead of a hard reject. Not yet inspected beyond its type. |
| Post-execute tool result | Yes | ctx.tool.hook("execute.after") | Cannot fail; result is mutable on completed. Usable for evidence capture. |
| Pre-finalize text (draft) | No | — | SessionHooks is prompt, context, compaction, generate, title, model.request, http.request, http.response, experimental.ws.*, retry. Assistant text is published as SessionEvent.Text.Ended (core/src/session/runner/publish-llm-event.ts:243) and reduced into session state by message-updater.ts; plugins only observe it through ctx.event.subscribe, as fold.ts does. There is no point at which a plugin can veto or rewrite it. |
| Re-ask a draft | No | — | session.retry fires only for provider errors (AIError, core/src/session/runner/retry.ts); its decision cannot be driven by draft quality. |
| Full-text capture for shadow mode | Yes | session.text.ended event data | fold.ts clips it at 4,000 chars via clip(); raising that is a one-line change in the forwarder. |

13.2 Consequences for the spec
act needs no upstream change. It is a second registration in fold.ts on ctx.tool.hook("execute.before"), forwarding to the door and failing the call with Tool.Error on hold/reject. The Tool.Error text is the only model-visible output, so it must be a template (§6).
draft pre-finalize needs a new hook point in the fork, so it is a real delta against upstream, not a plugin-only change. Smallest form: a session.text.before-end hook ({ sessionID, agent, model, text, state }, mutable text, optional reask) triggered in publish-llm-event.ts just before SessionEvent.Text.Ended is published. Two risks to settle before building: the text is already streamed to clients as deltas before ended, so a verdict can only rewrite the committed message and the UI may have shown the draft; and any re-ask must re-enter the runner loop, which the retry path does not offer.
Until that hook exists, enforcement can run one step late. The existing context hook sees the prior assistant text in messages on the next request, so the door can lint the previous draft and inject findings as a system note. That is annotate/reask semantics after the fact, with no fork change, and it is the realistic first enforcement step.
Rollout §10 is therefore: step 1 shadow (works now: event + unclipped text + execute.before in observe-only mode); step 2 late annotation via context; step 3 act holds via execute.before; step 4 pre-finalize draft only if steps 1–3 show the draft-time verdict is worth a fork delta.

13.3 Delta guard
fold-sync.sh's guard currently expects one added file and one registration line. Adding act changes fold.ts only (still within the guard). A new session hook point would touch core/src/session/runner/publish-llm-event.ts and plugin/src/effect/session.ts; the guard must list those files explicitly, and UPSTREAM.md's "the fork's entire delta" table must name them.
