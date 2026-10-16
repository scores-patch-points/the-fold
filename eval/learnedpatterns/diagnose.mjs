// eval/learnedpatterns/diagnose.mjs — POST-HOC, written after the verdict; it reads TRAINING data only and decides nothing.
// Why so little was admitted: (1) each property's own null maximum vs the single max-T bar; (2) each property's best real patterns;
// (3) the real training score of the keys that the in-scope STATES sentences would have needed.
//   node eval/learnedpatterns/diagnose.mjs [harvest.json]   → diagnose.json here
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { learn, inValidation, tokenize, anchorMentions, candidates, keysOf } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const H = JSON.parse(fs.readFileSync(path.resolve(process.argv[2] || path.join(HERE, "../../../learnedpatterns-cache/harvest.json")), "utf8"));
const train = Object.fromEntries(Object.entries(H.byPid).map(([p, v]) => [p, { entities: v.entities.filter((e) => !inValidation(e.qid)) }]));
const r = learn(train, { B: 199, seed: "learnedpatterns:real", diagnose: true });     // same seed: the same replicates as the run
const S = new Map(r.keyName.map((k, i) => [k, { S: r.real.S[i], conf: r.real.conf[i], ref: r.real.ref[i] }]));
const pids = Object.keys(H.byPid);
const perPid = {};
for (const pid of pids) {
  const nm = r.nullMaxByPid.map((m) => m[pid] ?? null).filter((x) => x != null).sort((a, b) => a - b);
  const best = r.keyName.map((k, i) => [k, i]).filter(([k]) => k.startsWith(pid + "|")).sort((a, b) => r.real.S[b[1]] - r.real.S[a[1]]).slice(0, 5)
    .map(([k, i]) => `${k.slice(pid.length + 1)} S=${r.real.S[i]} (${r.real.conf[i]}/${r.real.ref[i]})`);
  perPid[pid] = { ownNullMax: { median: nm[Math.floor(nm.length / 2)], max: nm[nm.length - 1] }, bestReal: best };
}
// the keys of the in-scope STATES sentences (from rows.jsonl), anchor = the ask's reading, candidate = the labeler's answer run
const rows = fs.readFileSync(path.join(HERE, "rows.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const summary = JSON.parse(fs.readFileSync(path.join(HERE, "summary.json"), "utf8"));
const needed = [];
for (const row of rows.filter((x) => x.inScope && x.strictLabel === "STATES")) {
  const rd = summary.readings[row.ask], toks = tokenize(row.sentence);
  const ms = anchorMentions(toks, rd.anchors);
  const blocked = new Set(); for (const a of ms) for (let k = a.i; k <= a.j; k++) blocked.add(k);
  const ans = String(row.strictAnswer).toLowerCase();
  const c = candidates(toks, blocked).find((x) => ans.includes(x.text.toLowerCase()) || x.text.toLowerCase().includes(ans));
  const keys = c && ms.length ? [...new Set(ms.flatMap((a) => keysOf(toks, a, c)))] : [];
  const scored = keys.flatMap((k) => rd.pids.map((p) => [`${p}|${k}`, S.get(`${p}|${k}`) || null])).filter(([, v]) => v).sort((a, b) => b[1].S - a[1].S).slice(0, 4);
  needed.push({ ask: row.ask, sentence: row.sentence.slice(0, 110), mentions: ms.length, candidate: c ? c.text : null, bestTrainingKeys: scored.map(([k, v]) => `${k} S=${v.S} (${v.conf}/${v.ref})`) });
}
const out = { posthoc: true, bar: r.bar, perPid, statesSentences: needed };
fs.writeFileSync(path.join(HERE, "diagnose.json"), JSON.stringify(out, null, 1) + "\n");
console.log(JSON.stringify(out, null, 1));
