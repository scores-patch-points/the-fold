// frontier/penelope-sink.mjs — every frontier log event is ALSO sent to pharos (the shared log), THROUGH PENELOPE, never directly.
// Michael's ruling (relayed by the "Wilson's ants" session, 2026-11-14): ants and organs write to pharos through Penelope's mark door;
// she is the only writer. Door: POST {PENELOPE_WEAVE_URL}/v1/weave/mark with
//   { by, log, kind, cell, addr, body, of?, basis?, witness: { how }, declare?: { why } }
// Loopback only. No URL configured, the door unreachable, or a refusal: the event is COUNTED and NOT written by any other path.
// The local hash-chained log stays the record the apparatus folds; the mark is the shared second record.
// Cells are this file's PROPOSAL per log kind (not a measured assignment). `of` carries the marks of the event's deps where known.
// Cells follow the EOQL 27-command table (ledgers/pharos-eoql/EOQL-COMMANDS.html): bare operator = Figure, OP- = Ground (declarations),
// OP+ = Pattern (built on top / written back). The mapping of frontier log kinds onto those commands is THIS FILE's proposal.
export const EOQL_OF = Object.freeze({
  source: "INS", span: "INS", fact: "INS",          // make a thing
  ground: "DEF-",                                     // fix the ground (as of when)
  shape: "DEF+", question: "DEF+", goal: "DEF+",      // define a view: the question shape / the goal
  call: "SIG",                                        // attend: the mouth sees only some of the things (one seam)
  instrument: "SYN",                                  // merge or count things
  claim: "CON",                                       // link or trace things: one step of a chain
  same: "SYN", cannot_link: "SEG", unsame: "SEG",     // merge / cut identity
  verdict: "EVA", flag: "EVA", contest: "EVA",        // judge things
  route: "CON",                                       // a contest linked to where it is landed
  answer: "INS+",                                     // write a pattern back
  memo_hit: "SIG+",                                   // see a pattern already written
  stop: "NUL+", gap: "NUL", refusal: "NUL", surf_miss: "NUL", retract: "NUL", // what is missing; a stop: nothing further changes the fold
});
const GRAIN = { "-": "Ground", "": "Figure", "+": "Pattern" };
export const cellOf = (cmd) => `${cmd.replace(/[-+]$/, "")}·${GRAIN[cmd.match(/[-+]?$/)[0]]}`;
export const CELL_OF = Object.freeze(Object.fromEntries(Object.entries(EOQL_OF).map(([k, c]) => [k, cellOf(c)])));

export function makePenelopeSink({ url = process.env.PENELOPE_WEAVE_URL ?? null, log = "frontier", run = "run", fetchImpl = globalThis.fetch, kinds = null } = {}) {
  const state = { on: false, why: "", sent: 0, refused: 0, unreachable: 0, skipped: 0, lastError: null };
  let base = null;
  if (!url) state.why = "PENELOPE_WEAVE_URL not set: events stay in frontier's own log only";
  else {
    try { const u = new URL(url); if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(u.hostname)) state.why = `${url} is not loopback: refused`; else { base = url.replace(/\/$/, ""); state.on = true; state.why = "configured"; } }
    catch { state.why = `bad PENELOPE_WEAVE_URL ${url}`; }
  }
  const declared = new Set(), marks = new Map(), pending = [];
  const sink = (e) => {
    if (!base) { state.skipped++; return; }
    if (kinds && !kinds.includes(e.kind)) return;
    const kind = `frontier-${e.kind}`;
    const body = {
      by: e.by, log, kind, cell: CELL_OF[e.kind] ?? "SIG·Ground", addr: `frontier:${run}:${e.id}`,
      body: { id: e.id, seq: e.seq, deps: e.deps, hash: e.hash, body: e.body },
      basis: { eoql: `${EOQL_OF[e.kind] ?? "SIG"} ${e.kind}:${e.id}` },
      of: e.deps.map((d) => marks.get(d)).filter(Boolean),
      witness: { how: e.kind === "verdict" || e.kind === "flag" ? `frontier ${e.by}` : `frontier hash-chained log ${e.hash.slice(0, 16)}` },
      ...(declared.has(kind) ? {} : { declare: { why: `frontier log event of kind ${e.kind} (cell proposed by frontier/penelope-sink.mjs)` } }),
    };
    declared.add(kind);
    const p = fetchImpl(`${base}/v1/weave/mark`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      .then(async (r) => { if (!r.ok) { state.refused++; state.lastError = `${r.status} ${(await r.text()).slice(0, 120)}`; declared.delete(kind); return; } const j = await r.json().catch(() => ({})); if (j.id) marks.set(e.id, j.id); state.sent++; })
      .catch((err) => { state.unreachable++; state.lastError = String(err?.message ?? err); declared.delete(kind); });
    pending.push(p);
  };
  return { sink, status: () => ({ ...state }), flush: () => Promise.all(pending.splice(0)) };
}
