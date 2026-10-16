// eval/modelvsrules/run-discourse.mjs — Experiment 2 of PREREG.md: who is "he"? The G3 corpora through R (the production planTurn, exactly as
// eval/ants/g3/measure.mjs calls it) and through gemma2:2b with ONE frozen prompt; the pre-registered falsification rule is applied mechanically.
//   node eval/modelvsrules/run-discourse.mjs [--limit N]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { CORPUS } from "../ants/g3/corpus.mjs";
import { CORPUS2 } from "../ants/g3/corpus2.mjs";
import { runCase } from "../ants/g3/measure.mjs";
import { admitReferents, emptyReferents } from "../../fold-chat-mind.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const limit = (() => { const i = argv.indexOf("--limit"); return i >= 0 ? +argv[i + 1] : Infinity; })();
const OLLAMA = process.env.OLLAMA_URL || "http://127.0.0.1:11435", MODEL = process.env.MODEL || "gemma2:2b";

// the frozen prompt (PREREG.md Experiment 2: written once, md5 recorded, never edited after a result)
const TEMPLATE = "Below is a conversation, then a new message from the same person.\n\nConversation:\n{conv}\n\nNew message: {ask}\n\nDoes the new message depend on something said earlier (a person, place, thing or topic it points back to)? If it does, reply with the exact name or phrase from the conversation that it refers to, and nothing else. If it can be understood on its own, reply with exactly: NONE\nAnswer:";
const MD5 = crypto.createHash("md5").update(TEMPLATE).digest("hex");
// Amendment A1 (exploratory arm H): the model CHOOSES among names the referent record extracted mechanically
const TEMPLATE_H = "Below is a conversation, then a new message from the same person.\n\nConversation:\n{conv}\n\nNew message: {ask}\n\nCandidate names:\n{cands}\n\nWhich ONE candidate does the new message refer back to? Reply with exactly that candidate, and nothing else. If the new message can be understood on its own, reply with exactly: NONE\nAnswer:";
const MD5_H = crypto.createHash("md5").update(TEMPLATE_H).digest("hex");
const normS = (s) => String(s ?? "").toLowerCase().replace(/[\s]+/g, " ").replace(/^[\s"“'‘]+|[\s"”'’.?!]+$/g, "").trim();

async function armM(s) {
  const conv = s.prior.map((t) => `Q: ${t.ask}\nA: ${t.answer}`).join("\n\n");
  const prompt = TEMPLATE.replace("{conv}", conv).replace("{ask}", s.ask);
  const t0 = Date.now();
  const r = await fetch(`${OLLAMA}/api/chat`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, stream: false, messages: [{ role: "user", content: prompt }], options: { temperature: 0, seed: 7, num_predict: 30 } }) });
  const raw = String(((await r.json()).message || {}).content || "").trim();
  let ans = raw.split("\n")[0].replace(/^answer:\s*/i, "").replace(/^["“'‘]+|["”'’.]+$/g, "").trim();
  if (!ans || /^none\b/i.test(ans)) ans = null;
  return { ans, raw: raw.slice(0, 100), conv, ms: Date.now() - t0 };
}

async function armH(s, conv) {
  let rec = emptyReferents();
  for (const t of s.prior) rec = admitReferents(rec, { question: t.ask, answer: t.answer, sources: (t.titles || []).map((x) => ({ title: x })) });
  const cands = [...new Set((rec.entities || []).map((e) => e.surface))].slice(0, 8);
  if (!cands.length) return { ans: null, cands };
  const prompt = TEMPLATE_H.replace("{conv}", conv).replace("{ask}", s.ask).replace("{cands}", cands.map((c, i) => `${i + 1}. ${c}`).join("\n"));
  const r = await fetch(`${OLLAMA}/api/chat`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, stream: false, messages: [{ role: "user", content: prompt }], options: { temperature: 0, seed: 7, num_predict: 30 } }) });
  const raw = String(((await r.json()).message || {}).content || "").trim();
  let ans = raw.split("\n")[0].replace(/^answer:\s*/i, "").replace(/^\d+[.)]\s*/, "").replace(/^["“'‘]+|["”'’.]+$/g, "").trim();
  if (!ans || /^none\b/i.test(ans)) ans = null;
  else { const hit = cands.find((c) => normS(c) === normS(ans)) || cands.find((c) => normS(c).includes(normS(ans)) || normS(ans).includes(normS(c))); ans = hit || null; }   // must be ONE OF the candidates
  return { ans, cands };
}

// exact statistics
const lfact = (() => { const t = [0]; for (let i = 1; i < 2000; i++) t[i] = t[i - 1] + Math.log(i); return t; })();
const lchoose = (n, k) => lfact[n] - lfact[k] - lfact[n - k];
const mcnemar = (b, c) => { const n = b + c; if (!n) return 1; let p = 0; for (let k = b; k <= n; k++) p += Math.exp(lchoose(n, k) - n * Math.log(2)); return Math.min(1, p); };
const fisherMore = (a1, n1, a2, n2) => { const K = a1 + a2, N = n1 + n2; let p = 0; for (let x = a1; x <= Math.min(K, n1); x++) { if (K - x > n2) continue; p += Math.exp(lchoose(n1, x) + lchoose(n2, K - x) - lchoose(N, K)); } return Math.min(1, p); };

const items = [...CORPUS, ...CORPUS2].filter((s) => s.cls === "follow" || s.cls === "switch").slice(0, limit);
const rows = [];
let n = 0;
for (const s of items) {
  const r = runCase(s), m = await armM(s), h = await armH(s, m.conv);
  const hasRef = !!s.ref;
  const refOk = (a) => !!(a && hasRef && (normS(a).includes(normS(s.ref)) || (normS(a).length >= 3 && normS(s.ref).includes(normS(a)))));
  const verbatim = !!(m.ans && normS(m.conv + " " + s.ask).includes(normS(m.ans)));
  const arm = (commit, ok) => ({ commit, ok: commit && hasRef ? ok : null });
  rows.push({
    id: s.id, cls: s.cls, lang: s.lang, ask: s.ask, ref: s.ref || null,
    R: arm(!!r.inherits, r.rightRef === true), M: { ...arm(!!m.ans, refOk(m.ans)), ans: m.ans, raw: m.raw, ms: m.ms },
    MV: arm(!!m.ans && verbatim, refOk(m.ans) && verbatim), H: { ...arm(!!h.ans, refOk(h.ans)), ans: h.ans, cands: h.cands }, N: { commit: false, ok: false },
  });
  if (++n % 20 === 0) console.error(`${n}/${items.length}`);
}
fs.writeFileSync(path.join(HERE, "rows-discourse.jsonl"), rows.map((x) => JSON.stringify(x)).join("\n") + "\n");

const F = rows.filter((x) => x.cls === "follow" && x.ref), Fnr = rows.filter((x) => x.cls === "follow" && !x.ref), W = rows.filter((x) => x.cls === "switch");
console.log(`items: follow-with-referent ${F.length}, follow-without-referent ${Fnr.length}, switch ${W.length} · model ${MODEL} · prompt md5 ${MD5} · H prompt md5 ${MD5_H}`);
console.log("\narm  | follow(ref): correct wrong silent | follow(no ref): committed | switch: LEAK of " + W.length + " | median ms");
for (const k of ["R", "M", "MV", "H", "N"]) {
  const c = F.filter((x) => x[k].commit && x[k].ok).length, w = F.filter((x) => x[k].commit && !x[k].ok).length, s2 = F.length - c - w;
  const nc = Fnr.filter((x) => x[k].commit).length, lk = W.filter((x) => x[k].commit).length;
  const ms = rows.map((x) => x[k].ms).filter((v) => v != null).sort((a, b) => a - b);
  console.log(`${k.padEnd(4)} | ${String(c).padStart(18)} ${String(w).padStart(5)} ${String(s2).padStart(6)} | ${String(nc).padStart(14)} of ${Fnr.length} | ${String(lk).padStart(12)} | ${ms.length ? ms[Math.floor(ms.length / 2)] : "-"}`);
}
console.log("\nby language (correct on follow-with-referent / leak on switch):");
for (const L of [...new Set(rows.map((x) => x.lang))]) {
  const f = F.filter((x) => x.lang === L), w = W.filter((x) => x.lang === L);
  console.log(`  ${L}: ` + ["R", "M", "MV", "H"].map((k) => `${k} ${f.filter((x) => x[k].commit && x[k].ok).length}/${f.length} correct, ${w.filter((x) => x[k].commit).length}/${w.length} leak`).join("  |  "));
}
console.log("\nPre-registered tests (M or M+V against R):");
for (const k of ["M", "MV", "H"]) {
  const b = F.filter((x) => x[k].commit && x[k].ok && !(x.R.commit && x.R.ok)).length, c = F.filter((x) => x.R.commit && x.R.ok && !(x[k].commit && x[k].ok)).length;
  const pC = mcnemar(b, c);
  const lkK = W.filter((x) => x[k].commit).length, lkR = W.filter((x) => x.R.commit).length;
  const pL = fisherMore(lkK, W.length, lkR, W.length);
  const wK = F.filter((x) => x[k].commit && !x[k].ok).length, wR = F.filter((x) => x.R.commit && !x.R.ok).length;
  const pW = fisherMore(wK, F.length, wR, F.length);
  const better = pC < 0.05, leakOk = pL >= 0.05, wrongOk = pW >= 0.05;
  console.log(`${k} vs R: correct-only-${k} ${b}, correct-only-R ${c}, McNemar p=${pC.toFixed(4)} → ${better ? "BETTER" : "not better"}; leak ${lkK} vs ${lkR}, p(more)=${pL.toFixed(4)} → ${leakOk ? "not more" : "MORE"}; wrong ${wK} vs ${wR}, p(more)=${pW.toFixed(4)} → ${wrongOk ? "not more" : "MORE"}`);
  console.log(`   VERDICT for ${k}${k === "H" ? " (EXPLORATORY, Amendment A1)" : ""}: ${better && leakOk && wrongOk ? (k === "H" ? "EXPLORATORY SUPPORT" : "SUPPORTED") : (!better ? "FALSIFIED (not better)" : "FALSIFIED AS STATED (better only by leaking/being wrong more)")}`);
}
