// eval/learnedpatterns/harvest.mjs — PREREG.md "Training data and the referee": per in-scope property, 500 items with an English
// article (Wikidata's own search, haswbstatement, sorted by incoming links), their truthy values with labels and aliases, and the article lead.
//   node eval/learnedpatterns/harvest.mjs [cacheDir]     → <cacheDir>/harvest.json (+ manifest.json here, with its sha256)
// Every HTTP GET is cached by URL under <cacheDir>/http so a rerun makes no new calls. A generic User-Agent (no identity); 429s honour
// Retry-After; a request that still fails is COUNTED and its entities dropped with a reason — a failure is never read as "no value" or
// "no page". The eval's pages and its asks' referents are excluded before anything is learned.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SCOPE, sha, cueStemsOf, readAsk } from "./lib.mjs";
import { sentencesOf } from "../sets/build-from-wikipedia.mjs";
import { resolveTitlesWikipedia } from "../../fold-chat-titles.js";
import { pacedFetch, netStats } from "./net.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const CACHE = path.resolve(process.argv[2] || path.join(ROOT, "../learnedpatterns-cache"));
const N = 500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(path.join(CACHE, "http"), { recursive: true });

const stats = { requests: 0, cached: 0, failures: 0, failedUrls: [] };
async function getJSON(url, { post = null } = {}) {
  const file = path.join(CACHE, "http", sha(url + (post || "")) + ".json");
  if (fs.existsSync(file)) { stats.cached++; return JSON.parse(fs.readFileSync(file, "utf8")); }
  let last = null;
  for (let k = 0; k < 3; k++) {
    try {
      stats.requests++;
      const r = await pacedFetch(url, post ? { method: "POST", headers: { "Accept": "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" }, body: post } : { headers: { "Accept": "application/json" } });
      if (!r.ok) { last = `HTTP ${r.status}`; continue; }
      const j = await r.json();
      if (j && j.error) { last = `api error ${j.error.code}`; continue; }
      fs.writeFileSync(file, JSON.stringify(j));
      return j;
    } catch (e) { last = String(e.message || e); }
  }
  stats.failures++; stats.failedUrls.push({ url: url.slice(0, 200), why: last });
  return null;
}
const WD = "https://www.wikidata.org/w/api.php?format=json&maxlag=5&";
const WP = "https://en.wikipedia.org/w/api.php?format=json&maxlag=5&";
const q = (o) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");

