#!/usr/bin/env node
// scripts/build-foundation-index.mjs — the foundation's transformation records, as the fold's RUNTIME can use them.  (2026-10-14)
//
//   node scripts/build-foundation-index.mjs --store <khora .../scene/foundation-weft> [--out mind/foundation-index.json]
//                                           [--include-closed]   (writes ONLY to a *.local.json path; never committed)
//
// khora's reading is kept as TRANSFORMATION RECORDS (weft-lean.mjs): which beings were admitted, which clauses were cut under
// which parents, which ends were connected by which connector at which byte, which evaluations flipped a sign. Not the corpus.
// The chat is a browser page and wants PASSAGES, so this reads each record's byte address back out of the corpus file — the
// sentence the transformation was done to — and keeps it once, verbatim, with its document. The index is therefore a
// projection of the store through the file bytes: it is regenerable and it is never the substrate.
//
// RIGHTS: a document's frontmatter `license` decides. Only open licences (public domain, Creative Commons) go into the
// committed index. A closed-licence document (the TRC transcripts, held in the local pointer cache) is counted and left out —
// unless --include-closed is given, which is allowed ONLY with an output path ending `.local.json` (git-ignored; corpus policy
// LP22: copyrighted bytes are for local reading and are never committed or served).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const STORE = opt("--store", null);
const OUT = path.resolve(opt("--out", "mind/foundation-index.json"));
const INCLUDE_CLOSED = args.includes("--include-closed");
const KHORA = opt("--khora", "/Users/mlacy/Documents/3.0/khora/native/the-fold");
if (!STORE) { console.error("usage: build-foundation-index.mjs --store <foundation-weft dir> [--out file] [--include-closed]"); process.exit(2); }
if (INCLUDE_CLOSED && !/\.local\.json$/.test(OUT)) { console.error("refused: --include-closed writes only to a *.local.json path (closed-licence text is never committed)"); process.exit(2); }

const { openStore } = await import(path.join(KHORA, "weft-store.mjs"));
const OPEN = /public domain|creative commons|\bcc[ -]?by|\bcc0\b|\bcc-by/i;
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const fm = (text) => { const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text); const d = {}; if (m) for (const l of m[1].split(/\r?\n/)) { const k = /^([A-Za-z_]+):\s*(.*)$/.exec(l); if (k) d[k[1]] = k[2].replace(/^"|"$/g, "").trim(); } return d; };

const store = openStore(STORE);
const passes = store.passes();
const storeSha = crypto.createHash("sha256");
for (const f of fs.readdirSync(STORE).filter((x) => /^seg-\d{6}\.bin$/.test(x)).sort()) storeSha.update(fs.readFileSync(path.join(STORE, f)));

const docs = []; const docIdx = new Map(); const units = new Map();
const excluded = { closedLicense: new Set(), unreadableBytes: 0, shortOrLong: 0 };
const bytesOf = new Map();
const isCorpusRel = (f) => f.replace(/^.*\/Zenodotus\//, "");

for (const l of passes) {
  const file = l.a;
  if (!fs.existsSync(file)) { excluded.unreadableBytes += 1; continue; }
  const raw = bytesOf.get(file) ?? fs.readFileSync(file); bytesOf.set(file, raw);
  const meta = fm(raw.toString("utf8", 0, 4000));
  const open = OPEN.test(meta.license ?? "");
  if (!open && !INCLUDE_CLOSED) { excluded.closedLicense.add(file); continue; }
  if (!docIdx.has(file)) {
    docIdx.set(file, docs.length);
    docs.push({ file: isCorpusRel(file), title: meta.title || path.basename(file).replace(/^[0-9a-f]{12}--/, ""), layer: l.l ?? null, lang: l.g ?? null, license: meta.license ?? meta.rights ?? null, source: meta.source ?? meta.attribution ?? null, source_url: meta.source_url ?? null, open });
  }
  const d = docIdx.get(file);
  // a CON record sits at the byte of the sentence it was done to; the sentence is read back from the corpus file
  for (const c of l.con) {
    const at = c[3]; if (!(at >= 0)) continue;
    const key = `${d}:${at}`; if (units.has(key)) continue;
    const win = raw.subarray(at, at + 900).toString("utf8");
    const m = /^[\s\S]*?[.!?](?=\s|$)/.exec(win);
    const t = norm(m ? m[0] : win.split(/\n/)[0].slice(0, 300));
    if (t.length < 20 || t.length > 600) { excluded.shortOrLong += 1; continue; }
    units.set(key, [d, at, t]);
  }
}

const body = {
  schema: "FoundationIndex@1",
  built: new Date().toISOString(),
  weft: { store: path.basename(STORE), passes: passes.length, segments: store.segments(), sha16: storeSha.digest("hex").slice(0, 16) },
  note: "verbatim sentences at the byte addresses the transformation records name; the records, not this file, are the substrate",
  scope: INCLUDE_CLOSED ? "local (closed-licence text included; never committed)" : "open licences only",
  excluded: { closedLicenseDocuments: excluded.closedLicense.size, unreadableBytes: excluded.unreadableBytes, shortOrLongUnits: excluded.shortOrLong },
  docs,
  units: [...units.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]),
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(body) + "\n");
const byLayer = {}; for (const u of body.units) { const k = docs[u[0]].layer ?? "?"; byLayer[k] = (byLayer[k] ?? 0) + 1; }
console.log(`foundation index — ${docs.length} documents · ${body.units.length} verbatim units ${JSON.stringify(byLayer)} · left out: ${excluded.closedLicense.size} closed-licence docs${INCLUDE_CLOSED ? " (INCLUDED: local index)" : ""}`);
console.log(`→ ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB) from ${passes.length} transformation passes in ${store.segments()} segments (store sha16 ${body.weft.sha16})`);
