// eval/houdini/run.mjs — the Houdini battery.
//   node eval/houdini/run.mjs            the scoreboard (calibration seeds, then held-out seeds), flatness, latency, mutants; writes eval/houdini/results.json
//   node eval/houdini/run.mjs --check    exit 1 when a floor in eval/houdini/FLOORS.json is broken, the oracle is below 100%, or a mutant survives
//
// Seeds: CALIBRATION [1,2] were looked at while the declared numbers in fold-chat-houdini.js were chosen; HELD-OUT [101,102,103] were not. Both are reported; the held-out numbers are the ones to believe.
// What the table is: for each arm, the share of the available score on each property, on invented conversations whose gold is known by construction. What it is NOT: a measure of answer quality.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LANGS, makeConversation, makeProbes } from "./world.mjs";
import { makeArms, deepFreeze, feasibleNeed, BASE, MUTANTS } from "./arms.mjs";
import { scoreProbe, mean } from "./metrics.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CAL = [1, 2, 101, 102, 103], HELD = [201, 202, 203], LENGTHS = [24, 60, 160];   // 101-103 were the first held-out set and were looked at while the class rules were built: they are calibration now
const METRICS = ["needRecall", "shapePrecision", "guard", "decoyRejection", "budget", "honesty", "integrity", "determinism", "flatness", "worstScriptRecall", "semanticRecall", "latency"];
const ARMS = ["oracle", "houdini", "houdini-lex", "positional", "empty", "everything"];

function parts(conv, probe) {
  const c = { ...conv, summary: structuredClone(conv.summary), history: structuredClone(conv.history), referents: structuredClone(conv.referents) };
  return deepFreeze({ basePrompt: BASE, summary: c.summary, history: c.history, question: probe.question, referents: c.referents });
}

/** Gold for a multi-topic ask is the BALANCED core of the feasible prefix: every named topic gets the same quota, and an odd leftover record is not required of anyone. */
function balanced(need, conv) {
  const topicOf = (t) => conv.store.find((x) => x.turn === t)?.topic;
  const by = new Map();
  for (const t of need) { const k = topicOf(t); if (!by.has(k)) by.set(k, []); by.get(k).push(t); }
  if (by.size < 2) return need;
  const q = Math.min(...[...by.values()].map((l) => l.length));
  return need.filter((t) => by.get(topicOf(t)).indexOf(t) < q);
}

/** Run one arm over a set of conversations → raw per-probe rows. */
function runArm(name, seeds) {
  const rows = [];
  for (const seed of seeds) for (const lang of LANGS) for (const L of LENGTHS) {
    const conv = makeConversation({ seed, L, lang }), probes = makeProbes(conv, seed), arms = makeArms(conv);
    for (const probe of probes) {
      const baselineChars = arms.positional(parts(conv, probe), probe, conv).reduce((n, m) => n + m.content.length, 0);
      const need = balanced(feasibleNeed(parts(conv, probe), probe, conv, baselineChars), conv);   // the same feasible gold for every arm
      const gold = { ...probe, need, pinnedNeed: probe.pinnedNeed.filter((t) => need.includes(t)) };
      let messages, again, threw = false;
      try { messages = arms[name](parts(conv, probe), probe, conv, baselineChars); again = arms[name](parts(conv, probe), probe, conv, baselineChars); } catch { threw = true; }
      if (threw) { rows.push({ cls: probe.cls, lang, L, seed, threw: true, integrity: 0, determinism: 0 }); continue; }
      const s = scoreProbe({ messages, probe: gold, conv, baselineChars });
      rows.push({ cls: probe.cls, lang, L, seed, ...s, determinism: JSON.stringify(messages) === JSON.stringify(again) ? 1 : 0 });
    }
  }
  return rows;
}

