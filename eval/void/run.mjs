// eval/void/run.mjs — run an arm over the frozen battery (eval/void/PREREG.md).
//   node eval/void/run.mjs L0 --record     the declared live recording pass for an arm (saves every response)
//   node eval/void/run.mjs L0              replay, offline; writes eval/void/results-<arm>.json
// Held per-row results are written to a separate file that the summary does not print (aggregates only until a stage closes).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkBattery, recordingFetch, score, voidFieldsScore, solvable, tally } from "./harness.mjs";
import { runSlotTurn, answerLine } from "../../fold-chat-answerwire.js";
import { makeMemo } from "../../fold-chat-web.js";   // the surface's own page memo (fold-chat.js: web.makeMemo())

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NOW = new Date("2026-10-14T12:00:00Z");   // the battery's date (passed to the probes; never the wall clock)

/** The arms. Each returns { answer, voidDecl, anchorTitle, raw } for one ask. L0 is the pipeline as merged. */
export const ARMS = {
  async L0(q, fetchImpl) {
    const turn = await runSlotTurn({ question: q, lang: "en", webPassages: [], now: NOW, fetchImpl, signal: null, memo: makeMemo(), timeBoxMs: 120000 });
    const handoff = turn && turn.handoff ? turn.handoff.kind : null;
    const answer = handoff ? null : answerLine(turn) || null;
    const anchorTitle = turn?.frame?.referents?.[0]?.title || null;
    return { answer, voidDecl: null, anchorTitle, raw: { handoff, gap: turn?.gap?.kind || null, slot: turn?.frame?.slot || null } };
  },
};

async function pool(items, n, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } }));
  return out;
}

export async function runArm(arm, { record = false, log = () => {} } = {}) {
  const rows = checkBattery();
  const fetchImpl = recordingFetch(record ? "record" : "replay", { log });
  const outs = await pool(rows, record ? 3 : 6, async (r) => {
    try { return await ARMS[arm](r.q, fetchImpl); } catch (e) { return { answer: null, voidDecl: null, anchorTitle: null, raw: { error: String(e?.message || e) } }; }
  });
  const scores = rows.map((r, i) => score(r, outs[i]));
  const fields = rows.map((r, i) => voidFieldsScore(r, outs[i]));
  const fieldTotals = (set) => { const t = { slot: 0, admits: 0, anchor: 0, relation: 0, cardinality: 0, n: 0 }; rows.forEach((r, i) => { if (set && r.set !== set) return; t.n++; for (const k of Object.keys(fields[i])) if (fields[i][k]) t[k]++; }); return t; };
  return {
    arm, record, at: NOW.toISOString(),
    fetch: { live: fetchImpl.stats.live, hits: fetchImpl.stats.hits, misses: fetchImpl.stats.misses.length, hosts: fetchImpl.stats.hosts },
    dev: tally(rows, scores, "dev"), held: tally(rows, scores, "held"), all: tally(rows, scores),
    voidFields: { dev: fieldTotals("dev"), held: fieldTotals("held") },
    rows: rows.map((r, i) => ({ id: r.id, set: r.set, q: r.q, tier: scores[i].tier, informative: scores[i].informative ?? null, answer: outs[i].answer, raw: outs[i].raw, solvable: solvable(r) })),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arm = process.argv[2] || "L0";
  const record = process.argv.includes("--record");
  const res = await runArm(arm, { record, log: record ? (s) => process.stderr.write(s + "\n") : () => {} });
  const dev = { ...res, rows: res.rows.filter((r) => r.set === "dev") };
  const held = { ...res, rows: res.rows.filter((r) => r.set === "held") };
  fs.writeFileSync(path.join(HERE, `results-${arm}${record ? "-record" : ""}.json`), JSON.stringify(dev, null, 1) + "\n");
  fs.writeFileSync(path.join(HERE, `results-${arm}${record ? "-record" : ""}.held.json`), JSON.stringify(held, null, 1) + "\n");
  console.log(JSON.stringify({ arm, record, fetch: res.fetch, dev: res.dev, held: res.held, voidFields: res.voidFields }, null, 1));
}
