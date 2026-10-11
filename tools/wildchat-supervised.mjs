// tools/wildchat-supervised.mjs — the CONTINUOUS supervised-learning loop over WildChat.
//
// Every ask runs through the live fold; a supervisor (an Anthropic model, via ANTHROPIC_API_KEY)
// judges the outcome and writes a LESSON (root cause + the intended reading). Confirmed corrections
// are LEARNED into tools/wildchat-learned.json (raw -> intended, e.g. "itnow" -> "it now"), and a
// later ask that matches a learned correction is sent PRE-CORRECTED — so what fails stops failing.
//
//   node tools/wildchat-supervised.mjs [--budget 300] [--cap 30]
//
// Loops until budget/cap; writes wildchat-lessons.jsonl (append-only) and wildchat-learned.json;
// prints a live supervised-correct rate every batch. READ THE KEY FROM ONE PLACE:
//   ANTHROPIC_API_KEY env, else tools/.anthropic-key (chmod 600) — never printed.
import { chromium } from "../node_modules/playwright/index.mjs";
import { murmurOf, murmurSay } from "../fold-chat-murmur.js";
import { salientTerms } from "../fold-chat-salience-infer.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL = process.env.FOLD_URL || "http://127.0.0.1:8814/";
const BATTERY = path.join(HERE, "wildchat-battery.json");
const LESSONS = path.join(HERE, "..", "wildchat-lessons.jsonl");
const LEARNED = path.join(HERE, "wildchat-learned.json");
const PROPOSALS = path.join(HERE, "..", "wildchat-proposals.jsonl");
const BUDGET = Number(process.argv.find((_, i) => process.argv[i - 1] === "--budget") || 300) * 1000;
const CAP = Number(process.argv.find((_, i) => process.argv[i - 1] === "--cap") || 30);
const BATCH = Number(process.argv.find((_, i) => process.argv[i - 1] === "--batch") || 6);

let apiKey = process.env.ANTHROPIC_API_KEY || "";
if (!apiKey) { try { apiKey = fs.readFileSync(path.join(HERE, ".anthropic-key"), "utf8").trim(); } catch {} }

// THE PROPOSAL REGISTRY: append-only, and INSTANTLY LIVE — every new context is seeded with the current
// proposals (hd:fold-lessons), so the fold's very next turn prompts BY them. Anthropic never touches code:
// a proposal is a behavioral rule only.
const proposals = (() => { try { return fs.readFileSync(PROPOSALS, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { return []; } })();
const saveProposal = (p) => { proposals.push(p); try { fs.appendFileSync(PROPOSALS, JSON.stringify(p) + "\n"); } catch {} return p; };

const learned = (() => { try { return JSON.parse(fs.readFileSync(LEARNED, "utf8")); } catch { return {}; } })();
const battery = JSON.parse(fs.readFileSync(BATTERY, "utf8"));
const asks = battery.asks || [];
const LANG_EXTRA = [
  { text: "Qui est le président des États-Unis ?", lang: "fr" },
  { text: "¿Quién fundó Nashville y cuándo?", lang: "es" },
  { text: "Was ist die Hauptstadt von Frankreich?", lang: "de" },
];
const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
const learnedLookup = (text) => {
  const t = norm(text);
  // longest learned correction that is a substring of this ask
  let best = null;
  for (const [from, to] of Object.entries(learned)) { const f = norm(from); if (f.length >= 3 && t.includes(f) && (!best || f.length > best[0].length)) best = [f, to]; }
  return best;
};

// FOLD THE SUPERVISOR PROMPT with the fold itself (user, 2026-10-11): only the ask's SALIENT terms, the fold's
// own one-line interpretation (murmurSay), and a tight disposition — never the raw question or the raw answer.
const foldSupervisorInput = (ask, out) => {
  let mur = null, terms = null;
  try { mur = murmurSay(murmurOf({ question: String(ask.text || "") })).join(" "); } catch { mur = null; }
  try { terms = salientTerms(String(ask.text || "")).terms.slice(0, 4).map((t) => t.form).join(", "); } catch { terms = null; }
  return {
    ask: String(ask.text || "").replace(/\s+/g, " ").slice(0, 70),
    salient: terms || null,
    foldRead: mur ? mur.slice(0, 180) : null,
    answer: String(out.content || "").replace(/\s+/g, " ").slice(0, 90) || null,
    disposition: out.refused ? "refused" : out.gap ? "gap:" + (out.voidKind || "?") : out.hard ? "hard" : "answered",
  };
};

async function supervise(text, out) {
  const key = (() => { try { return fs.readFileSync(path.join(HERE, ".anthropic-key"), "utf8").trim(); } catch { return ""; } })();
  if (!key) return null;
  const model = "claude-sonnet-4-5";   // the cheapest Sonnet — hardcoded, never the broken shell default
  const folded = foldSupervisorInput({ text }, out);
  const content = "You supervise a grounded research chat.\nFOLDED EVIDENCE (already reduced by the fold: salient terms, its own interpretation, disposition):\n" +
    JSON.stringify(folded, null, 1) +
    "\nWas the assistant's response correct and well-grounded? Reply with ONLY a JSON object, no prose, no markdown:\n" +
    `{"correct":"yes"|"no"|"ambiguous","lesson":"one sentence naming the root cause of any failure","mean":"the question the person most likely meant, as a clean one-line rewrite","proposal":{"mechanism":"one of scope-resolution|salience|follow-up|run-together|void|other","promptRule":"one directive the assistant must obey from now on, phrased as a rule – behavioral only, NEVER code"}}\n` +
    `"proposal" is required on any failure: the ONE mechanical rule that would stop this class. NEVER propose code; only a rule the assistant can follow. "mean" is null if the ask was not misread.`;
  let r;
  try { r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model, max_tokens: 400, messages: [{ role: "user", content }] }) }); }
  catch (e) { console.error("  supervisor unreachable:", String((e && e.message) || e)); return { correct: "unverified", lesson: "supervisor unreachable", mean: null }; }
  if (!r.ok) { let b = ""; try { b = (await r.text()).slice(0, 120); } catch {} console.error("  supervisor HTTP", r.status, b); return { correct: "unverified", lesson: "supervisor HTTP " + r.status, mean: null }; }
  let j; try { j = await r.json(); } catch { j = null; }
  const msg = (j && j.content && j.content[0] && j.content[0].text) || "";
  const parse = (s) => { try { const o = JSON.parse(s.replace(/^```[a-z]*\n?|```$/g, "").trim()); return { correct: o.correct || "ambiguous", lesson: String(o.lesson || ""), mean: o.mean || null, proposal: (o.proposal && o.proposal.promptRule) ? { mechanism: String(o.proposal.mechanism || "other"), promptRule: String(o.proposal.promptRule).slice(0, 220) } : null }; } catch { } const g = (k) => { const m = s.match(new RegExp(`"${k}"\\s*:\\s*"([^"]*)"`, "i")); return m ? m[1] : null; }; const pm = s.match(/"proposal"\s*:\s*\{[^}]*"promptRule"\s*:\s*"([^"]*)"/i); return { correct: g("correct") || "ambiguous", lesson: g("lesson") || "", mean: g("mean") || null, proposal: pm ? { mechanism: (s.match(/"mechanism"\s*:\s*"([^"]*)"/i) || [])[1] || "other", promptRule: pm[1] } : null }; };
  return parse(msg);
}

