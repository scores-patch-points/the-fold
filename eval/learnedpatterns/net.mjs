// eval/learnedpatterns/net.mjs — one polite fetch for every Wikimedia call of this experiment (harvest, title door, run).
// A generic User-Agent (no identity); at least `gapMs` between calls to one host; a 429/5xx waits for Retry-After (or a doubling
// backoff) and is retried; every throttle and every final failure is COUNTED. A failure is returned as a failure, never as an empty page.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const UA = "the-fold-eval/1.0 (learned-patterns experiment)";
export const netStats = { calls: 0, throttled: 0, failed: 0 };
const nextAt = new Map();
const GAP = { "query.wikidata.org": 65000 };                 // WDQS answered "1 req / min" during this run's outage rule
export async function pacedFetch(url, opts = {}, { gapMs = 1000, tries = 10 } = {}) {
  const host = new URL(url).host, gap = GAP[host] ?? gapMs;
  let last = null;
  for (let k = 0; k < tries; k++) {
    const wait = (nextAt.get(host) || 0) - Date.now();
    if (wait > 0) await sleep(wait);
    nextAt.set(host, Date.now() + gap);
    netStats.calls++;
    try {
      const r = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), "User-Agent": UA } });
      if (r.status === 429 || r.status >= 500) {
        netStats.throttled++;
        const ra = Number(r.headers.get("retry-after"));
        nextAt.set(host, Date.now() + Math.min(180000, Math.max(gap, ra > 0 ? ra * 1000 : 4000 * 2 ** k)));
        last = r; continue;
      }
      return r;
    } catch (e) { last = e; await sleep(2000 * 2 ** Math.min(k, 5)); }
  }
  netStats.failed++;
  if (last && typeof last.status === "number") return last;   // the throttled response itself: callers see !ok and count it
  throw last || new Error("fetch failed");
}
