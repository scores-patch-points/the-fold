// eval/wald/calibrate.mjs — Wald vs the gate the surface runs today, on the pre-registered gold (eval/wald/PREREG.md).
//   node eval/wald/calibrate.mjs            measure, print, write eval/wald/results.json and eval/wald/calibration.json
// The witnesses are the surface's REAL organs, called with the inputs fold-chat.js gives them on a fresh session.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { classifyTurn } from "../../fold-chat-discourse.js";
import { skipsSearch } from "../../fold-chat-kinds.js";
import { planTurn } from "../../fold-chat-flow.js";
import { describeOutput } from "../../fold-chat-outputtype.js";
import { lookupWarranted } from "../../fold-chat-self.js";
import { recallOf } from "../../fold-chat-recall.js";
import { liveAsk } from "../../fold-chat-gaps.js";
import { functionWordsOf } from "../../fold-chat-snippets.js";
import { detectLang, threadLanguage } from "../../fold-chat-lang.js";
import { hintsFor } from "../../fold-chat-hints.js";
import { urlOf } from "../../fold-chat-web.js";
import { pre as watchPre, batonReply, inspectReply, challengeReply } from "../../fold-chat-watch.js";
import { sourceRecall } from "../../fold-chat-sourceask.js";
import { witnessVotes } from "../../fold-chat-wald.js";
import { measureRatios, waldDecide, PULLS } from "../../vendor/khora/native/organs/wald.js";
import { CORPUS, PRIORS } from "../ants/g1/corpus.mjs";
import { CORPUS2 } from "../ants/g1/corpus2.mjs";
import { CORPUS3, PRIORS3 } from "../ants/g1/corpus3.mjs";
import { CORPUS4 } from "../ants/g1/corpus4.mjs";
import { CORPUS5 } from "../ants/g1/corpus5.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const YEAR = 2026;   // the run's year, passed to liveAsk (the clock is the caller's)
const SEED = 20261014, SHUFFLES = 200;

/** The signals fold-chat.js computes for a turn (lines ~2270-2552) from the prior messages: no claims, no referents, no shelf.
 *  The read-backs (PREREG Amendment 2) are computed exactly as fold-chat.js:2528-2539 does; on a prior with no assistant reply they come out null. */
export function signalsOf(said, prior = []) {
  const lang0 = detectLang(said, { prior: threadLanguage(prior) }).lang;
  const hl = lang0 === "unknown" ? "en" : lang0;
  const follow = planTurn(said, prior, { referents: null, rejected: [], hints: hintsFor(hl), lang: lang0, casts: null });
  let watcherPre = null;
  try { watcherPre = watchPre({ ask: said, prior, opts: { referents: null, rejected: [], hints: hintsFor(hl), lang: lang0 } }); } catch { watcherPre = null; }
  const question = follow.retry || said;
  let outType = null;
  try { outType = describeOutput(question, { prior, hasMaterial: false }); } catch { outType = null; }
  const producing = !!outType?.wants && follow.mode === "web" && outType.type !== "code" && outType.type !== "translation" && outType.type !== "rewrite";
  const kind = classifyTurn(question, { hasMaterial: false });
  const fw = functionWordsOf(hl);
  const lookup = !skipsSearch(kind) && !!question && follow.mode === "web" ? lookupWarranted({ question, follow, fw }) : null;
  const recall = !skipsSearch(kind) && !!question && follow.mode === "web" ? recallOf({ question, claims: [], fw }) : null;
  // the read-backs, in fold-chat.js's order
  const watchText = watcherPre && follow.mode !== "cold-gap" ? (watcherPre.want === "inspect" ? inspectReply(prior, said) : null) : null;
  let srcRecall = follow.kind === "source-ask" && follow.mode === "web" ? sourceRecall(prior, said) : null;
  if (!srcRecall && !watchText && watcherPre && follow.kind === "source-ask" && follow.mode === "web") { const br = batonReply(watcherPre); if (br) srcRecall = { provenance: null, turn: null, text: br, fromBaton: true }; }
  if (!srcRecall && watchText) srcRecall = { provenance: null, turn: null, text: watchText, fromBaton: true, inspect: true };
  if (!srcRecall && watcherPre && follow.mode === "thread") { const cr = challengeReply(watcherPre, prior); if (cr) srcRecall = { provenance: cr.provenance, turn: null, text: cr.text, fromBaton: true, challenge: true }; }
  const primaryAsk = !srcRecall && follow.kind === "source-ask" && follow.mode === "web" && watcherPre && watcherPre.sub === "new" && watcherPre.thread && watcherPre.thread.has && String(watcherPre.thread.answer || "").trim()
    ? { claim: String(watcherPre.thread.answer).replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/)[0], turn: watcherPre.thread.turn } : null;
  const activeGap = !!(producing && outType.voidIfMissing.some((g) => g.active === true));
  const urlAsk = (() => { try { return urlOf(String(said || "")); } catch { return null; } })();
  const live = liveAsk(question, { year: YEAR });
  return { kind, follow, outType, producing, lookup, recall, srcRecall, primaryAsk, activeGap, hasMaterial: false, urlAsk, bookask: null, live, lang: lang0, closedClass: !!(fw && fw.size), want: watcherPre?.want ?? null, wantSub: watcherPre?.sub ?? null, question };
}

