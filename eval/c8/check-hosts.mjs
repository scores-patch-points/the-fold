// eval/c8/check-hosts.mjs — C8, local-only: classify every host a captured run reached against the declared list.
//   node eval/c8/check-hosts.mjs <dir of drive.mjs .jsonl files> [--fallback-on]
// Reads the per-turn and page-load host counts eval/modelless/drive.mjs records. Fails (exit 1) when a FALLBACK host
// (a public proxy or text reader, fold-chat-hosts.js) was reached on a run made with the fallback off.
// Known limit: "result" means "not local, not declared, not a fallback service" — a result site is identified by
// exclusion, not yet matched against the search results the turn actually received.
import fs from "node:fs";
import path from "node:path";
import { hostClass } from "../../fold-chat-hosts.js";
const dir = process.argv[2], fallbackOn = process.argv.includes("--fallback-on");
if (!dir) { console.error("usage: check-hosts.mjs <dir> [--fallback-on]"); process.exit(2); }
const by = { local: {}, declared: {}, fallback: {}, result: {} }; let turns = 0, files = 0;
const add = (hosts) => { for (const [h, n] of Object.entries(hosts || {})) { const c = hostClass(h); by[c][h] = (by[c][h] || 0) + n; } };
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".jsonl"))) {
  files++;
  for (const line of fs.readFileSync(path.join(dir, f), "utf8").split("\n").filter(Boolean)) {
    const r = JSON.parse(line); add(r.load?.hosts); for (const t of r.turns || []) { turns++; add(t.hosts); }
  }
}
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
console.log(`files ${files} · turns ${turns} · fallback ${fallbackOn ? "ON" : "off"}`);
for (const [c, o] of Object.entries(by)) console.log(`${c.padEnd(9)} ${String(Object.keys(o).length).padStart(4)} hosts ${String(sum(o)).padStart(6)} requests${c === "result" ? "" : "  " + Object.keys(o).sort().join(", ")}`);
const bad = !fallbackOn && Object.keys(by.fallback).length;
console.log(bad ? `FAIL: the fallback was off and ${Object.keys(by.fallback).length} fallback host(s) were reached` : "PASS: no undeclared service was reached (result sites by exclusion — see the known limit)");
process.exit(bad ? 1 : 0);
