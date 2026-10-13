// coder-gate.mjs — the MVP gate's coder half (eval/gate/GATE.md, bars K1–K4).
//
//   node eval/gate/coder-gate.mjs extract [--since 2026-10-05] [--max 20]   → eval/gate/coder-tasks.json
//   node eval/gate/coder-gate.mjs run [--door http://127.0.0.1:11436] [--only id,id] → eval/gate/results/coder-<stamp>.jsonl
//
// A TASK is a real fix commit of this week: its test file is kept, its source change is reverted to the parent, and it is admitted
// only if the test PASSES at the fix and FAILS after the revert (fail-to-pass). The task statement is the commit's own subject.
// Workspaces are throwaway detached worktrees in the scratch dir (one per repo, reset per task); the user's checkouts are never
// touched. Sibling imports (../khora, ../janus …) resolve through symlinks next to the workspaces. The judge is the test command
// re-run HERE after the door returns — never the door's own verdict.
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = "/Users/mlacy/Documents/3.0";
const WS = process.env.GATE_WS || "/private/tmp/claude-501/-Users-mlacy-Documents-3-0/db568c87-8748-4571-8b32-b1f43d6358f0/scratchpad/gate-ws";
const REPOS = { "the-fold": `${ROOT}/the-fold`, khora: `${ROOT}/khora-fold`, penelope: `${ROOT}/penelope-fold` };
const SIBLINGS = ["khora", "janus", "penelope", "Zenodotus", "heimdall", "eoreader7", "live_priors"];
const args = process.argv.slice(2);
const mode = args[0];
const opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d; };
const git = (repo, ...a) => execFileSync("git", ["-C", repo, ...a], { encoding: "utf8", maxBuffer: 64 << 20 }).trim();
const sh = (cmd, cwd, ms = 120000) => { const r = spawnSync("/bin/bash", ["-lc", cmd], { cwd, encoding: "utf8", timeout: ms, maxBuffer: 64 << 20 }); return { code: r.status ?? (r.signal ? 124 : 1), out: ((r.stdout || "") + (r.stderr || "")).slice(-4000) }; };

function workspace(name) {
  fs.mkdirSync(WS, { recursive: true });
  for (const s of SIBLINGS) { const link = path.join(WS, s), target = path.join(ROOT, s); if (!fs.existsSync(link) && fs.existsSync(target)) fs.symlinkSync(target, link); }
  const dir = path.join(WS, name);
  if (!fs.existsSync(dir)) {
    git(REPOS[name], "worktree", "add", "--detach", "-f", dir, "HEAD");
    const nm = path.join(REPOS[name], "node_modules");
    if (fs.existsSync(nm) && !fs.existsSync(path.join(dir, "node_modules"))) fs.symlinkSync(nm, path.join(dir, "node_modules"));
  }
  return dir;
}
const reset = (dir, sha) => { git(dir, "checkout", "-f", "-q", "--detach", sha); git(dir, "clean", "-fdq", "-e", "node_modules"); };