/** fold-chat.js:2532, rebuilt from the same signals. */
export function gateNow(s) {
  const noLookup = !!(s.lookup && !s.lookup.warranted);
  const needlessSearch = s.producing && !s.outType.needsSources;
  return (!skipsSearch(s.kind) && !!s.question && s.follow.mode === "web" && !noLookup && !s.recall && !s.srcRecall && !s.primaryAsk && !needlessSearch && !s.activeGap) || !!s.urlAsk;
}

function goldRows() {
  const cases = JSON.parse(fs.readFileSync(path.join(ROOT, "eval/cases.json"), "utf8"));
  const arr = Array.isArray(cases) ? cases : cases.cases;
  const rows = [];
  for (const c of arr) {
    const turns = c.turns || [];
    const said = turns[turns.length - 1];
    const prior = turns.slice(0, -1).map((t) => ({ role: "user", content: t }));   // declared: earlier turns carry no assistant reply
    rows.push({ set: "cases", id: c.id, said, prior, label: { web: !!c.expect?.search } });
  }
  const priorsOf = (k) => (PRIORS3 && PRIORS3[k]) || (PRIORS && PRIORS[k]) || [];
  for (const [name, corpus] of [["g1", CORPUS], ["g1", CORPUS2], ["g1", CORPUS3], ["g1", CORPUS4], ["g1", CORPUS5]]) {
    for (const r of corpus || []) {
      if (!r?.gold?.wants) continue;   // output asks only (PREREG)
      rows.push({ set: name, id: r.q, said: r.q, prior: r.prior ? priorsOf(r.prior) : [], label: { web: !!r.gold.needsSources } });
    }
  }
  // PREREG Amendment 2: the multi-turn gold, over real stored priors (assistant replies included)
  const mt = JSON.parse(fs.readFileSync(path.join(HERE, "multiturn-gold.json"), "utf8"));
  for (const r of mt.rows) rows.push({ set: "mt", id: r.id, said: r.ask, prior: priorOf(mt.priors[r.prior]), label: { web: !!r.expect.search } });
  return rows;
}

// a prior thread as the surface stores it. live: `upto` messages of the exported session; watch/g2: `upto` recorded turns, each rebuilt as
// {user: ask} + {assistant: spoken, provenance, authored} (the fields those runs recorded; no watch baton existed then)
function priorOf(p) {
  if (p.from === "live") {
    const live = JSON.parse(fs.readFileSync(path.join(HERE, "multiturn-live-2026-10-14.json"), "utf8"));
    return live.sessions.find((x) => x.id === p.session).messages.slice(0, p.upto);
  }
  const file = { watch: "eval/ants/watch-fixture-before-fix.json", g2: "eval/ants/g2/repro-control-1791355297096.json" }[p.from];
  const turns = JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8")).turns.slice(0, p.upto);
  return turns.flatMap((t) => [
    { role: "user", content: t.ask },
    { role: "assistant", content: t.spoken || "", ...(t.provenance && typeof t.provenance === "object" ? { provenance: t.provenance } : {}), ...(t.authored ? { authored: t.authored } : {}) },
  ]);
}

