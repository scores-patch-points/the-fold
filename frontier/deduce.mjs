// frontier/deduce.mjs — a generated deduction world and bounded workers for the claim ledger (stage 9, H7).
// World: rules "If Pk then Pk+1." for k < depth as spans; goal "P0 implies P<depth>". Rules are admitted as claims by the reader
// (cites = the span). A worker takes ONE open item, assembles that item's backward cone within B (the newest unflagged frontier claim and
// the rule spans that mention its end), asks the mouth for ONE step, and returns it. Faults can be planted: a circular step at `circularAt`,
// a disputed rule at `contestAt` (a second source contests it), a plausible-but-wrong step at `wrongAt` (skips a link with no rule).
import { assemble } from "./assemble.mjs";
import { BLOCKING } from "./ledger.mjs";

export async function deductionWorld({ log, surf, depth = 20, contestAt = null, seed = 1, breakAt = null, decoys = 0 }) {
  // breakAt: the rule P<breakAt> → P<breakAt+1> is withheld (the goal is then NOT derivable). decoys: extra rules that lead off the chain
  // ("If Pk then Qk.") and between decoy atoms, so a worker must read which line starts at its frontier.
  const lines = Array.from({ length: depth }, (_, k) => (k === breakAt ? null : `If P${k} then P${k + 1}.`)).filter(Boolean);
  const r = (await import("./synth.mjs")).rng(seed);
  for (let i = 0; i < decoys; i++) { const k = Math.floor(r() * depth); lines.push(r() < 0.5 ? `If P${k} then Q${k}${i}.` : `If Q${i} then P${Math.floor(r() * depth)}.`); }
  for (let i = lines.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [lines[i], lines[j]] = [lines[j], lines[i]]; }
  const text = lines.join(" ");
  const { spans } = await surf.ingest(text, { source: `deduction-d${depth}-s${seed}` });
  const rules = spans.map((s) => { const m = s.body.text.match(/^If (\w+) then (\w+)\.$/); return log.append({ kind: "claim", by: "reader:rule", deps: [s.id], body: { end1: m[1], label: "implies", end2: m[2], cites: [s.id], premises: [], text: s.body.text } }); });
  const ruleOf = (k) => rules.find((c) => c.body.end1 === `P${k}` && c.body.end2 === `P${k + 1}`);
  const goal = log.append({ kind: "goal", by: "asker", body: { end1: "P0", label: "implies", end2: `P${depth}` } });
  if (contestAt != null && ruleOf(contestAt)) log.append({ kind: "contest", by: "source:second-witness", deps: [ruleOf(contestAt).id], body: { target: ruleOf(contestAt).id, detail: `a second source denies P${contestAt} implies P${contestAt + 1}` } });
  return { goal, rules, spans, text };
}

const STEP_SCHEMA = { type: "object", properties: { from: { type: "string" }, via: { type: "string" }, end2: { type: "string" } }, required: ["from", "via", "end2"] };
const STEP_SYSTEM = "You extend a chain of implications toward the GOAL by exactly ONE step. Lines are [event-id] rules. We have shown P0 implies X (the FRONTIER). Pick ONE rule line that STARTS with X ('If X then Y.'), preferring one that can lead toward the goal, and reply JSON {\"from\": the frontier id, \"via\": that rule's event id, \"end2\": \"Y\"}.";

/** Rules already tried from a frontier (any outcome): a frontier is exhausted when every rule starting at its end has been tried. */
const triedFrom = (log, frId) => new Set(log.byKind("claim").filter((c) => c.by !== "reader:rule" && (c.body.from ?? null) === frId).map((c) => c.body.via).filter(Boolean));
const rulesFrom = (log, x) => log.byKind("claim").filter((c) => c.by === "reader:rule" && c.body.end1 === x);

/** The frontier: the newest unflagged derived claim P0 implies X (or the start) that still has an untried rule from X. Backs off from dead
 *  ends instead of stopping (a dead end is a valid claim, not an error). Returns { fr, x, untried } or null when every frontier is exhausted. */
export function frontierOf(log, goal) {
  const flagged = new Set(log.byKind("flag").filter((f) => BLOCKING.has(f.body.rule)).map((f) => f.deps[0]));
  const derived = log.byKind("claim").filter((c) => c.body.end1 === goal.body.end1 && c.by !== "reader:rule" && !flagged.has(c.id));
  for (const fr of [...derived.reverse(), null]) {
    const x = fr ? fr.body.end2 : goal.body.end1;
    const tried = triedFrom(log, fr?.id ?? null);
    const untried = rulesFrom(log, x).filter((r) => !tried.has(r.id));
    if (untried.length) return { fr, x, untried };
  }
  return null;
}

