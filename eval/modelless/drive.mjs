// drive.mjs — drive the REAL fold page with NO model reachable and record, per prompt, what finished without one.
//   node eval/modelless/drive.mjs [--only id,id] [--limit N] [--conc 4] [--out file.jsonl]
// /v1/chat/completions is answered 503 and counted; the in-tab engine has no WebGPU in headless. A turn that
// asks the model to speak shows up as modelRule.allowed === true (R0) or a counted call. Web lanes are live.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { installWorld } from "./world.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL_ = process.env.FOLD_URL || "http://127.0.0.1:8814/";
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d; };
const only = (opt("only", "") || "").split(",").filter(Boolean);
const limit = +opt("limit", 0) || Infinity;
const conc = +opt("conc", 4);
const WORLD = opt("world", "live");   // "live" = the real web lanes; "stub" = eval/modelless/world.mjs (deterministic, retrieval held perfect)
const out = path.resolve(HERE, opt("out", `results/run-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.jsonl`));
fs.mkdirSync(path.dirname(out), { recursive: true });
const PROMPTS = opt("prompts", path.join(HERE, "prompts.json"));
const P = JSON.parse(fs.readFileSync(path.resolve(PROMPTS), "utf8"));
const jobs = P.categories.filter((c) => !only.length || only.includes(c.id)).flatMap((c) => c.turns.slice(0, limit).map((t, i) => ({ cat: c.id, idx: i, turns: t })));

// settle: the composer re-enables BEFORE some turns are stored (the feed keeps streaming), so idle is not enough.
// Require: composer idle, a stored assistant message that carries a decision (modelRule, computed, void, a note or a
// 'No answer was written'), and an unchanged signature for 4 s. Timeout => settled:false (UNMEASURED, never a guess).
async function settle(page, ms = 150000) {
  const t0 = Date.now(); let last = "", since = Date.now();
  await page.waitForTimeout(1500);
  while (Date.now() - t0 < ms) {
    const s = await page.evaluate(() => {
      const i = document.getElementById("input"); const idle = !!i && !i.disabled && !i.readOnly && i.getAttribute("aria-busy") !== "true" && !/stop/i.test(document.getElementById("send")?.getAttribute("aria-label") || "");
      const sess = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).sort((a, b) => new Date(b.updated) - new Date(a.updated))[0] || {};
      const m = (sess.messages || []).filter((x) => x.role === "assistant").pop();
      const g = m?.grounding || {}; const shown = [...document.querySelectorAll(".msg.assistant")].slice(-1)[0]?.innerText || "";
      const decided = !!(g.modelRule || g.computed || g.void || (m && m.notices && m.notices.length) || /fold note|No answer was written|THESE SOURCES|FROM THE SOURCES|was written\./i.test(shown));
      return { idle, decided, sig: shown.length + ":" + (g.kind || "") + ":" + (g.modelRule?.rule || "") + ":" + (m?.snips || []).length };
    });
    if (s.sig !== last) { last = s.sig; since = Date.now(); }
    if (s.idle && s.decided && Date.now() - since >= 4000) return true;
    await page.waitForTimeout(700);
  }
  throw new Error("not settled");
}
const snap = (page) => page.evaluate(() => {
  const s = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).sort((a, b) => new Date(b.updated) - new Date(a.updated))[0] || {};
  const m = (s.messages || []).filter((x) => x.role === "assistant").pop() || null;
  const g = m?.grounding || {};
  const shown = [...document.querySelectorAll(".msg.assistant")].slice(-1)[0]?.querySelector(".body")?.innerText || "";
  const clip = (v) => JSON.parse(JSON.stringify(v ?? null, (k, x) => (typeof x === "string" && x.length > 300 ? x.slice(0, 300) + "…" : x)));
  return { shown: shown.replace(/\s+/g, " ").trim().slice(0, 700), content: (m?.content || "").slice(0, 400), authored: m?.authored || null, answerMode: m?.answerMode || null,
    kind: g.kind || null, rule: g.modelRule?.rule || null, allowed: g.modelRule?.allowed ?? null, nSources: g.nSources ?? (g.sources || []).length, gaps: clip(g.gaps || []), void: clip(g.void || null),
    computed: clip(g.computed || null), snips: clip((m?.snips || []).slice(0, 8)), snipsN: g.snipsN ?? (m?.snips || []).length, fellBackFrom: g.fellBackFrom || m?.fellBackFrom || null, notices: clip((m?.notices || []).map((n) => n.kind || n)), answerTurn: clip(g.answerTurn || m?.answerTurn || null), process: clip(g.process || []), line: g.line || null, lang: g.lang || null, nTurnsStored: (s.messages || []).length };
});

async function runJob(browser, job) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();
  const calls = [];
  if (WORLD === "stub") await installWorld(page);
  await page.route("**/v1/chat/completions", (route) => { calls.push(route.request().url()); return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "no model in this test" } }) }); });
  const rec = { cat: job.cat, idx: job.idx, turns: [], error: null };
  try {
    await page.goto(URL_, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForFunction(() => { const i = document.getElementById("input"); return i && !i.disabled; }, undefined, { timeout: 90000 });
    for (const ask of job.turns) {
      const t0 = Date.now(), c0 = calls.length;
      await page.fill("#input", ask); await page.click("#send");
      let settled = true;
      try { await settle(page); } catch { settled = false; }
      rec.turns.push({ ask, ms: Date.now() - t0, settled, modelCalls: calls.length - c0, ...(await snap(page)) });
    }
  } catch (e) { rec.error = String(e).slice(0, 300); }
  finally { await ctx.close(); }
  return rec;
}

const browser = await chromium.launch();
const q = jobs.slice(); const done = []; let n = 0;
const worker = async () => { while (q.length) { const j = q.shift(); const r = await runJob(browser, j); done.push(r); fs.appendFileSync(out, JSON.stringify(r) + "\n"); n++; const last = r.turns.at(-1); console.log(`[${n}/${jobs.length}] ${j.cat}#${j.idx} ${JSON.stringify(j.turns.at(-1)).slice(0, 60)} → ${r.error ? "ERROR " + r.error.slice(0, 60) : (last?.kind || "-") + " " + (last?.rule || "-") + " calls=" + last?.modelCalls + " " + (last?.shown || "").slice(0, 70)}`); } };
await Promise.all(Array.from({ length: conc }, worker));
await browser.close();
console.log("wrote", out);