const floorRate = (k, n) => Math.max(k / n, 1 / (n + 2));   // rule-of-succession floor when gate-now makes no error of a kind
function gateRates(rows) {
  const need = rows.filter((r) => r.label.web), not = rows.filter((r) => !r.label.web);
  const alpha = floorRate(not.filter((r) => r.gate).length, not.length);       // false pull
  const beta = floorRate(need.filter((r) => !r.gate).length, need.length);     // missed pull
  return { alpha, beta };
}

function waldLOO(rows, voteKey = "votes") {
  return rows.map((r, i) => {
    const others = rows.filter((_, j) => j !== i).map((x) => ({ votes: x[voteKey], label: x.label, gate: x.gate }));
    const { lr } = measureRatios(others, PULLS.WEB);
    const { alpha, beta } = gateRates(others);
    const t0 = performance.now();
    const d = waldDecide({ votes: r[voteKey], calibration: { web: { lr, alpha, beta } } });
    const ms = performance.now() - t0;
    const w = d.pulls.web;
    return { take: d.recommend.includes(PULLS.WEB), verdict: w.verdict, ms };
  });
}

function errors(rows, takes, set) {
  let missed = 0, wasted = 0, n = 0, cont = 0;
  rows.forEach((r, i) => {
    if (set && !(Array.isArray(set) ? set.includes(r.set) : r.set === set)) return;
    n++;
    const t = takes[i];
    if (t.verdict === "continue") cont++;
    if (r.label.web && !t.take) missed++;
    if (!r.label.web && t.take) wasted++;
  });
  return { n, missed, wasted, errors: missed + wasted, continue: cont };
}

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

