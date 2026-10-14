// eval/void/run.mjs — run an arm over the frozen battery (eval/void/PREREG.md).
//   node eval/void/run.mjs L0 --record     the declared live recording pass for an arm (saves every response)
//   node eval/void/run.mjs L0              replay, offline; writes eval/void/results-<arm>.json
// Held per-row results are written to a separate file that the summary does not print (aggregates only until a stage closes).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkBattery, recordingFetch, score, voidFieldsScore, solvable, tally } from "./harness.mjs";
import { runSlotTurn, answerLine } from "../../fold-chat-answerwire.js";
import { makeMemo } from "../../fold-chat-web.js";
import { slotDeps } from "../../fold-chat-answerwire.js";
import { functionWordsOf } from "../../fold-chat-snippets.js";
import { declareAskVoid } from "../../fold-chat-void-declare.js";
import { universeOf, bindVoid } from "../../fold-chat-void-universe.js";
import { bornFill } from "../../fold-chat-void-born.js";
import { resolvePronouns } from "../../vendor/khora/native/adapters/text/pronouns.js";
import { ewt } from "./ewt.mjs";
// L3's role witness (Amendment 12): Callimachus's readClause + the EWT parse, from a khora checkout (node-only; 16 MB prior, not vendored)
const KP = "/Users/mlacy/Documents/3.0/khora-main-readclause/native/";
const { loadModel } = await import(KP + "adapters/text/english-parser.js");
const { readClause } = await import(KP + "organs/claim-realize.js");
const PARSER = loadModel(JSON.parse(fs.readFileSync(KP + "priors/parser-eng-ewt.json", "utf8")));
const inside = (sp, a, b) => !!sp && a >= sp.from && b <= sp.to;
function makeRoleGate({ strict }) {
  return (sl, f, aliases) => {
    if (!sl.sent || !sl.relTok) return { ok: null, refused: "no_verb_relation", strictOnly: strict };
    const rc = readClause(sl.sent, `${sl.ref}#${sl.start}`, { model: PARSER, predForm: sl.relTok });
    if (process.env.ROLE_DEBUG) console.error("ROLE", JSON.stringify({ rel: sl.relTok, sent: sl.sent.slice(0, 110), refusal: rc.refusal ? String(typeof rc.refusal === "string" ? rc.refusal : rc.refusal.why).slice(0, 60) : null }));
    if (rc.refusal) { const why = String(typeof rc.refusal === "string" ? rc.refusal : rc.refusal.why || rc.refusal.kind || "refused").replace(/[^a-z ]/gi, "").slice(0, 70); return { ok: null, refused: why, strictOnly: strict, keepOnRefuse: false }; }
    const c = rc.claim; if (!c || c.untrusted) return { ok: null, refused: "untrusted_parse", strictOnly: strict };
    const args = [c.subj, c.obj, ...(c.obls || [])].filter(Boolean);
    const fa = sl.inSent + f.start, fb = fa + String(f.value).length;
    const fi = args.findIndex((a) => inside(a, fa, fb));
    if (fi < 0) return { ok: false };
    // the anchor, as written in the sentence (longest alias occurrence)
    const low = sl.sent.toLowerCase();
    let ai = -1;
    for (const al of aliases) { const at = low.indexOf(String(al).toLowerCase()); if (at >= 0) { ai = args.findIndex((a) => inside(a, at, at + String(al).length)); break; } }
    if (ai < 0) return { ok: true, implied: true };       // the anchor is implied (kind / pronoun): the filler must lie in some argument
    return { ok: ai !== fi };                             // anchor and filler are DIFFERENT arguments of the same predicate
  };
}
// the khora's rich relation reader (S50) — node-only (reads the priors from disk); the browser surface reaches it through the khora's door
const { engineRelationsFor } = await import("/Users/mlacy/Documents/3.0/khora-terrain-induction/native/the-fold/reader-bundle.js");
import { morphologyFromPrior, createLemmatizer } from "../../vendor/khora/native/adapters/text/morphology.js";
// the received morphology prior (khora reads it from the workspace's janus/priors; the browser surface must reach it through the khora's door)
const MORPH = (() => { try { const p = morphologyFromPrior(JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../janus/priors/morphology-eng.json"), "utf8"))); return createLemmatizer(p.forms, { language: p.language }); } catch { return null; } })();
const sameAct = MORPH ? (a, b) => MORPH.sameAct(a, b) : null;   // the surface's own page memo (fold-chat.js: web.makeMemo())

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
  // L1: L0's answer unchanged (an answer is never altered by a layer that declares), plus the void the ask declares (perception + grammar + pathos)
  async L1(q, fetchImpl) {
    const base = await ARMS.L0(q, fetchImpl);
    const deps = slotDeps({ fetchImpl, memo: makeMemo(), lang: "en" });
    const v = await declareAskVoid(q, { fw: functionWordsOf("en"), lang: "en", resolveTitles: deps.resolveTitles });
    return { ...base, voidDecl: v.decl, anchorTitle: v.anchor ? v.anchor.title : base.anchorTitle, raw: { ...base.raw, void: v.fields, anchorBy: v.anchor ? v.anchor.by : null, experiencer: v.experiencer, voidGap: v.gap || null } };
  },
  // L1.1: L1 with the longest name (both witnesses) — Amendment 4
  async L1_1(q, fetchImpl) {
    const base = await ARMS.L0(q, fetchImpl);
    const deps = slotDeps({ fetchImpl, memo: makeMemo(), lang: "en" });
    const v = await declareAskVoid(q, { fw: functionWordsOf("en"), lang: "en", resolveTitles: deps.resolveTitles, longestName: true });
    return { ...base, voidDecl: v.decl, anchorTitle: v.anchor ? v.anchor.title : base.anchorTitle, raw: { ...base.raw, void: v.fields, anchorBy: v.anchor ? v.anchor.by : null }, _v: v, _deps: deps };
  },
  // L2′: L1.1 + the Born-weighed parliament (clause + engine witnesses), logos order, four corners — Amendments 4–7
  async L2b(q, fetchImpl) {
    const l11 = await ARMS.L1_1(q, fetchImpl);
    const { _v: v, _deps: deps, ...out } = l11;
    if (out.answer || !v.anchor || !v.fields.admits) return { ...out, raw: { ...out.raw, l2b: out.answer ? "kept-L0-answer" : "no-anchor-or-admits" } };
    let passages = [];
    try { passages = await deps.searchPassages({ referents: [{ surface: v.anchor.surface, title: v.anchor.title }], predicate: (v.frame && v.frame.ok ? v.frame.predicate : []) }); } catch { passages = []; }
    let engineEdges = [];
    try { engineEdges = engineRelationsFor(passages.map((p) => ({ ref: p.ref, text: p.text }))).edges || []; } catch (e) { engineEdges = []; }
    const E = ewt();
    const r = bornFill({ fields: v.fields, anchor: v.anchor, relationWords: v.relationWords, passages,
      organs: { sameAct, lemmasOf: E.lemmasOf, ewtEntry: E.entry, resolvePronouns, engineEdges } });
    const l2b = { verdict: r.verdict, bindings: r.bindings, nullTopMax: r.nullTopMax, top: r.candidates.slice(0, 3).map((c) => ({ v: String(c.value).slice(0, 30), M: c.mass, probable: c.probable, w: c.witnesses })), violations: r.orderViolations.length, gaps: r.gaps.map((g) => g.kind), kinds: r.kinds };
    if (r.verdict === "bound" && r.answer && r.answer.text) return { ...out, answer: r.answer.text, raw: { ...out.raw, l2b: { ...l2b, at: r.answer.at } } };
    return { ...out, raw: { ...out.raw, l2b } };
  },
  // L1.2: the longest name from the ask's own runs (Amendment 9)
  async L1_2(q, fetchImpl) {
    const base = await ARMS.L0(q, fetchImpl);
    const deps = slotDeps({ fetchImpl, memo: makeMemo(), lang: "en" });
    const v = await declareAskVoid(q, { fw: functionWordsOf("en"), lang: "en", resolveTitles: deps.resolveTitles, longestRun: true });
    return { ...base, voidDecl: v.decl, anchorTitle: v.anchor ? v.anchor.title : base.anchorTitle, raw: { ...base.raw, void: v.fields, anchorBy: v.anchor ? v.anchor.by : null }, _v: v, _deps: deps };
  },
  async L2c(q, fetchImpl) { return l2cArm(q, fetchImpl, { orderOn: true }); },
  async L2c_noorder(q, fetchImpl) { return l2cArm(q, fetchImpl, { orderOn: false }); },
  // L3 (Amendment 12): L2d + the role witness as a gate
  async L3_soft(q, fetchImpl) { return l2cArm(q, fetchImpl, { orderOn: true, nullMode: "relation", roleGate: makeRoleGate({ strict: false }) }); },
  async L3_strict(q, fetchImpl) { return l2cArm(q, fetchImpl, { orderOn: true, nullMode: "relation", roleGate: makeRoleGate({ strict: true }) }); },
  async L3_noengine(q, fetchImpl) { return l2cArm(q, fetchImpl, { orderOn: true, nullMode: "relation", roleGate: makeRoleGate({ strict: false }), engineOn: false }); },
  // L2d (Amendment 11): L2c with the relation-counterfactual Born null
  async L2d(q, fetchImpl) { return l2cArm(q, fetchImpl, { orderOn: true, nullMode: "relation" }); },
  // L2: the referent's universe — L1 plus, where L0 gave no answer, the void's open edge bound by clause (PREREG Amendment 2)
  async L2(q, fetchImpl) {
    const base = await ARMS.L0(q, fetchImpl);
    const deps = slotDeps({ fetchImpl, memo: makeMemo(), lang: "en" });
    const v = await declareAskVoid(q, { fw: functionWordsOf("en"), lang: "en", resolveTitles: deps.resolveTitles });
    const out = { ...base, voidDecl: v.decl, anchorTitle: v.anchor ? v.anchor.title : base.anchorTitle, raw: { ...base.raw, void: v.fields } };
    if (base.answer || !v.anchor || !v.fields.admits) return { ...out, raw: { ...out.raw, l2: base.answer ? "kept-L0-answer" : "no-anchor-or-admits" } };
    let passages = [];
    try { passages = await deps.searchPassages({ referents: [{ surface: v.anchor.surface, title: v.anchor.title }], predicate: (v.frame && v.frame.ok ? v.frame.predicate : []) }); } catch (e) { passages = []; }
    const u = universeOf({ anchor: v.anchor, passages });
    const b = bindVoid(v.fields, u, { sameAct, relationWords: v.relationWords });
    const l2 = { pages: passages.map((p) => p.title), kinds: u.kinds.map((k) => k.kindKey), edges: b.edges.length, fillers: b.fillers.map((f) => ({ key: f.key, value: f.value, n: f.edges.length, about: [...new Set(f.edges.map((e) => e.about))] })) };
    if (b.fillers.length === 1) return { ...out, answer: b.fillers[0].edges[0].text, raw: { ...out.raw, l2: { ...l2, answered: true, at: `${b.fillers[0].edges[0].ref}#${b.fillers[0].edges[0].start}-${b.fillers[0].edges[0].end}` } } };
    return { ...out, raw: { ...out.raw, l2: { ...l2, answered: false, why: b.fillers.length ? "contest" : "no-edge" } } };
  },
};

// L2c (Amendment 9): L1.2 + bornFill with strict engine co-reference, sentence instances, the per-candidate Born null; order on/off
async function l2cArm(q, fetchImpl, { orderOn, nullMode = "filler", roleGate = null, engineOn = true, tag = "l2c" }) {
  const l12 = await ARMS.L1_2(q, fetchImpl);
  const { _v: v, _deps: deps, ...out } = l12;
  if (out.answer || !v.anchor || !v.fields.admits) return { ...out, raw: { ...out.raw, l2c: out.answer ? "kept-L0-answer" : "no-anchor-or-admits" } };
  let passages = [];
  try { passages = await deps.searchPassages({ referents: [{ surface: v.anchor.surface, title: v.anchor.title }], predicate: (v.frame && v.frame.ok ? v.frame.predicate : []) }); } catch { passages = []; }
  let engineEdges = [];
  try { engineEdges = engineRelationsFor(passages.map((p) => ({ ref: p.ref, text: p.text }))).edges || []; } catch { engineEdges = []; }
  const E = ewt();
  const r = bornFill({ fields: v.fields, anchor: v.anchor, relationWords: v.relationWords, passages, strictCorefer: true, perCandidateNull: true, orderOn, nullMode, roleGate, engineOn,
    organs: { sameAct, lemmasOf: E.lemmasOf, ewtEntry: E.entry, resolvePronouns, engineEdges } });
  const l2c = { verdict: r.verdict, bindings: r.bindings, top: r.candidates.slice(0, 3).map((c) => ({ v: String(c.value).slice(0, 30), M: c.mass, nullOwn: c.nullOwn, probable: c.probable, w: c.witnesses })), violations: r.orderViolations.length, gaps: r.gaps.map((g) => g.kind), role: r.role };
  if (r.verdict === "bound" && r.answer && r.answer.text) return { ...out, answer: r.answer.text, raw: { ...out.raw, l2c: { ...l2c, at: r.answer.at } } };
  return { ...out, raw: { ...out.raw, l2c } };
}

async function pool(items, n, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } }));
  return out;
}

export async function runArm(arm, { record = false, log = () => {} } = {}) {
  const rows = checkBattery();
  const fetchImpl = recordingFetch(record ? "record" : "replay", { log });
  const outs = await pool(rows, record ? 1 : 6, async (r) => {   // Amendment 10: record one ask at a time
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
