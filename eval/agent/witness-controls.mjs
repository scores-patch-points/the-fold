// eval/agent/witness-controls.mjs — the rehearsal witness's own mechanical controls (not a measure of the agent): on the hidden tests'
// hand-written reference pages, a sentence of the kind readAsk produces should REHEARSE and PASS; on the same pages with the scripts
// removed, it should FAIL (or be a named gap) — never pass. Runs the real injected observer + executor in a sandboxed srcdoc frame,
// exactly as fold-chat-folds.js does.   node eval/agent/witness-controls.mjs
import { chromium } from "playwright";
import { REF } from "./controls.mjs";
import { planRehearsal, judgeRehearsal, OBSERVE_JS, rehearsalScript } from "../../fold-chat-rehearse.js";

// One generic sentence per page, in the shape readAsk's SATISFY lines take ("it would let the user …"). Not tuned to the tests.
const SAY = {
  calc: "It lets the user press number buttons and operators and shows the result.",
  tip: "The user enters the bill and a tip percentage and clicks Calculate to see the tip and total.",
  "km-m": "The user enters kilometres and clicks Convert to see metres.",
  countdown: "Clicking Start counts down from 10 seconds to zero.",
  todo: "The user types a task and adds it to the list.",
  counter: "Each click on the + button increases the count shown.",
  dice: "Pressing Roll shows a random number from 1 to 6.",
  password: "Clicking Generate Password shows a new random password.",
  darkmode: "Clicking the toggle switches the page to dark mode.",
  oddeven: "The user enters a number and clicks Check to see whether it is odd or even.",
  upper: "The user types text and clicks Convert to see it in uppercase.",
};
const strip = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, "");
const inject = (html, s) => (/<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + s) : /<body[^>]*>/i.test(html) ? html.replace(/<body[^>]*>/i, (m) => m + s) : s + html);
const OBS = `<script>(function(){${OBSERVE_JS}window.addEventListener("load",function(){setTimeout(function(){parent.postMessage({__observe:1,offer:__offer()},"*");},600);});})();<\/script>`;

async function inFrame(page, srcdoc, key, timeout, sandbox = "allow-scripts") {
  return page.evaluate(({ srcdoc, key, timeout, sandbox }) => new Promise((resolve) => {
    const f = document.createElement("iframe"); f.setAttribute("sandbox", sandbox);
    const on = (ev) => { if (ev.source === f.contentWindow && ev.data && ev.data[key]) { removeEventListener("message", on); f.remove(); resolve(ev.data); } };
    addEventListener("message", on); setTimeout(() => { removeEventListener("message", on); resolve(null); }, timeout);
    f.srcdoc = srcdoc; document.body.appendChild(f);
  }), { srcdoc, key, timeout, sandbox });
}
export async function rehearse(page, html, satisfy) {
  const obs = await inFrame(page, inject(html, OBS), "__observe", 5000);
  const plan = planRehearsal(satisfy, (obs && obs.offer) || {});
  if (plan.gap) return { plan, verdict: judgeRehearsal(plan, null) };
  const run = await inFrame(page, inject(html, rehearsalScript(plan, { ms: 600 })), "__rehearse", 6000 + (plan.wait || 0) + plan.actions.length * 300, "allow-scripts allow-forms");
  return { plan, verdict: judgeRehearsal(plan, run) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const browser = await chromium.launch(); const page = await browser.newPage(); await page.setContent("<!doctype html><body></body>");
  let bad = 0;
  for (const [id, say] of Object.entries(SAY)) {
    const pos = await rehearse(page, REF[id], say), neg = await rehearse(page, strip(REF[id]), say);
    const ok = pos.verdict.ok !== false && neg.verdict.ok !== true;
    if (!ok) bad++;
    const v = (r) => (r.verdict.ok === true ? "pass" : r.verdict.ok === false ? "FAIL" : "gap ");
    console.log(`${ok ? "ok " : "BAD"} ${id.padEnd(9)} correct:${v(pos)} stripped:${v(neg)}  ${pos.verdict.line || pos.verdict.finding || pos.verdict.gap || ""} || ${neg.verdict.finding || neg.verdict.gap || neg.verdict.line || ""}`.slice(0, 260));
  }
  await browser.close();
  console.log(bad ? `${bad} witness control(s) failed` : "the witness never fails a correct reference page and never passes a stripped one");
  process.exit(bad ? 1 : 0);
}
