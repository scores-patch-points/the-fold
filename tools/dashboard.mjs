// tools/dashboard.mjs — live status dashboard for the supervised learning loop.
// Serves a small page on :8820 that tails wildchat-lessons.jsonl / wildchat-learned.json /
// wildchat-proposals.jsonl / wildchat-night.log over SSE, and opens it in the browser.
//
//   node tools/dashboard.mjs [--port 8820]   (then open http://127.0.0.1:8820/)
//   --open  opens Chrome for you
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const ARG = (n, d) => process.argv.find((_, i) => process.argv[i - 1] === n) || d;
const PORT = Number(ARG("--port", 8820));
const OPEN = process.argv.includes("--open");

const F = {
  lessons: path.join(ROOT, "wildchat-lessons.jsonl"),
  learned: path.join(ROOT, "tools", "wildchat-learned.json"),
  proposals: path.join(ROOT, "wildchat-proposals.jsonl"),
  nightlog: path.join(ROOT, "wildchat-night.log"),
};
const tailLines = (file, n) => { try { const s = fs.readFileSync(file, "utf8"); const a = s.split("\n").filter(Boolean); return a.slice(-n); } catch { return []; } };
const readJSON = (file, d) => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return d; } };

function snapshot() {
  const lessons = tailLines(F.lessons, 40).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const learned = readJSON(F.learned, {});
  const proposals = tailLines(F.proposals, 400).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const logs = tailLines(F.nightlog, 8);
  const n = lessons.length;
  const pct = (f) => (n ? ((lessons.filter(f).length / n) * 100).toFixed(0) + "%" : "—");
  return {
    at: new Date().toISOString(), n,
    stats: {
      correct: pct((x) => x.correct === "yes"), wrong: pct((x) => x.correct === "no"),
      ambiguous: pct((x) => x.correct === "ambiguous"), unverified: pct((x) => x.correct === "unverified"),
      answered: pct((x) => x.answered), gap: pct((x) => x.gap), hard: pct((x) => x.hard),
      learned: Object.keys(learned).length, proposals: proposals.length,
      avgSecs: n ? (lessons.reduce((a, x) => a + Number(x.secs || 0), 0) / n).toFixed(1) : "—",
    },
    lessons: lessons.reverse(),           // newest first
    proposed: proposals.slice(-5).reverse().map((p) => ({ mechanism: p.mechanism, promptRule: p.promptRule, round: p.round })),
    logs,
  };
}

