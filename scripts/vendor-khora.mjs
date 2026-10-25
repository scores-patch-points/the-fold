#!/usr/bin/env node
// scripts/vendor-khora.mjs — vendor the khora's REAL organs into the chat, by closure.
//
// The chat is a surface. It must not carry a lean fork of the organs (that is
// what fold-chat-ground.js is) — it runs the khora's own ES modules, the way the
// holodeck does, so the page stays a static, no-build, GitHub-Pages-deployable
// page and the organs stay defined in exactly one place.
//
//   node scripts/vendor-khora.mjs            copy the closure of ENTRIES into vendor/khora/
//   node scripts/vendor-khora.mjs --check    verify vendor/khora is byte-identical to the pinned commit's files
//   node scripts/vendor-khora.mjs --dry      print the closure and skips, copy nothing
//   node scripts/vendor-khora.mjs --add      copy ONLY files not yet pinned (a new organ), leaving every
//                                            pinned file byte-identical and the pin's commit untouched.
//                                            Use it when the khora working tree is ahead of the pin and you
//                                            want one more organ, not a refresh of all of them.
//   --src /path/to/khora                     default: ../khora
//   --janus /path/to/janus --janus-commit <sha>
//                                            also copy PRIORS (the data the reader asks its prior door for, by name)
//                                            from that janus COMMIT's objects (`git show <sha>:priors/<name>`, never a
//                                            working tree) into vendor/khora/native/priors/. A refresh without
//                                            --janus-commit re-reads the commit the pin already names.
//
// Rules (same as holodeck/tools/vendor-er7.mjs):
//   - vendor/khora is a FROZEN COPY. Never edit it by hand; a tweak goes in
//     the chat's own fold-chat-*.js files or in the khora itself.
//   - Only the static import closure of ENTRIES is copied (relative imports
//     under native/). A file that statically imports a `node:` builtin cannot
//     run in a browser: it is NOT copied, and is recorded in
//     vendor/khora/VENDOR-KHORA.json under `skips` with the importing chain,
//     so the surface KNOWS the organ is unported (never silently dropped).
//   - Dynamic `import()` is not followed (guarded node-only paths live there).
//   - VENDOR-KHORA.json pins the khora commit, and each file's sha256.
//   - Priors are pinned the same way, under `priors/<name>` in `files`, with the janus commit in `janus`.
//     In a page the prior door (the-fold/prior-source.mjs) fetches them from native/priors/ beside it;
//     under Node it reads that directory (there is no janus/priors beside vendor/khora).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const SRC = path.resolve(arg("--src", path.join(ROOT, "..", "khora")));
const DEST = path.join(ROOT, "vendor", "khora");
const DRY = process.argv.includes("--dry");
const CHECK = process.argv.includes("--check");
const ADD = process.argv.includes("--add");
const PIN = path.join(DEST, "VENDOR-KHORA.json");
const JANUS = path.resolve(arg("--janus", path.join(ROOT, "..", "janus")));
const JANUS_ARG = arg("--janus-commit", null);

// The priors a page read of English takes through the prior door (read-core.mjs::priorsFor: the class prior and its lexicon,
// morphology, the MEASURED punctuation prior; language-grammar.js::grammarFor: frame, role config, contractions; reading-rules,
// which prior-source.mjs preloads at import). parser-eng-ewt.json (16 MB, the clause parser's) is not carried: the chat reads
// with the quality layer off, so nothing it runs asks for it.
export const PRIORS = [
  "pos-eng.json",
  "pos-eng-lexicon.json",
  "morphology-eng.json",
  "punctuation-eng.json",
  "reading-rules.json",
  "frame-eng.json",
  "role-config-eng.json",
  "contractions-eng.json",
  "dotted-eng.json",        // the hyperlexicon's dotted words read ahead (fold-chat-cut.js; read-core.mjs::abbreviationsFor)
];

