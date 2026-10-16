// eval/modelvsrules/run.mjs — run the arms of PREREG.md over pairs.jsonl and apply the pre-registered falsification rule.
//   node eval/modelvsrules/run.mjs [pairs.jsonl] [--limit N]    → rows to eval/modelvsrules/rows.jsonl, the verdict on stdout
// R = the production binder (runAnswerTurn over the one sentence, the real Wikipedia title door); M = gemma2:2b at temperature 0 with ONE frozen
// prompt; M+V = M accepted only if verbatim AND the title door resolves it; L = lexical baseline; N = null. Labels come from the gold regex only.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { runAnswerTurn } from "../../fold-chat-answerturn.js";
import { resolveTitlesWikipedia } from "../../fold-chat-titles.js";
import { functionWordsOf } from "../../fold-chat-snippets.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const pairsPath = argv.find((a) => !a.startsWith("--")) || path.join(HERE, "pairs.jsonl");
const limit = (() => { const i = argv.indexOf("--limit"); return i >= 0 ? +argv[i + 1] : Infinity; })();
const OLLAMA = process.env.OLLAMA_URL || "http://127.0.0.1:11435", MODEL = process.env.MODEL || "gemma2:2b";
const FW = functionWordsOf("en");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── the frozen prompt (PREREG.md: written once, md5 recorded, never edited after a result) ──────────────────────────────────
const PROMPT_TEMPLATE = "Answer the question using ONLY the sentence. Reply with the exact words from the sentence that answer the question, and nothing else. If the sentence does not answer the question, reply with exactly: NONE\n\nQuestion: {ask}\nSentence: {sentence}\nAnswer:";
const PROMPT_MD5 = crypto.createHash("md5").update(PROMPT_TEMPLATE).digest("hex");
const promptOf = (ask, sentence) => PROMPT_TEMPLATE.replace("{ask}", ask).replace("{sentence}", sentence);

// Node sends no User-Agent and Wikimedia throttles that: a generic one (no identity) is sent. Browsers send their own.
const uaFetch = (u, o = {}) => fetch(u, { ...o, headers: { ...(o.headers || {}), "User-Agent": "the-fold-eval/1.0 (model-vs-rules run)" } });
// ── the real title door, cached; failures are counted and never silently read as "no page" ───────────────────────────────────
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
const isNamed = (r) => !!(r && typeof r.title === "string" && r.title && !r.disambiguation);

// ── arms ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function armR(p) {
  try {
    const turn = await runAnswerTurn({ question: p.ask, lang: "en", now: { year: 2026 },
      passages: [{ ref: "S1", title: p.page, url: p.url, host: "en.wikipedia.org", lang: "en", text: p.sentence }],
      deps: { fw: FW, resolveTitles: door, fetchLead: async () => null, searchPassages: async () => [] } });
    return { ans: turn.answer && turn.answer.filler ? String(turn.answer.filler.text) : null, slot: turn.slot || null };
  } catch (e) { return { ans: null, error: String(e.message || e).slice(0, 80) }; }
}
async function armM(p) {
  const t0 = Date.now();
  const r = await fetch(`${OLLAMA}/api/chat`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, stream: false, messages: [{ role: "user", content: promptOf(p.ask, p.sentence) }], options: { temperature: 0, seed: 7, num_predict: 40 } }) });
  const j = await r.json(); const raw = String(j.message && j.message.content || "").trim();
  let ans = raw.split("\n")[0].replace(/^answer:\s*/i, "").replace(/^["“'‘]+|["”'’.]+$/g, "").trim();
  if (!ans || /^none\b/i.test(ans)) ans = null;
  return { ans, raw: raw.slice(0, 120), ms: Date.now() - t0 };
}
const normS = (s) => String(s).toLowerCase().replace(/\s+/g, " ").trim();
async function armMV(p, m, slot) {
  if (!m.ans) return { ans: null };
  if (!normS(p.sentence).includes(normS(m.ans))) return { ans: null, why: "not verbatim" };
  if (slot === "quantity" || slot === "time") return { ans: m.ans };
  const res = await door([m.ans]);
  return isNamed(res.get(m.ans)) ? { ans: m.ans } : { ans: null, why: "no page" };
}
function armL(p, slot) {
  const q = normS(p.ask);
  if (slot === "quantity" || slot === "time") { const n = p.sentence.match(/\d[\d,.]*/); return { ans: n ? n[0] : null }; }
  for (const m of p.sentence.matchAll(/\p{Lu}[\p{L}.'’-]*(?:\s+(?:of|de|van|von|the|and)?\s*\p{Lu}[\p{L}.'’-]*)*/gu)) {
    const run = m[0];
    if (m.index === 0 && !/\s/.test(run)) continue;                    // a single capitalised sentence opener
    if (q.includes(normS(run))) continue;
    return { ans: run };
  }
  return { ans: null };
}