// ── the eval's pages and referents: never trained on ─────────────────────────────────────────────────────────────────────
const props = (await getJSON(WD + q({ action: "wbgetentities", ids: SCOPE.join("|"), props: "labels|aliases|datatype", languages: "en" })))?.entities;
if (!props) throw new Error("could not read the scope properties from Wikidata (counted as a door failure; nothing harvested)");
const cue = cueStemsOf(props);
const pairs = fs.readFileSync(path.join(ROOT, "eval/modelvsrules/pairs.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const uaFetch = (u, o = {}) => pacedFetch(u, o);
const doorCache = new Map();
const door = async (cands) => {
  const need = [...new Set(cands)].filter((c) => !doorCache.has(c));
  for (let at = 0; at < need.length; at += 40) {
    const chunk = need.slice(at, at + 40); let m = null;
    for (let k = 0; k < 4 && !m; k++) { try { m = await resolveTitlesWikipedia(chunk, { fetchImpl: uaFetch }); } catch { await sleep(1500 * 2 ** k); } }
    for (const c of chunk) if (m) doorCache.set(c, m.get(c) || null);
  }
  return new Map(cands.map((c) => [c, doorCache.get(c) || null]));
};
const excluded = new Set(pairs.map((p) => p.page));
const askReadings = {};
for (const ask of [...new Set(pairs.map((p) => p.ask))]) {
  const r = await readAsk(ask, { cue, door });
  askReadings[ask] = r;
  for (const x of r.referents) { excluded.add(x.title); excluded.add(String(x.title).replace(/\s*\([^)]*\)\s*$/u, "")); }
}
console.error(`excluded titles: ${excluded.size}`);

// ── per property ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const truthy = (claims) => {
  const st = (claims || []).filter((c) => c.rank !== "deprecated" && c.mainsnak?.snaktype === "value" && c.mainsnak?.datavalue?.value?.id);
  const pref = st.filter((c) => c.rank === "preferred");
  return [...new Set((pref.length ? pref : st).map((c) => c.mainsnak.datavalue.value.id))];
};
const out = { written: new Date().toISOString(), N, scope: SCOPE, cue, props: Object.fromEntries(SCOPE.map((p) => [p, { label: props[p]?.labels?.en?.value, aliases: (props[p]?.aliases?.en || []).map((a) => a.value) }])), askReadings, excluded: [...excluded].sort(), byPid: {}, drops: {} };
for (const pid of SCOPE) {
  const drops = { excluded: 0, noEnwiki: 0, claimsFailed: 0, noValue: 0, noLead: 0, leadFailed: 0, labelsFailed: 0 };
  const picked = [];
  for (let off = 0; picked.length < N && off + 500 <= 10000; off += 500) {
    const s = await getJSON(WD + q({ action: "query", list: "search", srsearch: `haswbstatement:${pid}`, srsort: "incoming_links_desc", srlimit: 500, sroffset: off, srnamespace: 0 }));
    if (!s) { console.error(`${pid}: search page ${off} failed (counted)`); break; }
    const ids = (s.query?.search || []).map((x) => x.title).filter((t) => /^Q\d+$/.test(t));
    if (!ids.length) break;
    for (let at = 0; at < ids.length && picked.length < N; at += 50) {
      const chunk = ids.slice(at, at + 50);
      const e = await getJSON(WD + q({ action: "wbgetentities", ids: chunk.join("|"), props: "labels|aliases|sitelinks", languages: "en", sitefilter: "enwiki" }));
      if (!e) { drops.labelsFailed += chunk.length; continue; }
      for (const id of chunk) {
        if (picked.length >= N) break;
        const ent = e.entities?.[id]; const title = ent?.sitelinks?.enwiki?.title;
        if (!title) { drops.noEnwiki++; continue; }
        if (excluded.has(title) || excluded.has(title.replace(/\s*\([^)]*\)\s*$/u, ""))) { drops.excluded++; continue; }
        picked.push({ qid: id, title, label: ent.labels?.en?.value || null, aliases: (ent.aliases?.en || []).map((a) => a.value) });
      }
    }
  }
  // truthy values (wdt:, Wikidata's own best-rank reading) with their English labels and aliases: ONE query per property
  const withVals = [], valNames = new Map();
  const vq = `SELECT ?item ?v ?vl (GROUP_CONCAT(DISTINCT ?va; separator="|") AS ?vas) WHERE { VALUES ?item { ${picked.map((x) => "wd:" + x.qid).join(" ")} } ?item wdt:${pid} ?v . FILTER(isIRI(?v)) OPTIONAL { ?v rdfs:label ?vl . FILTER(lang(?vl) = "en") } OPTIONAL { ?v skos:altLabel ?va . FILTER(lang(?va) = "en") } } GROUP BY ?item ?v ?vl`;
  const vr = picked.length ? await getJSON("https://query.wikidata.org/sparql", { post: "query=" + encodeURIComponent(vq) }) : null;
  if (!vr) drops.claimsFailed += picked.length;
  else {
    const vals = new Map();
    for (const b of vr.results?.bindings || []) {
      const item = b.item.value.split("/").pop(), v = b.v.value.split("/").pop();
      if (!/^Q\d+$/.test(v)) continue;
      (vals.get(item) || vals.set(item, new Set()).get(item)).add(v);
      valNames.set(v, [...new Set([...(valNames.get(v) || []), b.vl?.value, ...(b.vas?.value ? b.vas.value.split("|") : [])].filter(Boolean))]);
    }
    for (const it of picked) { const vs = vals.get(it.qid); if (!vs || !vs.size) { drops.noValue++; continue; } withVals.push({ ...it, valueIds: [...vs] }); }
  }
  // leads
  const leads = new Map();
  for (let at = 0; at < withVals.length; at += 20) {
    const chunk = withVals.slice(at, at + 20).map((x) => x.title);
    const r = await getJSON(WP + q({ action: "query", prop: "extracts", exintro: 1, explaintext: 1, exlimit: 20, redirects: 1, titles: chunk.join("|") }));
    if (!r) { for (const t of chunk) leads.set(t, null); continue; }
    const norm = new Map(); for (const n of r.query?.normalized || []) norm.set(n.to, n.from); for (const n of r.query?.redirects || []) norm.set(n.to, norm.get(n.from) || n.from);
    for (const p of Object.values(r.query?.pages || {})) { const t = norm.get(p.title) || p.title; leads.set(t, p.missing !== undefined ? "" : (p.extract || "")); }
  }
  const ents = [];
  for (const x of withVals) {
    const lead = leads.get(x.title);
    if (lead === null || lead === undefined) { drops.leadFailed++; continue; }
    if (!lead.trim()) { drops.noLead++; continue; }
    const values = x.valueIds.flatMap((id) => valNames.get(id) || []);
    if (!values.length) { drops.labelsFailed++; continue; }
    ents.push({ qid: x.qid, title: x.title, anchors: [...new Set([x.title, x.label, ...x.aliases].filter(Boolean))], values: [...new Set(values)], valueIds: x.valueIds, sentences: sentencesOf(lead) });
  }
  out.byPid[pid] = { entities: ents }; out.drops[pid] = drops;
  console.error(`${pid}: picked ${picked.length}, kept ${ents.length}, drops ${JSON.stringify(drops)}, http ${JSON.stringify({ req: stats.requests, cached: stats.cached, fail: stats.failures })}`);
}
out.http = { ...stats, net: netStats };
const bytes = JSON.stringify(out);
fs.writeFileSync(path.join(CACHE, "harvest.json"), bytes);
const manifest = { written: out.written, file: path.join(CACHE, "harvest.json"), sha256: sha(bytes), bytes: bytes.length, N, cue, askReadings, excludedCount: out.excluded.length, perPid: Object.fromEntries(SCOPE.map((p) => [p, { kept: out.byPid[p].entities.length, drops: out.drops[p], sentences: out.byPid[p].entities.reduce((n, e) => n + e.sentences.length, 0) }])), http: { requests: stats.requests, cached: stats.cached, failures: stats.failures, net: netStats, failedUrls: stats.failedUrls.slice(0, 50) } };
fs.writeFileSync(path.join(HERE, "harvest-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.error(`harvest written: sha256 ${manifest.sha256}, failures ${stats.failures}`);
