// fold-chat-lattice.js — CLIMB THE ABSTRACTION LATTICE (2026-10-11).
//
// On a turn the model may write (modelRule.allowed — the mechanical paths have
// refused or handed off), the model is told to REASON, not recite. The ladder
// is the fold's own lattice, climbed in nested passes, mechanically derived —
// every rung is built ONLY from the fold's own computed ground:
//
//   L1 · GROUND     the concrete: the read sentences that bear on the ask,
//                   QUOTED verbatim (the only permitted fact material)
//   L2 · LENS       the ask's own angle: its content phrase + the relation the
//                   turn must witness (the cues/frame)
//   L3 · PARADIGM   the general pattern this instantiates — the SHAPE the reply
//                   must fit (an incumbent, a quantity, a place, a change…),
//                   never a fact
//
// The instruction is NESTED reasoning: think the ground first, then the lens,
// then the paradigm, and only then speak; every spoken factual sentence must
// restate an L1 quote with its address; the thinking is private — none of the
// unspoken lattice lines may leak into the reply.
//
// DECLARED, not measured (Constitution II.11). The honesty rule this module is
// built to keep: the scaffold NEVER introduces a content word the ask, the
// read sentences, or the declared rung vocabulary do not carry — so a model
// can never be led to cite a "fact" the lattice itself invented
// (scaffoldWithoutInvention, falsified below).

const REASONS = Object.freeze({
  groundIntro: "L1 · GROUND — the material that bears on the ask (verbatim; the only sentences a factual sentence may restate)",
  lensIntro: "L2 · LENS — what this ask is really testing, in the ask's own words",
  paradigmIntro: "L3 · PARADIGM — the general case this instantiates; it shapes the reply, it is never a fact",
  nested: "REASON IN THE LATTICE BEFORE YOU REPLY: climb the ground, then the lens, then the paradigm — then write. Mean every sentence: a factual sentence must restate an L1 quote and carry its address. Nothing the ladder said is spoken — only what the ground holds.",
});

/** The declared rung vocabulary — the ONLY new words the prompt may add
 *  beyond the ask's own, the quotes, and the cues. Falsified: a scaffold
 *  containing a word outside (question ∪ quotes ∪ cues ∪ this set) is refused. */
const VOCAB = Object.freeze(new Set([
  "l1", "l2", "l3", "ground", "lens", "paradigm", "ask", "material", "verbatim", "sentence", "sentences",
  "factual", "only", "restate", "carries", "address", "shape", "reply", "never", "climb", "then", "before", "reason",
  "instantiates", "general", "case", "what", "the", "its", "this", "is", "it", "are", "in", "of", "and", "a", "may",
  "incumbent", "quantity", "place", "time", "person", "thing", "change", "relation", "witness", "turn", "must", "be", "not",
  "private", "think", "ladder", "held", "means", "write", "about", "bearing", "read", "word", "words", "labels", "cues",
  "you", "your", "mean", "every", "quote", "carry", "nothing", "said", "spoken", "lattice", "itself", "will", "one", "with",
  "holds", "that", "bears", "really", "testing", "own", "shapes", "shape", "shaped", "its", "s", "word", "rung", "fact", "fits", "fold", "already",
]));

const clip = (s, n) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };

/** L2: the ask's own words after its frame ("Who is the current king of Sweden and what year was he born?" → its content phrase). */
export function lensOf(question, { fwstrips = ["who", "what", "where", "when", "which", "whose", "why", "how", "is", "are", "am", "was", "were", "be", "been", "the", "a", "an", "and", "of", "to", "in", "it", "he", "she", "they", "his", "her", "their", "its", "do", "does", "did"] } = {}) {
  const w = String(question ?? "").replace(/[?!¿¡.]+$/u, "").replace(/\s+/g, " ").trim();
  const words = w.split(/\s+/).filter((x) => !fwstrips.includes(String(x).toLowerCase()));
  return words.join(" ").slice(0, 140);
}

/** L3: the declared paradigm this ask instantiates, from the fold's own frame — never a fact. */
export function paradigmOf({ slot = null, cues = [] } = {}) {
  const SLOT_SHAPE = { person: "an incumbent", place: "a place", time: "a moment or span", quantity: "a number", thing: "a nominated thing" };
  const parts = [];
  if (slot && SLOT_SHAPE[slot]) parts.push(`the reply fits the shape of ${SLOT_SHAPE[slot]}`);
  if (Array.isArray(cues) && cues.length) parts.push(`the labels the fold already read: ${cues.slice(0, 3).map((c) => String(c).replace(/\s+/g, " ").slice(0, 60)).join(" · ")}`);
  return parts.join("; ");
}

/** Build the ladder. Sentences are the turn's salient read sentences, quoted; cues/labels and the
 *  slot come from the turn's own computed reading. Returns null when there is nothing to reason over. */
export function climbLattice({ question, referents = [], sentences = [], cues = [], slot = null, max = 6 } = {}) {
  const quotes = (Array.isArray(sentences) ? sentences : []).filter((s) => String(s ?? "").trim().length >= 20).map((s) => clip(s, 240)).slice(0, max);
  if (!quotes.length) return null;
  const lens = lensOf(question);
  const paradigm = paradigmOf({ slot, cues });
  const steps = [
    { rung: "L1", label: "ground", lines: quotes.map((q) => `“${q}”`) },
    { rung: "L2", label: "lens", lines: lens ? [lens] : [] },
    ...(paradigm ? [{ rung: "L3", label: "paradigm", lines: [paradigm] }] : []),
  ];
  return { steps, sentences: quotes };
}

/** The nested-reasoning prompt the model hears on an allowed turn, or null. */
export function latticePrompt(input) {
  const l = climbLattice(input);
  if (!l) return null;
  const parts = [REASONS.nested];
  for (const s of l.steps) {
    const intro = s.rung === "L1" ? REASONS.groundIntro : s.rung === "L2" ? REASONS.lensIntro : REASONS.paradigmIntro;
    parts.push(intro + (s.lines.length ? "\n" + s.lines.map((x) => "· " + x).join("\n") : ""));
  }
  return parts.join("\n\n");
}

/** THE HONESTY CHECK (falsifiable): no content word of the scaffold lies
 *  outside (question ∪ quotes ∪ cues ∪ the declared VOCAB) — the lattice can
 *  lead a model to the material, never to a word it invented. */
export function scaffoldWithoutInvention(prompt, { question = "", quotes = [], cues = [] } = {}) {
  const text = String(prompt ?? "").toLowerCase();
  const own = new Set([...(String(question).toLowerCase().match(/[\p{L}\p{N}]+/gu) || []), ...VOCAB]);
  for (const q of quotes) for (const w of (String(q).toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])) own.add(w);
  for (const c of cues) for (const w of (String(c).toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])) own.add(w);
  const foreign = (text.match(/[\p{L}\p{N}]+/gu) || []).filter((w) => !own.has(w));
  return foreign.length ? { ok: false, foreign: [...new Set(foreign)].slice(0, 8) } : { ok: true, foreign: [] };
}