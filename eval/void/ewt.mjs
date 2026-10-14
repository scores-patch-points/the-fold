// eval/void/ewt.mjs — the RECEIVED gold lemmas of UD English-EWT r2.14 (khora native/eval/fixtures/ud-english-ewt; CC BY-SA 4.0).
// form (lower case) → { lemmas:Set, upos:{UPOS:count}, part: count of VerbForm=Part }. Read once; a gold treebank, never a word list.
// Node-only (the files are read from the khora checkout); the browser surface reaches the same prior through the khora's door.
import fs from "node:fs";
import path from "node:path";
const DIR = "/Users/mlacy/Documents/3.0/khora/native/eval/fixtures/ud-english-ewt";
let cache = null;
export function ewt() {
  if (cache) return cache;
  const m = new Map();
  for (const f of ["en_ewt-ud-train.conllu", "en_ewt-ud-dev.conllu", "en_ewt-ud-test.conllu"]) {
    const p = path.join(DIR, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      if (!line || line[0] === "#") continue;
      const c = line.split("\t");
      if (c.length < 6 || c[0].includes("-") || c[0].includes(".")) continue;
      const form = c[1].toLowerCase(), lemma = c[2].toLowerCase(), upos = c[3];
      if (!m.has(form)) m.set(form, { lemmas: new Set(), upos: {}, part: 0 });
      const e = m.get(form);
      e.lemmas.add(lemma); e.upos[upos] = (e.upos[upos] || 0) + 1;
      (e.byUpos ||= {}); ((e.byUpos[upos] ||= {})[lemma] = (e.byUpos[upos][lemma] || 0) + 1);   // for the DOMINANT lemma (Clarification 14.1)
      if (/VerbForm=Part/.test(c[5])) e.part++;
    }
  }
  cache = { size: m.size, dominantOf: (w) => { const e = m.get(String(w).toLowerCase()); if (!e) return null; const best = Object.entries(e.upos).sort((a, b) => b[1] - a[1])[0]; if (!best) return null; const ls = Object.entries(e.byUpos[best[0]] || {}).sort((a, b) => b[1] - a[1]); return { upos: best[0], lemma: ls[0] ? ls[0][0] : null }; }, lemmasOf: (w) => { const e = m.get(String(w).toLowerCase()); return e ? e.lemmas : new Set(); }, entry: (w) => m.get(String(w).toLowerCase()) || null, giver: "UD English-EWT r2.14 (CC BY-SA 4.0), gold LEMMA/UPOS/FEATS" };
  return cache;
}
