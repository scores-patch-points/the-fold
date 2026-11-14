// exp/plant.mjs — H7 risk: pass rate of planted plausible-but-wrong steps through logos alone vs logos + step-witness, depths 2–50.
// Deterministic stand-in worker (no model): the measurement is of the CHECKS, not of a model. 10 plants per depth at seeded positions.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { makeLog } from "../log.mjs";
import { makeSurf } from "../surf.mjs";
import { makeMouth, stubTransport } from "../mouth.mjs";
import { runLedger } from "../ledger.mjs";
import { deductionWorld, makeWorker, stepStub, stepWitness } from "../deduce.mjs";
import { rng, synthCut } from "../synth.mjs";
const L = new Set(["implies→implies"]);
const rows = ["depth,plant,kind,checks,caught,goal_status"];
for (const depth of [2, 5, 10, 20, 50]) {
  const r = rng(depth);
  for (let i = 0; i < 10; i++) {
    const at = 1 + Math.floor(r() * depth);
    for (const kind of ["wrongLicensedAt", "wrongAt"]) for (const checks of ["logos", "logos+witness"]) {
      const log = makeLog({ now: () => 0 }); const surf = makeSurf({ log, read: synthCut });
      const { goal } = await deductionWorld({ log, surf, depth, decoys: depth, seed: depth * 10 + i });
      const mouth = makeMouth({ log, B: 4000, transport: stubTransport(stepStub) });
      const res = await runLedger({ log, goal, worker: makeWorker({ mouth, faults: { [kind]: at }, contentOf: surf.contentOf }), licences: L, logos: true, witness: checks === "logos" ? null : stepWitness, maxSteps: 4 * depth + 12 });
      const planted = log.byKind("claim").filter((c) => c.body.inference && c.body.via && c.body.end2 !== log.get(c.body.via).body.end2);
      const caught = planted.length ? planted.every((p) => res.flags.some((f) => f.claim === p.id && f.rule !== "unrouted_contest")) : null;
      rows.push([depth, at, kind === "wrongAt" ? "wrong-declared-unlicensed" : "wrong-looks-licensed", checks, planted.length ? (caught ? 1 : 0) : "not-reached", res.status].join(","));
    }
  }
}
writeFileSync(fileURLToPath(new URL("../runs/results/plant.csv", import.meta.url)), rows.join("\n") + "\n");
const t = {}; for (const l of rows.slice(1)) { const [d, , k, c, caught, st] = l.split(","); const key = `${k} | ${c}`; (t[key] ??= { n: 0, caught: 0, filled: 0 }); if (caught !== "not-reached") { t[key].n++; t[key].caught += +caught; t[key].filled += st === "filled" ? 1 : 0; } }
for (const [k, v] of Object.entries(t)) console.log(`${k}: caught ${v.caught}/${v.n}; goal reported cleanly 'filled' through a wrong step: ${v.filled}/${v.n}`);
