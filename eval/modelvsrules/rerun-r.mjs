// eval/modelvsrules/rerun-r.mjs — Experiment 3 of PREREG.md: re-run ONLY the production-binder arm (R) over the same 162 pairs with the lemma table on,
// and compare with the SAME run of the frozen checkout before the table (paired, one door cache) on the independent second labeler's STATES / NOT labels.
//   node eval/modelvsrules/rerun-r.mjs [pairs-labels.json]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// PAIRED: the SAME pairs, the SAME title-door cache, in ONE process — the table-on checkout and a frozen checkout of the commit before it
const ROOT_AFTER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ROOT_BEFORE = process.env.FROZEN_ROOT;
if (!ROOT_BEFORE) { console.error("set FROZEN_ROOT to a checkout of the commit before the table"); process.exit(2); }
const { runAnswerTurn: runAfter } = await import(path.join(ROOT_AFTER, "fold-chat-answerturn.js"));
const { runAnswerTurn: runBefore } = await import(path.join(ROOT_BEFORE, "fold-chat-answerturn.js"));
import { resolveTitlesWikipedia } from "../../fold-chat-titles.js";
import { functionWordsOf } from "../../fold-chat-snippets.js";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FW = functionWordsOf("en"), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const labels = JSON.parse(fs.readFileSync(process.argv[2] || path.join(HERE, "pairs-labels.json"), "utf8"));
const pairs = fs.readFileSync(path.join(HERE, "pairs.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const before = fs.readFileSync(path.join(HERE, "rows.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const uaFetch = (u, o = {}) => fetch(u, { ...o, headers: { ...(o.headers || {}), "User-Agent": "the-fold-eval/1.0 (experiment 3)" } });
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
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const overlaps = (a, b) => { const x = norm(a), y = norm(b); return x.length >= 2 && y.length >= 2 && (x.includes(y) || y.includes(x)); };
const lfact = (() => { const t = [0]; for (let i = 1; i < 2000; i++) t[i] = t[i - 1] + Math.log(i); return t; })();
const lchoose = (n, k) => lfact[n] - lfact[k] - lfact[n - k];
const mcnemar = (b, c) => { const n = b + c; if (!n) return 1; let p = 0; for (let k = b; k <= n; k++) p += Math.exp(lchoose(n, k) - n * Math.log(2)); return Math.min(1, p); };
const fisherMore = (a1, n1, a2, n2) => { const K = a1 + a2, N = n1 + n2; let p = 0; for (let x = a1; x <= Math.min(K, n1); x++) { if (K - x > n2) continue; p += Math.exp(lchoose(n1, x) + lchoose(n2, K - x) - lchoose(N, K)); } return Math.min(1, p); };

const after = [], beforeLive = [];
const askOne = async (run, p) => {
  try {
    const t = await run({ question: p.ask, lang: "en", now: { year: 2026 },
      passages: [{ ref: "S1", title: p.page, url: p.url, host: "en.wikipedia.org", lang: "en", text: p.sentence }],
      deps: { fw: FW, resolveTitles: door, fetchLead: async () => null, searchPassages: async () => [] } });
    return t.answer && t.answer.filler ? String(t.answer.filler.text) : null;
  } catch { return null; }
};
for (const p of pairs) { beforeLive.push(await askOne(runBefore, p)); after.push(await askOne(runAfter, p)); }
const L = new Map(labels.map((x) => [x.k, x]));
const rows = pairs.map((p, i) => ({ s: L.get(i), b: beforeLive[i], a: after[i], gold: new RegExp(p.gold, "i"), label: p.label }));
const S = rows.filter((r) => r.s.label === "STATES"), N = rows.filter((r) => r.s.label === "NOT");
const ok = (r, v) => !!(v && overlaps(v, r.s.answer));
const sc = (key) => ({ c: S.filter((r) => ok(r, r[key])).length, w: S.filter((r) => r[key] && !ok(r, r[key])).length, fc: N.filter((r) => r[key]).length });
const B = sc("b"), A = sc("a");
const changed = rows.map((r, i) => ({ i, ...r })).filter((r) => r.b !== r.a);
console.log(`door failures ${doorFail}; pairs ${rows.length} (STATES ${S.length}, NOT ${N.length}); answers changed by the table: ${changed.length}`);
console.log(`R before: STATES correct ${B.c} wrong ${B.w} | NOT false-commit ${B.fc}`);
console.log(`R after : STATES correct ${A.c} wrong ${A.w} | NOT false-commit ${A.fc}`);
const b = S.filter((r) => ok(r, r.a) && !ok(r, r.b)).length, c = S.filter((r) => ok(r, r.b) && !ok(r, r.a)).length;
console.log(`McNemar (STATES) gained ${b}, lost ${c}, p=${mcnemar(b, c).toFixed(4)}; false-commit more? Fisher p(more)=${fisherMore(A.fc, N.length, B.fc, N.length).toFixed(4)}; wrong more? p(more)=${fisherMore(A.w, S.length, B.w, S.length).toFixed(4)}`);
for (const r of changed) console.log(`  CHANGED [${r.s.label}] ${JSON.stringify(r.b)} → ${JSON.stringify(r.a)}  | ${pairs[r.i].ask} | ${pairs[r.i].sentence.slice(0, 90)}`);
