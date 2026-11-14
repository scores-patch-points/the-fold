// frontier/assemble.mjs — ORGAN 7, the Context assembler.
// Builds each model call from fold output: addressed spans tagged with their event ids, the question shape, and the seam's instruction.
// Every span id must trace to a source event with a hash (surf.traceSpan) or the assembler refuses it. If the call would exceed B it is
// SPLIT into several calls over disjoint span groups (each within B); a single span that alone exceeds B is a typed gap
// (`span_over_budget`). Nothing is ever truncated.
//   assemble({ log, B, system, seam, shape, spanIds, contentOf, frame }) → { calls: [{ system, user, spanIds }], refused: [] }
import { estimateTokens } from "./tokens.mjs";
import { traceSpan } from "./surf.mjs";

const shapeLine = (shape) => (shape ? `QUESTION SHAPE: ${JSON.stringify(shape)}` : "");
const spanLine = (log, id) => { const e = log.get(id); return `[${id}] ${e.body.text}`; };

export function assemble({ log, B, system = "", seam, shape = null, spanIds = [], contentOf = null, frame = (body) => body, schema = null, reserve = 8 }) {
  const refused = [];
  const ok = [];
  for (const id of spanIds) {
    const e = log.get(id);
    if (e?.kind === "claim" || e?.kind === "answer" || e?.kind === "fact") { ok.push(id); continue; } // log-native records are addressed by their own ids
    const t = traceSpan(log, id, contentOf);
    if (!t.ok) refused.push({ id, gap: "untraced_span", why: t.why }); else ok.push(id);
  }
  const fixed = estimateTokens(system) + estimateTokens(frame(shapeLine(shape))) + (schema ? estimateTokens(JSON.stringify(schema)) : 0) + reserve + 16;
  const room = B - fixed;
  if (room <= 0) return { calls: [], refused: [...refused, { gap: "frame_over_budget", tokens: fixed, B }] };
  const groups = [[]];
  let used = 0;
  for (const id of ok) {
    const line = spanLine(log, id) ;
    const t = estimateTokens(line + "\n");
    if (t > room) { refused.push({ id, gap: "span_over_budget", tokens: t, room }); continue; }
    if (used + t > room) { groups.push([]); used = 0; }
    groups[groups.length - 1].push(id); used += t;
  }
  const calls = groups.filter((g) => g.length || !ok.length).map((g) => ({
    system,
    user: frame([shapeLine(shape), "EVIDENCE (each line is [event-id] text):", ...g.map((id) => spanLine(log, id))].filter(Boolean).join("\n")),
    spanIds: g, seam,
  }));
  return { calls, refused };
}

/** Renders a log-native record (claim/fact/answer) as evidence text: what assemble's spanLine reads. */
export const recordText = (e) => e.body.text ?? JSON.stringify(e.body);
