// eval/sets/freeze.mjs — freeze a finished set, or verify the frozen ones.
//   node eval/sets/freeze.mjs freeze <draft.json> [--en eval/sets/frozen/en.json]
//   node eval/sets/freeze.mjs verify
// Freezing checks the shape (lib.mjs), writes eval/sets/frozen/<lang>.json with each item's side (dev | holdout) and
// the md5 of those exact bytes, and appends the date, md5 and counts to FROZEN.md. It refuses to overwrite a frozen
// set: an edit after a failed run is a dated amendment in a new file, never a change to the frozen one.
// Verify recomputes every frozen file's md5 against the ledger and fails on any difference.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkSet, frozenBytes, md5Of } from "./lib.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const where = (base = HERE) => ({ FROZEN: path.join(base, "frozen"), LEDGER: path.join(base, "FROZEN.md") });
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const ledgerMd5s = (LEDGER) => { const m = new Map(); try { for (const l of fs.readFileSync(LEDGER, "utf8").split("\n")) { const c = l.split("|").map((x) => x.trim()); if (/^[a-z]{2,3}$/.test(c[1] || "") && /^[0-9a-f]{32}$/.test(c[3] || "")) m.set(c[1], c[3]); } } catch {} return m; };

export function verify({ base } = {}) {
  const { FROZEN, LEDGER } = where(base), want = ledgerMd5s(LEDGER), bad = [];
  for (const [lang, md5] of want) { const f = path.join(FROZEN, `${lang}.json`); if (!fs.existsSync(f)) bad.push(`${lang}: the frozen file is missing`); else if (md5Of(fs.readFileSync(f)) !== md5) bad.push(`${lang}: the bytes no longer match the recorded md5`); }
  for (const f of fs.existsSync(FROZEN) ? fs.readdirSync(FROZEN) : []) if (f.endsWith(".json") && !want.has(f.replace(/\.json$/, ""))) bad.push(`${f}: frozen but not in the ledger`);
  return bad;
}

export function freeze(draftPath, { base, enPath } = {}) {
  const { FROZEN, LEDGER } = where(base);
  enPath = enPath || path.join(FROZEN, "en.json");
  const set = read(draftPath), en = set.lang === "en" ? null : (fs.existsSync(enPath) ? read(enPath) : null);
  const bad = checkSet(set, { en });
  if (bad.length) return { ok: false, bad };
  const out = path.join(FROZEN, `${set.lang}.json`);
  if (fs.existsSync(out)) return { ok: false, bad: [`${set.lang} is already frozen; an amendment goes in a new dated file, never over the frozen one`] };
  const bytes = frozenBytes(set), md5 = md5Of(bytes), parsed = JSON.parse(bytes);
  const n = (f) => parsed.items.filter(f).length;
  fs.mkdirSync(FROZEN, { recursive: true });
  fs.writeFileSync(out, bytes);
  const row = `| ${set.lang} | ${new Date().toISOString().slice(0, 10)} | ${md5} | ${parsed.items.length} items · ${n((i) => i.side === "holdout")} holdout · ${n((i) => i.relabel)} relabel | ${set.labeledBy || "—"} |\n`;
  if (!fs.existsSync(LEDGER)) fs.writeFileSync(LEDGER, "# Frozen test sets\n\n| lang | frozen | md5 | counts | labeled by |\n|---|---|---|---|---|\n");
  fs.appendFileSync(LEDGER, row);
  return { ok: true, md5, out };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "verify") { const bad = verify(); console.log(bad.length ? bad.join("\n") : "all frozen sets match their recorded md5"); process.exit(bad.length ? 1 : 0); }
  if (cmd === "freeze" && arg) { const en = process.argv.indexOf("--en"); const r = freeze(arg, en > 0 ? { enPath: process.argv[en + 1] } : {}); console.log(r.ok ? `frozen ${r.out}\nmd5 ${r.md5}` : r.bad.join("\n")); process.exit(r.ok ? 0 : 1); }
  console.error("usage: freeze.mjs freeze <draft.json> | verify"); process.exit(2);
}
