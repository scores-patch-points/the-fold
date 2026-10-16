// eval/learnedpatterns/learn.mjs — PREREG.md "Admission" and "Instrument checks" 1–2: learn ONE table on the 80% of harvested entities
// (hash of the Q-id), admit by the max-T shuffled-label null (B = 199), check it on the 20% graded by Wikidata, and run the same learner with
// a shuffled referee (the mutation check).
//   node eval/learnedpatterns/learn.mjs [harvest.json]     → eval/learnedpatterns/patterns.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { learn, tableOf, scoredCandidates, valueForms, verdictOf, inValidation, sha } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(process.argv[2] || path.join(HERE, "../../../learnedpatterns-cache/harvest.json"));
const bytes = fs.readFileSync(file, "utf8");
const H = JSON.parse(bytes);
const B = 199;

const split = (keep) => Object.fromEntries(Object.entries(H.byPid).map(([pid, v]) => [pid, { entities: v.entities.filter((e) => inValidation(e.qid) === keep) }]));
const train = split(false), val = split(true);
const count = (by) => Object.fromEntries(Object.entries(by).map(([p, v]) => [p, v.entities.length]));

function validate(table) {
  const per = {};
  for (const [pid, { entities }] of Object.entries(val)) {
    const c = { commits: 0, confirmed: 0, refuted: 0, skipped: 0, ties: 0, sentencesWithMention: 0 };
    for (const e of entities) {
      const forms = valueForms(e.values);
      for (const s of e.sentences) {
        const { cands, mentions } = scoredCandidates(s, { pids: [pid], anchors: e.anchors, pronoun: true }, table);
        if (mentions) c.sentencesWithMention++;
        if (!cands.length) continue;
        if (cands.length > 1 && cands[1].score === cands[0].score) { c.ties++; continue; }
        c.commits++;
        const v = verdictOf(cands[0].key, forms);
        if (v > 0) c.confirmed++; else if (v < 0) c.refuted++; else c.skipped++;
      }
    }
    per[pid] = c;
  }
  return per;
}

const t0 = Date.now();
const real = learn(train, { B, seed: "learnedpatterns:real", onProgress: (b) => console.error(`real null ${b}/${B}  ${((Date.now() - t0) / 1000).toFixed(0)}s`) });
console.error(`real: ${real.instances} instances, ${real.patterns} candidate patterns, bar ${real.bar}, admitted ${real.admitted.length}`);
const mut = learn(train, { B, seed: "learnedpatterns:mutation-null", labelPerm: "learnedpatterns:mutation", onProgress: (b) => console.error(`mutation null ${b}/${B}`) });
console.error(`mutation: bar ${mut.bar}, admitted ${mut.admitted.length}`);

const byPid = (adm) => Object.fromEntries(Object.keys(H.byPid).map((p) => [p, adm.filter((a) => a.pid === p).length]));
const summ = (xs) => { const s = [...xs].sort((a, b) => a - b); return { min: s[0], median: s[Math.floor(s.length / 2)], max: s[s.length - 1] }; };
const out = {
  written: new Date().toISOString(), harvestSha256: sha(bytes), B, seed: "learnedpatterns:real",
  split: { train: count(train), validation: count(val) },
  real: { instances: real.instances, candidatePatterns: real.patterns, bar: real.bar, nullMax: summ(real.nullMax), admittedByPid: byPid(real.admitted), admitted: real.admitted, validation: validate(tableOf(real.admitted)) },
  mutation: { bar: mut.bar, nullMax: summ(mut.nullMax), admittedByPid: byPid(mut.admitted), admitted: mut.admitted, validation: validate(tableOf(mut.admitted)) },
};
fs.writeFileSync(path.join(HERE, "patterns.json"), JSON.stringify(out, null, 1) + "\n");
console.log(JSON.stringify({ split: out.split, real: { ...out.real, admitted: out.real.admitted.slice(0, 40) }, mutation: { ...out.mutation, admitted: out.mutation.admitted.slice(0, 10) } }, null, 1));