export function run() {
  const rows = goldRows();
  for (const r of rows) { r.sig = signalsOf(r.said, r.prior); r.gate = gateNow(r.sig); r.votes = witnessVotes(r.sig); }
  const gate = rows.map((r) => ({ take: r.gate, verdict: r.gate ? "probable" : "refused" }));
  const wald = waldLOO(rows);
  const sets = ["cases", "g1", "mt"];
  const OLD = ["cases", "g1"];   // "all gold" in bars B1-B4 stays the pre-registered old gold (Amendment 2); mt is reported apart
  const report = { prereg: "eval/wald/PREREG.md", n: rows.length, by: {} };
  for (const set of sets) report.by[set] = { gateNow: errors(rows, gate, set), wald: errors(rows, wald, set) };
  report.by.all = { gateNow: errors(rows, gate, OLD), wald: errors(rows, wald, OLD) };
  // null: each witness's vote column shuffled across rows (base rate kept, link to the row broken)
  const rand = rng(SEED);
  const witnesses = [...new Set(rows.flatMap((r) => r.votes.map((v) => v.witness)))];
  const nullErr = { cases: [], g1: [], mt: [], all: [] };
  for (let k = 0; k < SHUFFLES; k++) {
    const cols = Object.fromEntries(witnesses.map((w) => [w, rows.map((r) => r.votes.filter((v) => v.witness === w))]));
    for (const w of witnesses) { const c = cols[w]; for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } }
    rows.forEach((r, i) => { r.nullVotes = witnesses.flatMap((w) => cols[w][i]); });
    const t = waldLOO(rows, "nullVotes");
    for (const set of sets) nullErr[set].push(errors(rows, t, set).errors);
    nullErr.all.push(errors(rows, t, OLD).errors);
  }
  const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))]; };
  report.null = Object.fromEntries(Object.entries(nullErr).map(([k, xs]) => [k, { shuffles: xs.length, p05: q(xs, 0.05), median: q(xs, 0.5), p95: q(xs, 0.95) }]));
  const msAll = wald.map((t) => t.ms);
  report.restingCost = { medianMs: q(msAll, 0.5), maxMs: Math.max(...msAll) };
  // bars (PREREG)
  const c = report.by.cases, g = report.by.g1;
  report.bars = {
    B1: { holds: c.wald.missed <= c.gateNow.missed, wald: c.wald.missed, gateNow: c.gateNow.missed, what: "missed pulls on cases.json" },
    B2: { holds: c.wald.wasted <= c.gateNow.wasted && g.wald.wasted <= g.gateNow.wasted, wald: [c.wald.wasted, g.wald.wasted], gateNow: [c.gateNow.wasted, g.gateNow.wasted], what: "wasted pulls on cases.json and G1" },
    B3: { holds: report.by.all.wald.errors < report.null.all.p05, wald: report.by.all.wald.errors, nullP05: report.null.all.p05, what: "fewer errors than 95% of shuffled-witness nulls (all gold)" },
    B4: { holds: report.restingCost.maxMs < 1, maxMs: report.restingCost.maxMs, what: "decision time below the 1 ms stand-in price of a thread read" },
  };
  // Amendment 2: old-gold rows whose read-back signals are no longer null (expected: none — no old prior has an assistant reply)
  report.oldRowsWithReadback = rows.filter((r) => r.set !== "mt" && (r.sig.srcRecall || r.sig.primaryAsk)).map((r) => r.id);
  // the Clarification 1 row, by name
  const c1 = rows.findIndex((r) => r.id === "P3_R_0");
  if (c1 >= 0) report.clarification1 = { id: "P3_R_0", label: rows[c1].label.web, gateNow: rows[c1].gate, wald: wald[c1].take, verdict: wald[c1].verdict, mode: rows[c1].sig.follow.mode, want: rows[c1].sig.want, wantSub: rows[c1].sig.wantSub, votes: rows[c1].votes.map((v) => `${v.witness} ${v.pull}:${v.vote}`) };
  // the per-row disagreements, for reading (ids only)
  report.disagreements = rows.map((r, i) => ({ set: r.set, id: r.id, label: r.label.web, gateNow: r.gate, wald: wald[i].take, verdict: wald[i].verdict }))
    .filter((x) => x.gateNow !== x.wald || x.wald !== x.label);
  // the calibration the surface's shadow uses: ratios on ALL gold, alpha/beta = gate-now's own rates on all gold
  const all = rows.map((r) => ({ votes: r.votes, label: r.label, gate: r.gate }));
  const { lr, needed, notNeeded } = measureRatios(all, PULLS.WEB);
  const calibration = { schema: "WaldCalibration@1", measuredAt: "2026-10-14", gold: { rows: rows.length, needed, notNeeded }, web: { lr, ...gateRates(all), giver: "eval/wald/calibrate.mjs; alpha/beta = the current gate's own error rates (PREREG arm 2)" } };
  return { report, calibration };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { report, calibration } = run();
  fs.writeFileSync(path.join(HERE, "results.json"), JSON.stringify(report, null, 1) + "\n");
  fs.writeFileSync(path.join(HERE, "calibration.json"), JSON.stringify(calibration, null, 1) + "\n");
  // the surface is a static page: the shadow reads the same calibration as a module (generated; never edit by hand)
  fs.writeFileSync(path.join(ROOT, "fold-chat-wald-calibration.js"), `// GENERATED by eval/wald/calibrate.mjs — never edit by hand. Measured on the pre-registered gold (eval/wald/PREREG.md).\nexport const WALD_CALIBRATION = Object.freeze(${JSON.stringify(calibration)});\nexport default WALD_CALIBRATION;\n`);
  console.log(JSON.stringify({ n: report.n, by: report.by, null: report.null, restingCost: report.restingCost, bars: report.bars, oldRowsWithReadback: report.oldRowsWithReadback, clarification1: report.clarification1, disagreements: report.disagreements.length }, null, 1));
}
