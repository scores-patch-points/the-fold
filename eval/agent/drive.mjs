// eval/agent/drive.mjs — drive the REAL Fold page's agent mode (window.__folds.create → runPipeline) headless, one make-ask per unit,
// and run the HIDDEN behavioural test (hidden.json) on whatever page the turn left. PREREG.md fixes everything here.
//   node eval/agent/drive.mjs --arm base|rehearse [--split dev|held|all] [--seeds 1,2,3] [--only id,id] [--tag name] [--conc 1]
// The model: the page's /v1/chat/completions is answered by the LOCAL small model (Ollama gemma2:2b) with the unit's seed added —
// the page's own temperature, prompts and token limits are untouched. The web: every other outside request is recorded per ask the
// first time and REPLAYED after (webcache/<id>.json), so the arms read the same world. A unit that does not finish inside the
// declared wall (UNIT_MS) is recorded settled:false — UNMEASURED, never a guess.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { runHidden, loadHidden } from "./hidden.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d; };
const ARM = opt("arm", "base");
const SPLIT = opt("split", "all");
const SEEDS = opt("seeds", "1").split(",").map(Number);
const ONLY = (opt("only", "") || "").split(",").filter(Boolean);
const TAG = opt("tag", ARM);
const CONC = +opt("conc", 1);
const ASKS = opt("asks", path.join(HERE, "asks.json"));
const URL_ = (process.env.FOLD_URL || "http://127.0.0.1:8868/") + (ARM === "rehearse" ? "?rehearse=1" : "");
const OLLAMA = process.env.OLLAMA_URL || "http://127.0.0.1:11435", MODEL = process.env.MODEL || "gemma2:2b";
const UNIT_MS = 45 * 60 * 1000;
const OUT = path.join(HERE, "results", `${TAG}.jsonl`);
const PAGES = path.join(HERE, "results", "pages");
const CACHE = path.join(HERE, "results", "webcache");
fs.mkdirSync(PAGES, { recursive: true }); fs.mkdirSync(CACHE, { recursive: true });

export const splitOf = (id) => (parseInt(crypto.createHash("sha256").update("eval/agent:" + id).digest("hex")[0], 16) < 8 ? "held" : "dev");
const H = loadHidden();
const SHIM = fs.readFileSync(path.join(HERE, "webllm-shim.mjs"), "utf8");
const asks = JSON.parse(fs.readFileSync(ASKS, "utf8")).asks.filter((a) => (SPLIT === "all" || splitOf(a.id) === SPLIT) && (!ONLY.length || ONLY.includes(a.id)));
const done = new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8").split("\n").filter(Boolean).map((l) => { const r = JSON.parse(l); return r.id + "#" + r.seed; }) : []);
const jobs = asks.flatMap((a) => SEEDS.map((seed) => ({ ...a, seed }))).filter((j) => !done.has(j.id + "#" + j.seed));

// ── the web, recorded once per ask and replayed ─────────────────────────────────────────────────────────────────────
const caches = new Map();
const cacheOf = (id) => { if (!caches.has(id)) { const f = path.join(CACHE, id + ".json"); caches.set(id, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {}); } return caches.get(id); };
const saveCache = (id) => fs.writeFileSync(path.join(CACHE, id + ".json"), JSON.stringify(cacheOf(id)));
const keyOf = (req) => crypto.createHash("sha1").update(req.method() + " " + req.url() + " " + (req.postData() || "")).digest("hex");

