#!/usr/bin/env node
// Judge battery runner: runs eval/judge/cases.json against falsifyAnswer. Pure node, no deps, no writes, no network.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

export function checkShape(shape, got) {
  if (shape == null) return true;
  if (shape.verdict != null && got !== shape.verdict) return false;
  if (shape.in && !shape.in.includes(got)) return false;
  if (shape.not_in && shape.not_in.includes(got)) return false;
  return true;
}

// A table that cannot be read as written is a usage error (exit 2), never a green run.
export function validateTable(table) {
  const bad = [], ids = new Set(), V = new Set(table.verdicts || []);
  const shape = (id, e) => {
    if (!e || typeof e !== "object" || Array.isArray(e)) { bad.push(id + ": expect must be an object or an array of objects"); return; }
    const keys = Object.keys(e);
    if (!keys.length) bad.push(id + ": empty expect");
    for (const k of keys) {
      if (!["verdict", "in", "not_in"].includes(k)) bad.push(id + ": unknown expect key " + k);
      else for (const v of [].concat(e[k])) if (!V.has(v)) bad.push(id + ": unknown verdict " + JSON.stringify(v));
    }
  };
  if (!V.size) bad.push("table has no verdicts list");
  for (const r of table.rows || []) {
    if (ids.has(r.id)) bad.push(r.id + ": duplicate id"); ids.add(r.id);
    if (!["pass", "todo"].includes(r.kind)) bad.push(r.id + ": kind must be pass or todo");
    if (!r.claims?.length || !r.sources?.length) bad.push(r.id + ": needs claims and sources");
    for (const e of Array.isArray(r.expect) ? r.expect : [r.expect]) shape(r.id, e);
  }
  return bad;
}

// Returns { ok, got:[verdicts] } ; a throwing judge is a failing row.
export function runRow(falsifyAnswer, row) {
  let got = [];
  try {
    const sources = row.sources.map((s) => ({ url: "", ...s }));
    const res = falsifyAnswer(row.claims, sources);
    got = (res.claims || []).map((c) => c && c.verdict);
    const want = Array.isArray(row.expect) ? row.expect : null;
    let ok = true;
    if (want) {
      if (got.length < want.length) ok = false;
      want.forEach((w, i) => { if (!checkShape(w, got[i])) ok = false; });
    } else {
      if (got.length < 1) ok = false;
      else ok = checkShape(row.expect, got[0]);
    }
    return { ok, got };
  } catch (e) {
    return { ok: false, got, error: String((e && e.message) || e) };
  }
}

const wantText = (e) => JSON.stringify(e);

async function main() {
  const argv = process.argv.slice(2);
  const opt = { judge: path.join(root, "fold-chat-falsify-answer.js"), cases: path.join(root, "eval/judge/cases.json"), json: false, strictTodo: false, family: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => { if (i + 1 >= argv.length) { console.error("judge-battery: " + a + " needs a value"); process.exit(2); } return argv[++i]; };
    if (a === "--judge") opt.judge = path.resolve(val());
    else if (a === "--cases") opt.cases = path.resolve(val());
    else if (a === "--json") opt.json = true;
    else if (a === "--strict-todo") opt.strictTodo = true;
    else if (a === "--family") opt.family = val();
    else { console.error("unknown argument: " + a); process.exit(2); }
  }
  let mod, sha;
  try {
    sha = crypto.createHash("sha256").update(fs.readFileSync(opt.judge)).digest("hex").slice(0, 12);
    mod = await import(pathToFileURL(opt.judge).href);
    if (typeof mod.falsifyAnswer !== "function") throw new Error("no falsifyAnswer export");
  } catch (e) {
    console.error("judge-battery: cannot load judge " + opt.judge + ": " + ((e && e.stack) || e));
    process.exit(2);
  }
  let table;
  try { table = JSON.parse(fs.readFileSync(opt.cases, "utf8")); } catch (e) { console.error("judge-battery: cannot read cases " + opt.cases + ": " + e.message); process.exit(2); }
  const bad = validateTable(table);
  if (bad.length) { console.error("judge-battery: invalid table " + opt.cases + ":\n  " + bad.join("\n  ")); process.exit(2); }
  const rows = table.rows.filter((r) => !opt.family || r.family === opt.family);
  if (!rows.length) { console.error("judge-battery: no rows match" + (opt.family ? " family " + JSON.stringify(opt.family) : "")); process.exit(2); }
  const out = [];
  let pass = 0, known = 0, fail = 0, fixed = 0, threw = 0;
  for (const row of rows) {
    const r = runRow(mod.falsifyAnswer, row);
    let status;
    if (row.kind === "todo") status = r.ok ? "unexpectedly-fixed" : "known-break";
    else status = r.ok ? "pass" : "fail";
    if (r.error) threw++;
    if (status === "pass") pass++; else if (status === "known-break") known++; else if (status === "fail") fail++; else fixed++;
    out.push({ id: row.id, family: row.family, kind: row.kind, status, want: row.expect, got: r.got, error: r.error, source_file: row.source_file });
    if (!opt.json && (status === "fail" || status === "unexpectedly-fixed" || (status === "known-break" && r.error))) {
      console.log((status === "fail" ? "FAIL " : status === "known-break" ? "BREAK(threw) " : "FIXED ") + row.id + " [" + row.family + "] want " + wantText(row.expect) + " got " + JSON.stringify(r.got) + (r.error ? " threw " + r.error : "") + "  (" + row.source_file + ")");
    }
  }
  const summary = "judge-battery: " + rows.length + " rows: " + pass + " pass, " + known + " known-break, " + fail + " fail, " + fixed + " unexpectedly-fixed" + (threw ? " (" + threw + " threw)" : "");
  if (opt.json) console.log(JSON.stringify({ judge: opt.judge, sha256_12: sha, summary, results: out }, null, 2));
  else console.log(summary + "\n  judge " + opt.judge + " sha256 " + sha);
  process.exit(fail > 0 || (opt.strictTodo && fixed > 0) ? 1 : 0);
}
// Run as a script: compare REAL paths. argv[1] keeps a symlink the loader resolves ("/tmp" is "/private/tmp" on macOS), and the
// old equality made the runner a silent no-op with exit 0 there — a pass nobody ran. A vendor gate must never see that.
const isMain = () => { try { return !!process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fileURLToPath(import.meta.url); } catch { return false; } };
if (isMain()) await main();
