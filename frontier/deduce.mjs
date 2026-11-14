// frontier/deduce.mjs — a generated deduction world and bounded workers for the claim ledger (stage 9, H7).
// World: rules "If Pk then Pk+1." for k < depth as spans; goal "P0 implies P<depth>". Rules are admitted as claims by the reader
// (cites = the span). A worker takes ONE open item, assembles that item's backward cone within B (the newest unflagged frontier claim and
// the rule spans that mention its end), asks the mouth for ONE step, and returns it. Faults can be planted: a circular step at `circularAt`,
// a disputed rule at `contestAt` (a second source contests it), a plausible-but-wrong step at `wrongAt` (skips a link with no rule).
import { assemble } from "./assemble.mjs";
import { BLOCKING } from "./ledger.mjs";

export async function deductionWorld({ log, surf, depth = 20, contestAt = null, seed = 1 }) {
  const text = Array.from({ length: depth }, (_, k) => `If P${k} then P${k + 1}.`).join(" ");
  const { spans } = await surf.ingest(text, { source: `deduction-d${depth}-s${seed}` });
  const rules = spans.map((s, k) => log.append({ kind: "claim", by: "reader:rule", deps: [s.id], body: { end1: `P${k}`, label: "implies", end2: `P${k + 1}`, cites: [s.id], premises: [], text: s.body.text } }));
  const goal = log.append({ kind: "goal", by: "asker", body: { end1: "P0", label: "implies", end2: `P${depth}` } });
  if (contestAt != null) log.append({ kind: "contest", by: "source:second-witness", deps: [rules[contestAt].id], body: { target: rules[contestAt].id, detail: `a second source denies P${contestAt} implies P${contestAt + 1}` } });
  return { goal, rules, spans };
}

const STEP_SCHEMA = { type: "object", properties: { from: { type: "string" }, via: { type: "string" }, end2: { type: "string" } }, required: ["from", "via", "end2"] };
const STEP_SYSTEM = "You extend a chain of implications by exactly ONE step. Lines are [event-id] claims. FRONTIER is the newest proven claim 'P0 implies X'. Find the line 'X implies Y' (or 'If X then Y.') and reply JSON {\"from\": frontier id, \"via\": the rule's id, \"end2\": \"Y\"}.";

/** The frontier: the newest unflagged, untainted claim P0 implies X. */
export function frontierOf(log, goal) {
  const flagged = new Set(log.byKind("flag").filter((f) => BLOCKING.has(f.body.rule)).map((f) => f.deps[0]));
  const derived = log.byKind("claim").filter((c) => c.body.end1 === goal.body.end1 && c.by !== "reader:rule" && !flagged.has(c.id));
  return derived.at(-1) ?? null;
}

export function makeWorker({ mouth, faults = {}, contentOf }) {
  let step = 0;
  return async (item, { log, B, goal }) => {
    if (item.kind === "contest") return { route: item.id };
    if (item.kind !== "goal") return null;
    step++;
    const fr = frontierOf(log, goal);
    const x = fr ? fr.body.end2 : goal.body.end1;
    if (faults.circularAt === step && fr) // planted: a step that asserts the conclusion back onto the start (begging the question)
      return { claim: { end1: x, label: "implies", end2: goal.body.end1, premises: [fr.id], cites: [fr.id], inference: { relation: "implies", yields: "implies" }, text: `${x} implies ${goal.body.end1} (planted circular step)` }, by: "worker:planted-fault" };
    const ruleIds = log.byKind("claim").filter((c) => c.by === "reader:rule" && c.body.end1 === x).map((c) => c.id);
    if (!ruleIds.length) return null;
    const cone = [...(fr ? [fr.id] : []), ...ruleIds];
    const { calls } = assemble({ log, B, system: STEP_SYSTEM, seam: "ledger-step", spanIds: cone, contentOf, frame: (b) => `FRONTIER: ${fr ? fr.id : "(start: P0)"}\n${b}`, schema: STEP_SCHEMA });
    const res = await mouth.ask({ system: calls[0].system, user: calls[0].user, schema: STEP_SCHEMA, seam: "ledger-step", deps: cone });
    const v = res.value ?? {};
    const via = log.get(v.via);
    if (!via || via.kind !== "claim" || via.body.end1 !== x) return { gap: "worker_could_not_step" };
    let end2 = via.body.end2;
    if (faults.wrongAt === step) end2 = `P${Number(end2.slice(1)) + 1}`; // planted plausible-but-wrong step: skips a link no rule licenses
    const premises = [...(fr ? [fr.id] : []), via.id];
    return { claim: { end1: goal.body.end1, label: "implies", end2, premises, cites: premises, inference: faults.wrongAt === step ? { relation: "skip", yields: "implies" } : { relation: "implies", yields: "implies" }, text: `${goal.body.end1} implies ${end2}` }, tokens: res.call.body.ctxEstimate };
  };
}

/** Stand-in mouth for the step seam: reads FRONTIER and the rule lines, returns the one step they license. Declared stub, not a model. */
export const stepStub = ({ user }) => {
  const fr = (user.match(/FRONTIER: (ev\d+)/) ?? [])[1] ?? null;
  const lines = [...user.matchAll(/\[(ev\d+)\] (.*)/g)].map((m) => ({ id: m[1], t: m[2] }));
  const frLine = lines.find((l) => l.id === fr);
  const x = frLine ? (frLine.t.match(/implies (P\d+)/) ?? [])[1] : "P0";
  const rule = lines.find((l) => new RegExp(`^If ${x} then (P\\d+)\\.`).test(l.t) || new RegExp(`^${x} implies`).test(l.t));
  return rule ? { from: fr ?? "", via: rule.id, end2: (rule.t.match(/(P\d+)\.?$/) ?? [])[1] } : { from: "", via: "", end2: "" };
};
