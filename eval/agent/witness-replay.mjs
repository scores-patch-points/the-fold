// eval/agent/witness-replay.mjs — DEV ONLY (PREREG.md): run the witness offline on pages a run already produced, with the SATISFY
// line that run read, and print what it would have said beside the hidden test's verdict. Never pointed at held-out rows.
//   node eval/agent/witness-replay.mjs B-dev
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { rehearse } from "./witness-controls.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const tag = process.argv[2] || "B-dev";
if (/held/i.test(tag)) { console.error("witness-replay is for dev rows only"); process.exit(2); }
const rows = fs.readFileSync(path.join(HERE, "results", tag + ".jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.split === "dev");
const browser = await chromium.launch(); const page = await browser.newPage(); await page.setContent("<!doctype html><body></body>");
for (const r of rows) {
  const f = path.join(HERE, "results", "pages", `${tag}-${r.id}-${r.seed}.html`);
  if (!fs.existsSync(f)) { console.log(`${r.id}: no page`); continue; }
  const sat = (r.satisfy || []).filter(Boolean).at(-1) || null;
  const { plan, verdict } = await rehearse(page, fs.readFileSync(f, "utf8"), sat);
  const w = verdict.ok === true ? "pass" : verdict.ok === false ? "FAIL" : "gap ";
  console.log(`${r.id.padEnd(10)} held:${r.held ? "Y" : "n"} hidden:${r.pass ? "pass" : "fail"} witness:${w}  ${verdict.line || verdict.finding || verdict.gap}`.slice(0, 300));
  console.log(`           SATISFY: ${sat}`.slice(0, 300));
}
await browser.close();