const measure = (page, st) => page.evaluate(() => {
  const all = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).flatMap((s) => s.messages || []);
  const a = all.filter((m) => m.role === "assistant").pop() || {};
  const content = String(a.content || "");
  const voidKind = (a.grounding && a.grounding.void && a.grounding.void.kind) || (a.void && a.void.kind) || null;
  const hard = !!(a.murmur && a.murmur.hard);
  const gap = !!voidKind || /no source|nothing supports|no answer was written|no draft could be/i.test(content.slice(0, 300));
  const bubble = [...document.querySelectorAll(".msg.assistant")].pop();
  const answerText = String((bubble && bubble.querySelector(".body") ? bubble.querySelector(".body").innerText : null) || content || "").replace(/\s+/g, " ").slice(0, 260);
  const nSources = (a.sources || []).length + (Array.isArray(a.snips) ? a.snips.length : 0);
  return { answered: content.trim().length > 25 && !gap, gap, voidKind, hard, refused: /refus|opencode serve|only build/i.test(content.slice(0, 200)), content: content.replace(/\s+/g, " ").slice(0, 140), answerText, nSources };
}).then((m) => ({ ...m, secs: ((Date.now() - st) / 1000).toFixed(1) }));

const rows = [];
const tStart = Date.now();
const report = () => {
  const n = rows.length; if (!n) return;
  const pct = (f) => ((rows.filter(f).length / n) * 100).toFixed(0) + "%";
  console.log(`\n  ── supervised ${n} asks · correct ${pct((r) => r.correct === "yes")} (no ${pct((r) => r.correct === "no")}) · gap ${pct((r) => r.gap)} · hard ${pct((r) => r.hard)} · learned ${Object.keys(learned).length} rules ──\n`);
};

