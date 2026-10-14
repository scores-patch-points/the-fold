// eval/sets/template.mjs — write an empty 60-item skeleton for one language, to be filled by hand and labelled by
// someone other than the builder.  node eval/sets/template.mjs <lang> [outdir]   (refuses to overwrite)
import fs from "node:fs";
import path from "node:path";
import { skeleton } from "./lib.mjs";
const lang = process.argv[2], dir = path.resolve(process.argv[3] || "eval/sets/drafts");
if (!/^[a-z]{2,3}$/.test(lang || "")) { console.error("usage: template.mjs <lang code> [outdir]"); process.exit(2); }
const out = path.join(dir, `${lang}.json`);
if (fs.existsSync(out)) { console.error(`refusing to overwrite ${out}`); process.exit(1); }
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(out, JSON.stringify(skeleton(lang), null, 2) + "\n");
console.log(`wrote ${out}: 60 empty items (40 factual, 10 trap, 10 entity)`);
