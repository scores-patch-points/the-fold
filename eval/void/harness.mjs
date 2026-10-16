// eval/void/harness.mjs — the faithful harness for eval/void/PREREG.md: the surface's own runSlotTurn over a RECORD-THEN-REPLAY fetch,
// and the three-tier scorer (RIGHT / WRONG / GAP, informative or plain). No model anywhere; a model call would have to go through fetch,
// and every fetch is counted by host (V6).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { BATTERY } from "./battery.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REC_DIR = path.join(HERE, "recording");
const FROZEN_SHA = fs.readFileSync(path.join(HERE, "battery.sha"), "utf8").trim();

export function checkBattery() {
  const sha = crypto.createHash("sha256").update(fs.readFileSync(path.join(HERE, "battery.mjs"))).digest("hex");
  if (sha !== FROZEN_SHA) throw new Error(`battery.mjs changed after freezing (${sha.slice(0, 8)} != ${FROZEN_SHA.slice(0, 8)}): refused`);
  return BATTERY;
}

const keyOf = (url, o = {}) => crypto.createHash("sha256").update(`${(o.method || "GET").toUpperCase()} ${url} ${typeof o.body === "string" ? o.body : ""}`).digest("hex").slice(0, 24);

/** A fetch that records (mode "record": live, and saved) or replays (mode "replay": offline; a miss is a typed 'unrecorded' error). */
export function recordingFetch(mode, { dir = REC_DIR, log = null } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const stats = { hits: 0, misses: [], live: 0, hosts: {} };
  const f = async (url, o = {}) => {
    const u = String(url);
    const host = (() => { try { return new URL(u).host; } catch { return "?"; } })();
    stats.hosts[host] = (stats.hosts[host] || 0) + 1;
    const file = path.join(dir, keyOf(u, o) + ".json");
    if (fs.existsSync(file)) {
      const r = JSON.parse(fs.readFileSync(file, "utf8"));
      stats.hits++;
      return new Response(r.body, { status: r.status, headers: { "content-type": r.contentType || "text/plain" } });
    }
    if (mode !== "record") { stats.misses.push(u); const e = new Error(`unrecorded: ${u}`); e.kind = "unrecorded"; throw e; }
    stats.live++;
    // Amendment 10: a 429 or 5xx is an environment failure, never material — retried (Retry-After, else exponential from 1 s; up to 6 tries)
    // and NEVER saved; a 403 is the site's real refusal and is kept. Still failing after the retries: returned live, left unrecorded.
    let res, body, tries = 0;
    for (;;) {
      res = await fetch(u, { ...o, headers: { "user-agent": "the-fold eval/void (https://github.com/scores-patch-points/the-fold)", ...(o.headers || {}) } });
      body = await res.text();
      const transient = res.status === 429 || res.status >= 500;
      if (!transient) break;
      if (++tries >= 6) { stats.transientFailed = (stats.transientFailed || 0) + 1; if (log) log(`gave-up ${res.status} ${u.slice(0, 120)}`); return new Response(body, { status: res.status }); }
      const ra = Number(res.headers.get("retry-after"));
      await new Promise((r) => setTimeout(r, Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1000 * 2 ** (tries - 1)));
    }
    fs.writeFileSync(file, JSON.stringify({ url: u, method: (o.method || "GET").toUpperCase(), status: res.status, contentType: res.headers.get("content-type"), sha256: crypto.createHash("sha256").update(body).digest("hex"), body }));
    if (log) log(`rec ${res.status} ${u.slice(0, 120)}`);
    return new Response(body, { status: res.status, headers: { "content-type": res.headers.get("content-type") || "text/plain" } });
  };
  f.stats = stats;
  return f;
}

const fold = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Score one arm's output for one row. `out`: { answer: string|null, voidDecl: EOVoidDeclaration@1|null, anchorTitle: string|null } */
export function score(row, out) {
  const ans = out && typeof out.answer === "string" && out.answer.trim() ? out.answer : null;
  if (ans) {
    if (row.neg) return { tier: "WRONG", why: "answered a false premise" };
    const hit = row.fillers.find((f) => fold(ans).includes(fold(f)));
    return hit ? { tier: "RIGHT", filler: hit } : { tier: "WRONG", why: "no accepted filler in the answer" };
  }
  if (row.neg) return { tier: "GAP", informative: true, why: "a gap is right on a false premise" };
  const v = out && out.voidDecl;
  const declared = (field) => v && Array.isArray(v.cells) ? (v.cells.find((c) => c.field === field) || {}).declared ?? null : null;
  const slotOk = declared("slot") === row.void.slot;
  const admitsOk = declared("admits") === row.void.admits;
  const anchorOk = !!out && fold(out.anchorTitle) === fold(row.void.anchor);
  return { tier: "GAP", informative: !!(slotOk && admitsOk && anchorOk), fields: { slotOk, admitsOk, anchorOk } };
}

/** The void-definition score: how many of the five gold fields a declaration states correctly (whether or not the arm answered). */
export function voidFieldsScore(row, out) {
  const v = out && out.voidDecl;
  const d = (field) => v && Array.isArray(v.cells) ? (v.cells.find((c) => c.field === field) || {}).declared ?? null : null;
  const rel = d("relation");
  const relOk = !!rel && row.void.relation.some((s) => fold(JSON.stringify(rel)).includes(fold(s)));
  return {
    slot: d("slot") === row.void.slot,
    admits: d("admits") === row.void.admits,
    anchor: !!out && fold(out.anchorTitle) === fold(row.void.anchor),
    relation: relOk,
    cardinality: d("cardinality") === row.void.cardinality,
  };
}

/** Is any accepted filler anywhere in the recorded bytes? (reported as a column; gold is never edited) */
export function solvable(row, dir = REC_DIR) {
  if (row.neg) return null;
  const bodies = fs.existsSync(dir) ? fs.readdirSync(dir).map((f) => fold(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).body)) : [];
  return row.fillers.some((f) => bodies.some((b) => b.includes(fold(f))));
}

export function tally(rows, results, set = null) {
  const t = { n: 0, RIGHT: 0, WRONG: 0, GAP: 0, informativeGap: 0, useful: 0 };
  rows.forEach((r, i) => {
    if (set && r.set !== set) return;
    const s = results[i];
    t.n++; t[s.tier]++;
    if (s.tier === "GAP" && s.informative) t.informativeGap++;
    if (s.tier === "RIGHT" || (s.tier === "GAP" && s.informative)) t.useful++;
  });
  return t;
}