if (mode === "extract") {
  const since = opt("since", "2026-10-05"), max = +opt("max", 20);
  const tasks = [];
  for (const [name, repo] of Object.entries(REPOS)) {
    const shas = git(repo, "log", "--all", "--no-merges", `--since=${since}`, "--format=%H").split("\n").filter(Boolean).reverse();
    const dir = workspace(name);
    for (const sha of shas) {
      if (tasks.length >= max) break;
      const st = git(repo, "show", "--name-status", "--format=", sha).split("\n").filter(Boolean).map((l) => l.split("\t"));
      const tests = st.filter(([s, f]) => /^[AM]$/.test(s) && /\.test\.(mjs|js)$/.test(f)).map(([, f]) => f);
      const srcs = st.filter(([s, f]) => s === "M" && /\.(mjs|js)$/.test(f) && !/\.test\./.test(f) && !/^vendor\//.test(f)).map(([, f]) => f);
      if (!tests.length || !srcs.length || srcs.length > 3 || tests.length > 2) continue;
      const lines = git(repo, "show", "--numstat", "--format=", sha, "--", ...srcs).split("\n").reduce((n, l) => n + (+l.split("\t")[0] || 0) + (+l.split("\t")[1] || 0), 0);
      if (lines > 250) continue;
      const subject = git(repo, "log", "-1", "--format=%s", sha);
      if (/^(Merge|vendor|chore|ci|docs|consolidate|WIP)/i.test(subject)) continue;
      const testCommand = `node --test ${tests.map((t) => JSON.stringify(t)).join(" ")}`;
      try { reset(dir, sha); } catch { continue; }
      const atFix = sh(testCommand, dir, 90000);
      if (atFix.code !== 0) continue;                                            // must pass at the fix
      try { git(dir, "checkout", "-q", `${sha}^`, "--", ...srcs); } catch { continue; }
      const reverted = sh(testCommand, dir, 90000);
      if (reverted.code === 0) continue;                                          // must FAIL without the fix
      tasks.push({ id: `${name}-${sha.slice(0, 7)}`, repo: name, sha, subject, body: git(repo, "log", "-1", "--format=%b", sha).slice(0, 600), testCommand, srcFiles: srcs, testFiles: tests, linesChanged: lines });
      console.log(`admitted ${name}-${sha.slice(0, 7)}  ${subject.slice(0, 90)}`);
    }
    try { reset(dir, "HEAD"); } catch {}
  }
  fs.writeFileSync(path.join(HERE, "coder-tasks.json"), JSON.stringify({ _about: "fail-to-pass tasks cut from real fix commits (GATE.md coder half); frozen at extraction", extractedFrom: since, tasks }, null, 1) + "\n");
  console.log(`${tasks.length} tasks → eval/gate/coder-tasks.json`);
}

if (mode === "run") {
  const door = opt("door", "http://127.0.0.1:11436");
  const only = (opt("only", "") || "").split(",").filter(Boolean);
  const T = JSON.parse(fs.readFileSync(path.join(HERE, "coder-tasks.json"), "utf8")).tasks.filter((t) => !only.length || only.includes(t.id));
  fs.mkdirSync(path.join(HERE, "results"), { recursive: true });
  const out = path.join(HERE, "results", `coder-${opt("stamp", "run")}.jsonl`);
  for (const t of T) {
    const dir = workspace(t.repo);
    reset(dir, t.sha); git(dir, "checkout", "-q", `${t.sha}^`, "--", ...t.srcFiles);
    const before = sh(t.testCommand, dir, 90000);
    const t0 = Date.now();
    let door_ = null, err = null;
    try {
      const r = await fetch(door + "/v1/code", { method: "POST", headers: { "content-type": "application/json", "x-er7-session": "mvp-gate" }, body: JSON.stringify({ task: t.subject, workspace: dir, testCommand: t.testCommand, maxRounds: 3, ground: true }), signal: AbortSignal.timeout(15 * 60 * 1000) });
      door_ = await r.json().catch(() => ({ status: r.status }));
    } catch (e) { err = String(e).slice(0, 300); }
    const ms = Date.now() - t0;
    const after = sh(t.testCommand, dir, 90000);
    const touched = git(dir, "diff", "--name-only").split("\n").filter(Boolean);
    const unparseable = touched.filter((f) => /\.(mjs|js)$/.test(f) && sh(`node --check ${JSON.stringify(f)}`, dir, 30000).code !== 0);
    const rec = { id: t.id, subject: t.subject, beforeFailed: before.code !== 0, solved: before.code !== 0 && after.code === 0, ms, doorDone: door_ ? !!door_.done : null, doorSaid: door_ ? JSON.stringify(door_).slice(0, 600) : null, err, touched, unparseable, diff: git(dir, "diff").slice(0, 3000), afterTail: after.out.slice(-600) };
    fs.appendFileSync(out, JSON.stringify(rec) + "\n");
    console.log(`${rec.solved ? "SOLVED " : "failed "} ${t.id}  ${Math.round(ms / 1000)}s  doorDone=${rec.doorDone}  touched=${touched.length}${unparseable.length ? " UNPARSEABLE" : ""}${err ? " err=" + err.slice(0, 80) : ""}`);
  }
  console.log("wrote", out);
}
