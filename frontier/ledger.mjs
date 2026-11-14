// frontier/ledger.mjs — ORGAN 12, stigmergic reasoning under logos rules.
// The claim ledger is the LOG (claim events form a DAG through deps). Bounded workers each take ONE open item, read only that item's
// backward cone (within B), and add ONE step. Open items: the goal (an unmet shape), typed gaps, contested claims, "both" verdicts.
// Logos rules DISCLOSE, never rewrite (khora P186): after each step,
//   • begging the question  — khora reasoning-lint.js::findClaimCycle over the claim graph (end1 → end2)       → flag `circular`
//   • disputed premise      — khora regime.js::regimeOf/isSettled on the premise's disputes                   → flag `contested_premise`
//   • unlicensed inference  — khora reasoning-lint.js::lintInferences with the ground giver's licences       → flag `unlicensed`
//   • unrouted open contest — a `contest` event with no `route` event                                         → flag `unrouted_contest`
// A flagged claim stays in the ledger (visible, cited) but cannot fill the goal. Disagreement lands as a contest, never averaged.
// The chain ends when the goal is filled by an unflagged path, or when no open item can make a difference (logged `stop`).
// Item choice: trail-steered (Wilson: khora stigmergy via frontier/wilson) or random — an ablation switch.
import { engine } from "./contract.mjs";
import { depositFromWitness, orderRoutes } from "./wilson/wilson-adapter.mjs";
import { rng as mkRng } from "./synth.mjs";

export async function logosCheck(log, claimEv, { licences, logos = true }) {
  if (!logos) return [];
  const [findClaimCycle, regimeOf, isSettled, lintInferences] = await Promise.all([engine("findClaimCycle"), engine("regimeOf"), engine("isSettled"), engine("lintInferences")]);
  const flags = [];
  // begging the question: a cycle among the claims not already flagged circular, closed by THIS claim (findClaimCycle stops at the first)
  const circ = new Set(log.byKind("flag").filter((f) => f.body.rule === "circular").map((f) => f.deps[0]));
  const notes = log.byKind("claim").filter((c) => !circ.has(c.id)).map((c) => ({ id: c.id, end1: c.body.end1, label: c.body.label, end2: c.body.end2 }));
  const cyc = findClaimCycle(notes);
  const before = findClaimCycle(notes.filter((n) => n.id !== claimEv.id));
  if (cyc && !before) flags.push({ rule: "circular", detail: `cycle ${cyc.cycle.join(" → ")}`, ref: "khora reasoning-lint.js::findClaimCycle" });
  for (const p of claimEv.body.premises ?? []) {
    const disputes = log.byKind("contest").filter((c) => c.body.target === p && !log.byKind("landed").some((l) => l.body.contest === c.id)).map((c) => ({ source: c.by }));
    if (!isSettled({ regime: regimeOf(disputes) })) flags.push({ rule: "contested_premise", detail: `premise ${p} is under an open contest`, ref: "khora regime.js::isSettled" });
  }
  if (claimEv.body.inference) {
    const r = await lintInferences([{ kind: "deduction", ...claimEv.body.inference, end1: claimEv.body.end1, label: claimEv.body.label, end2: claimEv.body.end2, ref: claimEv.id }], { licenses: licences, strictness: "strict" });
    if (r.findings.some((f) => f.kind === "unlicensed_inference")) flags.push({ rule: "unlicensed", detail: `${claimEv.body.inference.relation}→${claimEv.body.inference.yields} not licensed`, ref: "khora reasoning-lint.js::lintInferences" });
  }
  const already = new Set(log.byKind("flag").filter((f) => f.body.rule === "unrouted_contest").map((f) => f.body.contest));
  for (const c of log.byKind("contest")) if (!already.has(c.id) && !log.byKind("route").some((r) => r.body.contest === c.id)) flags.push({ rule: "unrouted_contest", contest: c.id, detail: `contest ${c.id} has no route`, ref: "frontier ledger (landContest posture)" });
  for (const f of flags) log.append({ kind: "flag", by: "logos", deps: [claimEv.id], body: f });
  return flags;
}

/** Open items, folded from the log (no hidden queue). */
// BLOCKING flags stop a claim from carrying the chain (it asserts what does not follow). A contested premise does NOT block: the step
// is valid relative to its premise; the claim carries the taint forward (descent) and the goal can only be "filled_with_flags".
export const BLOCKING = new Set(["circular", "unlicensed"]);
export function openItems(log, goal) {
  const items = [];
  const flagged = new Set(log.byKind("flag").filter((f) => BLOCKING.has(f.body.rule)).map((f) => f.deps[0]));
  const filled = log.byKind("claim").some((c) => !flagged.has(c.id) && c.body.end1 === goal.body.end1 && c.body.end2 === goal.body.end2 && c.body.label === goal.body.label);
  if (!filled) items.push({ id: goal.id, kind: "goal" });
  for (const g of log.byKind("gap")) if (g.body.ledger && !log.byKind("claim").some((c) => c.deps.includes(g.id))) items.push({ id: g.id, kind: "gap" });
  for (const c of log.byKind("contest")) if (!log.byKind("route").some((r) => r.body.contest === c.id)) items.push({ id: c.id, kind: "contest" });
  return items;
}

/** Run workers until the goal is filled or nothing open can make a difference. `worker(item, cone, ctx)` returns ONE step:
 *  { claim: {end1,label,end2,premises,inference,text} } | { gap } | { route: contestId } | null (nothing to add). */
