// eval/modelless/fetch-world.mjs — world.mjs (the deterministic encyclopedia the model-free battery serves to a Playwright page) as a NODE fetch, so
// a unit test can drive the REAL slot pipeline (runSlotTurn / runSlotParts) over the same pages with no network and no model.
// `EXTRA` is the pages the world lacks that a test needs (a page for a birthplace, a full-name sentence); they are this file's, not world.mjs's.
import * as world from "./world.mjs";

export const EXTRA = {
  Amiens: "Amiens is a city and commune in northern France, the prefecture of the Somme department. Amiens has a population of about 135,000 people.",
  "Emmanuel Macron": "Emmanuel Macron was born in Amiens, France. Emmanuel Macron is a French politician who has served as president of France since 14 May 2017.",
};
export const PAGES = { ...world.PAGES, ...EXTRA };
const resolve = (t) => {
  const n = String(t).replace(/_/g, " ").trim();
  const k = Object.keys(PAGES).find((x) => x.toLowerCase() === n.toLowerCase());
  if (k) return { title: k, redirectedFrom: null };
  const r = world.resolveTitle(n);
  return r ? { ...r } : null;
};
const json = (b) => ({ ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b), body: null });
export const fetchImpl = async (url) => {
  const u = new URL(String(url));
  if (!/wikipedia\.org$/.test(u.hostname)) return { ok: false, status: 502, json: async () => ({}), text: async () => "" };
  const p = u.searchParams;
  if (p.get("list") === "search") return json({ query: { search: world.search(p.get("srsearch") || "", 8).map((x) => ({ title: x.title, snippet: x.text.slice(0, 140), wordcount: x.text.split(/\s+/).length })) } });
  if (p.get("prop") === "extracts") { const r = resolve(p.get("titles") || ""); return json(r ? { query: { pages: { 1: { pageid: 1, ns: 0, title: r.title, extract: PAGES[r.title] } } } } : { query: { pages: { "-1": { ns: 0, title: p.get("titles"), missing: "" } } } }); }
  if (p.get("prop") === "pageprops" || p.get("redirects")) {
    const pages = {}, redirects = [], normalized = []; let neg = -1, id = 1;
    for (const t of (p.get("titles") || "").split("|")) {
      const nrm = t.replace(/_/g, " "), first = nrm.charAt(0).toUpperCase() + nrm.slice(1);
      if (first !== t) normalized.push({ from: t, to: first });
      const r = resolve(first);
      if (!r) { pages[String(neg--)] = { ns: 0, title: first, missing: "" }; continue; }
      if (r.redirectedFrom || r.title !== first) redirects.push({ from: first, to: r.title });
      pages[String(id++)] = { pageid: id, ns: 0, title: r.title };
    }
    return json({ query: { ...(normalized.length ? { normalized } : {}), ...(redirects.length ? { redirects } : {}), pages } });
  }
  return json({});
};
export const wiki = (t) => "https://en.wikipedia.org/wiki/" + encodeURIComponent(t.replace(/ /g, "_"));
export const passage = (t) => ({ ref: "en.wikipedia.org — " + t, source: wiki(t), url: wiki(t), text: PAGES[t], via: "direct" });
export const NOW = new Date("2026-10-14T00:00:00Z");

