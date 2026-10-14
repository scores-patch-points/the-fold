// tools/restart.mjs — ALWAYS a way to restart the fold.
//
// The fold's server (server.mjs) is the one process a broken fold is stuck behind: if it
// wedges, leaks the port, or serves a stale module, nothing at the surface can recover it.
// This is the escape hatch. It is idempotent and safe to run at any time:
//
//   node tools/restart.mjs            # stop whatever holds FOLD_PORT, start server.mjs fresh, wait healthy
//   node tools/restart.mjs --check    # report state only; change nothing
//   FOLD_PORT=9000 node tools/restart.mjs
//
// It never deletes state: the browser's own localStorage and the on-disk ledgers are untouched.
// A restart is a process swap, nothing more.
import { spawn, execSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const PORT = Number(process.env.FOLD_PORT || 8814);
const HOST = process.env.FOLD_HOST || "127.0.0.1";
const BASE = `http://${HOST}:${PORT}`;
const CHECK = process.argv.includes("--check");

const listeners = () => {
  try { return execSync(`lsof -ti tcp:${PORT} -sTCP:LISTEN`, { encoding: "utf8" }).trim().split(/\s+/).filter(Boolean); }
  catch { return []; }
};
const alive = async (ms = 800) => {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(BASE + "/heimdall/status", { signal: c.signal }); return r.ok; }
  catch { return false; }
  finally { clearTimeout(t); }
};

const before = listeners();
const up = await alive();
console.log(`the-fold: port ${PORT} -> ${before.length ? "held by pid " + before.join(",") : "free"}; /heimdall ${up ? "UP" : "down"}`);
if (CHECK) process.exit(0);

// 1) stop whatever holds the port (a prior fold, or a stray). SIGTERM first, then SIGKILL.
if (before.length) {
  for (const pid of before) { try { process.kill(Number(pid), "SIGTERM"); } catch {} }
  for (let i = 0; i < 20 && listeners().length; i++) await sleep(250);
  for (const pid of listeners()) { try { process.kill(Number(pid), "SIGKILL"); } catch {} }
  await sleep(300);
}

// 2) start it fresh, detached, logging to a file the operator can tail.
const log = `/tmp/fold-server.log`;
const out = (await import("node:fs")).openSync(log, "a");
const child = spawn(process.execPath, ["server.mjs"], {
  cwd: ROOT, detached: true, stdio: ["ignore", out, out],
  env: { ...process.env, FOLD_PORT: String(PORT), FOLD_HOST: HOST },
});
child.unref();
console.log(`the-fold: started pid ${child.pid} (${BASE}); log ${log}`);

// 3) wait for health — the same signal the page's bridge detection reads.
let ok = false;
for (let i = 0; i < 60; i++) { if (await alive(1200)) { ok = true; break; } await sleep(500); }
if (!ok) { console.error(`the-fold: NOT healthy after 30 s — see ${log}`); process.exit(1); }
console.log(`the-fold: UP at ${BASE} (pid(s) ${listeners().join(",")})`);
