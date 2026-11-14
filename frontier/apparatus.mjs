// frontier/apparatus.mjs — the wiring. The model is the mouth; it speaks only at seams the apparatus cannot close.
//   makeApparatus({ log, mouth, ground, switches }) → { ask(fields) → result, readerState() }
// Order per question: shape (3) → wave fold over facts (4, identity 5) → instruments for numeric/date kinds (6) → only if the fold leaves
// a gap on a value slot: a READ SEAM — retrieve spans (index), assemble within B (7), mouth (8), witness (9), write-back the read fact (10).
// Chains are walked one hop per seam (6: seam decomposition). Reader state (11) folds turns. Every step is an event.
// switches (ablations): { stopRule, memo, instruments, witnesses, identity, writeBack, k }
import { makeShape } from "./shape.mjs";
import { wave, makeMemo } from "./fold.mjs";
import { runInstrument } from "./instruments.mjs";
import { assemble } from "./assemble.mjs";
import { witness, regressionGate } from "./witness.mjs";
import { makeIndex } from "./index.mjs";
import { OverBudget } from "./mouth.mjs";
import { identityAt } from "./identity.mjs";
import { readSpansWithJanus } from "./janus-read.mjs";

export const READ_SCHEMA = { type: "object", properties: { value: { type: ["string", "null"] }, cite: { type: "array", items: { type: "string" } } }, required: ["value", "cite"] };
const READ_SYSTEM = "You answer ONE slot from the evidence lines only. Each line starts with [event-id]. Reply as JSON {\"value\": string or null, \"cite\": [event-ids you used]}. If the evidence does not state the answer, value is null. Give the shortest exact value (a name, number, date or place), copied from the evidence.";

