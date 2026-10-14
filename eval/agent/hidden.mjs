// eval/agent/hidden.mjs — run a HIDDEN behavioural test (hidden.json) on a produced page. The agent never sees this file.
//   import { runHidden, loadHidden } from "./hidden.mjs";  await runHidden(browser, html, loadHidden().tests[id])
// A test is a list of ALTERNATIVES (any one passing = pass). Each alternative loads the page fresh in its own context with the
// network refused, snapshots it, runs its steps, snapshots again, and checks every expectation.
//
// Steps:   { click: [label…], optional?, times? }  — first label (in order) that matches a visible element; "re:" = whole-label
//                                                   regex (case-insensitive), "@act" = hidden.json's generic act regex, else exact.
//          { fill: "text", nth }                    — the nth visible text-like input/textarea, in document order.
//          { choose: [label…], optional? }          — a <select> option whose text matches.
//          { checkbox: nth }                        — click the nth checkbox (a switch).
//          { press: "Enter" }                       — on the element last filled.
//          { wait: ms }
// Expect:  { text: re, flags?, textOnly?, absentBefore? }  — after-haystack matches (absentBefore: before did not).
//          { moreOf: re }      — more matches after than before.      { newMatch: re } — a match after that was not before.
//          { changed: true }   — haystack differs.                    { not: re }      — after does not match.
//          { bgChanged: true } — html/body/top containers' colours.   { sigChanged: true } — any element's colour/opacity.
//          { sigChangesWithin: ms } — the style+text signature changes at least once while sampling for ms.
// The haystack is body.innerText plus every input/textarea/select value (textOnly: innerText alone). Flags default "i".
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const loadHidden = () => JSON.parse(fs.readFileSync(path.join(HERE, "hidden.json"), "utf8"));

const SNAP = () => {
  const vals = [...document.querySelectorAll("input,textarea,select")].map((e) => (e.type === "checkbox" || e.type === "radio") ? "" : String(e.value || "")).filter(Boolean);
  const text = String((document.body && document.body.innerText) || "");
  const col = (el) => { if (!el) return ""; const s = getComputedStyle(el); return s.backgroundColor + "/" + s.color; };
  const tops = [document.documentElement, document.body, ...(document.body ? [...document.body.children].slice(0, 12) : [])];
  const bg = tops.map(col).join("|");
  const all = [...document.querySelectorAll("body *")].slice(0, 400).map((el) => { const s = getComputedStyle(el); return s.backgroundColor + s.color + s.opacity + s.filter + s.boxShadow + s.borderColor; }).join("|");
  return { text, hay: text + "\n" + vals.join("\n"), bg, sig: bg + "#" + all + "#" + text };
};

async function findAndClick(page, labels, act) {
  const pats = labels.map((l) => (l === "@act" ? act : l));
  const idx = await page.evaluate((pats) => {
    const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
    const vis = (el) => { const r = el.getClientRects(); if (!r.length) return false; const s = getComputedStyle(el); return s.visibility !== "hidden" && s.display !== "none"; };
    const labelOf = (el) => norm(el.tagName === "INPUT" ? (el.value || el.getAttribute("aria-label") || "") : (el.getAttribute("aria-label") || el.innerText || el.textContent || ""));
    const test = (p, s) => p.startsWith("re:") ? new RegExp(p.slice(3), "i").test(s) : s.toLowerCase() === p.toLowerCase();
    const clickable = (el) => /^(BUTTON|A|SUMMARY)$/.test(el.tagName) || (el.tagName === "INPUT" && /^(button|submit|reset)$/i.test(el.type)) || el.getAttribute("role") === "button" || el.hasAttribute("onclick") || getComputedStyle(el).cursor === "pointer";
    const els = [...document.querySelectorAll("body *")].filter(vis);
    document.querySelectorAll("[data-ht]").forEach((e) => e.removeAttribute("data-ht"));
    for (const p of pats) {
      let hit = els.find((el) => clickable(el) && test(p, labelOf(el)));
      if (!hit) hit = els.filter((el) => test(p, labelOf(el))).filter((el, _, a) => !a.some((o) => o !== el && el.contains(o))).at(0);   // deepest
      if (hit) { hit.setAttribute("data-ht", "1"); return true; }
    }
    return false;
  }, pats);
  if (!idx) return false;
  try { await page.click("[data-ht='1']", { timeout: 2500, force: true }); } catch { await page.evaluate(() => document.querySelector("[data-ht='1']")?.click()); }
  return true;
}
const TEXTLIKE = "input:not([type]),input[type=text],input[type=number],input[type=search],input[type=tel],input[type=email],input[type=url],input[type=password],textarea";

