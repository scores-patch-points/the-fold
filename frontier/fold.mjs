// frontier/fold.mjs — ORGAN 4, the Wave fold.
// Folds the log per question, under a declared ground, and stops each branch at the first step that can no longer make a difference.
//   wave({ log, shape, ground, groundVersion, memo, stopRule, identity }) → { answer, support: [ids], stops: [stop events], walked, memoHit }
// Facts are `fact` events {anchor, relation, value, at?}; `retract` events {target}. A BRANCH is one (anchor-member, relation) chain.
// Walk: newest → oldest over the branch's events (its dependency cone from the heads). Per branch the stop is cumulative and is a
// DIFFERENCE test, never a count of steps: under timeRegime "latest" with cardinality one, once a non-retracted value is held, no older
// fact can change the projection (a retraction is always newer than its target, so it has already been seen), and the branch stops.
// Under "all" / cardinality many / aggregates nothing older is inert, so the branch only stops at the shape's extent frontier (asOf /
// since) or at the root. Each stop is logged as a `stop` event {branch, frontier, reason, walked}. With `stopRule:false` (ablation) the
// fold walks every branch to the root.
// Memo: key = (head ids of the cone, ground id@version, shape key). A repeat question with the same heads hits the memo and logs `memo_hit`.
import { createHash } from "node:crypto";
import { identityAt } from "./identity.mjs";
import { shapeKey } from "./shape.mjs";

const h = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);

export function makeMemo() { const m = new Map(); return { get: (k) => m.get(k), set: (k, v) => m.set(k, v), size: () => m.size }; }

export function wave({ log, shape, ground, memo = null, stopRule = true, by = "fold", deps = [] }) {
  const ident = identityAt(log);
  const cls = shape.anchor ? ident.classOf(shape.anchor) : { members: null, plural: false, contested: [] };
  const inBranch = (e) => (e.kind === "fact" && (!shape.relation || e.body.relation === shape.relation) && (!cls.members || cls.members.includes(e.body.anchor)))
    || (e.kind === "retract");
  // the cone: every branch event, newest first (log order is dependency order)
  const all = log.all();
  const cone = [];
  for (let i = all.length - 1; i >= 0; i--) if (inBranch(all[i])) cone.push(all[i]);
  const heads = cone.filter((e) => e.kind === "fact").slice(0, 64).map((e) => e.id); // newest heads; the memo key changes when any new branch fact lands
  const key = `${h(heads.join(","))}|${ground.id}@${ground.version}|${h(shapeKey(shape))}|stop=${stopRule}`;
  if (memo?.get(key)) {
    const hit = memo.get(key);
    log.append({ kind: "memo_hit", by, deps: [hit.answerEvent ?? deps[0]].filter(Boolean), body: { key } });
    return { ...hit, memoHit: true };
  }
  const asOf = ground.asOf ?? shape.extent?.asOf ?? null;
  const since = shape.extent?.since ?? null;
  const retracted = new Set();
  const branches = new Map(); // branchKey → { value, support, done, walked }
  const stops = [];
  const one = shape.cardinality === "one" && ground.timeRegime === "latest" && ["value", "date", "bool", "entity"].includes(shape.kind);
  let walked = 0;
  for (const e of cone) {
    if (e.kind === "retract") { retracted.add(e.body.target); continue; }
    const bk = `${e.body.anchor}::${e.body.relation}`;
    if (!branches.has(bk)) branches.set(bk, { values: [], support: [], done: false, walked: 0 });
    const b = branches.get(bk);
    if (b.done) continue;
    const t = e.body.at ?? null;
    if (asOf != null && t != null && t > asOf) continue; // after the extent: not this question's world
    walked++; b.walked++;
    if (since != null && t != null && t < since) {
      if (stopRule) { b.done = true; stops.push(log.append({ kind: "stop", by, deps: [e.id], body: { branch: bk, frontier: e.id, reason: "extent frontier (older than since)", walked: b.walked } })); }
      continue;
    }
    if (retracted.has(e.id)) continue;
    b.values.push(e.body.value); b.support.push(e.id);
    if (one && stopRule) { b.done = true; stops.push(log.append({ kind: "stop", by, deps: [e.id], body: { branch: bk, frontier: e.id, reason: "latest valid value held; older facts cannot change it under ground", walked: b.walked } })); }
  }
  for (const [bk, b] of branches) if (!b.done) stops.push(log.append({ kind: "stop", by, deps: b.support.slice(-1), body: { branch: bk, frontier: "root", reason: "walked to root", walked: b.walked } }));
  // project the branches onto the shape
  const bs = [...branches.values()].filter((b) => b.support.length);
  let answer;
  if (cls.plural) answer = { status: "plural", why: "identity contested", values: bs.map((b) => b.values[0]), contested: cls.contested };
  else if (!bs.length) answer = ground.absence === "closed" ? { status: "closed_absent", value: shape.kind === "count" ? 0 : false } : { status: "gap", gap: "absent_fact" };
  else if (shape.kind === "count") answer = { status: "ok", value: bs.reduce((n, b) => n + b.values.length, 0) };
  else if (shape.kind === "list" || shape.cardinality === "many") answer = { status: "ok", value: bs.flatMap((b) => b.values) };
  else {
    const latest = bs.map((b) => b.values[0]);
    const distinct = [...new Set(latest.map((v) => JSON.stringify(v)))];
    answer = distinct.length === 1 ? { status: "ok", value: latest[0] } : { status: "both", values: latest, why: "members of one identity class disagree" };
  }
  const support = bs.flatMap((b) => (one ? b.support.slice(0, 1) : b.support));
  const out = { answer, support, stops: stops.map((s) => s.id), walked, coneSize: cone.length, key };
  if (memo) memo.set(key, out);
  return { ...out, memoHit: false };
}
