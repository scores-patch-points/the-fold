// eval/sets/verify-quotes.mjs — C2(a): every item's gold quote must be present, verbatim, at its cited page.
//   node eval/sets/verify-quotes.mjs <set.json>     (re-fetches each page; exit 1 on any absent quote)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchPlain, norm } from "./build-from-wikipedia.mjs";

export async function verifyQuotes(set, { fetchImpl = fetch, delayMs = 0 } = {}) {
  const bad = [], cache = new Map();
  for (const it of set.items) {
    const { title, quote } = it.gold?.source || {};
    if (!title || !quote) { bad.push(`${it.id}: no gold source`); continue; }
    let page = cache.get(title);
    if (page === undefined) { try { if (delayMs) await new Promise((r) => setTimeout(r, delayMs)); page = await fetchPlain(title, set.lang, fetchImpl); } catch (e) { bad.push(`${it.id}: ${e.message}`); continue; } cache.set(title, page); }
    if (!page) bad.push(`${it.id}: the page "${title}" does not exist`);
    else if (!norm(page.text).includes(norm(quote))) bad.push(`${it.id}: the quote is not on "${title}"`);
  }
  return bad;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const f = process.argv[2];
  if (!f) { console.error("usage: verify-quotes.mjs <set.json>"); process.exit(2); }
  const set = JSON.parse(fs.readFileSync(f, "utf8")), bad = await verifyQuotes(set, { delayMs: 1500 });
  console.log(bad.length ? bad.join("\n") : `all ${set.items.length} gold quotes are present on their pages`);
  process.exit(bad.length ? 1 : 0);
}
