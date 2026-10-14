// tools/wildchat-run.mjs — the continuous real-chat suite against the LIVE fold.
//
// Cycles the WildChat battery (tools/wildchat-battery.json) across the real surface:
//   · topics WITHIN a chat  (ask A, then a DIFFERENT-topic ask B in the same chat)
//   · NEW chats             (a fresh chat per first turn)
//   · Agent vs Chat         (a share of runs start in the Agent engagement, testing the fold->reading lane handoff)
//   · swapping languages    (a small multilingual set is interleaved so detectLang is exercised)
//
// Measures each ask from the STORED message: answered (grounded text, no void) / gap (void kind) /
// hard (murmur.hard) / refused (an agent/code refusal) and the seconds. Appends one JSON line per
// ask to wildchat-results.jsonl; prints a rolling summary every N asks.
//
//   node tools/wildchat-run.mjs [--budget 240] [--cap 40] [--batch 8]
//
// Continuous: it loops until the budget (seconds) or cap (asks) is spent, then prints the summary.
import { chromium } from "../node_modules/playwright/index.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL = process.env.FOLD_URL || "http://127.0.0.1:8814/";
const BATTERY = path.join(HERE, "wildchat-battery.json");
const OUT = path.join(HERE, "..", "wildchat-results.jsonl");
const BUDGET = Number(process.argv.find((_, i) => process.argv[i - 1] === "--budget") || 240) * 1000;
const CAP = Number(process.argv.find((_, i) => process.argv[i - 1] === "--cap") || 40);
const BATCH = Number(process.argv.find((_, i) => process.argv[i - 1] === "--batch") || 8);

const battery = JSON.parse(fs.readFileSync(BATTERY, "utf8"));
const asks = battery.asks || [];
const follows = battery.followups || [];
// Multilingual research asks (the battery itself is English-only; swapping language exercises detectLang + the murmur).
const LANG_EXTRA = [
  { text: "Qui est le président des États-Unis ?", lang: "fr" },
  { text: "¿Quién fundó Nashville y cuándo?", lang: "es" },
  { text: "Was ist die Hauptstadt von Frankreich?", lang: "de" },
  { text: "La capitale de la France est Paris, n'est-ce pas ?", lang: "fr" },
  { text: "¿Cuántos estados tiene Estados Unidos?", lang: "es" },
  { text: "Wer war Ada Lovelace?", lang: "de" },
];

const PICK = (i) => { const a = asks[(i * 17) % asks.length]; return { text: a.text, cls: a.cls, lang: "en" }; };
const PICK_FOLLOW = (i) => { const f = follows[(i * 11) % (follows.length || 1)]; return { text: f.text, cls: "follow-up", lang: "en" }; };

const results = [];
const started = Date.now();
const t0 = () => Date.now() - started;

const measure = (page, st = Date.now()) => page.evaluate(() => {
  const all = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).flatMap((s) => s.messages || []);
  const a = all.filter((m) => m.role === "assistant").pop() || {};
  const content = String(a.content || "");
  const voidKind = a.grounding && a.grounding.void ? a.grounding.void.kind : (a.void ? (a.void.kind || null) : null);
  const hard = !!(a.murmur && a.murmur.hard);
  const refused = /refus|no draft was produced|only build things|opencode serve|can only build/i.test(content);
  const gap = !!voidKind || /no source|nothing supports|no answer was written|no draft/i.test(content.slice(0, 400));
  const answered = content.trim().length > 25 && !gap && !refused;
  return { answered, gap, voidKind: voidKind || null, hard, refused, content: content.replace(/\s+/g, " ").slice(0, 120) };
}).then((m) => ({ ...m, secs: ((Date.now() - st) / 1000).toFixed(1) }));

async function runAsk(page, ask, mode, i, st) {
  const before = await page.evaluate(() => document.querySelectorAll(".msg.assistant").length);
  await page.fill("#input", ask.text); await page.click("#send");
  await page.waitForFunction((k) => document.querySelectorAll(".msg.assistant").length > k, before, { timeout: 150000 }).catch(() => {});
  await page.waitForFunction(() => { const i = document.getElementById("input"); return i && !i.disabled && i.getAttribute("aria-busy") !== "true"; }, null, { timeout: 150000 }).catch(() => {});
  const m = await measure(page, st);
  const row = { n: i, mode, lang: ask.lang || "en", cls: ask.cls || "other", text: ask.text.slice(0, 90), ...m };
  results.push(row);
  fs.appendFileSync(OUT, JSON.stringify(row) + "\n");
  const flag = m.refused ? "  REFUSED" : m.hard ? "  hard" : !m.answered && m.gap ? " gap" : " ok";
  console.log(`[${String(i).padStart(3)}] ${(mode).padEnd(5)} ${(ask.lang || "en").padEnd(3)} ${(ask.cls || "?").padEnd(16)} ${flag} ${m.secs}s  ${ask.text.slice(0, 60)}${m.answered ? "" : "  -> " + m.content.slice(0, 0)}`);
  if (results.length % BATCH === 0) summary();
  return m.answered;
}

function summary() {
  const n = results.length;
  if (!n) return;
  const metric = (fn) => (results.filter(fn).length / n * 100).toFixed(0) + "%";
  const avg = (results.reduce((a, x) => a + Number(x.secs), 0) / n).toFixed(1);
  console.log(`\n  ── rolling ${n}/${CAP} asks ── answered ${metric((x) => x.answered)} · gap ${metric((x) => x.gap)} · hard ${metric((x) => x.hard)} · refused ${metric((x) => x.refused)} · avg ${avg}s\n`);
}

let i = 0;
let langIdx = 0;
const browser = await chromium.launch();
try {
  while (Date.now() - started < BUDGET && i < CAP) {
    const mode = i % 4 === 3 ? "agent" : "chat";                  // ~1 in 4 in the Agent engagement
    const ctx = await browser.newContext({ viewport: { width: 1300, height: 1000 } });
    if (mode === "agent") await ctx.addInitScript(() => { try { localStorage.setItem("fold-chat:engagement", "code"); } catch {} });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: "load", timeout: 90000 });
    await page.waitForFunction(() => { const i = document.getElementById("input"); return i && !i.disabled; }, null, { timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(900);
    // 1) a first-turn ask (or a language swap every 8th)
    let ask = i % 8 === 7 ? LANG_EXTRA[langIdx++ % LANG_EXTRA.length] : PICK(i);
    await runAsk(page, ask, mode, i);
    // 2) topics within the SAME chat: a different-topic follow-up
    const follow = PICK_FOLLOW(i);
    await runAsk(page, follow, mode + "+", i, Date.now());
    await ctx.close();
    i++;
  }
} catch (e) { console.error("RUNNER ERROR:", String((e && e.message) || e)); }
finally {
  await browser.close();
  console.log(`\nDONE — ${results.length} asks in ${(t0() / 1000).toFixed(0)}s → ${OUT}`);
  summary();
}