// eval/learnedpatterns/run.mjs — PREREG.md "Evaluation" and "What decides": the production binder R, the learned patterns P, and R∪P (R when R
// commits, else P) over the 162 modelvsrules pairs, ONE process, ONE title-door cache; scored on both fixed labelings; the pre-registered tests.
// The mutation table (instrument check 1) runs as arm PM beside them. R runs on all 162 (instrument check 3); P is scored on the asks in scope.
//   node eval/learnedpatterns/run.mjs      → rows.jsonl + summary.json here, the verdict on stdout
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAnswerTurn } from "../../fold-chat-answerturn.js";
import { resolveTitlesWikipedia } from "../../fold-chat-titles.js";
import { functionWordsOf } from "../../fold-chat-snippets.js";
import { readAsk, tableOf, answerOf } from "./lib.mjs";
import { pacedFetch, netStats } from "./net.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MV = path.join(HERE, "../modelvsrules");
const FWS = functionWordsOf("en"), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pairs = fs.readFileSync(path.join(MV, "pairs.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const labels = new Map(JSON.parse(fs.readFileSync(path.join(MV, "pairs-labels.json"), "utf8")).map((x) => [x.k, x]));
const manifest = JSON.parse(fs.readFileSync(path.join(HERE, "harvest-manifest.json"), "utf8"));
const P = JSON.parse(fs.readFileSync(path.join(HERE, "patterns.json"), "utf8"));
const TABLE = tableOf(P.real.admitted), MTABLE = tableOf(P.mutation.admitted);

// ── one title door, cached, failures counted (never read as "no page") ─────────────────────────────────────────────────
const uaFetch = (u, o = {}) => pacedFetch(u, o);
const cache = new Map(); let doorFail = 0;
async function door(cands) {
  const need = [...new Set(cands)].filter((c) => !cache.has(c));
  for (let at = 0; at < need.length; at += 40) {
    const chunk = need.slice(at, at + 40); let m = null;
    for (let k = 0; k < 4 && !m; k++) { try { m = await resolveTitlesWikipedia(chunk, { fetchImpl: uaFetch }); } catch { await sleep(1500 * 2 ** k); } }
    if (!m) doorFail += chunk.length;
    for (const c of chunk) cache.set(c, m && m.get ? m.get(c) || null : null);
  }
  return new Map(cands.map((c) => [c, cache.get(c) || null]));
}

async function armR(p) {
  try {
    const turn = await runAnswerTurn({ question: p.ask, lang: "en", now: { year: 2026 },
      passages: [{ ref: "S1", title: p.page, url: p.url, host: "en.wikipedia.org", lang: "en", text: p.sentence }],
      deps: { fw: FWS, resolveTitles: door, fetchLead: async () => null, searchPassages: async () => [] } });
    return turn.answer && turn.answer.filler ? String(turn.answer.filler.text) : null;
  } catch { return null; }
}

// ── statistics: exact, as eval/modelvsrules/run.mjs ────────────────────────────────────────────────────────────────────
const lfact = (() => { const t = [0]; for (let i = 1; i < 2000; i++) t[i] = t[i - 1] + Math.log(i); return t; })();
const lchoose = (n, k) => lfact[n] - lfact[k] - lfact[n - k];
const mcnemar = (b, c) => { const n = b + c; if (!n) return 1; let p = 0; for (let k = b; k <= n; k++) p += Math.exp(lchoose(n, k) - n * Math.log(2)); return Math.min(1, p); };
const fisherMore = (a1, n1, a2, n2) => { const K = a1 + a2, N = n1 + n2; let p = 0; for (let x = a1; x <= Math.min(K, n1); x++) { if (K - x > n2) continue; p += Math.exp(lchoose(n1, x) + lchoose(n2, K - x) - lchoose(N, K)); } return Math.min(1, p); };
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const overlaps = (a, b) => { const x = norm(a), y = norm(b); return x.length >= 2 && y.length >= 2 && (x.includes(y) || y.includes(x)); };

// ── run ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const readings = {};
for (const ask of [...new Set(pairs.map((p) => p.ask))]) readings[ask] = await readAsk(ask, { cue: manifest.cue, door });
const rows = [];
for (const [k, p] of pairs.entries()) {
  const rd = readings[p.ask], inScope = rd.pids.length > 0;
  const R = await armR(p);
  const Pa = inScope ? await answerOf(p.sentence, rd, TABLE, door) : { ans: null, why: "out of scope" };
  const PM = inScope ? await answerOf(p.sentence, rd, MTABLE, door) : { ans: null, why: "out of scope" };
  const L = labels.get(k);
  rows.push({ k, id: p.id, ask: p.ask, page: p.page, sentence: p.sentence, inScope, pids: rd.pids, regexLabel: p.label, gold: p.gold, strictLabel: L.label, strictAnswer: L.answer,
    R, P: Pa.ans || null, Pwhy: Pa.why || null, Pvia: Pa.via || null, PM: PM.ans || null, RP: R || Pa.ans || null });
  if ((k + 1) % 20 === 0) console.error(`${k + 1}/${pairs.length} (door failures ${doorFail})`);
}
fs.writeFileSync(path.join(HERE, "rows.jsonl"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");

// scoring: regex = ANSWER/NOT-ANSWER with the gate's gold; strict = STATES/NOT with the second labeler's answer words
const LAB = {
  regex: { pos: (r) => r.regexLabel === "ANSWER", ok: (r, v) => !!(v && new RegExp(r.gold, "i").test(v)) },
  strict: { pos: (r) => r.strictLabel === "STATES", ok: (r, v) => !!(v && overlaps(v, r.strictAnswer)) },
};
const cells = (set, lab, arm) => {
  const A = set.filter(LAB[lab].pos), N = set.filter((r) => !LAB[lab].pos(r));
  const c = A.filter((r) => LAB[lab].ok(r, r[arm])).length, w = A.filter((r) => r[arm] && !LAB[lab].ok(r, r[arm])).length;
  return { pos: A.length, neg: N.length, correct: c, wrong: w, silent: A.length - c - w, falseCommit: N.filter((r) => r[arm]).length };
};
function test(set, lab, arm) {
  const A = set.filter(LAB[lab].pos), N = set.filter((r) => !LAB[lab].pos(r));
  const b = A.filter((r) => LAB[lab].ok(r, r[arm]) && !LAB[lab].ok(r, r.R)).length, c = A.filter((r) => LAB[lab].ok(r, r.R) && !LAB[lab].ok(r, r[arm])).length;
  const X = cells(set, lab, arm), Rr = cells(set, lab, "R");
  const pC = mcnemar(b, c), pFC = fisherMore(X.falseCommit, N.length, Rr.falseCommit, N.length), pW = fisherMore(X.wrong, A.length, Rr.wrong, A.length);
  const better = pC < 0.05, fcOk = pFC >= 0.05, wOk = pW >= 0.05;
  return { gained: b, lost: c, pCorrect: pC, falseCommit: [X.falseCommit, Rr.falseCommit], pMoreFC: pFC, wrong: [X.wrong, Rr.wrong], pMoreWrong: pW,
    verdict: better && fcOk && wOk ? "SUPPORTED" : !better ? "FALSIFIED (not better)" : "FALSIFIED AS STATED (better only by being wrong more often)" };
}
const scope = rows.filter((r) => r.inScope);
const summary = { doorFailures: doorFail, pairs: rows.length, inScope: scope.length, readings, asksInScope: Object.entries(readings).filter(([, r]) => r.pids.length).map(([a, r]) => ({ ask: a, pids: r.pids, anchors: r.anchors })),
  check3_R_all162: { strict: cells(rows, "strict", "R"), regex: cells(rows, "regex", "R") }, arms: {}, tests: {} };
for (const lab of ["strict", "regex"]) {
  summary.arms[lab] = Object.fromEntries(["R", "P", "RP", "PM"].map((a) => [a, cells(scope, lab, a)]));
  summary.tests[lab] = { H1_P_vs_R: test(scope, lab, "P"), H2_RP_vs_R: test(scope, lab, "RP") };
}
const verdict = (h) => { const v = ["strict", "regex"].map((l) => summary.tests[l][h].verdict); return v.every((x) => x === "SUPPORTED") ? "SUPPORTED" : v[0] === v[1] ? v[0] : `MIXED (strict: ${v[0]}; regex: ${v[1]}) — not supported`; };
summary.verdict = { H1: verdict("H1_P_vs_R"), H2: verdict("H2_RP_vs_R") };
fs.writeFileSync(path.join(HERE, "summary.json"), JSON.stringify(summary, null, 1) + "\n");

console.log(`pairs ${rows.length}, in scope ${scope.length}; title-door failures ${doorFail}`);
console.log(`check 3 (R on all 162, strict): STATES ${summary.check3_R_all162.strict.correct}/${summary.check3_R_all162.strict.pos} correct, ${summary.check3_R_all162.strict.wrong} wrong; NOT false commits ${summary.check3_R_all162.strict.falseCommit}`);
for (const lab of ["strict", "regex"]) {
  console.log(`\n[${lab}] arm | positives: correct wrong silent | negatives: false commit`);
  for (const [a, c] of Object.entries(summary.arms[lab])) console.log(`  ${a.padEnd(3)} | ${c.correct}/${c.pos} ${c.wrong} ${c.silent} | ${c.falseCommit}/${c.neg}`);
  for (const [h, t] of Object.entries(summary.tests[lab])) console.log(`  ${h}: gained ${t.gained} lost ${t.lost} p=${t.pCorrect.toFixed(4)}; FC ${t.falseCommit.join(" vs ")} p(more)=${t.pMoreFC.toFixed(4)}; wrong ${t.wrong.join(" vs ")} p(more)=${t.pMoreWrong.toFixed(4)} → ${t.verdict}`);
}
console.log(`\nVERDICT H1 (learned patterns instead of the binder): ${summary.verdict.H1}\nVERDICT H2 (learned patterns added to the binder): ${summary.verdict.H2}`);
