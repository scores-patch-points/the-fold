// frontier/janus-read.mjs — the READ SEAM without a model: Janus reads, the fold answers.
// Janus (scores-patch-points/janus native/organs/nl-eot.mjs) reads text through the language's Universal Dependencies grammar into EOT:
// content nodes and arcs (nsubj, compound, cop, ...). No model. This file PROJECTS those arcs into slot claims; it does not read the text.
//   frame (declared here, giver: this build): a copular predicate P whose subject noun R has a possessor X  →  claim (X, R, P)
//     "Orkadra's mentor is Marmarten."  →  arcs compound(mentor→orkadra), nsubj(Marmarten→mentor)  →  (Orkadra, mentor, Marmarten)
//   A span whose arcs fit no declared frame yields NO claim (the seam then falls to the next organ, the mouth last).
// Casing: Janus lemmatizes (orkadra); the claim takes the span's own bytes for the matched word, so claims stay addressed to the source.
import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CONTRACT } from "./contract.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let G = null, nl = null;
export async function janusReader() {
  if (G) return G;
  const dir = process.env.JANUS_DIR ? resolve(process.env.JANUS_DIR) : resolve(ROOT, "..", "janus");
  if (!existsSync(join(dir, "native"))) throw Object.assign(new Error(`typed gap: no janus checkout at ${dir}`), { gap: "janus_absent" });
  nl = await import(pathToFileURL(join(dir, CONTRACT.siblings.janus.entries.nlEot)).href);
  G = nl.loadGrammar("eng", { priors: join(dir, "priors"), workspace: dirname(dir) });
  if (G.gap) throw Object.assign(new Error(`typed gap: janus has no English grammar: ${G.gap}`), { gap: "janus_no_grammar" });
  return G;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const surfaceOf = (text, lemma) => { const m = text.match(new RegExp(`(?<![\\p{L}\\p{N}])(${esc(String(lemma).replace(/'s$/i, ""))})(?![\\p{L}\\p{N}])`, "iu")); return m ? m[1] : null; };

/** Claims from one sentence's EOT record: [{anchor, relation, value}] for every copular-possessive frame in its arcs. */
export function claimsOfRecord(rec) {
  const m = rec.meaning, text = rec.surface.text, node = Object.fromEntries(m.nodes.map((n) => [n.key, n])), out = [];
  for (const a of m.arcs) {
    if (a.rel !== "nsubj" || !a.from || !a.to) continue;            // P --nsubj--> R
    const P = node[a.from], R = node[a.to];
    if (!P || !R) continue;
    const copular = (P.markers ?? []).some((k) => (m.markers ?? []).some((mk) => mk.key === k && mk.rel === "cop"));
    if (!copular) continue;
    for (const b of m.arcs) {
      if (b.from !== a.to || !["compound", "nmod:poss", "nmod"].includes(b.rel)) continue; // R --compound/poss--> X
      const X = node[b.to]; if (!X) continue;
      const anchor = surfaceOf(text, X.lemma), relation = surfaceOf(text, R.lemma), value = surfaceOf(text, P.lemma);
      if (anchor && relation && value) out.push({ anchor, relation: relation.toLowerCase(), value });
    }
  }
  // frame 2 (declared here): a conditional. The node carrying the "if" marker is the antecedent A; a node with an advmod arc to "then" is
  // the consequent C  →  claim (A, implies, C). Reads Janus's markers and arcs only; the UD parse of "If P0 then P1." puts P0 at the root
  // and P1 as its object, which this frame does not depend on.
  const ifMarked = m.nodes.filter((n) => (n.markers ?? []).some((k) => (m.markers ?? []).some((mk) => mk.key === k && mk.rel === "mark" && String(mk.lemma).toLowerCase() === "if")));
  const thenKey = m.nodes.find((n) => String(n.lemma).toLowerCase() === "then")?.key;
  if (ifMarked.length === 1 && thenKey) for (const a of m.arcs) {
    if (a.rel !== "advmod" || a.to !== thenKey || !node[a.from]) continue;
    let A = ifMarked[0], C = node[a.from];
    if (A.key === C.key) {
      // frame 2b: the parser attached "if" to the clause head, which also carries "then" (measured: 28 of 100 conditionals on the dev
      // world, seed 7). The head is then the consequent and its single compound dependent the antecedent. Reported to janus as a parse issue.
      const deps = m.arcs.filter((b) => b.from === C.key && b.rel === "compound" && node[b.to]);
      if (deps.length !== 1) continue;
      A = node[deps[0].to];
    }
    const anchor = surfaceOf(text, A.lemma), value = surfaceOf(text, C.lemma);
    if (anchor && value) out.push({ anchor, relation: "implies", value });
  }
  return out;
}

/** Read span events through Janus and write each claim as a `fact` (byline reader:janus-nl-eot, deps = the span). Spans already read are
 *  skipped (the read is itself a log event). Returns the new fact ids. */
export async function readSpansWithJanus(log, spanIds, { reuse = true } = {}) {
  const g = await janusReader();
  const done = reuse ? new Set(log.byKind("read").map((e) => e.deps[0])) : new Set(); // reuse=false: the ablation that forgets past reads
  const facts = [];
  for (const id of spanIds) {
    if (done.has(id)) continue;
    const sp = log.get(id); if (!sp || sp.kind !== "span") continue;
    const r = nl.read(g, sp.body.text);
    const claims = r.gap ? [] : r.records.flatMap(claimsOfRecord);
    log.append({ kind: "read", by: "reader:janus-nl-eot", deps: [id], body: { claims: claims.length, gaps: r.gap ? [r.gap] : r.gaps ?? [] } });
    for (const c of claims) facts.push(log.append({ kind: "fact", by: "reader:janus-nl-eot", deps: [id], body: { ...c, read: true, text: sp.body.text } }).id);
  }
  return facts;
}
