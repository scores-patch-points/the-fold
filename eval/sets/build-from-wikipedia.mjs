// eval/sets/build-from-wikipedia.mjs — draft a language's test set from seed rows, each gold quote taken from the live page.
//   node eval/sets/build-from-wikipedia.mjs <lang> [seeds.json] [out.json]
// A seed is { part, title, ask, answers?, keep?, flag?, with? }. The page's plain text is fetched from that
// language's Wikipedia API; the gold quote is the FIRST sentence that contains one of the answers (or, for a trap,
// the `with` phrase) — so a quote is verbatim from the page and contains its answer by construction. A seed whose
// answer or phrase is absent from the page is REPORTED, never guessed. Each part is cut to the spec's count in seed
// order (spares at the end of a part fill gaps).
// The draft names its labeler as the builder, unreviewed: it cannot satisfy "labels by someone other than the builder"
// until a person reviews it. No e-mail or identity goes in a request header.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SHAPE, checkSet } from "./lib.mjs";

const UA = "the-fold-eval/1.0 (test-set builder)";
export const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Wikipedia answers a burst with 429 and a Retry-After; honour it, a few times, then say so (never read it as "no such page").
export async function fetchPlain(title, lang, fetchImpl = fetch, { retries = 5, sleepImpl = sleep } = {}) {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&titles=${encodeURIComponent(title)}`;
  let r;
  for (let n = 0; ; n++) {
    r = await fetchImpl(url, { headers: { "User-Agent": UA } });
    if (r.status !== 429 || n >= retries) break;
    const wait = Number(r.headers?.get?.("retry-after"));
    await sleepImpl(Math.min(60000, Number.isFinite(wait) && wait > 0 ? wait * 1000 : 2000 * 2 ** n));
  }
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${title}`);
  const j = await r.json(), p = Object.values(j?.query?.pages || {})[0];
  if (!p || p.missing !== undefined || !p.extract) return null;
  return { title: p.title, text: p.extract, url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}` };
}

// Abbreviations a full stop after which is not a sentence end ("c. 1881", "St. Peter", "Mr. Mei"); a single capital letter
// ("J. S. Bach") is an initial. A heading line is not a sentence, and a single line break inside a paragraph is only a
// space (Wikipedia's plain text breaks lines inside parentheses).
const ABBR = new Set(["c", "ca", "b", "d", "r", "fl", "st", "mr", "mrs", "ms", "dr", "prof", "jr", "sr", "vs", "etc", "no", "mt", "gen", "col", "lt", "capt", "fr", "rev", "hon", "approx", "cf", "sq", "lit", "inc", "ltd", "co"]);
export function sentencesOf(text) {
  const out = [];
  for (const para of String(text).split(/\n{2,}|\n(?=\s*=)|(?<==)\s*\n/)) {
    const p = norm(para.split("\n").filter((l) => !/^\s*=+.*=+\s*$/.test(l)).join(" "));
    if (!p) continue;
    let start = 0;
    for (const m of p.matchAll(/[.!?]\s+(?=[\p{Lu}0-9"'(\[])/gu)) {
      const tok = (p.slice(start, m.index).match(/(\S+)$/) || ["", ""])[1].replace(/^[("'\[]+/, "").toLowerCase();
      if (m[0][0] === "." && (ABBR.has(tok) || /^\p{L}$/u.test(tok))) continue;
      out.push(p.slice(start, m.index + 1)); start = m.index + m[0].length;
    }
    if (start < p.length) out.push(p.slice(start));
  }
  return out.map(norm).filter(Boolean);
}

/** The first sentence containing every `with` phrase and (if answers) at least one answer; case-insensitive match, verbatim quote. */
export function takeQuote(text, { answers = [], with: w = [] } = {}) {
  const need = [].concat(w).filter(Boolean).map((x) => norm(x).toLowerCase()), ans = answers.filter(Boolean).map((x) => norm(x).toLowerCase());
  for (const s of sentencesOf(text)) {
    const low = s.toLowerCase();
    if (need.every((n) => low.includes(n)) && (!ans.length || ans.some((a) => low.includes(a)))) return s.length <= 500 ? { quote: s } : { tooLong: s.length };
  }
  return null;
}

export async function build(seeds, { lang, fetchImpl = fetch, log = () => {}, delayMs = 0, cacheDir = null } = {}) {
  const items = [], absent = [], count = { factual: 0, trap: 0, entity: 0 }, cache = new Map();
  for (const sd of seeds) {
    if (!(sd.part in SHAPE)) { absent.push({ seed: sd, why: "part must be factual, trap or entity" }); continue; }
    if (count[sd.part] >= SHAPE[sd.part]) continue;   // a spare beyond the spec's count
    let page = cache.get(sd.title);
    const cacheFile = cacheDir ? path.join(cacheDir, `${lang}-${encodeURIComponent(sd.title)}.json`) : null;
    if (page === undefined && cacheFile) { try { page = JSON.parse(fs.readFileSync(cacheFile, "utf8")); cache.set(sd.title, page); } catch { page = undefined; } }
    if (page === undefined) { try { if (delayMs) await sleep(delayMs); page = await fetchPlain(sd.title, lang, fetchImpl); if (page && cacheFile) { fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(cacheFile, JSON.stringify(page)); } } catch (e) { page = null; absent.push({ seed: sd, why: String(e.message || e) }); continue; } cache.set(sd.title, page); }
    if (!page) { absent.push({ seed: sd, why: "no such page" }); continue; }
    if (sd.part === "trap" && !sd.with) { absent.push({ seed: sd, why: "a trap seed needs `with`, the phrase that shows the truth" }); continue; }
    const q = takeQuote(page.text, sd);
    if (!q) { absent.push({ seed: sd, why: "no sentence on the page has the answer" + (sd.with ? " and the phrase" : "") }); continue; }
    if (q.tooLong) { absent.push({ seed: sd, why: `the sentence is ${q.tooLong} characters` }); continue; }
    if (sd.part === "entity" && !(sd.keep || []).every((k) => norm(page.text).includes(norm(k)))) { absent.push({ seed: sd, why: "the name to keep is not on the page in that spelling" }); continue; }
    count[sd.part]++;
    const id = `${lang}-${sd.part}-${String(count[sd.part]).padStart(2, "0")}`;
    const gold = { source: { title: page.title, url: page.url, quote: q.quote } };
    if (sd.part === "trap") gold.flag = sd.flag; else gold.answers = sd.answers;
    if (sd.part === "entity") gold.keep = sd.keep;
    items.push({ id, lang, part: sd.part, ask: sd.ask, gold });
    log(id, page.title);
  }
  return { set: { lang, about: `Draft built mechanically from ${lang}.wikipedia.org; each gold quote is the first page sentence with the answer.`, labeledBy: "the builder's own draft — not yet reviewed by a second labeler", items }, absent };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [lang, seedsPath = `eval/sets/seeds/${process.argv[2]}.json`, outPath = `eval/sets/drafts/${process.argv[2]}.json`] = process.argv.slice(2);
  if (!lang) { console.error("usage: build-from-wikipedia.mjs <lang> [seeds.json] [out.json]"); process.exit(2); }
  const seeds = JSON.parse(fs.readFileSync(seedsPath, "utf8"));
  const { set, absent } = await build(seeds, { lang, delayMs: 1500, cacheDir: path.join(path.dirname(fileURLToPath(import.meta.url)), ".cache") });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(set, null, 2) + "\n");
  for (const a of absent) console.log(`ABSENT  [${a.seed.part}] ${a.seed.title} — ${a.seed.ask}\n        ${a.why}`);
  const bad = checkSet(set, { en: null }).filter((b) => !/checked against the English set|parallel/.test(b));
  console.log(`\n${set.items.length} items written to ${outPath}; ${absent.length} seed(s) absent`);
  if (bad.length) console.log("shape:\n  " + bad.join("\n  "));
  process.exit(absent.length || bad.length ? 1 : 0);
}
