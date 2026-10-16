// eval/nesting/turns-e2e.mjs — drive the REAL chat page through scripted turns with the in-tab model replaced by a shim, over the deterministic
// stub world (eval/modelless/world.mjs). Nothing here calls a real model or the live web. Written for the nesting-fix audit (2026-10-14) to
// give D1/D2/D6 and the claim store an execution witness that the unit suite cannot (fold-chat.js run() needs a DOM).
//
//   node eval/nesting/turns-e2e.mjs --arm throw|fabricate|none --turns "Hello there!|Who is the president of France?|Where was he born?" [--procshim] [--out f.json]
//
//   arm throw      the shim's chat.completions.create() THROWS: a turn that wants the model dies inside run() (D1: it must still end in a typed notice)
//   arm fabricate  the shim returns a fixed paragraph: a research turn reaches falsifyAnswer (D2: it must not read Node's `process`)
//   arm none       no WebGPU adapter: the model is absent
//   --procshim     CONTROL: defines window.process = {env:{}} (the browser-global the unguarded read assumed)
//
// It starts the repo's own server on a free port in THIS checkout (never :8814/:8824/:8832) and stops it at the end. Playwright is imported
// from FOLD_PLAYWRIGHT (a file URL) or the package.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import net from "node:net";
import { fileURLToPath, pathToFileURL } from "node:url";
import { installWorld } from "../modelless/world.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d; };
const ARM = opt("arm", "throw");
const TURNS = String(opt("turns", "Hello there!")).split("|").map((s) => s.trim()).filter(Boolean);
const OUT = opt("out", null);
const SETTLE_MS = Number(opt("settle", 90000));
const FAB = "Paris was founded in 1999 by Napoleon, and the Eiffel Tower is 900 metres tall. The president of France is Napoleon Bonaparte.";

const SHIM = `
const IDS = ["gemma-2-2b-it-q4f16_1-MLC","Qwen2.5-0.5B-Instruct-q4f16_1-MLC","Qwen3-1.7B-q4f16_1-MLC","SmolLM2-360M-Instruct-q4f16_1-MLC","SmolLM2-1.7B-Instruct-q4f16_1-MLC","Llama-3.2-1B-Instruct-q4f16_1-MLC","Llama-3.2-3B-Instruct-q4f16_1-MLC","Phi-3.5-mini-instruct-q4f16_1-MLC","Qwen2.5-1.5B-Instruct-q4f16_1-MLC"];
export const prebuiltAppConfig = { model_list: IDS.flatMap((id) => [{ model_id: id }, { model_id: id.replace("q4f16_1", "q4f32_1") }]) };
export async function hasModelInCache() { return true; }
export class WebWorkerMLCEngineHandler { onmessage() {} }
const MODE = ${JSON.stringify(ARM)};
const FAB = ${JSON.stringify(FAB)};
function engineFor(build, cfg) {
  let stop = false;
  try { cfg?.initProgressCallback?.({ progress: 1, text: "shim ready", timeElapsed: 0 }); } catch {}
  return {
    interruptGenerate() { stop = true; }, async unload() {}, async resetChat() {},
    chat: { completions: { async create() {
      stop = false;
      if (MODE === "throw") throw new Error("shim: a model generation was attempted");
      return (async function* () {
        for (let i = 0; i < FAB.length && !stop; i += 24) yield { choices: [{ delta: { content: FAB.slice(i, i + 24) }, finish_reason: null }] };
        yield { choices: [{ delta: {}, finish_reason: "stop" }], usage: { completion_tokens: 30 } };
      })();
    } } },
  };
}
export async function CreateWebWorkerMLCEngine(_w, build, cfg) { return engineFor(build, cfg); }
export async function CreateMLCEngine(build, cfg) { return engineFor(build, cfg); }
`;

const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); s.on("error", rej); });

