#!/usr/bin/env node
// scripts/which-live.mjs — the REAL pipeline functions on LIVE encyclopedia results: senseTerm -> disambiguationOf -> whichSense -> whichLine.
// Usage: node scripts/which-live.mjs [term]   (network: one Wikipedia search request, with an identifying User-Agent)
import { senseTerm } from "../fold-chat-senses.js";
import { whichSense, whichLine } from "../fold-chat-which.js";
const term0 = process.argv[2] || "mercury";
const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term0)}&srlimit=12&format=json&formatversion=2`;
const j = await (await fetch(url, { headers: { "User-Agent": "penelope-experiment/0.1 (michael.t.lacy@gmail.com)" } })).json();
const results = j.query.search.map((r) => ({ title: r.title, url: "https://en.wikipedia.org/wiki/" + r.title.replace(/ /g, "_"), snippet: r.snippet.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&") }));
const ask = `tell me about ${term0}`;
const term = senseTerm(ask);
console.log(`ask: "${ask}" -> senseTerm: ${JSON.stringify(term)}; ${results.length} live results\n`);
const CONTEXTS = {
  "no thread": "",
  "planets thread": "Earlier we went through the planets of the Solar System, their orbits, and how far each one is from the Sun.",
  "chemistry thread": "Earlier we compared metals: the chemical element with atomic number 80, its symbol, why it is a liquid at room temperature.",
  "music thread": "Earlier I was asking about a record label and an annual music prize for albums.",
  "space-programme thread": "Earlier we talked about the first human spaceflight program, the astronauts and their capsules.",
  "cars thread": "Earlier I was shopping for a medium-priced car brand and its older models.",
};
for (const [name, context] of Object.entries(CONTEXTS)) {
  const w = whichSense({ term, results, ask, context });
  console.log(`${name.padEnd(24)} -> ${w ? w.decision.padEnd(6) : "null"} | ${w ? (whichLine(w) || "(senses in the encyclopedia's order)") : ""}`);
  if (w) console.log(`${" ".repeat(24)}    options: ${w.options.slice(0, 4).map((o) => o.label + (o.p != null ? ` ${(o.p * 100).toFixed(0)}%` : "")).join(" | ")}${w.hint ? `   (the one word that would settle it: "${w.hint}")` : ""}`);
}
