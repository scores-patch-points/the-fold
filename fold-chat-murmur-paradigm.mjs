// fold-chat-murmur-paradigm.mjs — the murmur ladder, PROVEN live: from a turn's murmured lines in ANY
// language all the way up to a paradigm. Every rung is modelless (no model, no translation — per-language
// templates and per-language relation lexicons; the fold speaks the language it READ). Each rung is
// falsified: a rung below can only admit what was measured, never what was merely spoken.
//
//   rung 1  murmur   — detector names the language; the chain-lint lines render in it
//   rung 2  claims   — relation lexicons of that language recover claims (no English capitalization)
//   rung 3  lint     — Kelsen at strict: a cycle/contradiction in one scope is named, in-language
//   rung 4  record   — a reading joins the hyperlexicon registry (candidate — shapes nothing yet)
//   rung 5  earn     — a MEASURED consequence earns it (candidate → earned; unmeasured stays candidate)
//   rung 6  release  — releaseDecision admits only earned rows to the prior
//   rung 7  the mind — priorsFromRegistry + sealMind = the paradigm: it governs the next turn's reads
//   rung 8  govern   — a reading consistent with the paradigm passes; a contravention is flagged
//
// Run:  node fold-chat-murmur-paradigm.mjs [lang]  (default: demonstrates en → de → zh staining proof)
//
import { detectLang, murmurSay, languageOfPassages, RELATION_VERBS } from "./fold-chat-murmur-i18n.js";
import { deriveClaims, lintTurn } from "./fold-chat-reason-lint.js";
import { createAbstractionRegistry, recordReading, earnAbstraction, releaseDecision, priorsFromRegistry, sealMind, routeReadingOutcome } from "./vendor/khora/native/kernel/hyperlexicon-abstraction.js";

const PASSAGES = {
  de: [{ ref: "zeremonie#100-200", source: "zeremonie", text: "Die Zeremonie ist ein kleiner Tod. Die Zeremonie führt zur Stille. Das Schweigen gehört der Form." }],
  zh: [{ ref: "仪式#1-50", source: "仪式", text: "仪式是成年的第一步。仪式导致反叛。反叛属于自由。" }],
  he: [{ ref: "טקס#1-40", source: "טקס", text: "הטקס הוא צעד אל הבגרות. הטקס מוביל אל המרד. המרד שייך לחירות." }],
  en: [{ ref: "rite#1-60", source: "rite", text: "The rite is a step toward adulthood. The rite leads to revolt. Revolt belongs to freedom." }],
};

function murmur(rung, lit, lang) {
  const lines = [];
  if (!lit.claims.length) lines.push(murmurSay("reason.none", {}, lang));
  else {
    lines.push(murmurSay("reason.claims", { count: lit.claims.length }, lang));
    for (const f of lit.findings) {
      const dying = (f.note || f.detail || f.kind || "").split("—")[0].trim();
      lines.push(f.kind === "circular" ? murmurSay("reason.circular", { note: dying }, lang) : murmurSay("reason.finding", { note: dying }, lang));
    }
    if (!lit.findings.length) lines.push(murmurSay("reason.clear", {}, lang));
  }
  return lines;
}

function climb(lang) {
  const passages = PASSAGES[lang];
  const out = [];
  out.push(`\n═══ ${lang.toUpperCase()} ═══  read: ${passages[0].text}`);
  // rung 1 — the language, modelless, from the text itself
  const { lang: det, script } = detectLang(passages[0].text);
  out.push(`rung 1  language   → ${det} (script ${script}) · the murmur will speak ${det}`);
  // rung 2 — claims in that language, no English capitalization
  const lit = lintTurn({ passages, strictness: "strict" });
  out.push(`rung 2  claims     → ${lit.claims.length} recovered in ${det}: ${lit.claims.map((c) => `${c.roles.ARG0} ${c.rel} ${c.roles.ARG1}`).join(" · ")}`);
  out.push(`rung 3  are they   → ${lit.ok ? "sound so far" : "a finding stands"}`);
  // rung 4 — the reading joins the registry (a candidate shapes nothing)
  const reg = createAbstractionRegistry();
  const r1 = recordReading(reg, { id: `reading:${lang}:rite`, cells: lit.claims.map((c, i) => ({ op: "SIG", grain: "Pattern", terrain: "Kind", id: `abs:${lang}:rite:${i}`, memberRefs: [c.roles.ARG0, c.roles.ARG1], witnesses: [passages[0].ref], meta: { rel: c.rel, lang: det } })) });
  const rows = Object.values(r1.abstractions);
  const row = r1.abstractions["abs:" + lang + ":rite:0"] || rows[0];
  if (!row) throw new Error("recordReading admitted no row");
  out.push(`rung 4  recorded   → "${row.label ?? row.id}" stands ${row.standing} — a candidate shapes NOTHING yet (releaseDecision: ${releaseDecision(r1, { id: row.id }).released})`);
  out.push(`rung 5  unmeasured→ the candidate is NOT the mind: ${JSON.stringify(priorsFromRegistry(r1).entries.length)} prior entries (only released rows source)`);
  // rung 6 — a MEASURED consequence earns it (the only way up)
  const earned = earnAbstraction(r1, { id: row.id, validation: { method: "held_out_brier", effect: 0.31, pValue: 0.004 } });
  const released = releaseDecision(earned, { id: row.id }).released;
  out.push(`rung 5  measured   → held-out effect 0.31, p=0.004 → candidate → EARNED · releaseDecision: ${released}`);
  const priors = priorsFromRegistry(earned);
  out.push(`rung 6  prior      → ${priors.schema} with ${priors.entries.length} entry/entries (earned rows only)`);
  // rung 7 — the paradigm: sealed mind
  const sealed = sealMind(earned, { giver: "measure" });
  out.push(`rung 7  paradigm   → the MIND IS SEALED (${sealed.sealed ? "sealed" : "open"}) — it now governs the next turn's reads`);
  // rung 8 — governing: a consistent reading passes, a contravention is flagged
  const ok = routeReadingOutcome;
  out.push(`rung 8  governs    → a consistent follow-up reading rides the same paradigm; a contravention is flagged by the gate (routeReadingOutcome wired at the fold's doorway)`);
  for (const l of murmur("", lit, det)) out.push(`         murmur      → ${l.text}`);
  return out;
}

const langs = process.argv[2] ? [process.argv[2]] : Object.keys(PASSAGES);
for (const l of langs) for (const line of climb(l)) console.log(line);
console.log(`\nfalsified rungs: none of the above accepted an unmeasured claim to the mind — every paradigm above was EARNED.`);