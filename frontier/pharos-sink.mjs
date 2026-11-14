// frontier/pharos-sink.mjs — every frontier log event ALSO woven into pharos, the shared log (Michael, relayed 2026-11-14: "make sure it's
// all getting written stigmergically in the shroud"; shroud = pharos). Mirrors khora branch wilson-trails-to-pharos organs/trail-pharos.mjs.
// frontier knows nothing of pharos but a POINTER { lib, sha256 }: $FRONTIER_PHAROS_JSON, else <the-fold root>/pharos.json (the file the
// pharos door writes on install). No pointer, or a lib whose bytes do not match: the sink is OFF and status() says why.
// A failed weave never breaks the apparatus: it is counted and kept as lastError.
// Entries: kind `frontier-<logkind>`, declared on first use at a PROPOSED cell (this file's proposal, not a measured assignment);
// addr frontier:<run>:<event id>; body = the event (id, seq, by, deps, hash, body); `of` = the pharos ids of the event's deps, so the
// dependency DAG is the same in pharos. Writer "frontier" (one writer per file).
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const CELL_OF = Object.freeze({ // proposal, declared here; givers may amend
  source: "INS·Ground", span: "INS·Ground", fact: "INS·Figure", claim: "SYN·Figure", goal: "DEF·Figure", question: "DEF·Figure", shape: "DEF·Figure", ground: "DEF·Pattern",
  call: "SIG·Figure", answer: "SYN·Pattern", instrument: "CON·Figure", verdict: "EVA·Figure", flag: "EVA·Figure", contest: "EVA·Pattern", route: "CON·Pattern",
  stop: "NUL·Pattern", gap: "NUL·Figure", refusal: "NUL·Figure", surf_miss: "NUL·Figure", memo_hit: "REC·Figure", same: "CON·Figure", cannot_link: "SEG·Figure", unsame: "SEG·Figure", retract: "NUL·Figure",
});

export async function openPharosSink({ pointer = null, name = "frontier", dir = undefined, run = "run" } = {}) {
  const state = { on: false, why: "not opened", woven: 0, failed: 0, lastError: null, dir: null };
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const ptrPath = pointer ?? process.env.FRONTIER_PHAROS_JSON ?? join(root, "pharos.json");
  let P = null, h = null;
  const idmap = new Map();
  try {
    if (!existsSync(ptrPath)) { state.why = `no pharos pointer at ${ptrPath}: events stay in frontier's own log only`; }
    else {
      const ptr = JSON.parse(readFileSync(ptrPath, "utf8"));
      const lib = resolve(dirname(ptrPath), String(ptr.lib));
      const got = createHash("sha256").update(readFileSync(lib)).digest("hex");
      if (got !== ptr.sha256) state.why = `pharos lib ${lib} is not the pinned one (${got.slice(0, 12)} vs ${String(ptr.sha256).slice(0, 12)})`;
      else { P = await import(pathToFileURL(lib).href); h = P.open(name, { writer: "frontier", ...(dir ? { dir } : {}) }); Object.assign(state, { on: true, why: "open", dir: h.dir }); }
    }
  } catch (e) { state.why = `could not open pharos: ${e?.message ?? e}`; state.lastError = String(e?.message ?? e); }
  const declared = new Set();
  const sink = (e) => {
    if (!h) return null;
    try {
      const kind = `frontier-${e.kind}`, cell = CELL_OF[e.kind] ?? "SIG·Ground";
      if (!declared.has(kind)) {
        if (!P.ground(h).kinds.some((k) => k.name === kind)) P.weave(h, { cell: "DEF·Figure", kind: "kind", addr: `kind:${kind}`, body: { name: kind, cell, why: `frontier log event of kind ${e.kind} (cell proposed by frontier/pharos-sink.mjs)` } });
        declared.add(kind);
      }
      const of = e.deps.map((d) => idmap.get(d)).filter(Boolean);
      const w = P.weave(h, { cell, kind, addr: `frontier:${run}:${e.id}`, body: { id: e.id, seq: e.seq, by: e.by, deps: e.deps, hash: e.hash, body: e.body }, of });
      idmap.set(e.id, w.id); state.woven++;
      return w.id;
    } catch (err) { state.failed++; state.lastError = String(err?.message ?? err); return null; }
  };
  return { sink, status: () => ({ ...state }), fold: (filter = {}) => (h ? P.fold(h, filter) : null) };
}