// What the chat runs. Add an organ here when the chat starts using it.
export const ENTRIES = [
  "organs/source.js",
  "organs/fact-block.js",
  "organs/cite.js",
  "organs/grounding.js",
  "organs/witness-sentences.js",
  // organs/verbatim-snip.js — NOT vendored: it statically imports kernel/kleene-up.js, which
  // imports a node: builtin (permanent addresses need node:crypto). Unported until guarded in the khora.
  "organs/run-dmca.js",
  "organs/corroboration.js",
  // THE PROMPT DOOR (Gary, with Kondo and the firewall under him) — what the mouth is handed, in what order, and what
  // never enters: fold-chat-gary.js. Pure, no imports of their own.
  "organs/gary.js",
  "organs/firewall.js",
  "organs/kondo.js",
  // THE PULL (Wald, under heimdall): what a prompt must pull — nothing, the thread, what the fold holds, a structured source, the web — fold-chat-wald.js. Pure, no imports.
  "organs/wald.js",
  // THE VOID (declareVoid: nine operators, every omission typed; cellOf injected from kernel/cube.js) — fold-chat-void-declare.js. Pure, no imports.
  "the-fold/void-shape.js",
  // TERRAIN INDUCTION (Kanada; khora kernel/terrain-induction.js, renamed from kind-induction 2026-10-14): terrainEvidence for the void's universe
  "kernel/terrain-induction.js",
  // NAGARJUNA'S FOUR CORNERS (interpretation/hl.js: verdictOfSupport — is / is-not / both / neither) for the void's verdicts; zero imports
  "interpretation/hl.js",
  // REFERENCE (SIG·Figure): khora's pronoun binder, gates opened and decided by a Born null (eval/void Amendment 5)
  "adapters/text/pronouns.js",
  // THE CONVERSATION'S FLOW (Terry Gross, in earned-cast.js): the speech act of the turn and the facts a reply hears — fold-chat-flow.js.
  "the-fold/earned-cast.js",
  // THE PATHOS ARCHONS: the felt shape of a run of answers for a DECLARED experiencer (Abhinavagupta, with Murch's pacing,
  // Panini's experiencer and the dynamics kernel), and the live turn's composition of it — fold-chat-pathos.js.
  "organs/pathos.js",
  "the-fold/pathos-turn.js",
  // the keyless memory (THE-HOLOGRAPH §3): sdrOf, Field.recall, nullBand — the shadow and echo tiers
  "the-fold/relative.js",
  // THE HOLOGRAPH'S READING SIDE (THE-HOLOGRAPH §6, §9): the address book projected from the constitutional reader's log, the three
  // blocks (Atmosphere / Lens / Paradigm) with the shared cut and the address strike, and the carry recomputed at a cursor.
  "the-fold/reading-log.js",
  "the-fold/resolutions.js",
  "the-fold/fold-at.js",
  // THE FOLD AT AN ADDRESS (FoldRecord@1): the claim-store contract the chat, janus and penelope cross — fold-chat-record.js is its chat adapter.
  "the-fold/fold-record.js",
  // THE OTHER MIND (fold-chat-minds.js): who holds what, a reference resolved inside the holder that introduced it, the fold at any for-whom,
  // a merge re-addressing what was said before it. (kernel/self.js is NOT vendored: under Node it imports canon-ground.mjs, which reads the canon off disk.) for-whom.js is pulled in by theory-of-mind.
  "kernel/perspective.js",
  "kernel/holder-scope.js",
  "kernel/theory-of-mind.js",
  "kernel/hindsight.js",
  // THE MEASURED STOP (THE-STIGMERGIC-PIPELINE §5, Phase A): streaming DMD
  // (causal, prefix-only) over the turn's trajectory decides when the fold has
  // settled or cycles — the cap stays the floor, never the stop. fold-chat-dmd.js.
  "kernel/rewrite-gate.js",
  // DOES A CITED SPAN STILL NAME ITS BYTES (span-drift.js): exact / shifted / moved / gone over `ref#start-end`, ambiguity said, never rewritten.
  // Pure; closes over record-log.js's resolveAddress. A pure function of its inputs, for the chat's citation check.
  "the-fold/span-drift.js",
  // THE READING'S OWN HYPERLEXICON (fold-chat-meaning.js): the relation reader (end1 —label→ end2, the vocabulary MEASURED from the text it reads,
  // never listed), the surfaces it stands on, the lemmatizer, and the assertion ledger. A word's meaning in a reading is the slots it fills.
  "adapters/text/relations.js",
  "adapters/text/surfaces.js",
  "adapters/text/morphology.js",
  "organs/hyperlexicon.js",
  // THE REASONING LINTER (fold-chat-reason-lint.js): the reasoning seed's sections 4-5 at strict, with regime.js's containment
  // boundary. Vendored by hand on 2026-10-11 and pinned in the 2026-10-14 refresh; named here so a refresh by closure keeps it.
  "organs/reasoning-lint.js",
  // THE MASTER PIPELINE (khora THE-READING-PIPELINE.md, 2026-10-24): read-core.mjs::readDocument / readWith is the one reader every
  // surface reads a document through; prior-source.mjs is the one door its priors come through (fetched from native/priors in a
  // page); spans.js::splitSentences is the one sentence cut (fold-chat-cut.js); language-context.js::extractSurfacesHeard is the
  // surface (name) organ; organs/lexicon.js the hyperlexicon organ that resolves dotted forms when a giver is reachable.
  "the-fold/read-core.mjs",
  "the-fold/prior-source.mjs",
  "adapters/text/spans.js",
  "the-fold/language-context.js",
  "organs/lexicon.js",
];

