// fold-chat-model-rule.js — THE RULE for when the fold calls a model (user, 2026-10-11).
//
// The model has ONE job: to SPEAK what the fold has already established. It is never asked to know, to
// decide, or to reason — the machine knows (box/field/vault), the sources speak (strand), the standing is
// MEASURED (earn/release — never generated). A model call is therefore a ROLE, not a resource:
//   steer    — it is fed the perfected context (lessons + the fold's reading) and phrases the CURRENT ask
//   residue  — it may write only the small residue the box and the field cannot hold, realised through
//              the pivot (every sentence grounded) and with quotes verbatim or struck
//   prosify  — it phrases mechanical content (the computed value, a record's facts) into natural words
// Every turn names its decision on the record (record.modelRule), so each call — or non-call — is auditable.

export const MODEL_BAR_RULES = Object.freeze({
  R1_NO_SOURCE: "the turn reached no source; the model may not answer from memory (only a named ALONE_KIND may)",
  R2_SOURCES_ONLY: "the answer IS the sources' own words (a strand); no model speaks for them",
  R3_ALONE_WRITTEN: "a written output may not be produced by the model alone",
  R4_UNREADABLE: "the murmur could not read the ask; the typed gap is drawn — no model guesses what the machine misread",
  R5_CLARIFY: "the term names several things; the machine asks WHICH — no model writes the options",
  R6_SLOT: "the ask is one fact for one typed slot; the slot pipeline answers it mechanically",
  R7_GATE: "the output gate refused; nothing is written by a model past it",
});

export const MODEL_ROLES = Object.freeze({
  steer: "fed the perfected context (lessons + the fold's reading) so it phrases the current ask, not the typos",
  residue: "drives only the small residue the box and the field cannot hold — pivot-realised, quotes verbatim or struck",
  prosify: "phrases mechanical content (the computed value, the record's facts) into one short natural sentence",
});

/** Decide the model call for a turn. Every barred branch names its rule and why; an allowed turn is the
 *  mouth's role (R0) — the fold established the material, the model only phrases it. */
export function modelCallRule({ plan = null, strand = null, aloneBarred = false, clarify = null, gateRefused = false } = {}) {
  if (plan) return { allowed: false, rule: "R1_NO_SOURCE", why: MODEL_BAR_RULES.R1_NO_SOURCE };
  if (strand) return { allowed: false, rule: "R2_SOURCES_ONLY", why: MODEL_BAR_RULES.R2_SOURCES_ONLY };
  if (clarify) return { allowed: false, rule: "R5_CLARIFY", why: MODEL_BAR_RULES.R5_CLARIFY };
  if (gateRefused) return { allowed: false, rule: "R7_GATE", why: MODEL_BAR_RULES.R7_GATE };
  if (aloneBarred) return { allowed: false, rule: "R3_ALONE_WRITTEN", why: MODEL_BAR_RULES.R3_ALONE_WRITTEN };
  return { allowed: true, rule: "R0_MOUTH", why: "the fold established the material; the model only phrases it — steer the perfected context, speak the small residue, prosify the result" };
}

export default { modelCallRule, MODEL_BAR_RULES, MODEL_ROLES };