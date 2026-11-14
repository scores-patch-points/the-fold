// frontier/log.mjs — ORGAN 1, the Log. Append-only, hash-chained, bylined events in dependency order.
// Every input, fetched page, span, turn, model call, answer, verdict, stop and refusal is an event here; no organ keeps hidden state.
//   makeLog({ path?, now? }) → log
//   log.append({ kind, by, deps?, body }) → event   (deps must already be in the log: dependency order is enforced, never assumed)
//   log.get(id) · log.all() · log.byKind(kind) · log.heads() · log.verify() → { ok, at? }
// Event: { id, seq, kind, by, deps, at, body, prev, hash }. `by` (the byline) is required: an unbylined event is refused.
import { createHash } from "node:crypto";
import { appendFileSync, readFileSync, existsSync } from "node:fs";

const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x));
export const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const hashOf = (e) => sha256(canon({ seq: e.seq, kind: e.kind, by: e.by, deps: e.deps, at: e.at, body: e.body, prev: e.prev }));

export function makeLog({ path = null, now = () => Date.now(), sink = null } = {}) {
  const events = [];
  const index = new Map();
  const referenced = new Set();
  const kinds = new Map();
  const push = (e) => {
    events.push(e); index.set(e.id, e);
    for (const d of e.deps) referenced.add(d);
    if (!kinds.has(e.kind)) kinds.set(e.kind, []);
    kinds.get(e.kind).push(e);
  };
  if (path && existsSync(path)) for (const line of readFileSync(path, "utf8").split("\n")) if (line.trim()) push(JSON.parse(line));

  const log = {
    append({ kind, by, deps = [], body = {} }) {
      if (!kind || !by) throw new TypeError("log.append: kind and by (the byline) are required");
      for (const d of deps) if (!index.has(d)) throw new RangeError(`log.append: dep ${d} is not in the log (dependency order)`);
      const seq = events.length;
      const prev = seq ? events[seq - 1].hash : null;
      const e = { id: `ev${seq}`, seq, kind, by, deps: [...new Set(deps)], at: now(), body, prev };
      e.hash = hashOf(e);
      Object.freeze(e);
      push(e);
      if (path) appendFileSync(path, JSON.stringify(e) + "\n");
      if (sink) { try { sink(e); } catch { /* a mirror never breaks the log */ } }
      return e;
    },
    get: (id) => index.get(id) ?? null,
    has: (id) => index.has(id),
    all: () => events,
    size: () => events.length,
    byKind: (k) => kinds.get(k) ?? [],
    heads: (filter = () => true) => events.filter((e) => filter(e) && !referenced.has(e.id)).map((e) => e.id),
    verify() {
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        if (e.prev !== (i ? events[i - 1].hash : null) || e.hash !== hashOf(e)) return { ok: false, at: e.id };
      }
      return { ok: true };
    },
  };
  return log;
}
