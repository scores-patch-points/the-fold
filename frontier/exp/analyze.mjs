// exp/analyze.mjs — tables (markdown) and plots (SVG) from the raw CSVs. No model; deterministic. Writes runs/results/summary.md + *.svg.
//   node frontier/exp/analyze.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const R = (f) => fileURLToPath(new URL(`../runs/results/${f}`, import.meta.url));
function parse(f) {
  if (!existsSync(R(f))) return null;
  const [head, ...lines] = readFileSync(R(f), "utf8").trim().split("\n");
  const cols = head.split(",");
  const split = (l) => { const out = []; let cur = "", q = false; for (let i = 0; i < l.length; i++) { const c = l[i]; if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c; } out.push(cur); return out; };
  return lines.map((l) => Object.fromEntries(split(l).map((v, i) => [cols[i], v])));
}
const wilson = (k, n) => { if (!n) return [0, 0]; const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [(c - m) / d, (c + m) / d]; };
const pct = (k, n) => (n ? `${((100 * k) / n).toFixed(0)}% (${k}/${n}) [${wilson(k, n).map((x) => (100 * x).toFixed(0)).join("–")}]` : "—");
const group = (rows, key) => rows.reduce((m, r) => { const k = typeof key === "function" ? key(r) : r[key]; (m[k] ??= []).push(r); return m; }, {});
const sum = (xs, f) => xs.reduce((n, x) => n + (+f(x) || 0), 0);
const max = (xs, f) => xs.reduce((n, x) => Math.max(n, +f(x) || 0), 0);
const lenient = (r) => (r.truth === "" ? r.correct === "1" : r.value && String(r.value).toLowerCase().includes(String(r.truth).toLowerCase()));
const WATTS = 20; // declared estimate (PREREG.md): M3 package power under GPU inference, ±50%
let md = "";

