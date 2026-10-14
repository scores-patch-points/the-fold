#!/usr/bin/env node
// scripts/vendor-self-check.mjs — is vendor/khora still byte-identical to what its pin says?  No khora checkout, no network, no credentials.
//
// The upstream-parity half of the gate needs a READ on the private scores-patch-points/khora repo, which CI's default token cannot give
// (the job failed on every merge to main with "could not read Username"). This half does not need it: VENDOR-KHORA.json pins each vendored
// file's sha256, so an edit, a deletion or a stray file in vendor/khora is caught here, on any machine, with nothing but this repo.
//   node scripts/vendor-self-check.mjs        exit 0 clean, 1 on any EDITED / MISSING / UNPINNED file
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DEST = path.join(ROOT, "vendor", "khora"), PIN = path.join(DEST, "VENDOR-KHORA.json");
if (!fs.existsSync(PIN)) { console.error("no vendor/khora/VENDOR-KHORA.json"); process.exit(2); }
const pin = JSON.parse(fs.readFileSync(PIN, "utf8"));
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
let bad = 0;
for (const [rel, h] of Object.entries(pin.files)) {
  const f = path.join(DEST, "native", rel);
  if (!fs.existsSync(f)) { console.error("MISSING  ", rel); bad++; continue; }
  if (sha(fs.readFileSync(f)) !== h) { console.error("EDITED   ", rel, "(vendored files are frozen copies; change khora, then re-vendor)"); bad++; }
}
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
for (const f of walk(path.join(DEST, "native"))) { const rel = path.relative(path.join(DEST, "native"), f).split(path.sep).join("/"); if (!(rel in pin.files)) { console.error("UNPINNED ", rel); bad++; } }
console.log(`vendor/khora: ${Object.keys(pin.files).length} files pinned at khora ${String(pin.khora?.commit).slice(0, 8)}; ${bad ? bad + " problem(s)" : "all byte-identical to the pin"}`);
process.exit(bad ? 1 : 0);
