// eval/modelvsrules/build-pairs.mjs — the labelled (question, sentence) pairs for the model-vs-rules experiment (see PREREG.md).
//   node eval/modelvsrules/build-pairs.mjs > eval/modelvsrules/pairs.jsonl
// For each slot/holder ask of the held-out gate: the top three Wikipedia search results' plain text; the sentences that name the ask's
// referent (the app's own askFrame reading) and carry its relation word or the gold. A pair is ANSWER if the gate's gold regex matches the
// sentence, else NOT-ANSWER (a hard negative: it names the referent and is not its answer). The label is the gold regex ALONE — never the
// binder, never a model, never a reader. Per ask at most 4 ANSWER and 6 NOT-ANSWER, ordered by a fixed hash of the sentence.
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { fetchPlain, sentencesOf, norm } from "../sets/build-from-wikipedia.mjs";
import { resolveTitlesWikipedia } from "../../fold-chat-titles.js";
import { askFrame, tokensOf } from "../../fold-chat-frame.js";
import { functionWordsOf } from "../../fold-chat-snippets.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GATE = JSON.parse(fs.readFileSync(path.join(HERE, "../gate/chat-heldout.json"), "utf8"));
const FW = functionWordsOf("en");
const UA = "the-fold-eval/1.0 (model-vs-rules pair builder)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

async function search(q, n = 3) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=${n}&format=json`;
  for (let k = 0; k < 5; k++) {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (r.status === 429) { await sleep(2000 * 2 ** k); continue; }
    if (!r.ok) throw new Error("HTTP " + r.status);
    return ((await r.json()).query?.search || []).map((x) => x.title);
  }
  return [];
}

const slotAsks = GATE.categories.filter((c) => c.id === "h-slot" || c.id === "h-holder")
  .flatMap((c) => c.turns.map((t, i) => ({ id: `${c.id}#${i}`, ask: t[t.length - 1] })));
// Node sends no User-Agent, and Wikimedia throttles that; a generic one (no identity) is sent. Browsers send their own.
const uaFetch = (u, o = {}) => fetch(u, { ...o, headers: { ...(o.headers || {}), "User-Agent": UA } });
const resolveTitles = (c) => resolveTitlesWikipedia(c, { fetchImpl: uaFetch });
let out = 0;
for (const { id, ask } of slotAsks) {
  const goldSrc = GATE.gold[id]; if (!goldSrc || goldSrc === "refuse") continue;
  const gold = new RegExp(goldSrc, "i");
  // the title door shares Wikipedia's rate limit with everything else on this machine: retry, and SAY when no referent could be read
  let frame = null;
  for (let k = 0; k < 5; k++) {
    try { frame = await askFrame(ask, { fw: FW, lang: "en", resolveTitles }); } catch { frame = null; }
    if (frame && frame.ok && (frame.referents || []).length) break;
    await sleep(2500 * 2 ** k);
  }
  if (!frame || !frame.ok || !(frame.referents || []).length) { console.error(`${id} ${ask} → NO REFERENT READ (door or frame), skipped`); continue; }
  const refs = (frame.referents || []).flatMap((r) => [r.surface, r.title].filter(Boolean)).map((s) => s.toLowerCase().replace(/\s*\([^)]*\)\s*$/, ""));
  const rel = [...(frame.predicate || []), ...(frame.attributes || [])].map((p) => String(p.surface || "").toLowerCase()).filter((w) => w.length >= 3);
  const relStem = (w) => w.slice(0, Math.max(3, w.length - 2));
  const pages = []; for (const t of await search(ask)) { await sleep(700); try { const p = await fetchPlain(t, "en"); if (p) pages.push(p); } catch { /* skip a page */ } }
  const A = [], N = [], seen = new Set();
  for (const p of pages) for (const s of sentencesOf(p.text)) {
    if (s.length < 25 || s.length > 420 || seen.has(s)) continue;
    const low = s.toLowerCase();
    if (!refs.some((r) => r && low.includes(r))) continue;
    const isAns = gold.test(s);
    if (!isAns && !rel.some((w) => low.includes(relStem(w)))) continue;
    seen.add(s);
    (isAns ? A : N).push({ id, ask, sentence: s, page: p.title, url: p.url, slot: frame.slot, label: isAns ? "ANSWER" : "NOT-ANSWER", gold: goldSrc });
  }
  const pick = (xs, n) => xs.sort((a, b) => (sha(id + a.sentence) < sha(id + b.sentence) ? -1 : 1)).slice(0, n);
  for (const pr of [...pick(A, 4), ...pick(N, 6)]) { console.log(JSON.stringify(pr)); out++; }
  console.error(`${id} ${ask} → ANSWER ${Math.min(4, A.length)}/${A.length}, NOT-ANSWER ${Math.min(6, N.length)}/${N.length}`);
}
console.error(`pairs written: ${out}`);