/** Context size must not grow with the conversation (the fold's own claim). Mean chars over the thread-dependent probe classes, at L = 80 … 640 (after the positional window has saturated), English. */
function flatness(name) {
  const ladder = [80, 160, 320, 640], size = [];
  for (const L of ladder) {
    const conv = makeConversation({ seed: 7, L, lang: "en" }), probes = makeProbes(conv, 7).filter((p) => /^callback|^thin|^multi/.test(p.cls)), arms = makeArms(conv);
    size.push(mean(probes.map((p) => { try { const bl = arms.positional(parts(conv, p), p, conv).reduce((n, m) => n + m.content.length, 0); return arms[name](parts(conv, p), p, conv, bl).reduce((n, m) => n + m.content.length, 0); } catch { return null; } })));
  }
  const ratio = size[size.length - 1] / size[0];
  return { ladder, size: size.map((x) => Math.round(x)), ratio: Number(ratio.toFixed(3)), score: Math.min(1, 1.25 / ratio) };
}
function latency(name) {
  const conv = makeConversation({ seed: 7, L: 640, lang: "en" }), probes = makeProbes(conv, 7), arms = makeArms(conv), ms = [];
  // CPU time of the call (user + system), not wall-clock: a busy machine (other jobs, another agent) stretches wall-clock without the code getting slower, and this gate is about the code
  for (const p of probes) { const pp = parts(conv, p); const c0 = process.cpuUsage(); try { arms[name](pp, p, conv); } catch { /* scored elsewhere */ } const c = process.cpuUsage(c0); ms.push((c.user + c.system) / 1000); }
  ms.sort((a, b) => a - b);
  return { medianMs: Number(ms[Math.floor(ms.length / 2)].toFixed(2)), worstMs: Number(ms[ms.length - 1].toFixed(2)), score: ms[Math.floor(ms.length / 2)] <= 100 ? 1 : 0 };
}

function summarise(name, rows) {
  const by = (cls) => rows.filter((r) => r.cls === cls);
  const recallRows = rows.filter((r) => !r.threw && r.cls !== "semantic" && r.cls !== "pressure");
  const cb = rows.filter((r) => !r.threw && /^callback/.test(r.cls));
  const perLang = LANGS.map((l) => mean(cb.filter((r) => r.lang === l).map((r) => r.recall)));
  const m = {
    needRecall: mean(recallRows.map((r) => r.recall)),
    shapePrecision: mean(rows.filter((r) => !r.threw).map((r) => r.precision)),
    guard: mean(rows.filter((r) => !r.threw && r.cls !== "pressure").map((r) => r.guard)),
    decoyRejection: mean(rows.filter((r) => !r.threw).map((r) => r.decoyRejection)),
    budget: mean(rows.filter((r) => !r.threw).map((r) => r.budget)),
    honesty: mean(rows.filter((r) => !r.threw).map((r) => r.honesty)),
    integrity: mean(rows.map((r) => r.integrity)),
    determinism: mean(rows.map((r) => r.determinism)),
    worstScriptRecall: Math.min(...perLang.filter((x) => x != null)),
    semanticRecall: mean(by("semantic").map((r) => r.recall)),
  };
  const byClass = {};
  for (const cls of [...new Set(rows.map((r) => r.cls))]) byClass[cls] = { recall: mean(by(cls).map((r) => r.recall)), precision: mean(by(cls).map((r) => r.precision)), n: by(cls).length };
  return { name, metrics: m, byClass, perLang: Object.fromEntries(LANGS.map((l, i) => [l, perLang[i]])) };
}

const fmt = (x) => (x == null ? "  n/a" : (x * 100).toFixed(1).padStart(5));
function table(title, results) {
  const cols = METRICS;
  console.log(`\n${title}`);
  console.log("arm".padEnd(18) + cols.map((c) => c.slice(0, 8).padStart(9)).join("") + "   weakest   mean");
  for (const r of results) {
    const vals = cols.map((c) => r.metrics[c]);
    const have = vals.filter((v) => v != null);
    console.log(r.name.padEnd(18) + vals.map((v) => fmt(v).padStart(9)).join("") + "  " + fmt(Math.min(...have)).padStart(8) + fmt(have.reduce((a, b) => a + b, 0) / have.length).padStart(7));
  }
}