async function runAlt(browser, html, alt, act) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  await ctx.route("**/*", (r) => r.abort());
  const page = await ctx.newPage();
  const log = [];
  try {
    page.on("dialog", (d) => d.dismiss().catch(() => {}));
    await page.setContent(html, { waitUntil: "load", timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(600);
    const before = await page.evaluate(SNAP);
    let lastFilled = null;
    for (const st of alt.steps) {
      if (st.click) {
        for (let k = 0; k < (st.times || 1); k++) {
          const ok = await findAndClick(page, st.click, act);
          if (!ok) { if (st.optional) { log.push(`click ${st.click[0]}: none (optional)`); break; } return { pass: false, why: `no element labelled ${st.click.join(" | ")}`, log }; }
          await page.waitForTimeout(150);
        }
      } else if (st.fill != null) {
        const ins = await page.$$(TEXTLIKE);
        const visible = []; for (const h of ins) if (await h.isVisible()) visible.push(h);
        const h = visible[st.nth || 0];
        if (!h) return { pass: false, why: `no input #${st.nth || 0}`, log };
        await h.fill(String(st.fill)).catch(async () => { await h.evaluate((e, v) => { e.value = v; }, String(st.fill)); });
        await h.evaluate((e) => { e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); e.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true })); });
        lastFilled = h;
      } else if (st.choose) {
        const done = await page.evaluate((pats) => {
          const test = (p, s) => p.startsWith("re:") ? new RegExp(p.slice(3), "i").test(s) : s.trim().toLowerCase() === p.toLowerCase();
          for (const sel of document.querySelectorAll("select")) for (const p of pats) for (const o of sel.options) if (test(p, o.textContent || "") || test(p, o.value || "")) { sel.value = o.value; sel.dispatchEvent(new Event("input", { bubbles: true })); sel.dispatchEvent(new Event("change", { bubbles: true })); return true; }
          return false;
        }, st.choose);
        if (!done && !st.optional) return { pass: false, why: `no option ${st.choose.join(" | ")}`, log };
      } else if (st.checkbox != null) {
        const boxes = await page.$$("input[type=checkbox]");
        const b = boxes[st.checkbox];
        if (!b) return { pass: false, why: "no checkbox", log };
        await b.click({ force: true, timeout: 2500 }).catch(() => b.evaluate((e) => e.click()));
      } else if (st.press) {
        if (lastFilled) await lastFilled.press(st.press).catch(() => {}); else await page.keyboard.press(st.press);
      } else if (st.wait) await page.waitForTimeout(st.wait);
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const after = await page.evaluate(SNAP);
    for (const ex of alt.expect) {
      const hb = ex.textOnly ? before.text : before.hay, ha = ex.textOnly ? after.text : after.hay;
      const re = (s) => new RegExp(s, ex.flags ?? "i");
      const count = (s, h) => (h.match(new RegExp(s, (ex.flags ?? "i") + "g")) || []).length;
      if (ex.text != null) {
        if (!re(ex.text).test(ha)) return { pass: false, why: `after does not show /${ex.text}/`, log };
        if (ex.absentBefore && re(ex.text).test(hb)) return { pass: false, why: `/${ex.text}/ was already shown before acting`, log };
      }
      if (ex.moreOf != null && !(count(ex.moreOf, ha) > count(ex.moreOf, hb))) return { pass: false, why: `no more /${ex.moreOf}/ after (${count(ex.moreOf, hb)}→${count(ex.moreOf, ha)})`, log };
      if (ex.newMatch != null) { const b = new Set(hb.match(new RegExp(ex.newMatch, "g")) || []); const a = ha.match(new RegExp(ex.newMatch, "g")) || []; if (!a.some((x) => !b.has(x))) return { pass: false, why: `no new /${ex.newMatch}/`, log }; }
      if (ex.changed && ha === hb) return { pass: false, why: "nothing changed", log };
      if (ex.not != null && re(ex.not).test(ha)) return { pass: false, why: `after shows /${ex.not}/`, log };
      if (ex.bgChanged && after.bg === before.bg) return { pass: false, why: "colours unchanged", log };
      if (ex.sigChanged && after.sig === before.sig) return { pass: false, why: "style unchanged", log };
      if (ex.sigChangesWithin) {
        let changed = after.sig !== before.sig;
        for (let t = 0; t < ex.sigChangesWithin && !changed; t += 400) { await page.waitForTimeout(400); changed = (await page.evaluate(SNAP)).sig !== before.sig; }
        if (!changed) return { pass: false, why: `nothing changed in ${ex.sigChangesWithin} ms`, log };
      }
    }
    return { pass: true, why: "ok", log };
  } catch (e) { return { pass: false, why: "harness: " + String(e.message || e).slice(0, 120), log }; }
  finally { await ctx.close().catch(() => {}); }
}

/** runHidden(browser, html, alts, act) → { pass, alt, whys }. A page that is absent (null) fails. */
export async function runHidden(browser, html, alts, act = loadHidden().act) {
  if (!html) return { pass: false, alt: null, whys: ["no page"] };
  const whys = [];
  for (let i = 0; i < alts.length; i++) {
    const r = await runAlt(browser, html, alts[i], act);
    if (r.pass) return { pass: true, alt: i, whys };
    whys.push(`alt${i}: ${r.why}`);
  }
  return { pass: false, alt: null, whys };
}