export function makeWorker({ mouth, faults = {}, contentOf }) {
  let step = 0;
  return async (item, { log, B, goal }) => {
    if (item.kind === "contest") return { route: item.id };
    if (item.kind !== "goal") return null;
    step++;
    const f = frontierOf(log, goal);
    if (!f) return null; // every frontier exhausted: nothing left can make a difference
    const { fr, x } = f;
    if (faults.circularAt === step && fr) // planted: a step that asserts the conclusion back onto the start (begging the question)
      return { claim: { end1: x, label: "implies", end2: goal.body.end1, premises: [fr.id], cites: [fr.id], inference: { relation: "implies", yields: "implies" }, text: `${x} implies ${goal.body.end1} (planted circular step)` }, by: "worker:planted-fault" };
    // the cone: untried rules from X, plus rules that END at X (they mention X but do not start there: the reading the model must do)
    // a line the witness vetoed from THIS frontier is not offered again from it (the veto is a mark in the environment)
    const vetoed = new Set(log.byKind("flag").filter((fl) => fl.body.rule === "step_contradicted").map((fl) => log.get(fl.deps[0])).filter((c) => (c?.body.from ?? null) === (fr?.id ?? null)).map((c) => c.body.via));
    const ruleIds = [...f.untried.map((c) => c.id), ...log.byKind("claim").filter((c) => c.by === "reader:rule" && c.body.end2 === x && !vetoed.has(c.id)).map((c) => c.id)];
    // fix 3: the frontier claim is stated on the FRONTIER line only; evidence lines are rules, so the model cannot cite the frontier as a rule
    const cone = ruleIds;
    const { calls } = assemble({ log, B, system: STEP_SYSTEM, seam: "ledger-step", spanIds: cone, contentOf, frame: (b) => `GOAL: ${goal.body.end1} implies ${goal.body.end2}\nFRONTIER: ${fr ? fr.id : "(start)"} — we have shown P0 implies ${x}. Pick a rule that starts with ${x}.\n${b}`, schema: STEP_SCHEMA });
    const res = await mouth.ask({ system: calls[0].system, user: calls[0].user, schema: STEP_SCHEMA, seam: "ledger-step", deps: [...(fr ? [fr.id] : []), ...cone] });
    const v = res.value ?? {};
    const via = log.get(v.via);
    if (!via || via.kind !== "claim" || via.by !== "reader:rule") return { gap: "worker_could_not_step" };
    let end2 = v.end2 && /^[PQ]\d+$/.test(v.end2) ? v.end2 : via.body.end2; // the worker's own conclusion (a model may misread it)
    if (faults.wrongAt === step || faults.wrongLicensedAt === step) end2 = `P${Number(String(via.body.end2).slice(1)) + 1}`; // planted plausible-but-wrong step: skips a link
    const premises = [...(fr ? [fr.id] : []), via.id];
    return { claim: { end1: goal.body.end1, label: "implies", end2, premises, cites: premises, inference: faults.wrongAt === step ? { relation: "skip", yields: "implies" } : { relation: "implies", yields: "implies" }, via: via.id, from: fr?.id ?? null, text: `${goal.body.end1} implies ${end2}` }, tokens: res.call.body.ctxEstimate };
  };
}

/** Stand-in mouth for the step seam: reads FRONTIER and the rule lines, returns the one step they license. Declared stub, not a model. */
export const stepStub = ({ user }) => {
  const fr = (user.match(/FRONTIER: (ev\d+)/) ?? [])[1] ?? null;
  const lines = [...user.matchAll(/\[(ev\d+)\] (.*)/g)].map((m) => ({ id: m[1], t: m[2] }));
  const x = (user.match(/we have shown P0 implies (\w+)/) ?? [])[1] ?? "P0";
  const rule = lines.find((l) => new RegExp(`^If ${x} then (P\\d+)\\.`).test(l.t) || new RegExp(`^${x} implies`).test(l.t));
  return rule ? { from: fr ?? "", via: rule.id, end2: (rule.t.match(/(P\d+)\.?$/) ?? [])[1] } : { from: "", via: "", end2: "" };
};

/** STEP WITNESS (organ 9 for the ledger): a step is supported only if its rule starts where its frontier ends and its conclusion is the
 *  rule's own end. Logos checks the shape of the argument; this checks that each step says what its cited premises say. */
export function stepWitness(log, claimEv) {
  const b = claimEv.body; if (!b.via) return null;
  const via = log.get(b.via), fr = b.from ? log.get(b.from) : null;
  const x = fr ? fr.body.end2 : b.end1;
  const ok = via && via.body.end1 === x && via.body.end2 === b.end2;
  return ok ? null : { rule: "step_contradicted", detail: `rule ${b.via} (${via?.body.end1}→${via?.body.end2}) does not take ${x} to ${b.end2}`, ref: "frontier deduce.mjs::stepWitness" };
}