export function makeApparatus({ log, mouth = null, ground, contentOf = null, switches = {} }) {
  const sw = { stopRule: true, memo: true, instruments: true, witnesses: true, writeBack: true, identity: true, k: 8, ...switches };
  const memo = sw.memo ? makeMemo() : null;
  const index = makeIndex(log);
  const turns = [];

  async function readSeam(shape, deps) {
    if (!mouth) { log.append({ kind: "gap", by: "apparatus", deps, body: { gap: "no_mouth", slot: shape.relation } }); return null; }
    const names = sw.identity && shape.anchor ? identityAt(log).classOf(shape.anchor).members : [shape.anchor];
    const q = [...names, String(shape.relation ?? "").replace(/_/g, " "), shape.slot].filter(Boolean).join(" ");
    const ids = index.search(q, sw.k);
    if (!ids.length) { log.append({ kind: "gap", by: "apparatus", deps, body: { gap: "surf_needed", query: q } }); return null; }
    const { calls, refused } = assemble({ log, B: mouth.B, system: READ_SYSTEM, seam: `read:${shape.relation}`, shape: { anchor: shape.anchor, relation: shape.relation, slot: shape.slot }, spanIds: ids, contentOf, schema: READ_SCHEMA });
    for (const r of refused) log.append({ kind: "gap", by: "assembler", deps, body: r });
    for (const c of calls) {
      let res;
      try { res = await mouth.ask({ system: c.system, user: c.user, schema: READ_SCHEMA, seam: c.seam, deps: [...deps, ...c.spanIds] }); }
      catch (e) { if (e instanceof OverBudget) continue; throw e; }
      const v = res.value ?? {};
      if (v.value == null || v.value === "") continue;
      const cites = (Array.isArray(v.cite) ? v.cite : []).filter((id) => c.spanIds.includes(id));
      const anchors = shape.anchor ? (sw.identity ? identityAt(log).classOf(shape.anchor).members : [shape.anchor]) : [];
      const w = sw.witnesses ? witness(log, { value: v.value, cites: cites.length ? cites : c.spanIds, shapeKey: null, slot: sw.slotWitness === false ? null : { anchors, relation: shape.relation } }) : { verdict: "unwitnessed" };
      if (sw.witnesses && w.verdict !== "supported") continue;
      return { value: v.value, cites: cites.length ? cites : c.spanIds, call: res.call, verdict: w.verdict };
    }
    return null;
  }

  async function resolve(fields, parentDeps = []) {
    const { shape, key, missing, event: sev } = makeShape(fields, { log, deps: parentDeps });
    if (missing.length) return { status: "gap", gap: "unmet_shape", missing, deps: [sev.id] };
    const deps = [sev.id];
    // composite kinds: resolve dependencies, then an instrument (never the model)
    if (["sum", "diff", "compare", "ratio", "daysBetween", "before", "greater"].includes(fields.kind ?? shape.kind) || (shape.dependency?.length && shape.composition === "aggregate")) {
      const parts = [];
      for (const d of shape.dependency) { const r = await resolve(d, deps); if (r.status !== "ok") return { status: "gap", gap: "dependency_gap", detail: r, deps }; parts.push(r); }
      const name = fields.instrument ?? { sum: "sum", diff: "diff", compare: "greater", ratio: "ratio", daysBetween: "daysBetween", before: "before", greater: "greater" }[shape.kind];
      if (!sw.instruments) { // ABLATION: the model does the arithmetic (what the apparatus forbids)
        if (!mouth) return { status: "gap", gap: "no_mouth", deps };
        const res = await mouth.ask({ system: "Compute exactly. Reply JSON {\"value\": number or boolean}.", user: `Operation: ${name}\nInputs in order: ${parts.map((p) => JSON.stringify(p.value)).join(", ")}`, schema: { type: "object", properties: { value: { type: ["number", "boolean"] } }, required: ["value"] }, seam: `arith:${name}`, deps });
        return { status: "ok", value: res.value?.value ?? null, support: [res.call.id, ...parts.flatMap((p) => p.support)], via: "model-arith" };
      }
      const r = runInstrument(log, name, parts.map((p) => p.value), { deps: [...deps, ...parts.flatMap((p) => p.support).filter((id) => log.has(id))] });
      return r.ok ? { status: "ok", value: r.value, support: [r.event.id, ...parts.flatMap((p) => p.support)], via: "instrument" } : { status: "gap", gap: r.gap, deps };
    }
    // chains: one hop per seam
    if (shape.composition === "chain") {
      let anchor = shape.anchor; const support = [];
      for (const rel of shape.dependency) {
        const r = await resolve({ anchor, relation: rel, kind: "entity" }, deps);
        if (r.status !== "ok") return { status: "gap", gap: "chain_broken", at: rel, anchor, hops: support.length, deps };
        support.push(...r.support); anchor = r.value;
      }
      return { status: "ok", value: anchor, support, via: "chain" };
    }
    const f = wave({ log, shape, ground, memo, stopRule: sw.stopRule, deps });
    if (f.answer.status === "ok") {
      if (shape.kind === "count" && sw.instruments) { const r = runInstrument(log, "count", f.support, { deps: f.support }); return { status: "ok", value: r.value, support: [r.event.id, ...f.support], via: "fold+instrument" }; }
      return { status: "ok", value: f.answer.value, support: f.support, via: f.memoHit ? "memo" : "fold" };
    }
    if (f.answer.status !== "gap") return { status: f.answer.status, values: f.answer.values, support: f.support, via: "fold" };
    // the fold left a gap on a value slot. JANUS FIRST (switch `janus`): read the retrieved spans through Janus's grammar into facts, fold again.
    if (sw.janus) {
      const names = sw.identity && shape.anchor ? identityAt(log).classOf(shape.anchor).members : [shape.anchor];
      const ids = index.search([...names, String(shape.relation ?? "").replace(/_/g, " ")].filter(Boolean).join(" "), sw.k);
      await readSpansWithJanus(log, ids, { reuse: sw.writeBack });
      const f2 = wave({ log, shape, ground, memo: null, stopRule: sw.stopRule, deps });
      if (f2.answer.status === "ok") return { status: "ok", value: f2.answer.value, support: f2.support, via: "janus+fold" };
      if (f2.answer.status !== "gap") return { status: f2.answer.status, values: f2.answer.values, support: f2.support, via: "janus+fold" };
      if (sw.janusOnly) { const g = log.append({ kind: "gap", by: "apparatus", deps, body: { gap: "absent_fact", anchor: shape.anchor, relation: shape.relation, after: "janus" } }); return { status: "gap", gap: "absent_fact", deps: [g.id] }; }
    }
    // the one seam the apparatus cannot close by itself: the mouth
    const r = await readSeam(shape, deps);
    if (!r) { const g = log.append({ kind: "gap", by: "apparatus", deps, body: { gap: "absent_fact", anchor: shape.anchor, relation: shape.relation } }); return { status: "gap", gap: "absent_fact", deps: [g.id] }; }
    let support = r.cites;
    if (sw.writeBack) {
      const value = sw.traceShuffle ? sw.traceShuffle(shape.relation, r.value) : r.value; // ABLATION ONLY: poisoned traces
      const fe = log.append({ kind: "fact", by: `mouth:${mouth.model}`, deps: [r.call.id, ...r.cites], body: { anchor: shape.anchor, relation: shape.relation, value, read: true } }); support = [fe.id, ...r.cites];
    }
    return { status: "ok", value: r.value, support, via: "seam", verdict: r.verdict };
  }

  return {
    index,
    async ask(fields, { turn = null } = {}) {
      const q = log.append({ kind: "question", by: "asker", body: { fields, turn } });
      const r = await resolve(fields, [q.id]);
      const { key } = makeShape(fields, {});
      const a = log.append({ kind: "answer", by: "apparatus", deps: [q.id, ...(r.support ?? []).filter((id) => log.has(id))], body: { status: r.status, value: r.value ?? null, values: r.values ?? null, gap: r.gap ?? null, via: r.via ?? null, shapeKey: key } });
      if (sw.witnesses && r.status === "ok") regressionGate(log, { shapeKey: key, value: r.value, answerId: a.id });
      turns.push({ q: q.id, a: a.id, support: r.support ?? [] });
      return { ...r, answerId: a.id };
    },
    // ORGAN 11 — reader state is a FOLD of the turns (what the reader has been shown), not an appended transcript
    readerState() {
      const seen = new Set(); const slots = new Map();
      for (const t of turns) { for (const id of t.support) seen.add(id); const a = log.get(t.a); slots.set(a.body.shapeKey, a.body.value); }
      return { seen, slots, turns: turns.length };
    },
    novelty(ids) { const s = this.readerState().seen; return ids.filter((id) => !s.has(id)); },
  };
}
