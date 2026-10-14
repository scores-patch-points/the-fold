#!/usr/bin/env node
// scripts/pronoun-baseline.mjs — record the pronoun stack's current measurements as the new floor (eval/pronoun/baseline.json).
//   node scripts/pronoun-baseline.mjs           write the baseline (do this ONLY when a measurement improved on purpose; the diff is the review)
//   node scripts/pronoun-baseline.mjs --show    print the current measurement and where it differs from the baseline
import fs from "node:fs";
const { measure } = await import(new URL("../eval/pronoun/measure.mjs", import.meta.url));
const P = new URL("../eval/pronoun/baseline.json", import.meta.url);
const cur = measure();
if (process.argv.includes("--show")) { console.log(JSON.stringify(cur, null, 1)); process.exit(0); }
fs.writeFileSync(P, JSON.stringify({ schema: "PronounBaseline@1", at: new Date().toISOString().slice(0, 10), measured: cur }, null, 1) + "\n");
console.log("baseline written:", Object.keys(cur.L0).map((l) => `${l} recall ${cur.L0[l].recall}`).join(" · "));
