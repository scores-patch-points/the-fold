#!/usr/bin/env node
// scripts/vendor-janus.mjs — vendor janus's identity organ into the chat (a FROZEN COPY, one script, never edited by hand).
//
//   node scripts/vendor-janus.mjs --src /path/to/janus/native/organs/identity     copy resolve.mjs into vendor/janus/identity/ and pin it
//   node scripts/vendor-janus.mjs --check                                         verify the vendored file matches its pinned sha256
//
// The organ is defined once, in janus (native/organs/identity/resolve.mjs). It is import-free on purpose (the surface is a static page,
// no build): the script refuses to vendor a file that statically imports anything, because that import could not run in the tab.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEST = path.join(ROOT, "vendor", "janus", "identity");
const PIN = path.join(ROOT, "vendor", "janus", "VENDOR-JANUS.json");
const FILES = ["resolve.mjs"];
const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
if (process.argv.includes("--check")) {
  const pin = JSON.parse(fs.readFileSync(PIN, "utf8"));
  let bad = 0;
  for (const f of FILES) { const got = sha(fs.readFileSync(path.join(DEST, f))); if (got !== pin.files[f]) { console.error(`DRIFT ${f}: ${got.slice(0, 12)} != pinned ${pin.files[f].slice(0, 12)}`); bad++; } }
  console.log(bad ? `vendor/janus: ${bad} file(s) drifted` : `vendor/janus: ${FILES.length} file(s) match the pin (${pin.janus.ref})`);
  process.exit(bad ? 1 : 0);
}
const SRC = path.resolve(arg("--src", path.join(ROOT, "..", "janus", "native", "organs", "identity")));
const files = {};
fs.mkdirSync(DEST, { recursive: true });
for (const f of FILES) {
  const buf = fs.readFileSync(path.join(SRC, f));
  const text = buf.toString("utf8");
  if (/^\s*import\s/m.test(text) || /\bfrom\s+['"]node:/.test(text)) { console.error(`REFUSED ${f}: it imports something; the surface runs it in a static page`); process.exit(1); }
  fs.writeFileSync(path.join(DEST, f), buf);
  files[f] = sha(buf);
}
let ref = "unknown";
try { ref = execFileSync("git", ["-C", SRC, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim(); } catch {}
fs.writeFileSync(PIN, JSON.stringify({ repo: "scores-patch-points/janus", janus: { ref, source: arg("--ref-note", "native/organs/identity/resolve.mjs") }, note: "FROZEN COPY. Refresh with `node scripts/vendor-janus.mjs --src <janus>/native/organs/identity`; verify with --check. Never edit by hand.", files }, null, 2) + "\n");
console.log(`vendored ${FILES.join(", ")} from ${SRC} @ ${ref}`);
