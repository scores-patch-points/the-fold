// eval/void/run-intl.mjs — the omnilingual battery (PREREG Amendment 16). Record then replay, like run.mjs; scores the EOT claim, never the string.
//   node eval/void/run-intl.mjs --record     live pass (saves every response, retries 429s, one ask at a time)
//   node eval/void/run-intl.mjs              offline replay; writes results-intl.json
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { recordingFetch } from "./harness.mjs";
import { BATTERY_INTL, LANGS } from "./battery-intl.mjs";
import { intlDoor } from "../../fold-chat-void-intl.js";
import { realizeClaim } from "../../fold-chat-void-keyed.js";
import { resolveTitlesWikipedia } from "../../fold-chat-titles.js";
import { runSlotTurn } from "../../fold-chat-answerwire.js";
import { makeMemo } from "../../fold-chat-web.js";
import { ewt } from "./ewt.mjs";
import { morphologyFromPrior, createLemmatizer } from "../../vendor/khora/native/adapters/text/morphology.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PRIORS = "/Users/mlacy/Documents/3.0/janus/priors";
const ISO3 = { es: "spa", fr: "fra", de: "deu", ru: "rus", ja: "jpn", ko: "kor", tr: "tur", hi: "hin" };
const sha = crypto.createHash("sha256").update(fs.readFileSync(path.join(HERE, "battery-intl.mjs"))).digest("hex");
if (sha !== fs.readFileSync(path.join(HERE, "battery-intl.sha"), "utf8").trim()) throw new Error("battery-intl.mjs changed after freezing");
const NOW = new Date("2026-10-14T12:00:00Z");

// each language's own POS prior (dominant UPOS); English uses EWT + the morphology lemmatizer (the declared asymmetry)
const posCache = new Map();
function dominantOfLang(lang) {
  if (lang === "en") { const E = ewt(); return (w) => E.dominantOf(w); }
  if (!posCache.has(lang)) {
    const f = path.join(PRIORS, `pos-${ISO3[lang]}.json`);
    posCache.set(lang, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")).forms || {} : {});
  }
  const forms = posCache.get(lang);
  return (w) => { const e = forms[w] || forms[String(w).toLowerCase()]; if (!e) return null; const best = Object.entries(e).sort((a, b) => b[1] - a[1])[0]; return best ? { upos: best[0], lemma: String(w).toLowerCase() } : null; };
}
const MORPH = (() => { try { const p = morphologyFromPrior(JSON.parse(fs.readFileSync(path.join(PRIORS, "morphology-eng.json"), "utf8"))); return createLemmatizer(p.forms, { language: p.language }); } catch { return null; } })();

function scoreClaim(row, claim) {
  if (!claim) return null;
  const propertyRight = claim.relation.property === row.goldP;
  let valueRight = false;
  if (row.goldQ) valueRight = claim.values.some((v) => v.kind === "item" && row.goldQ.includes(v.qid));
  if (row.goldYear) valueRight = claim.values.some((v) => v.kind === "time" && String(v.time).replace(/^\+/, "").startsWith(row.goldYear));
  return { propertyRight, valueRight };
}

async function oneRow(row, fetchImpl) {
  const getJson = async (url) => { try { const r = await fetchImpl(url); return await r.json(); } catch (e) { return { _unrecorded: String(e?.message || e).slice(0, 80) }; } };
  // intl-L0: the production path
  let l0 = null;
  try {
    const t = await runSlotTurn({ question: row.q, lang: row.lang === "en" ? "en" : { code: row.lang, by: "battery" }, webPassages: [], now: NOW, fetchImpl, signal: null, memo: makeMemo(), timeBoxMs: 60000 });
    l0 = { handoff: t && t.handoff ? t.handoff.kind : null, answered: !!(t && t.answer) };
  } catch (e) { l0 = { error: String(e?.message || e).slice(0, 80) }; }
  // intl-door
  let door;
  try {
    door = await intlDoor({ ask: row.q, lang: row.lang, getJson, resolveTitles: (c, o) => resolveTitlesWikipedia(c, { fetchImpl, edition: o.edition }),
      dominantOf: dominantOfLang(row.lang), sameAct: row.lang === "en" && MORPH ? (a, b) => MORPH.sameAct(a, b) : null, lemmasOf: row.lang === "en" ? ewt().lemmasOf : null });
  } catch (e) { door = { verdict: "unbound", cause: "ERROR", tried: [], refused: String(e?.message || e).slice(0, 100) }; }
  const sc = door.claim ? scoreClaim(row, door.claim) : null;
  const tier = door.verdict === "bound" && sc ? (sc.propertyRight && sc.valueRight ? "RIGHT" : "WRONG") : "GAP";
  return { id: row.id, ask: row.ask, lang: row.lang, set: row.set, q: row.q, l0, tier, cause: tier === "GAP" ? door.cause : tier === "WRONG" ? (sc.propertyRight ? "VALUE" : "PROPERTY") : null,
    propertyRight: sc ? sc.propertyRight : null, anchor: door.anchor || null, tried: door.tried,
    line: door.claim ? realizeClaim(door.claim, { lang: row.lang, labels: { items: Object.fromEntries(door.claim.values.filter((v) => v.qid).map((v) => [v.qid, v.text])) } }) : null,
    claim: door.claim ? { property: door.claim.relation.property, values: door.claim.values.map((v) => v.qid || v.time || v.amount || v.text) } : null };
}

const record = process.argv.includes("--record");
const f = recordingFetch(record ? "record" : "replay", { log: record ? (s) => process.stderr.write(s + "\n") : null });
const rows = [];
for (const r of BATTERY_INTL) rows.push(await oneRow(r, f));
const by = (fn) => rows.reduce((m, r) => { const k = fn(r); m[k] = (m[k] || 0) + 1; return m; }, {});
const by2 = (rs) => rs.reduce((m, r) => { m[r.tier] = (m[r.tier] || 0) + 1; return m; }, {});
const matrix = {};
for (const l of LANGS) matrix[l] = Object.fromEntries(rows.filter((r) => r.lang === l).map((r) => [r.ask, r.tier === "RIGHT" ? "RIGHT" : r.tier === "WRONG" ? `WRONG:${r.cause}` : r.cause]));
const out = { arm: "intl-door", record, at: NOW.toISOString(), fetch: { live: f.stats.live, hits: f.stats.hits, misses: f.stats.misses.length, gaveUp: f.stats.transientFailed || 0 },
  l0: by((r) => (r.l0 && r.l0.handoff) || (r.l0 && r.l0.error ? "error" : r.l0 && r.l0.answered ? "answered" : "none")),
  perLang: Object.fromEntries(LANGS.map((l) => [l, by2(rows.filter((r) => r.lang === l))])), causes: by((r) => (r.tier === "RIGHT" ? "RIGHT" : r.cause || r.tier)), matrix };
fs.writeFileSync(path.join(HERE, `results-intl${record ? "-record" : ""}.json`), JSON.stringify({ ...out, rows }, null, 1) + "\n");
console.log(JSON.stringify(out, null, 1));
