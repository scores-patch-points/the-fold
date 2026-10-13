// fold-chat-hosts.js — C8, local-only: the hosts the Fold may contact, and the public-fallback switch.
//
// DECLARED, not measured (II.11). giver: the user, 2026-10-13, choosing "Relay only" after the first
// host inventory (eval/modelless/drive.mjs, 102 live turns) showed every refused page read raced through
// five public CORS proxies at once, each of which learned the address.
//
// The list:
//   - this page's own server (localhost);
//   - Wikipedia and Wikidata, every language;
//   - the fold's own relay (holodeck-proxy), which does the server-side search and page reads;
//   - the search sources the person can see and pick in the scope picker (GitHub, Internet Archive,
//     OpenAlex, Crossref, doi.org for a paper's own address);
//   - the site a search result names (a result's own page, read directly by the browser).
// The five public proxies and the two text readers are NOT on it. They are a fallback that runs only
// when the relay could not read a page AND the person has switched it on in Settings; off by default.
//
// What would prove it wrong: a captured run with the switch off that reaches any FALLBACK host
// (eval/c8/check-hosts.mjs fails it), or readText calling a public service with the switch off
// (fold-chat-hosts.test.mjs).

export const RELAY_HOST = "holodeck-proxy.prometheoid.workers.dev";
export const LOCAL_HOSTS = Object.freeze(["127.0.0.1", "localhost", "[::1]"]);
export const DECLARED_SUFFIXES = Object.freeze([".wikipedia.org", ".wikidata.org"]);
export const DECLARED_HOSTS = Object.freeze([RELAY_HOST, "wikidata.org", "api.github.com", "archive.org", "api.openalex.org", "api.crossref.org", "doi.org"]);
// the services the fallback reaches: kept here so the checker can name them; the URLs that use them live in fold-chat-web.js
export const FALLBACK_HOSTS = Object.freeze(["api.allorigins.win", "api.codetabs.com", "corsproxy.io", "cors.eu.org", "thingproxy.freeboard.io", "r.jina.ai", "api.microlink.io"]);

export const PUBLIC_FALLBACK_KEY = "fold-chat:public-fallback";
/** Whether the person has switched the public fallback on. Off unless the stored value is exactly "on". */
export const publicFallbackOn = (storage) => { try { return storage?.getItem?.(PUBLIC_FALLBACK_KEY) === "on"; } catch { return false; } };

/** Classify one host: "local" | "declared" | "fallback" | "result" (any other site: a result's own page). */
export function hostClass(host) {
  const h = String(host || "").toLowerCase().replace(/:\d+$/, "");
  if (LOCAL_HOSTS.includes(h)) return "local";
  if (DECLARED_HOSTS.includes(h) || DECLARED_SUFFIXES.some((s) => h.endsWith(s))) return "declared";
  if (FALLBACK_HOSTS.includes(h)) return "fallback";
  return "result";
}