function evaluateSet(seeds, label) {
  const out = [];
  for (const name of [...ARMS, "+reader"]) {
    const s = summarise(name, runArm(name, seeds));
    s.metrics.flatness = flatness(name).score; s.flat = flatness(name);
    const lt = latency(name); s.metrics.latency = lt.score; s.latency = lt;
    out.push(s);
  }
  table(`${label} — seeds ${seeds.join(",")} · ${seeds.length * LANGS.length * LENGTHS.length} conversations`, out);
  return out;
}

const cal = evaluateSet(CAL, "CALIBRATION");
const held = evaluateSet(HELD, "HELD-OUT");

// per-class view of the held-out run for the two arms that matter
console.log("\nHELD-OUT by probe class (recall / precision):");
const classes = Object.keys(held[0].byClass);
console.log("class".padEnd(14) + ["houdini", "positional", "oracle"].map((a) => a.padStart(20)).join(""));
for (const c of classes) console.log(c.padEnd(14) + ["houdini", "positional", "oracle"].map((a) => { const x = held.find((r) => r.name === a).byClass[c]; return `${fmt(x.recall)} /${fmt(x.precision)}`.padStart(20); }).join(""));
console.log("\nHELD-OUT worst-script recall detail (callback probes):");
for (const a of ["houdini", "positional"]) console.log("  " + a.padEnd(11) + Object.entries(held.find((r) => r.name === a).perLang).map(([l, v]) => `${l} ${fmt(v)}`).join("  "));
const hf = held.find((r) => r.name === "houdini"), pf = held.find((r) => r.name === "positional");
console.log(`\nFlatness (mean chars at L=${hf.flat.ladder.join("/")}): houdini ${hf.flat.size.join("/")} (x${hf.flat.ratio}), positional ${pf.flat.size.join("/")} (x${pf.flat.ratio})`);
console.log(`Latency at L=640 (cold: nothing memoised across asks): houdini median ${hf.latency.medianMs} ms, worst ${hf.latency.worstMs} ms; positional median ${pf.latency.medianMs} ms`);

// mutants: each must lower its target metric on the held-out set
console.log("\nMUTANTS (held-out): each breaks one property; the suite must see it");
const mutResults = [];
const houdiniMetrics = hf.metrics;
for (const [k, m] of Object.entries(MUTANTS)) {
  const s = summarise(`mut:${k}`, runArm(`mut:${k}`, HELD));
  const got = s.metrics[m.target], was = houdiniMetrics[m.target], killed = got != null && was != null && got < was - 1e-9;
  mutResults.push({ mutant: k, target: m.target, houdini: was, mutantScore: got, killed });
  console.log(`  ${killed ? "KILLED  " : "SURVIVED"} ${k.padEnd(18)} ${m.target.padEnd(15)} ${fmt(was)} -> ${fmt(got)}`);
}
const reader = held.find((r) => r.name === "+reader");
console.log(`  positive control  +reader: semanticRecall ${fmt(hf.metrics.semanticRecall)} -> ${fmt(reader.metrics.semanticRecall)} (an injected reader moves the metric; the seam is real)`);

const results = { generated: "deterministic; no clock in the numbers", calibration: cal, heldOut: held, mutants: mutResults };
fs.writeFileSync(path.join(HERE, "results.json"), JSON.stringify(results, null, 1));

if (process.argv.includes("--check")) {
  let bad = 0;
  const floors = JSON.parse(fs.readFileSync(path.join(HERE, "FLOORS.json"), "utf8"));
  const o = held.find((r) => r.name === "oracle");
  for (const m of METRICS) if (o.metrics[m] != null && o.metrics[m] < 0.999) { console.error(`FAIL oracle ${m} = ${o.metrics[m]} (the ceiling must be 100%)`); bad++; }
  for (const [m, f] of Object.entries(floors.houdini)) if ((hf.metrics[m] ?? 0) + 1e-9 < f) { console.error(`FAIL houdini ${m} = ${hf.metrics[m]} < floor ${f}`); bad++; }
  for (const x of mutResults) if (!x.killed) { console.error(`FAIL mutant survived: ${x.mutant}`); bad++; }
  process.exit(bad ? 1 : 0);
}