// Node-only modules a vendored file reaches only through an IS_NODE-guarded dynamic import(): organs/grounding.js and
// kernel/self.js top-level-await the-fold/canon-ground.mjs under Node (it reads the canon off disk) and never in a page.
// They are copied although they import node: statically, so the closure also loads under Node (the reader core reaches
// grounding.js through organs/hypergraph.js); their own static imports are followed like any entry's. Recorded as `nodeOnly`.
export const NODE_ONLY = ["the-fold/canon-ground.mjs"];

// An import list may span lines (`import {\n  a,\n  b,\n} from "./regime.js"`, organs/reasoning-lint.js): the specifier part may hold
// newlines, never a quote or a semicolon.
const NODE_IMPORT = /(?:^|\n)\s*(?:import\s+(?:[^"';]*?\sfrom\s+)?|export\s+[^"';]*?\sfrom\s+)["']node:[^"']+["']/;
const STATIC_IMPORT = /(?:^|\n)\s*(?:import|export)\s+(?:[^"';]*?\sfrom\s+)?["'](\.[^"']+)["']/g;
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");

function resolveImport(fromRel, spec) {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec));
  return base;
}

// `stopAt`: files already pinned (the --add mode): they are leaves, never re-read from a khora tree that may be ahead.
function closure(entries = [...ENTRIES, ...NODE_ONLY], stopAt = null) {
  const native = path.join(SRC, "native");
  const seen = new Map(); // rel -> { via }
  const skips = [];
  const missing = [];
  const queue = entries.map((e) => ({ rel: e, via: "(entry)" }));
  while (queue.length) {
    const { rel, via } = queue.shift();
    if (seen.has(rel)) continue;
    if (stopAt && stopAt[rel]) { seen.set(rel, { via, pinned: true }); continue; }
    const abs = path.join(native, rel);
    if (!fs.existsSync(abs)) { missing.push({ rel, via }); continue; }
    const text = fs.readFileSync(abs, "utf8");
    if (NODE_IMPORT.test(text) && !NODE_ONLY.includes(rel)) { skips.push({ rel, via, why: "statically imports a node: builtin" }); seen.set(rel, { skipped: true }); continue; }
    seen.set(rel, { via });
    for (const m of text.matchAll(STATIC_IMPORT)) {
      const next = resolveImport(rel, m[1]);
      if (!/\.(m?js|json)$/.test(next)) continue;
      if (!seen.has(next)) queue.push({ rel: next, via: rel });
    }
  }
  const files = [...seen.entries()].filter(([, v]) => !v.skipped).map(([rel]) => rel).sort();
  return { files, skips, missing };
}

function khoraCommit() {
  try {
    const sha1 = execFileSync("git", ["-C", SRC, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const dirty = execFileSync("git", ["-C", SRC, "status", "--porcelain", "--", "native"], { encoding: "utf8" }).trim();
    return { commit: sha1, dirtyNative: dirty ? dirty.split("\n").length : 0 };
  } catch { return { commit: null, dirtyNative: null }; }
}

const pinForAdd = ADD && fs.existsSync(PIN) ? JSON.parse(fs.readFileSync(PIN, "utf8")) : null;
const { files, skips, missing } = pinForAdd
  ? closure([...ENTRIES, ...NODE_ONLY].filter((e) => !(pinForAdd.entries || []).includes(e) && !(pinForAdd.nodeOnly || []).includes(e)), pinForAdd.files)
  : closure();

if (CHECK) {
  if (!fs.existsSync(PIN)) { console.error("no vendor/khora/VENDOR-KHORA.json — run without --check first"); process.exit(2); }
  const pin = JSON.parse(fs.readFileSync(PIN, "utf8"));
  let bad = 0;
  for (const [rel, h] of Object.entries(pin.files)) {
    const f = path.join(DEST, "native", rel);
    if (!fs.existsSync(f)) { console.error("MISSING vendored", rel); bad++; continue; }
    if (sha(fs.readFileSync(f)) !== h) { console.error("EDITED vendored (must be byte-identical)", rel); bad++; }
  }
  const cur = khoraCommit();
  const behind = [];
  for (const rel of Object.keys(pin.files)) {
    if (rel.startsWith("priors/")) continue; // janus data, pinned by janus commit
    const s = path.join(SRC, "native", rel);
    if (fs.existsSync(s) && sha(fs.readFileSync(s)) !== pin.files[rel]) behind.push(rel);
  }
  console.log(`vendor/khora: ${Object.keys(pin.files).length} files, pinned khora ${String(pin.khora?.commit).slice(0, 8)}, now ${String(cur.commit).slice(0, 8)}${pin.janus?.commit ? `; priors from janus ${String(pin.janus.commit).slice(0, 8)}` : ""}`);
  if (behind.length) console.log(`BEHIND upstream (${behind.length}):\n  ` + behind.join("\n  "));
  if (pin.skips?.length) console.log(`typed skips (unported, node-only): ${pin.skips.map((s) => s.rel).join(", ")}`);
  process.exit(bad ? 1 : 0);
}

console.log(`closure of ${ENTRIES.length} entries under ${SRC}/native: ${files.length} files, ${skips.length} skipped (node-only), ${missing.length} missing`);
for (const s of skips) console.log(`  SKIP ${s.rel}  (${s.why}; reached via ${s.via})`);
for (const m of missing) console.log(`  MISSING ${m.rel}  (imported by ${m.via})`);
if (DRY) { console.log(files.map((f) => "  " + f).join("\n")); process.exit(0); }

// --add: keep every pinned file exactly as it is; copy only what the pin does not hold yet.
const pinned = pinForAdd;
if (ADD && !pinned) { console.error("--add needs an existing pin (vendor/khora/VENDOR-KHORA.json)"); process.exit(2); }
if (!ADD) fs.rmSync(path.join(DEST, "native"), { recursive: true, force: true });
const hashes = pinned ? { ...pinned.files } : {};
const added = [];
for (const rel of files) {
  const from = path.join(SRC, "native", rel);
  const to = path.join(DEST, "native", rel);
  if (pinned && pinned.files[rel] && fs.existsSync(to)) { hashes[rel] = pinned.files[rel]; continue; }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  hashes[rel] = sha(fs.readFileSync(to));
  added.push(rel);
}
const khora = pinned ? pinned.khora : khoraCommit();
// the priors, from a janus commit's objects: on --add only the names the pin does not hold yet
const JANUS_COMMIT = JANUS_ARG ?? pinned?.janus?.commit ?? (fs.existsSync(PIN) ? JSON.parse(fs.readFileSync(PIN, "utf8")).janus?.commit ?? null : null);
const priorsAdded = [];
if (JANUS_COMMIT) {
  for (const name of PRIORS) {
    const rel = `priors/${name}`;
    const to = path.join(DEST, "native", rel);
    if (pinned && pinned.files[rel] && fs.existsSync(to)) { hashes[rel] = pinned.files[rel]; continue; }
    let bytes;
    try { bytes = execFileSync("git", ["-C", JANUS, "show", `${JANUS_COMMIT}:priors/${name}`], { maxBuffer: 1 << 28 }); }
    catch { console.error(`prior ${name} is not at janus ${JANUS_COMMIT} (${JANUS})`); process.exit(1); }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, bytes);
    hashes[rel] = sha(bytes);
    priorsAdded.push(rel);
  }
} else if (PRIORS.length) console.log("NOTE: no --janus-commit and none pinned: no priors vendored; a page read is bare (every prior a typed gap).");
fs.mkdirSync(DEST, { recursive: true });
fs.writeFileSync(PIN, JSON.stringify({
  repo: "scores-patch-points/khora",
  khora,
  ...(JANUS_COMMIT ? { janus: { repo: "scores-patch-points/janus", commit: JANUS_COMMIT, priors: PRIORS } } : {}),
  note: "FROZEN COPY of the static import closure of `entries`. Refresh with `node scripts/vendor-khora.mjs`; verify with --check. Never edit by hand.",
  entries: ENTRIES,
  nodeOnly: NODE_ONLY,
  files: Object.fromEntries(Object.entries(hashes).sort(([a], [b]) => (a < b ? -1 : 1))),
  skips: pinned ? [...(pinned.skips || []), ...skips] : skips,
  missing: pinned ? [...(pinned.missing || []), ...missing] : missing,
}, null, 2) + "\n");
if (ADD) console.log(`added ${added.length} new file(s), kept ${files.length - added.length} pinned file(s) untouched:\n  ` + added.join("\n  "));
else console.log(`vendored ${files.length} files -> vendor/khora/  (khora ${String(khora.commit).slice(0, 8)}${khora.dirtyNative ? `, ${khora.dirtyNative} dirty native/ files in the khora working tree` : ""})`);
if (priorsAdded.length) console.log(`priors: ${priorsAdded.length} from janus ${String(JANUS_COMMIT).slice(0, 8)} -> vendor/khora/native/priors/`);
if (skips.length || missing.length) console.log("NOTE: skips/missing are recorded in VENDOR-KHORA.json — the surface must treat those organs as unported.");
