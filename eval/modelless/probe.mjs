// probe: open the real page with NO model reachable and show what one prompt does. node eval/modelless/probe.mjs "prompt"
import { chromium } from "playwright";
const URL_ = process.env.FOLD_URL || "http://127.0.0.1:8814/";
const ask = process.argv[2] || "What is 17 times 23?";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const page = await ctx.newPage();
const modelCalls = [], reqs = [];
page.on("request", (r) => { const u = r.url(); if (!/127\.0\.0\.1:8814\/[^h]/.test(u) || /heimdall/.test(u)) reqs.push(r.method() + " " + u.slice(0, 110)); });
await page.route("**/v1/chat/completions", (route) => { modelCalls.push(route.request().url()); return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "no model in this test" } }) }); });
page.on("console", (m) => { if (m.type() === "error") console.log("  [console.error]", m.text().slice(0, 160)); });
await page.goto(URL_, { waitUntil: "networkidle", timeout: 90000 });
const st = await page.evaluate(() => { const i = document.getElementById("input"); return { hasInput: !!i, disabled: i?.disabled, readOnly: i?.readOnly, ph: i?.placeholder, send: !!document.getElementById("send") }; });
console.log("composer:", JSON.stringify(st));
await page.fill("#input", ask); await page.click("#send");
await page.waitForTimeout(1500);
await page.waitForFunction(() => { const i = document.getElementById("input"); return i && !i.disabled && !i.readOnly && i.getAttribute("aria-busy") !== "true" && !/stop/i.test(document.getElementById("send")?.getAttribute("aria-label") || ""); }, undefined, { timeout: 120000 }).catch((e) => console.log("settle timeout"));
await page.waitForTimeout(600);
const out = await page.evaluate(() => {
  const s = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).sort((a, b) => new Date(b.updated) - new Date(a.updated))[0] || {};
  const m = (s.messages || []).filter((x) => x.role === "assistant").pop() || null;
  const body = [...document.querySelectorAll(".msg.assistant")].slice(-1)[0]?.querySelector(".body")?.innerText || null;
  return { keys: m ? Object.keys(m) : null, m: m ? JSON.parse(JSON.stringify(m, (k, v) => (typeof v === "string" && v.length > 400 ? v.slice(0, 400) + "…" : v))) : null, shown: body ? body.slice(0, 600) : null };
});
console.log("modelCalls:", modelCalls.length);
console.log(JSON.stringify(out, null, 1).slice(0, 5000));
await browser.close();