let i = 0, langIdx = 0;
const browser = await chromium.launch();
try {
  while (Date.now() - tStart < BUDGET && i < CAP) {
    const mode = i % 4 === 3 ? "agent" : "chat";
    const ctx = await browser.newContext({ viewport: { width: 1300, height: 1000 } });
    // THE FOLD HEALS ITSELF: past lessons are seeded into the fold's OWN store (hd:fold-healed), so the fold
    // applies the correction at runtime — not the harness rewriting the query.
    const seed = Object.entries(learned).map(([from, to]) => ({ schema: "HealedRule@1", from, to, by: "supervisor", at: new Date().toISOString() }));
    const seedLessons = proposals.map((p) => ({ schema: "LessonProposal@1", id: p.id, at: p.at, mechanism: p.mechanism, promptRule: p.promptRule }));
    await ctx.addInitScript(([h, l]) => { try { localStorage.setItem("hd:fold-healed", JSON.stringify(h)); localStorage.setItem("hd:fold-lessons", JSON.stringify(l)); } catch {} }, [seed, seedLessons]);
    if (mode === "agent") await ctx.addInitScript(() => { try { localStorage.setItem("fold-chat:engagement", "code"); } catch {} });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: "load", timeout: 90000 });
    await page.waitForFunction(() => { const e = document.getElementById("input"); return e && !e.disabled; }, null, { timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(800);

    const ask = i % 10 === 9 ? LANG_EXTRA[langIdx++ % LANG_EXTRA.length] : asks[(i * 19) % asks.length];
    const text = ask.text;   // sent RAW — the fold heals it itself from its seeded store

    const st = Date.now();
    const before = await page.evaluate(() => document.querySelectorAll(".msg.assistant").length);
    await page.fill("#input", text); await page.click("#send");
    await page.waitForFunction((k) => document.querySelectorAll(".msg.assistant").length > k, before, { timeout: 150000 }).catch(() => {});
    await page.waitForFunction(() => { const e = document.getElementById("input"); return e && !e.disabled && e.getAttribute("aria-busy") !== "true"; }, null, { timeout: 150000 }).catch(() => {});
    const m = await measure(page, st);

    const sv = await supervise(ask.text, m);
    // WHAT THE SYSTEM DID THIS ROUND (for the live dashboard's commentary/action panel)
    let action = m.answered ? "answered from the sources" : m.refused ? "refused" : m.gap ? "gap (" + (m.voidKind || "?") + ")" : m.hard ? "marked hard" : "answered";
    // PROPOSE + GO LIVE INSTANTLY: a supervisor rule is written to the log AND seeded into this page's own
    // store right now, so the fold's very next turn prompts by it. Behavioral only — never code.
    if (sv && sv.proposal && sv.proposal.promptRule) {
      const p = saveProposal({ id: "l" + Date.now().toString(36), at: new Date().toISOString(), round: i, mechanism: sv.proposal.mechanism, promptRule: sv.proposal.promptRule, ask: String(ask.text).slice(0, 90), flap: sv.correct });
      try { await page.evaluate((r) => { const a = JSON.parse(localStorage.getItem("hd:fold-lessons") || "[]"); a.push(r); localStorage.setItem("hd:fold-lessons", JSON.stringify(a)); }, { schema: "LessonProposal@1", id: p.id, at: p.at, mechanism: p.mechanism, promptRule: p.promptRule }); } catch (e) {}
      action = "proposal live [" + p.mechanism + "]: " + p.promptRule.slice(0, 80);
      console.log(`  ◉ proposal live [${p.mechanism}] ${p.promptRule.slice(0, 90)}`);
    }
    // LEARN: a misread that the supervisor can state cleanly becomes a query correction for next time.
    if (sv && sv.correct === "no" && sv.mean && norm(sv.mean) !== norm(ask.text) && norm(ask.text).length >= 3 && norm(sv.mean).length >= 3) {
      const from = norm(ask.text), to = norm(sv.mean);
      learned[from] = to;
      fs.writeFileSync(LEARNED, JSON.stringify(learned, null, 1));
      action += " · learned: \u201c" + from.slice(0, 40) + "\u201d -> \u201c" + to.slice(0, 40) + "\u201d";
      console.log(`  ● learned: "${from}" -> "${to}"`);
    }
    const lesson = { n: i, mode, lang: ask.lang || "en", cls: ask.cls || "other", text: ask.text.slice(0, 80), answerText: m.answerText, nSources: m.nSources, ...m, correct: sv && sv.correct, lesson: sv && sv.lesson, mean: sv && sv.mean, action };
    fs.appendFileSync(LESSONS, JSON.stringify(lesson) + "\n");
    rows.push(lesson);
    console.log(`[${String(i).padStart(3)}] ${mode.padEnd(5)} ${sv ? (sv.correct || "?").padEnd(9) : "no-supervisor"} ${m.secs}s  ${ask.text.slice(0, 66)}${m.gap ? "  [gap " + (m.voidKind || "?") + "]" : m.hard ? "  [hard]" : ""}`);
    if (rows.length % BATCH === 0) report();
    await ctx.close();
    i++;
  }
} catch (e) { console.error("RUNNER ERROR:", String((e && e.message) || e)); }
finally {
  await browser.close();
  console.log(`\nDONE — ${rows.length} supervised asks in ${((Date.now() - tStart) / 1000).toFixed(0)}s`);
  report();
  console.log("lessons -> wildchat-lessons.jsonl · learned -> wildchat-learned.json");
}