// ── statistics: exact, no libraries ────────────────────────────────────────────────────────────────────────────────────
const lfact = (() => { const t = [0]; for (let i = 1; i < 2000; i++) t[i] = t[i - 1] + Math.log(i); return t; })();
const lchoose = (n, k) => lfact[n] - lfact[k] - lfact[n - k];
const mcnemarOneSided = (b, c) => { const n = b + c; if (!n) return 1; let p = 0; for (let k = b; k <= n; k++) p += Math.exp(lchoose(n, k) - n * Math.log(2)); return Math.min(1, p); };   // P(X>=b | n, .5)
function fisherMore(a1, n1, a2, n2) { // one-sided: P(arm1 has >= a1 of the combined events | margins), "arm 1 commits MORE than arm 2"
  const K = a1 + a2, N = n1 + n2; let p = 0;
  for (let x = a1; x <= Math.min(K, n1); x++) { if (K - x > n2) continue; p += Math.exp(lchoose(n1, x) + lchoose(n2, K - x) - lchoose(N, K)); }
  return Math.min(1, p);
}

// ── run ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const pairs = fs.readFileSync(pairsPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).slice(0, limit);
const rows = [];
let i = 0;
for (const p of pairs) {
  const gold = new RegExp(p.gold, "i");
  const R = await armR(p), M = await armM(p), slot = R.slot || p.slot;
  const MV = await armMV(p, M, slot), L = armL(p, slot);
  const cell = (a) => ({ ans: a.ans || null, ok: !!(a.ans && gold.test(a.ans)) });
  rows.push({ id: p.id, ask: p.ask, label: p.label, page: p.page, sentence: p.sentence, slot, R: cell(R), M: { ...cell(M), raw: M.raw, ms: M.ms }, MV: cell(MV), L: cell(L), N: { ans: null, ok: false } });
  if (++i % 20 === 0) console.error(`${i}/${pairs.length}`);
}
fs.writeFileSync(path.join(HERE, "rows.jsonl"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");

const A = rows.filter((r) => r.label === "ANSWER"), Nn = rows.filter((r) => r.label === "NOT-ANSWER");
const arms = ["R", "M", "MV", "L", "N"];
console.log(`pairs ${rows.length}: ANSWER ${A.length}, NOT-ANSWER ${Nn.length} · model ${MODEL} · prompt md5 ${PROMPT_MD5} · title-door failures ${doorFail}`);
console.log("\narm   | ANSWER: correct  wrong  silent | NOT-ANSWER: false-commit | median ms");
for (const k of arms) {
  const c = A.filter((r) => r[k].ok).length, w = A.filter((r) => r[k].ans && !r[k].ok).length, s = A.length - c - w;
  const fc = Nn.filter((r) => r[k].ans).length;
  const ms = rows.map((r) => r[k].ms).filter((x) => x != null).sort((a, b) => a - b);
  console.log(`${k.padEnd(5)} | ${String(c).padStart(14)}  ${String(w).padStart(5)}  ${String(s).padStart(6)} | ${String(fc).padStart(12)} of ${Nn.length} | ${ms.length ? ms[Math.floor(ms.length / 2)] : "-"}`);
}
console.log("\nPre-registered tests (M or M+V against R):");
for (const k of ["M", "MV"]) {
  const b = A.filter((r) => r[k].ok && !r.R.ok).length, c = A.filter((r) => r.R.ok && !r[k].ok).length;
  const pCorrect = mcnemarOneSided(b, c);
  const fcK = Nn.filter((r) => r[k].ans).length, fcR = Nn.filter((r) => r.R.ans).length;
  const pMoreFC = fisherMore(fcK, Nn.length, fcR, Nn.length);
  const wK = A.filter((r) => r[k].ans && !r[k].ok).length, wR = A.filter((r) => r.R.ans && !r.R.ok).length;
  const pMoreW = fisherMore(wK, A.length, wR, A.length);
  const better = pCorrect < 0.05, fcOk = pMoreFC >= 0.05, wOk = pMoreW >= 0.05;
  console.log(`${k} vs R: correct-only-${k} ${b}, correct-only-R ${c}, McNemar one-sided p=${pCorrect.toFixed(4)} → ${better ? "BETTER" : "not better"}; `
    + `false-commit ${fcK} vs ${fcR}, p(more)=${pMoreFC.toFixed(4)} → ${fcOk ? "not more" : "MORE"}; wrong ${wK} vs ${wR}, p(more)=${pMoreW.toFixed(4)} → ${wOk ? "not more" : "MORE"}`);
  console.log(`   VERDICT on the claim for ${k}: ${better && fcOk && wOk ? "SUPPORTED" : (!better ? "FALSIFIED (not better)" : "FALSIFIED AS STATED (better only by being wrong more often)")}`);
}
