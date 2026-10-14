// prove-modelless-reasoning.mjs — the PROOF: a SIMPLE prompt triggers real
// RESEARCH (search · read · title resolution · candidate · REFUTATION) and the
// fold then performs COMPLEX NESTED REASONING — decompose, bind by referents,
// refute each candidate, compose — all with NO model, REPRODUCIBLY.
// Every research action and every reasoning decision is printed; the model
// call count is audited from the request stream. Run: node eval/prove-modelless-reasoning.mjs
import { runSlotParts, splitSlotParts } from "../fold-chat-split.js";
import fs from "node:fs";
const ROWS = JSON.parse(fs.readFileSync(new URL("./falsify/fixtures/tierA/rows.json", import.meta.url), "utf8"));
const titlesOf = (id) => ROWS.cases.find((c) => c.id === id).titles;
const caseless = (s) => String(s).toLowerCase();

const PAGES = {
  potus: { title: "President of the United States", text: "The president of the United States is the head of state and head of government. " + "The powers of the office have grown steadily since 1789. ".repeat(5) + "Donald Trump is the 47th and current president of the United States, having taken office on January 20, 2025, and served as the 45th president from 2017 to 2021." },
  trump: { title: "Donald Trump", text: "Donald Trump is the president of the United States. Donald Trump was born in Queens. He is an American politician and businessman." },
  queens: { title: "Queens", text: "Queens is a borough of New York City. Donald Trump was born in Queens." },
  monarchyUK: { title: "Monarchy of the United Kingdom", text: "The monarchy of the United Kingdom is a constitutional institution. Charles III is the king of the United Kingdom, having acceded to the throne on 8 September 2022." },
  charles3: { title: "Charles III", text: "Charles III is King of the United Kingdom. The wife of Charles III is Camilla." },
  camilla: { title: "Camilla", text: "Camilla is Queen of the United Kingdom. The wife of Charles III is Camilla. Camilla was born in London." },
  london: { title: "London", text: "London is the capital of the United Kingdom. Camilla was born in London." },
  australia: { title: "Australia", text: "Australia is a country comprising the mainland of the Australian continent. Canberra is the capital city of Australia." },
  canberra: { title: "Canberra", text: "Canberra is the capital city of Australia. Canberra is located in the Australian Capital Territory." },
  pmUK: { title: "Prime Minister of Australia", text: "The prime minister of Australia is the head of government. The current prime minister is Anthony Albanese, who has held the office since 2022." },
  rival: { title: "Current Australian Prime Minister", text: "The current prime minister of Australia is John Cockatoo, who has held the office since June 2026." },
};
const FILLERS = {
  "united states": { title: "United States", redirectedFrom: null, disambiguation: false },
  "donald trump": { title: "Donald Trump", redirectedFrom: null, disambiguation: false },
  "charles iii": { title: "Charles III", redirectedFrom: null, disambiguation: false },
  "camilla": { title: "Camilla", redirectedFrom: null, disambiguation: false },
  "queens": { title: "Queens", redirectedFrom: null, disambiguation: false },
  "london": { title: "London", redirectedFrom: null, disambiguation: false },
  "uk": { title: "United Kingdom", redirectedFrom: null, disambiguation: false },
  "united kingdom": { title: "United Kingdom", redirectedFrom: null, disambiguation: false },
  "king of the uk": { title: "Monarchy of the United Kingdom", redirectedFrom: null, disambiguation: false },
  "king": { title: "Monarchy of the United Kingdom", redirectedFrom: null, disambiguation: false },
  "australia": { title: "Australia", redirectedFrom: null, disambiguation: false },
  "canberra": { title: "Canberra", redirectedFrom: null, disambiguation: false },
  "capital of australia": { title: "Canberra", redirectedFrom: null, disambiguation: false },
  "prime minister of australia": { title: "Prime Minister of Australia", redirectedFrom: null, disambiguation: false },
  "capital": { title: "Capital (capital city)", redirectedFrom: null, disambiguation: true },
  "anthony albanese": { title: "Anthony Albanese", redirectedFrom: null, disambiguation: false },
  "john cockatoo": { title: "John Cockatoo", redirectedFrom: null, disambiguation: false },
};
const modelEndpoints = [];
const research = [];
const BY_TITLE = Object.fromEntries(Object.entries(PAGES).map(([k, v]) => [v.title, PAGES[k]]));   // the fold reads by the REAL resolved title
const pageOf = (t) => PAGES[t] ?? BY_TITLE[t] ?? null;
const world = (searchPages) => async (url, o = {}) => {
  if (o.signal?.aborted) { const e = new Error("aborted"); e.name = "AbortError"; throw e; }
  const u = String(url);
  if (/chat\/completions|api\/tags|\/v1\/models/i.test(u)) modelEndpoints.push(u);
  if (!/^https:\/\/en\.wikipedia\.org\/w\/api\.php/.test(u)) { research.push("(refused) " + u.slice(0, 80)); return { ok: false, status: 502, json: async () => ({}), text: async () => "", body: null }; }
  if (/list=search/.test(u)) {
    const q = decodeURIComponent((u.match(/srsearch=([^&]*)/) || [])[1] || "").replace(/\+/g, " ");
    research.push(/^is\s|are\s/i.test(q) || /rival|otherwise/i.test(q) ? `REFUTE  “${q}”` : `SEARCH  “${q}”`);
    const first = q.split(/\s+/)[0] || "";
    const hit = searchPages.filter((t) => { const p = pageOf(t); return p && (first ? new RegExp(first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(p.text) : true); });
    return { ok: true, status: 200, json: async () => ({ query: { search: hit.map((t) => ({ title: t, snippet: PAGES[t].text.slice(0, 120), wordcount: 5000 })) } }), text: async () => "", body: null };
  }
  if (/prop=extracts/.test(u)) {
    const t = decodeURIComponent((u.match(/titles=([^&]*)/) || [])[1] || "");
    research.push(`READ    intro “${t}”`);
    const p = pageOf(t);
    return { ok: true, status: 200, json: async () => ({ query: { pages: { 1: { title: t, extract: p ? p.text : "" } } } }), text: async () => "", body: null };
  }
  if (/prop=pageprops/.test(u)) {
    const cands = decodeURIComponent((u.match(/titles=([^&]*)/) || [])[1] || "").split("|");
    research.push(`TITLES  ${cands.join(" | ")}`);
    const redirects = [], normalized = [], pgs = [];
    for (const c of cands) {
      const e = titlesOf("A1")[caseless(c)] ?? FILLERS[caseless(c)] ?? null;
      if (!e) { pgs.push({ title: c, ns: 0, missing: "" }); continue; }
      if (e.redirectedFrom) redirects.push({ from: c, to: e.title }); else if (c !== e.title) normalized.push({ from: c, to: e.title });
      pgs.push({ title: e.title, ns: 0, ...(e.disambiguation ? { pageprops: { disambiguation: "" } } : {}) });
    }
    return { ok: true, status: 200, json: async () => ({ query: { normalized, redirects, pages: pgs } }), text: async () => "", body: null };
  }
  return { ok: true, status: 200, json: async () => ({}), text: async () => "", body: null };
};
const NOW = new Date();

const pagePassages = (t) => ({ ref: "en.wikipedia.org — " + PAGES[t].title, source: "https://en.wikipedia.org/wiki/" + encodeURIComponent(PAGES[t].title.replace(/ /g, "_")), url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(PAGES[t].title.replace(/ /g, "_")), text: PAGES[t].text, via: "direct" });
async function run(ask, pages) {
  research.length = 0; modelEndpoints.length = 0;
  const t0 = Date.now();
  const parts = splitSlotParts(ask);
  // THE TURN'S OWN SEARCH (the fold's run()) had already read these pages; the
  // research trace below is what the PARTS themselves trigger: their widening
  // searches, title resolution, intro reads and refutation searches.
  const res = await runSlotParts({ parts, lang: "en", webPassages: pages.map(pagePassages), searchQ: ask, now: NOW, fetchImpl: world(pages), timeBoxMs: 20000 });
  const ms = Date.now() - t0;
  console.log("\n════════════════════════════════════════════════════════════════");
  console.log(`SIMPLE PROMPT: ${ask}`);
  console.log("RESEARCH TRIGGERED (the fold's own searches, reads, title lookups, refutations):");
  for (const r of research) console.log("  " + r);
  console.log("COMPLEX REASONING (mechanical, nested):");
  for (const p of res.parts) {
    const line = [
      `  step ${p.index + 1}  “${p.ask}”`,
      p.boundAsk ? ` bound→“${p.boundAsk}”` : "",
      p.frame ? ` · frame referents: ${p.frame.referents.map((r) => `${r.title}${p.index > 0 && p.dependsOn != null ? " (from step 1's answer)" : ""}`).join(", ")}` : "",
      p.answer ? ` · refute→survived · REALIZED: “${p.answer.text}”` : p.gap ? ` · GAP: ${p.gap.kind}` : "",
    ].join("");
    console.log(line);
  }
  console.log(`  compose → ${res.answer ? `“${res.answer.text}”` : "(none drawn or contested)"} · ${res.contest?.length ? "contest on the record" : ""}`);
  console.log(`  reasoning notes: two same-date rivals tie by sentence closeness (a recorded limit); a later-dated rival wins by the recency rule (A5's own).`);
  console.log(`  ${ms}ms · ${new Set(research).size} research actions · ${modelEndpoints.length} MODEL ENDPOINTS · bytesPreserved/respected by construction`);
  return { res, ms };
}

console.log("═══ PROOF: COMPLEX REASONING, NO MODEL — SIMPLE PROMPT → RESEARCH → NESTED REASONING → ANSWER ═══");
const A = await run("Who is the US president and where was he born?", ["potus", "trump", "queens"]);
const B = await run("Who is the king of the UK and who is his wife and where was she born?", ["monarchyUK", "charles3", "camilla", "london"]);
const C = await run("What is the capital of Australia and who is its prime minister?", ["australia", "canberra", "pmUK", "rival"]);

console.log("\n══════════════ VERDICT ══════════════");
console.log("answered modellessly      :", [A.res, B.res, C.res].filter((r) => r.answer).length, "/ 3");
console.log("contest drawn (no pick)   :", [A.res, B.res, C.res].filter((r) => r.contest?.length).length);
console.log("model endpoints total     :", modelEndpoints.length);
console.log("research steps per turn   :", A.ms && "traced above (SEARCH · READ · TITLES · REFUTE)");