const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>the fold · live learning dashboard</title>
<style>
body{margin:0;font:13px/1.45 -apple-system,"Segoe UI",Roboto,sans-serif;background:#0e1116;color:#d7dde5}
.wrap{max-width:1200px;margin:0 auto;padding:14px}
h1{font-size:15px;font-weight:650;color:#eef1f5;margin:0 0 10px;display:flex;gap:10px;align-items:baseline}
h1 .dot{color:#4ade80;font-size:12px}.muted{color:#8b96a3;font-weight:400;font-size:12px}
.cards{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
.card{background:#161b22;border:1px solid #232c37;border-radius:8px;padding:7px 12px;min-width:84px}
.card b{display:block;font-size:18px;color:#fff}.card span{font-size:11px;color:#8b96a3;text-transform:uppercase;letter-spacing:.05em}
.card.good b{color:#4ade80}.card.bad b{color:#f87171}.card.hot b{color:#fbbf24}
.panels{display:grid;grid-template-columns:1.5fr 1fr;gap:14px}
@media(max-width:900px){.panels{grid-template-columns:1fr}}
.panel{min-width:0}
.panel h2{font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:#8b96a3;margin:0 0 8px}
.feed{display:flex;flex-direction:column;gap:10px}
.turn{background:#131920;border:1px solid #232c37;border-radius:10px;padding:9px 11px}
.bub{margin:4px 0;white-space:pre-wrap;word-break:break-word}
.bub.user{color:#cbd5e1}
.bub.me{color:#e8edf3;border-left:2px solid #3a7bd5;padding-left:8px}
.meta{display:flex;gap:8px;align-items:baseline;font-size:11px;color:#7a8494;margin-bottom:4px}
.badge{font-size:10px;padding:1px 6px;border-radius:99px;background:#202a36;color:#aeb8c3}
.badge.yes{background:#14532d;color:#86efac}.badge.no{background:#7f1d1d;color:#fca5a5}
.badge.gap{background:#3b2f0f;color:#fcd34d}.badge.hard{background:#4a1d1d;color:#f9a8d4}
.badge.ok{background:#14532d;color:#86efac}
.cmt{border-left:2px solid #2f6feb;padding-left:9px;margin:5px 0;color:#c9d4e0;font-size:12px}
.cmt .lbl{color:#60a5fa;text-transform:uppercase;font-size:10px;letter-spacing:.05em}
.cmt a{color:#c9a84c;word-break:break-word}
.live{margin-top:12px;border-top:1px solid #232c37;padding-top:8px}
.live .lbl{color:#fde68a;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
.log{font:12px ui-monospace,Menlo,monospace;color:#7a8494;white-space:pre-wrap}
.prop{margin-bottom:10px;font-size:12px;color:#9fb0c0;border-left:2px solid #fbbf24;padding-left:9px}
.prop b{color:#fde68a}
</style></head><body><div class="wrap">
<h1><span class="dot">●</span> the fold · LIVE learning loop <span class="muted" id="clock"></span></h1>
<div class="cards" id="cards"></div>
<div id="props" class="prop"></div>
<div class="panels">
  <div class="panel"><h2>Chat history — live</h2><div class="feed" id="history"></div></div>
  <div class="panel"><h2>The system's commentary · actions</h2><div class="feed" id="commentary"></div></div>
</div>
<div class="live"><div class="lbl">live loop output</div><div id="log" class="log"></div></div>
</div>
<script>
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
const badge = (k, t) => k ? '<span class="badge ' + k + '">' + (t || "") + "</span> " : "";
function render(j) {
  $("clock").textContent = new Date(j.at).toLocaleTimeString() + "  · " + j.n + " supervised asks";
  $("cards").innerHTML = [
    ["asks", j.n, ""], ["correct", j.stats.correct, "good"], ["wrong", j.stats.wrong, "bad"],
    ["gap", j.stats.gap, "hot"], ["hard", j.stats.hard, ""], ["avg", j.stats.avgSecs + "s", ""],
    ["learned", j.stats.learned, "good"], ["proposals", j.stats.proposals, "hot"],
  ].map(([l, v, c]) => '<div class="card ' + (c || "") + '"><b>' + v + "</b><span>" + l + "</span></div>").join("");
  $("props").innerHTML = j.proposed.length ? "<b>Proposals — live for the next turn</b><br>" + j.proposed.map((p) => "◇ [" + p.mechanism + "] " + esc(p.promptRule)).join("<br>") : "";
  $("history").innerHTML = j.lessons.map((x) =>
    '<div class="turn"><div class="meta">#' + x.n + " · " + (x.mode || "chat") + " · " + x.secs + "s " +
    (x.correct ? '<span class="badge ' + (x.correct === "yes" ? "yes" : x.correct === "no" ? "no" : "gap") + '">' + esc(x.correct) + "</span> " : "") +
    (x.gap ? '<span class="badge gap">' + esc(x.voidKind || "gap") + "</span> " : "") +
    (x.hard ? '<span class="badge hard">hard</span> ' : "") +
    (x.nSources ? '<span class="badge ok">' + x.nSources + " src</span>" : "") + "</div>" +
    '<div class="bub user">👤 ' + esc(x.text) + "</div>" +
    '<div class="bub me">🤖 ' + esc(x.answerText || x.content || "") + "</div></div>").join("");
  $("commentary").innerHTML = j.lessons.map((x) =>
    '<div class="turn"><div class="meta">#' + x.n + " · " + esc(x.cls || "other") + "</div>" +
    '<div class="cmt"><span class="lbl">verdict</span> ' + esc(x.correct) + "</div>" +
    '<div class="cmt"><span class="lbl">commentary</span> ' + esc(x.lesson || "—") + "</div>" +
    (x.mean ? '<div class="cmt"><span class="lbl">meant</span> ' + esc(x.mean) + "</div>" : "") +
    (x.action ? '<div class="cmt" style="border-color:#fbbf24"><span class="lbl">action</span> ' + esc(x.action) + "</div>" : "") +
    "</div>").join("");
  $("log").textContent = j.logs.join("\\n") + "\\n";
}
const es = new EventSource("/events");
es.onmessage = (e) => { try { render(JSON.parse(e.data)); } catch {} };
fetch("/snapshot").then((r) => r.json()).then(render).catch(() => {});
</script></body></html>`;

const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x").pathname;
  if (u === "/events") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive", "access-control-allow-origin": "*" });
    res.write("retry: 1500\n\n");
    let last = "";
    const tick = () => { const s = JSON.stringify(snapshot()); if (s !== last) { res.write("data: " + s + "\n\n"); last = s; } };
    const iv = setInterval(tick, 1200);
    req.on("close", () => clearInterval(iv));
    return;
  }
  if (u === "/snapshot") { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify(snapshot())); }
  res.writeHead(200, { "content-type": "text/html" });
  res.end(HTML);
});
server.listen(PORT, "127.0.0.1", () => {
  console.log(`dashboard live at http://127.0.0.1:${PORT}/`);
  if (OPEN) execSync(`open -a "Google Chrome" "http://127.0.0.1:${PORT}/"`, { stdio: "ignore" });
});