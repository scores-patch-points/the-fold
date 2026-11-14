// frontier/contract.mjs — the ONE door from frontier/ into the engine (eoreader7 = scores-patch-points/khora).
// Reads eoreader-contract.json, resolves the khora checkout, checks its HEAD against the pin, and imports entries by name.
// No other frontier file names a khora path. A missing checkout is a typed gap (thrown), never a silent fallback to a vendored copy.
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const CONTRACT = JSON.parse(readFileSync(join(ROOT, "eoreader-contract.json"), "utf8"));

export function khoraDir() {
  const d = process.env.KHORA_DIR ? resolve(process.env.KHORA_DIR) : resolve(ROOT, "..", "khora");
  if (!existsSync(join(d, "native"))) throw Object.assign(new Error(`typed gap: no khora checkout at ${d} (set KHORA_DIR)`), { gap: "engine_absent" });
  return d;
}

let checked = null;
export function engineCheck() {
  if (checked) return checked;
  const dir = khoraDir();
  let head = null;
  try { head = execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch { head = null; }
  const ok = head === CONTRACT.commit;
  if (!ok && process.env.FRONTIER_ALLOW_DRIFT !== "1")
    throw Object.assign(new Error(`typed gap: khora at ${dir} is ${head}, contract pins ${CONTRACT.commit}`), { gap: "engine_drift" });
  checked = { dir, head, pinned: CONTRACT.commit, drift: !ok };
  return checked;
}

const mods = new Map();
export async function engine(name) {
  const rel = CONTRACT.entries[name];
  if (!rel) throw new Error(`contract names no entry "${name}"`);
  const { dir } = engineCheck();
  if (!mods.has(rel)) mods.set(rel, await import(pathToFileURL(join(dir, rel)).href));
  const m = mods.get(rel);
  if (name === "stigmergy") return m;
  if (!(name in m)) throw new Error(`khora ${rel} exports no ${name}`);
  return m[name];
}
