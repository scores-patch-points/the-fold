#!/usr/bin/env node
// scripts/inventory-word-lists.mjs — every fixed natural-language word list in fold-chat-*.js, found by grep-style scanning.  (2026-10-14)
//   node scripts/inventory-word-lists.mjs            print the table (markdown) to stdout
//   node scripts/inventory-word-lists.mjs --write    write docs/NO-FIXED-LISTS.md
// WHAT COUNTS (the user's rule: "no fixed lists anywhere"): in non-test fold-chat-*.js, a literal enumeration of natural-language words that decides
// behaviour: (set) `new Set([...])` / `set("a b c")` with >= 3 alphabetic words; (alt) a regex alternation `(?:a|b|c…)` of >= 3 alphabetic words, in a
// regex literal or a RegExp string; (arr) a `const NAME = [ "a", "b", ... ]` of >= 5 alphabetic strings. NOT counted: all-caps tokens (UD tags, operator names),
// file extensions, Unicode script names. A line is a candidate; the SCAN cannot know which candidates are natural-language words, so the table is the
// work-list, not the verdict: `verdict` is "derived" / "left: <reason>" only for entries in VERDICTS (judged by hand, below), else "unjudged".
// The giver is the nearest comment line (<= 4 lines above, or the same line) that says declared/giver/measured.
import fs from "node:fs"; import path from "node:path";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
// file:name -> verdict. Judgements, each with its reason; everything not listed here is "unjudged".
const VERDICTS = {
  "fold-chat-casts.js:CASTS.pronounGender": "derived: UD FEATS Gender per natural-gender language (scripts/gen-pronoun-gender.mjs); no literal list remains",
  "fold-chat-casts.js:CASTS.inanimate": "left: removal passes every guard but makes Berlin Wall / Eiffel Tower / Hudson River persons; pinned in fold-chat-casts.test.mjs; no list-free signal measured (head-noun POS prior too sparse)",
  "fold-chat-anaphora.js:CLASSES.en.wh": "derived: UD PronType=Int|Rel (scripts/gen-anaphora-classes.mjs)",
  "fold-chat-anaphora.js:CLASSES.es.wh": "left: es treebank questions are sparse (cómo, cuándo missing); the guards do not exercise it",
  "fold-chat-anaphora.js:CLASSES.fr.wh": "left: fr treebank questions are sparse (quand, que missing); the guards do not exercise it",
  "fold-chat-anaphora.js:CLASSES.en.strong": "left: the generated pronoun class is not adoptable by union (lo, ello, y, eux change carries); no measured rule separates strong from weak",
  "fold-chat-anaphora.js:CLASSES.en.weak": "left: 'there' (expletive) and 'one/ones' (NUM/NOUN in UD) regress under the UD rule; the HARD set exercises it",
  "fold-chat-anaphora.js:CLASSES.en.frame": "left: request verbs have no UD feature; VerbNet communication classes cover only a subset",
  "fold-chat-anaphora.js:CLASSES.en.cont": "left: lexical (again, else, instead, rest, details); only 'more' has a UD feature (Degree=Cmp)",
  "fold-chat-anaphora.js:CLASSES.en.connectives": "left: CCONJ covers and/but/or but also both/either/nor, which would carry self-contained asks; adverbial openers (so, then, also) have no feature",
  "fold-chat-anaphora.js:CLASSES.es.strong": "left: the generated pronoun class is not adoptable by union (lo, ello, y, eux change carries); no measured rule separates strong from weak",
  "fold-chat-anaphora.js:CLASSES.es.weak": "left: 'there' (expletive) and 'one/ones' (NUM/NOUN in UD) regress under the UD rule; the HARD set exercises it",
  "fold-chat-anaphora.js:CLASSES.es.frame": "left: request verbs have no UD feature; VerbNet communication classes cover only a subset",
  "fold-chat-anaphora.js:CLASSES.es.cont": "left: lexical (again, else, instead, rest, details); only 'more' has a UD feature (Degree=Cmp)",
  "fold-chat-anaphora.js:CLASSES.es.connectives": "left: CCONJ covers and/but/or but also both/either/nor, which would carry self-contained asks; adverbial openers (so, then, also) have no feature",
  "fold-chat-anaphora.js:CLASSES.fr.strong": "left: the generated pronoun class is not adoptable by union (lo, ello, y, eux change carries); no measured rule separates strong from weak",
  "fold-chat-anaphora.js:CLASSES.fr.weak": "left: 'there' (expletive) and 'one/ones' (NUM/NOUN in UD) regress under the UD rule; the HARD set exercises it",
  "fold-chat-anaphora.js:CLASSES.fr.frame": "left: request verbs have no UD feature; VerbNet communication classes cover only a subset",
  "fold-chat-anaphora.js:CLASSES.fr.cont": "left: lexical (again, else, instead, rest, details); only 'more' has a UD feature (Degree=Cmp)",
  "fold-chat-anaphora.js:CLASSES.fr.connectives": "left: CCONJ covers and/but/or but also both/either/nor, which would carry self-contained asks; adverbial openers (so, then, also) have no feature",
  "fold-chat-thread.js:META_ALTS": "left: a topic-less utterance (work-card.meta-detect.mjs, AUC 0.98) cannot separate a meta ask from a new-topic question whose words the collection does not know",
  "fold-chat-mind.js:PARTICLE": "unjudged: derivable in principle (lower-case tokens inside UD flat PROPN spans); not attempted in this pass",
  "fold-chat-mind.js:TITLE_DOT": "unjudged: derivable in principle (abbreviation tokens followed by a PROPN flat); not attempted in this pass",
};
const files = fs.readdirSync(ROOT).filter((f) => /^fold-chat-.*\.js$/.test(f)).sort();
const WORD = /^[\p{L}][\p{L}'’-]*$/u;
const rows = [];
const giverOf = (lines, i) => {
  for (let k = i; k >= Math.max(0, i - 4); k--) {
    const isComment = /^\s*(\/\/|\*|\/\*)/.test(lines[k]);
    if (k < i && !isComment) break;                                   // the comment block directly above, never past code
    const m = /\/\/(.*)$/.exec(lines[k]); const t = m ? m[1] : (isComment ? lines[k] : "");
    if (/giver|DECLARED|declared|measured/.test(t)) return t.trim().replace(/^[\s*\/]+/, "").replace(/\s+/g, " ").slice(0, 160);
  }
  return "";
};
for (const file of files) {
  const lines = fs.readFileSync(path.join(ROOT, file), "utf8").split("\n");
  // a one-line `export const X = Object.freeze({ ... })` data file (generated) is skipped by marker
  if (lines.slice(0, 3).some((l) => /GENERATED/.test(l))) continue;
  let scope = "", scopeGiver = "", lang = "";
  lines.forEach((line, i) => {
    const dm = /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/.exec(line);
    if (dm) { scope = dm[1]; lang = ""; scopeGiver = giverOf(lines, i); }
    const lm = /^ {2}([a-z]{2}):\s*\{/.exec(line); if (lm) lang = lm[1];
    const km = /^ {2,4}([A-Za-z_]\w*):/.exec(line);
    const name = (dm && dm[1]) || (km ? [scope, lang, km[1]].filter(Boolean).join(".") : scope);
    const found = [];
    for (const m of line.matchAll(/new Set\(\[([^\]]*)\]\)/g)) { const ws = [...m[1].matchAll(/"([^"]*)"|'([^']*)'/g)].map((x) => x[1] ?? x[2]); found.push(["set", ws]); }
    for (const m of line.matchAll(/\bset\(\s*"([^"]*)"/g)) found.push(["set", m[1].split(/\s+/).filter(Boolean)]);
    for (const m of line.matchAll(/\(\?:([^()]*\|[^()]*)\)/g)) found.push(["alt", m[1].split("|")]);
    const am = /^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:Object\.freeze\()?\[\s*("[^"]+"\s*,\s*){4,}/.exec(line);
    if (am) found.push(["arr", [...line.matchAll(/"([^"]*)"/g)].map((x) => x[1])]);
    for (const [kind, ws0] of found) {
      const ws = ws0.map((w) => w.replace(/\\[sSbwdp]|[\\^$*+?{}\[\]]|\(\?:?|\)/g, "").trim()).filter((w) => WORD.test(w));
      if (ws.length < 3) continue;
      if (ws.every((w) => w === w.toUpperCase())) continue;                         // UD tags / operator names
      if (ws.every((w) => /^[a-z]{1,4}$/.test(w) && /^(?:js|mjs|css|html|json|png|jpg|svg|txt|md|pdf)$/.test(w))) continue;   // file extensions
      rows.push({ file, line: i + 1, name: name || "(anonymous)", kind, n: ws.length, sample: ws.slice(0, 8).join(" "), giver: giverOf(lines, i) || scopeGiver });
    }
  });
}
const keyed = (r) => { for (const k of Object.keys(VERDICTS)) { const [f, n] = k.split(":"); if (f === r.file && r.name === n) return VERDICTS[k]; } return "unjudged"; };
const esc = (s) => String(s).replace(/\|/g, "\\|");
const byFile = new Map(); for (const r of rows) byFile.set(r.file, (byFile.get(r.file) || 0) + 1);
const verdictCounts = {}; for (const r of rows) { const v = keyed(r).split(":")[0]; verdictCounts[v] = (verdictCounts[v] || 0) + 1; }
let md = `# NO FIXED LISTS — inventory of word lists in fold-chat-*.js\n\n`;
md += `Generated by \`node scripts/inventory-word-lists.mjs --write\` (grep-style; do not edit by hand — re-run). Rule: no literal enumeration of natural-language words may decide behaviour; derive it from Universal Dependencies annotation, the janus POS/act priors, collection statistics, or Unicode properties, and measure the derivation against what the list did.\n\n`;
md += `**${rows.length} candidate lines in ${byFile.size} files.** Verdicts: ${Object.entries(verdictCounts).map(([k, v]) => `${k} ${v}`).join(", ")}. A candidate is a line, not necessarily a natural-language list (the scan cannot tell a UI-label array from a stopword set); \`unjudged\` means nobody has decided yet, not that it is fine.\n\n`;
md += `## Judged\n\n| file | line | name | kind | words | giver | verdict |\n|---|---|---|---|---|---|---|\n`;
for (const r of rows) { const v = keyed(r); if (v === "unjudged") continue; md += `| ${r.file} | ${r.line} | ${esc(r.name)} | ${r.kind} | ${r.n} | ${esc(r.giver || "—")} | ${esc(v)} |\n`; }
md += `\n## Derived — no literal list remains\n\n| file:name | derivation |\n|---|---|\n`;
for (const [k, v] of Object.entries(VERDICTS)) if (v.startsWith("derived")) md += `| ${esc(k)} | ${esc(v)} |\n`;
md += `\n## Candidates by file (judged and unjudged)\n\n| file | candidates |\n|---|---|\n`;
for (const [f, c] of [...byFile].sort((a, b) => b[1] - a[1])) md += `| ${f} | ${c} |\n`;
md += `\n## All candidates\n\n| file | line | name | kind | words | sample | giver |\n|---|---|---|---|---|---|---|\n`;
for (const r of rows) md += `| ${r.file} | ${r.line} | ${esc(r.name)} | ${r.kind} | ${r.n} | ${esc(r.sample)} | ${esc(r.giver || "—")} |\n`;
if (process.argv.includes("--write")) { fs.mkdirSync(path.join(ROOT, "docs"), { recursive: true }); fs.writeFileSync(path.join(ROOT, "docs", "NO-FIXED-LISTS.md"), md); console.log(`docs/NO-FIXED-LISTS.md: ${rows.length} candidates in ${byFile.size} files`); } else console.log(md);
