// FEASIBILITY PROBE (not a registered arm): can Wikidata's typed statements answer the battery? Anchor = battery's gold anchor title.
// Property candidates come ONLY from searching Wikidata's property labels with the ask's own relation/role words (no property table).
import fs from "node:fs";
const R = "/Users/mlacy/Documents/3.0/the-fold-void/";
const { BATTERY } = await import(R + "eval/void/battery.mjs");
const API = "https://www.wikidata.org/w/api.php";
const UA = { "user-agent": "the-fold eval/void probe (michael.t.lacy@gmail.com)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function j(params) {
  const u = API + "?" + new URLSearchParams({ format: "json", origin: "*", ...params });
  for (let t = 0; t < 5; t++) { const r = await fetch(u, { headers: UA }); if (r.status === 429) { await sleep(1500 * 2 ** t); continue; } return r.json(); }
  return {};
}
const fold = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
const labelCache = new Map();
async function labels(ids) {
  const need = ids.filter((i) => !labelCache.has(i));
  for (let k = 0; k < need.length; k += 40) {
    const d = await j({ action: "wbgetentities", ids: need.slice(k, k + 40).join("|"), props: "labels", languages: "en" });
    for (const [id, e] of Object.entries(d.entities || {})) labelCache.set(id, e.labels?.en?.value || id);
    await sleep(120);
  }
  return ids.map((i) => labelCache.get(i));
}
const stopRel = new Set(["is", "the", "of", "in", "was", "did", "does", "do", "what", "who", "how", "many", "much"]);
function words(row) {
  const q = row.q.toLowerCase().replace(/[?]/g, "");
  const toks = q.split(/\s+/).filter((t) => !stopRel.has(t));
  const anchor = fold(row.void.anchor).split(/\s+/);
  return [...new Set(toks.filter((t) => !anchor.includes(fold(t))))];
}
const out = [];
let n = 0, ans = 0, wrongV = 0;
for (const row of BATTERY.filter((r) => !r.neg)) {
  const s = await j({ action: "wbsearchentities", search: row.void.anchor.replace(/\s*\([^)]*\)/, ""), language: "en", type: "item", limit: 1 });
  const qid = s.search?.[0]?.id; await sleep(150);
  if (!qid) { out.push({ id: row.id, q: row.q, stage: "no-entity" }); n++; continue; }
  const ent = await j({ action: "wbgetentities", ids: qid, props: "claims", languages: "en" }); await sleep(150);
  const claims = ent.entities?.[qid]?.claims || {};
  // property candidates: label search per ask word, plus the verb's nominal stem is NOT tabled (words as asked only)
  const props = new Map();
  for (const w of words(row)) {
    const p = await j({ action: "wbsearchentities", search: w, language: "en", type: "property", limit: 5 }); await sleep(120);
    for (const x of p.search || []) if (claims[x.id]) props.set(x.id, x.label);
  }
  const vals = [];
  for (const [pid, lab] of props) for (const c of claims[pid]) {
    const dv = c.mainsnak?.datavalue; if (!dv) continue;
    if (dv.type === "wikibase-entityid") vals.push({ pid, lab, id: dv.value.id });
    else if (dv.type === "time") vals.push({ pid, lab, text: String(dv.value.time) });
    else if (dv.type === "quantity") vals.push({ pid, lab, text: String(dv.value.amount) });
    else if (dv.type === "string") vals.push({ pid, lab, text: dv.value });
  }
  const ls = await labels(vals.filter((v) => v.id).map((v) => v.id)); let k = 0;
  for (const v of vals) if (v.id) v.text = ls[k++];
  const hit = vals.find((v) => row.fillers.some((f) => fold(v.text).includes(fold(f))));
  n++; if (vals.length) ans++;
  out.push({ id: row.id, set: row.set, q: row.q, qid, props: [...props.values()], nvals: vals.length, gold: !!hit, goldVia: hit ? `${hit.lab}=${hit.text}` : null, sample: vals.slice(0, 3).map((v) => `${v.lab}=${v.text}`) });
}
console.log(JSON.stringify({ asks: n, withValues: ans, goldFound: out.filter((o) => o.gold).length }));
for (const o of out) console.log(o.id.padEnd(4), (o.q || "").slice(0, 38).padEnd(38), o.stage || "", "props:", (o.props || []).join("/").slice(0, 40).padEnd(40), "vals", o.nvals ?? "-", o.gold ? "GOLD ✓ " + o.goldVia : (o.sample || []).slice(0, 2).join("; ").slice(0, 70));