export async function runLedger({ log, goal, worker, licences, logos = true, steer = "trail", maxSteps = 200, seed = 1, B = 4000 }) {
  const rand = mkRng(seed);
  let trails = [];
  let steps = 0, idle = 0;
  while (steps < maxSteps) {
    const items = openItems(log, goal);
    if (!items.length) { log.append({ kind: "stop", by: "ledger", deps: [goal.id], body: { reason: "goal filled; no open items", steps } }); break; }
    let pick;
    if (steer === "trail") { const o = orderRoutes(trails, "ledger", { routes: items.map((i) => i.kind), now: steps, rng: rand }); const k = o.order[0]; pick = items.find((i) => i.kind === k) ?? items[0]; }
    else pick = items[Math.floor(rand() * items.length)];
    const out = await worker(pick, { log, B, goal });
    steps++;
    if (!out) { if (++idle >= items.length) { log.append({ kind: "stop", by: "ledger", deps: [goal.id], body: { reason: "remaining open items make no difference (no worker could add a step)", open: items.map((i) => i.id), steps } }); break; } continue; }
    idle = 0;
    if (out.route) { log.append({ kind: "route", by: "worker", deps: [out.route], body: { contest: out.route, to: "landContest" } }); continue; }
    if (out.gap) { log.append({ kind: "gap", by: "worker", deps: [pick.id], body: { gap: out.gap, ledger: true } }); continue; }
    const c = log.append({ kind: "claim", by: out.by ?? "worker", deps: [pick.id, ...(out.claim.premises ?? [])].filter((id) => log.has(id)), body: out.claim });
    const flags = await logosCheck(log, c, { licences, logos });
    trails = depositFromWitness(trails, { head: "ledger", route: pick.kind, verdict: flags.length ? "contradicted" : "supported", tokens: out.tokens ?? 0, at: steps });
  }
  const flagged = new Set(log.byKind("flag").filter((f) => f.body.rule !== "unrouted_contest").map((f) => f.deps[0]));
  const filling = log.byKind("claim").filter((c) => c.body.end1 === goal.body.end1 && c.body.end2 === goal.body.end2 && c.body.label === goal.body.label);
  const clean = filling.find((c) => !flagged.has(c.id) && !taintedBy(log, c, flagged));
  const status = clean ? "filled" : filling.length ? "filled_with_flags" : "open";
  return { status, steps, claim: (clean ?? filling[0])?.id ?? null, flags: log.byKind("flag").map((f) => ({ claim: f.deps[0], ...f.body })) };
}

/** A claim inherits a flag from any premise in its backward cone (descent). */
export function taintedBy(log, c, flagged) {
  const seen = new Set(), stack = [...(c.body.premises ?? [])];
  while (stack.length) { const id = stack.pop(); if (seen.has(id)) continue; seen.add(id); if (flagged.has(id)) return true; const e = log.get(id); if (e?.kind === "claim") stack.push(...(e.body.premises ?? [])); }
  return false;
}

/** The ledger as a navigable graph: Mermaid text + a self-contained HTML page. Every node shows its event id and its citations. */
export function renderLedger(log, goal) {
  const flagsOf = new Map();
  for (const f of log.byKind("flag")) { const k = f.deps[0]; if (!flagsOf.has(k)) flagsOf.set(k, []); flagsOf.get(k).push(f.body.rule); }
  const lines = ["graph TD", `  ${goal.id}["GOAL ${goal.id}: ${goal.body.end1} ${goal.body.label} ${goal.body.end2}"]`];
  for (const c of log.byKind("claim")) {
    const fl = flagsOf.get(c.id);
    lines.push(`  ${c.id}["${c.id}: ${c.body.end1} ${c.body.label} ${c.body.end2}${fl ? " ⚑ " + fl.join(",") : ""}<br/>cites ${(c.body.cites ?? []).join(" ")}"]`);
    for (const p of c.body.premises ?? []) lines.push(`  ${p} --> ${c.id}`);
    for (const s of c.body.cites ?? []) if (!(c.body.premises ?? []).includes(s)) lines.push(`  ${s}([${s}]) -.-> ${c.id}`);
    if (fl) lines.push(`  style ${c.id} fill:#fdd`);
  }
  for (const k of log.byKind("contest")) lines.push(`  ${k.body.target} -. contest ${k.id} by ${k.by} .-x ${k.body.target}`);
  const mermaid = lines.join("\n");
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const rows = log.byKind("claim").map((c) => `<tr id="${c.id}"><td>${c.id}</td><td>${esc(`${c.body.end1} ${c.body.label} ${c.body.end2}`)}</td><td>${(c.body.premises ?? []).map((p) => `<a href="#${p}">${p}</a>`).join(" ")}</td><td>${(c.body.cites ?? []).join(" ")}</td><td>${(flagsOf.get(c.id) ?? []).join(", ")}</td></tr>`).join("\n");
  const html = `<!doctype html><meta charset="utf-8"><title>Claim ledger</title><style>body{font:14px system-ui;margin:16px}td{border-top:1px solid #ccc;padding:2px 6px;vertical-align:top}</style>
<h1>Claim ledger — goal ${goal.id}</h1><pre class="mermaid">${esc(mermaid)}</pre><table><tr><th>id</th><th>claim</th><th>premises</th><th>cites</th><th>logos flags</th></tr>${rows}</table>
<script type="module">import m from "https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.esm.min.mjs";m.initialize({startOnLoad:true,maxTextSize:900000});</script>`;
  return { mermaid, html };
}