async function main() {
  const pw = await import(process.env.FOLD_PLAYWRIGHT || "playwright");
  const port = await freePort();
  const srv = spawn(process.execPath, ["server.mjs"], { cwd: ROOT, env: { ...process.env, FOLD_PORT: String(port), FOLD_HOST: "127.0.0.1" }, stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; srv.stdout.on("data", (d) => { log += d; }); srv.stderr.on("data", (d) => { log += d; });
  const URL_ = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 100; i++) { try { const r = await fetch(URL_); if (r.ok) break; } catch {} await new Promise((r) => setTimeout(r, 200)); }
  const browser = await pw.chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const page = await ctx.newPage();
    if (args.includes("--procshim")) await ctx.addInitScript(() => { window.process = { env: {} }; });
    if (ARM !== "none") await ctx.addInitScript(() => {
      try { const fake = { requestAdapter: async () => ({ features: new Set(["shader-f16"]), limits: {} }) }; Object.defineProperty(Navigator.prototype, "gpu", { get: () => fake, configurable: true }); } catch {}
      try { localStorage.setItem("fold.webllm.downloaded", JSON.stringify(["gemma-2-2b-it-q4f16_1-MLC"])); } catch {}
    });
    await installWorld(page);
    await ctx.route("**/*", async (route) => {
      const u = route.request().url();
      if (/cdn\.jsdelivr\.net\/npm\/@mlc-ai\/web-llm@/.test(u)) return ARM === "none" ? route.abort() : route.fulfill({ status: 200, contentType: "text/javascript", body: SHIM, headers: { "access-control-allow-origin": "*" } });
      return route.continue();
    });
    const errs = [];
    page.on("pageerror", (e) => errs.push("pageerror: " + String(e).slice(0, 240)));
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 240)); });
    await page.goto(URL_, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForFunction(() => { const i = document.getElementById("input"); return i && !i.disabled; }, undefined, { timeout: 90000 });
    await page.waitForTimeout(1500);
    const snap = () => page.evaluate(() => {
      const all = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).sort((a, b) => new Date(b.updated) - new Date(a.updated));
      const s = all[0] || {};
      const asst = (s.messages || []).filter((x) => x.role === "assistant");
      const m = asst[asst.length - 1] || null;
      const g = (m && m.grounding) || {};
      return {
        nAsst: asst.length, content: String((m && m.content) || "").slice(0, 300), authored: (m && m.authored) || null,
        notices: ((m && m.notices) || []).map((n) => ({ kind: n.kind, text: String(n.text || "").slice(0, 200) })),
        claims: (s.claims || []).map((c) => ({ id: c.id, rel: c.rel, text: String(c.roles?.ARG1 || "").slice(0, 120), support: c.basis?.support || null, cited: c.basis?.cited ? String(c.basis.cited).slice(0, 80) : null })),
        showed: g.showed || null, nSources: (g.sources || []).length, referents: ((s.referents && s.referents.entities) || []).map((e) => e.surface),
        answerTurn: m && m.answerTurn ? { answer: m.answerTurn.answer && m.answerTurn.answer.text, frame: m.answerTurn.frame && { slot: m.answerTurn.frame.slot, referents: (m.answerTurn.frame.referents || []).map((r) => r.title || r.surface) } } : null,
        shown: ([...document.querySelectorAll(".msg.assistant")].slice(-1)[0]?.querySelector(".body")?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 300),
      };
    });
    const rows = [];
    for (const ask of TURNS) {
      const before = await snap();
      await page.fill("#input", ask); await page.click("#send");
      let settled = false, last = "", since = Date.now();
      const t0 = Date.now();
      await page.waitForTimeout(1200);
      while (Date.now() - t0 < SETTLE_MS) {
        const s = await snap();
        const idle = await page.evaluate(() => { const i = document.getElementById("input"); return !!i && !i.disabled; });
        const sig = s.nAsst + ":" + s.shown.length + ":" + s.content.length;
        if (sig !== last) { last = sig; since = Date.now(); }
        if (idle && s.nAsst > before.nAsst && Date.now() - since >= 3500) { settled = true; break; }
        await page.waitForTimeout(500);
      }
      rows.push({ ask, settled, ms: Date.now() - t0, ...(await snap()) });
    }
    const out = { arm: ARM, procshim: args.includes("--procshim"), at: new Date().toISOString(), turns: rows, errors: [...new Set(errs)].slice(0, 12) };
    if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
    console.log(JSON.stringify(out, null, 1));
  } finally { await browser.close(); srv.kill(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