function svgLines({ title, xlab, ylab, series, logx = true, file }) {
  const W = 560, H = 320, L = 60, Bm = 44, T = 30, Rm = 140;
  const xs = series.flatMap((s) => s.pts.map((p) => p[0])), ys = series.flatMap((s) => s.pts.map((p) => p[1]));
  const fx = logx ? Math.log10 : (x) => x; const x0 = Math.min(...xs.map(fx)), x1 = Math.max(...xs.map(fx)), y1 = Math.max(...ys, 1) * 1.08;
  const X = (x) => L + ((fx(x) - x0) / (x1 - x0 || 1)) * (W - L - Rm), Y = (y) => H - Bm - (y / y1) * (H - Bm - T);
  const colors = ["#2a6fdb", "#d9534f", "#2e9e5b", "#9b59b6", "#e69f00", "#555"];
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="system-ui" font-size="11"><rect width="${W}" height="${H}" fill="#fff"/><text x="${L}" y="18" font-size="13" font-weight="600">${title}</text>`;
  s += `<line x1="${L}" y1="${H - Bm}" x2="${W - Rm}" y2="${H - Bm}" stroke="#888"/><line x1="${L}" y1="${T}" x2="${L}" y2="${H - Bm}" stroke="#888"/>`;
  for (const x of [...new Set(xs)]) s += `<text x="${X(x)}" y="${H - Bm + 14}" text-anchor="middle">${logx ? `1e${Math.round(Math.log10(x))}` : x}</text>`;
  for (let i = 0; i <= 4; i++) { const v = (y1 * i) / 4; s += `<text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v >= 100 ? Math.round(v) : v.toFixed(2)}</text><line x1="${L}" x2="${W - Rm}" y1="${Y(v)}" y2="${Y(v)}" stroke="#eee"/>`; }
  s += `<text x="${(L + W - Rm) / 2}" y="${H - 8}" text-anchor="middle">${xlab}</text><text x="14" y="${(T + H - Bm) / 2}" transform="rotate(-90 14 ${(T + H - Bm) / 2})" text-anchor="middle">${ylab}</text>`;
  series.forEach((sr, i) => { const c = sr.color ?? colors[i % colors.length]; const pts = sr.pts.sort((a, b) => a[0] - b[0]); s += `<polyline fill="none" stroke="${c}" stroke-width="2" ${sr.dash ? 'stroke-dasharray="5 4"' : ""} points="${pts.map((p) => `${X(p[0])},${Y(p[1])}`).join(" ")}"/>` + pts.map((p) => `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="3" fill="${c}"/>`).join(""); s += `<text x="${W - Rm + 8}" y="${T + 14 * i + 10}" fill="${c}">${sr.name}</text>`; });
  writeFileSync(R(file), s + "</svg>\n");
  return `![${title}](${file})`;
}

// ── H1 / H2 scaling ───────────────────────────────────────────────
const sc = parse("scaling.csv");
if (sc) {
  md += "## H1/H2: scaling (mixed synthetic world, qwen3:4b, B = 4000)\n\n| size (est. tokens) | arm | n | exact | lenient | gap rate (answerable) | unanswerable → gap | calls/q | max ctx/call (est / engine) | engine s/q | est. J/correct |\n|---|---|---|---|---|---|---|---|---|---|---|\n";
  const bySize = group(sc, "size_tokens");
  const accSeries = {}, ctxSeries = {};
  for (const size of Object.keys(bySize).sort((a, b) => a - b)) for (const [arm, rs] of Object.entries(group(bySize[size], "arm"))) {
    const ans = rs.filter((r) => r.truth !== ""), un = rs.filter((r) => r.truth === "");
    const k = sum(rs, (r) => r.correct), eng = sum(rs, (r) => r.engine_ms) / 1000;
    md += `| ${size} | ${arm} | ${rs.length} | ${pct(k, rs.length)} | ${pct(rs.filter(lenient).length, rs.length)} | ${pct(sum(ans, (r) => r.gap), ans.length)} | ${pct(sum(un, (r) => r.gap), un.length)} | ${(sum(rs, (r) => r.calls) / rs.length).toFixed(2)} | ${max(rs, (r) => r.max_ctx_est)} / ${max(rs, (r) => r.max_ctx_engine)} | ${(eng / rs.length).toFixed(1)} | ${k ? ((eng * WATTS) / k).toFixed(0) : "—"} |\n`;
    if (rs.some((r) => +r.calls > 0)) { (accSeries[arm] ??= []).push([+size, k / rs.length]); (ctxSeries[arm] ??= []).push([+size, max(rs, (r) => r.max_ctx_est)]); }
  }
  md += "\nWhere the long-context arm shows 0 calls, it was a typed gap (`exceeds_model_window_32k`), not a run.\n\n";
  md += svgLines({ title: "Accuracy (exact) vs corpus size", xlab: "corpus tokens (est.)", ylab: "accuracy", series: Object.entries(accSeries).map(([name, pts]) => ({ name, pts })), file: "scaling-accuracy.svg" }) + "\n\n";
  md += svgLines({ title: "Max context per call vs corpus size (B = 4000)", xlab: "corpus tokens (est.)", ylab: "tokens (est.)", series: [...Object.entries(ctxSeries).map(([name, pts]) => ({ name, pts })), { name: "B", pts: Object.values(ctxSeries)[0].map((p) => [p[0], 4000]), dash: true, color: "#000" }], file: "scaling-context.svg" }) + "\n\n";
  md += "Per question type (apparatus vs retrieval vs longctx, all sizes pooled):\n\n| qtype | " + Object.keys(group(sc, "arm")).join(" | ") + " |\n|---|" + Object.keys(group(sc, "arm")).map(() => "---").join("|") + "|\n";
  for (const [qt, rs] of Object.entries(group(sc, "qtype"))) md += `| ${qt} | ` + Object.keys(group(sc, "arm")).map((a) => { const x = rs.filter((r) => r.arm === a && (+r.calls > 0 || a === "apparatus")); return pct(sum(x, (r) => r.correct), x.length); }).join(" | ") + " |\n";
  md += "\n";
}

// ── ablations ────────────────────────────────────────────────────
const ab = parse("ablations.csv");
if (ab) {
  md += "## Ablations (size 1e5, each question asked twice on one fresh log per arm)\n\n| arm | pass | exact | unanswerable → gap | wrong (non-gap) | calls total | Δ calls vs full | Δ exact vs full (pts) |\n|---|---|---|---|---|---|---|---|\n";
  const base = {};
  for (const [armp, rs] of Object.entries(group(ab, "arm"))) { const [arm, pass] = armp.split("#"); const un = rs.filter((r) => r.truth === ""); const k = sum(rs, (r) => r.correct), wrong = rs.filter((r) => r.correct === "0" && r.gap === "0").length, calls = sum(rs, (r) => r.calls); if (arm === "full") base[pass] = { k, calls, n: rs.length }; }
  for (const [armp, rs] of Object.entries(group(ab, "arm"))) { const [arm, pass] = armp.split("#"); const un = rs.filter((r) => r.truth === ""); const k = sum(rs, (r) => r.correct), wrong = rs.filter((r) => r.correct === "0" && r.gap === "0").length, calls = sum(rs, (r) => r.calls); const b = base[pass]; md += `| ${arm} | ${pass} | ${pct(k, rs.length)} | ${pct(sum(un, (r) => r.gap), un.length)} | ${wrong} | ${calls} | ${b ? calls - b.calls : "—"} | ${b ? (((k - b.k) / rs.length) * 100).toFixed(0) : "—"} |\n`; }
  md += "\nPer question type, pass 1:\n\n| arm | " + Object.keys(group(ab, "qtype")).join(" | ") + " |\n|---|" + Object.keys(group(ab, "qtype")).map(() => "---").join("|") + "|\n";
  for (const [armp, rs] of Object.entries(group(ab.filter((r) => r.arm.endsWith("#pass1")), "arm"))) md += `| ${armp.split("#")[0]} | ` + Object.keys(group(ab, "qtype")).map((q) => { const x = rs.filter((r) => r.qtype === q); return `${sum(x, (r) => r.correct)}/${x.length}`; }).join(" | ") + " |\n";
  md += "\n";
}

// ── H7 depth ─────────────────────────────────────────────────────
const dp = parse("depth.csv");
if (dp) {
  md += "## H7: stigmergic depth (generated deductions, decoys = depth, qwen3:4b)\n\n| depth | instance | arm | answer (truth) | correct | calls | steps | max ctx | logos/witness flags | planted circular caught | planted contest caught | model step faults caught |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n";
  for (const r of dp) md += `| ${r.depth} | ${r.instance} | ${r.arm} | ${r.answer} (${r.truth}) | ${r.correct} | ${r.calls} | ${r.steps} | ${r.max_ctx_est} | ${r.flags || "—"} | ${r.planted_circular_caught || "—"} | ${r.planted_contest_caught || "—"} | ${r.model_step_faults} |\n`;
  const accBy = {};
  for (const r of dp.filter((r) => r.instance !== "faulted")) (accBy[r.arm] ??= {})[r.depth] = [...((accBy[r.arm] ?? {})[r.depth] ?? []), +r.correct];
  md += "\n" + svgLines({ title: "Accuracy vs depth (clean + broken instances)", xlab: "depth", ylab: "accuracy", logx: false, series: Object.entries(accBy).map(([name, m]) => ({ name, pts: Object.entries(m).map(([d, xs]) => [+d, xs.reduce((a, b) => a + b, 0) / xs.length]) })), file: "depth-accuracy.svg" }) + "\n\n";
}

// ── H6 compounding ───────────────────────────────────────────────
const cp = parse("compound.csv");
if (cp) {
  md += "## H6: compounding (200 related questions, one growing log per arm)\n\n| arm | exact | calls total | calls in q 1–50 | calls in q 151–200 | answered without a model call |\n|---|---|---|---|---|---|\n";
  const series = [];
  for (const [arm, rs] of Object.entries(group(cp, "arm"))) {
    const seg = (a, b) => sum(rs.filter((r) => +r.i >= a && +r.i < b), (r) => r.calls);
    md += `| ${arm} | ${pct(sum(rs, (r) => r.correct), rs.length)} | ${sum(rs, (r) => r.calls)} | ${seg(0, 50)} | ${seg(150, 200)} | ${pct(rs.filter((r) => r.calls === "0" && r.status === "ok").length, rs.length)} |\n`;
    const pts = []; let c = 0; rs.sort((a, b) => a.i - b.i).forEach((r) => { c += +r.calls; if ((+r.i + 1) % 20 === 0) pts.push([+r.i + 1, c]); }); series.push({ name: arm, pts });
  }
  md += "\n" + svgLines({ title: "Cumulative model calls over the question stream", xlab: "question #", ylab: "calls", logx: false, series, file: "compound-calls.svg" }) + "\n\n";
}
writeFileSync(R("summary.md"), md);
console.log(md.slice(0, 4000));