async function runUnit(browser, job) {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  const page = await ctx.newPage();
  const origin = new URL(URL_).origin;
  const stats = { calls: 0, modelMs: 0, web: { hit: 0, miss: 0 } };
  const cache = cacheOf(job.id);
  // THE IN-TAB MODEL, HEADLESS: the page is in-browser-only (fold-chat.js NO_HEIMDALL) and headless Chromium has no WebGPU, so the
  // harness gives the page an adapter, marks the default in-tab model as downloaded, and serves webllm-shim.mjs at the pinned web-llm
  // URL; every generation then reaches /__harness/chat, answered by the in-tab model's computer counterpart (gemma2:2b) with the seed.
  await ctx.addInitScript(() => {
    try { const fake = { requestAdapter: async () => ({ features: new Set(["shader-f16"]), limits: {} }) }; Object.defineProperty(Navigator.prototype, "gpu", { get: () => fake, configurable: true }); } catch {}
    try { localStorage.setItem("fold.webllm.downloaded", JSON.stringify(["gemma-2-2b-it-q4f16_1-MLC"])); } catch {}
  });
  await ctx.route("**/*", async (route) => {
    const req = route.request(), u = req.url();
    if (/cdn\.jsdelivr\.net\/npm\/@mlc-ai\/web-llm@/.test(u)) return route.fulfill({ status: 200, contentType: "text/javascript", body: SHIM });
    if (/\/__harness\/chat(\?|$)/.test(u)) {
      const body = JSON.parse(req.postData() || "{}");
      const t0 = Date.now();
      try {
        const r = await fetch(`${OLLAMA}/v1/chat/completions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: MODEL, messages: body.messages, temperature: body.temperature, max_tokens: body.max_tokens, top_p: body.top_p, stream: false, seed: job.seed }) });
        const j = await r.json();
        stats.calls += 1; stats.modelMs += Date.now() - t0;
        const c = j.choices && j.choices[0];
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content: c ? c.message.content : "", finish: c ? c.finish_reason : "stop", tokens: j.usage ? j.usage.completion_tokens : 0 }) });
      } catch (e) { return route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: String(e.message || e) }) }); }
    }
    if (/\/api\/tags(\?|$)/.test(u)) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ models: [{ name: MODEL, heimdall: {} }] }) });
    if (/\/v1\/chat\/completions(\?|$)/.test(u)) {
      const body = JSON.parse(req.postData() || "{}");
      const t0 = Date.now();
      try {
        const r = await fetch(`${OLLAMA}/v1/chat/completions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, model: MODEL, seed: job.seed }) });
        const text = await r.text();
        stats.calls += 1; stats.modelMs += Date.now() - t0;
        return route.fulfill({ status: r.status, contentType: r.headers.get("content-type") || "text/event-stream", body: text });
      } catch (e) { return route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: { message: String(e.message || e) } }) }); }
    }
    if (u.startsWith("data:") || u.startsWith("blob:") || u.startsWith("about:")) return route.continue();
    const own = u.startsWith(origin + "/") && !u.startsWith(origin + "/heimdall/");
    if (own) return route.continue();
    const k = keyOf(req);
    if (cache[k]) { stats.web.hit += 1; const c = cache[k]; return route.fulfill({ status: c.status, headers: c.headers, body: Buffer.from(c.body, "base64") }); }
    stats.web.miss += 1;
    try {
      const resp = await route.fetch({ timeout: 60000 });
      const buf = await resp.body();
      const headers = Object.fromEntries(Object.entries(resp.headers()).filter(([h]) => !/^(content-encoding|content-length|transfer-encoding|set-cookie)$/i.test(h)));
      if (/heimdall\/(status|api\/ps)/.test(u) === false) cache[k] = { status: resp.status(), headers, body: buf.toString("base64"), url: u.slice(0, 300) };
      return route.fulfill({ status: resp.status(), headers, body: buf });
    } catch { return route.abort(); }
  });
  const rec = { id: job.id, split: splitOf(job.id), seed: job.seed, arm: ARM, settled: false, error: null };
  const t0 = Date.now();
  try {
    await page.goto(URL_, { waitUntil: "load", timeout: 90000 });
    await page.waitForFunction(() => window.__folds && typeof window.__folds.create === "function", undefined, { timeout: 90000 });
    await page.waitForTimeout(1500);
    await page.evaluate((ask) => window.__folds.create(ask), job.ask);
    await page.waitForTimeout(2000);
    const deadline = Date.now() + UNIT_MS;
    while (Date.now() < deadline) {
      if (!(await page.evaluate(() => window.__folds.isRunning()))) { rec.settled = true; break; }
      await page.waitForTimeout(3000);
    }
    const f = await page.evaluate(() => { const all = JSON.parse(localStorage.getItem("fold-chat:folds@1") || "[]"); return all.sort((a, b) => b.updated - a.updated)[0] || null; });
    const log = (f && f.log) || [];
    const reads = log.filter((e) => e.kind === "think" && /reading what you're asking for|reading it again/.test(e.label || "")).map((e) => e.text || "");
    rec.lastTurn = f && f.lastTurn || null;
    rec.held = !!(f && f.lastTurn && f.lastTurn.held);
    rec.satisfy = reads.map((t) => ((/^\s*SATISFY\s*:\s*(.+)$/im.exec(t) || [])[1] || null));
    rec.findings = log.filter((e) => e.errors && e.errors.some((x) => x.code === "finding")).map((e) => e.errors[0].msg.slice(0, 200));
    rec.verdicts = log.filter((e) => /verdict/.test(e.label || "")).map((e) => `${e.label}: ${String(e.text || "").slice(0, 160)}`);
    rec.rehearsals = log.filter((e) => e.rehearsal).map((e) => e.rehearsal);
    const html = f && f.artifact && f.artifact.html || null;
    rec.htmlHash = html ? crypto.createHash("sha1").update(html).digest("hex").slice(0, 12) : null;
    if (html) fs.writeFileSync(path.join(PAGES, `${TAG}-${job.id}-${job.seed}.html`), html);
    fs.writeFileSync(path.join(PAGES, `${TAG}-${job.id}-${job.seed}.log.json`), JSON.stringify(log));
    const ht = H.tests[job.id] ? await runHidden(browser, html, H.tests[job.id], H.act) : { pass: null, whys: ["no hidden test (smoke)"] };
    rec.pass = ht.pass; rec.hiddenWhy = ht.whys;
    rec.falseHeld = rec.held && !rec.pass; rec.trueHeld = rec.held && rec.pass;
  } catch (e) { rec.error = String(e.message || e).slice(0, 300); }
  finally { rec.ms = Date.now() - t0; rec.calls = stats.calls; rec.modelMs = stats.modelMs; rec.web = stats.web; saveCache(job.id); await ctx.close().catch(() => {}); }
  return rec;
}

const browser = await chromium.launch();
console.log(`arm ${ARM} · ${URL_} · ${jobs.length} unit(s) · model ${MODEL} via ${OLLAMA} · out ${OUT}`);
const q = jobs.slice(); let n = 0;
const worker = async () => { while (q.length) { const j = q.shift(); const r = await runUnit(browser, j); fs.appendFileSync(OUT, JSON.stringify(r) + "\n"); n++;
  console.log(`[${n}/${jobs.length}] ${j.id}#${j.seed} ${r.error ? "ERROR " + r.error.slice(0, 80) : `${r.held ? "HELD" : "open"} hidden:${r.pass ? "pass" : "fail"} passes:${r.lastTurn?.passes ?? "-"} calls:${r.calls} ${Math.round(r.ms / 1000)}s web ${r.web.hit}/${r.web.hit + r.web.miss}`}`); } };
await Promise.all(Array.from({ length: CONC }, worker));
await browser.close();
