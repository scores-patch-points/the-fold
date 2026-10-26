// fold-chat-meaning.js — WORD MEANING FROM THE READING'S OWN HYPERLEXICON. Pure: no DOM, no network, no model, no clock.
//
// The hyperlexicon is the reading's assertion ledger: notes `end1 —label→ end2` that the relation reader (vendor/khora adapters/text/relations.js)
// hears in the text, its verb vocabulary MEASURED from that text, never listed. A word's meaning IN A READING is the set of slots it fills — the
// (end1, end2) pairs it is heard to relate. Two words are the same meaning there iff they fill the SAME slot in EQUIVALENT claims; a pair the
// reading never placed so is a TYPED GAP, earned by the reading and never guessed (fold-stress-session/hyperlexicon-meaning.mjs, which this adopts;
// Parmenides, FOLD-CONSTITUTION II.7: "appearance may nominate, never decide" — no embedding, no list of synonyms).
//
//   readLedger(sources, { fw })           → { notes: [{ ref, end1, label, end2, polarity }], verbs: Set, sources: [ref] }
//   sameMeaning(a, b, ledger, { exclude }) → { verdict: "same" | "other" | "refused", via?, slots?, witnesses?, why? }
//
// CIRCULARITY IS REFUSED. The claim and the page sentence under test would trivially "share a slot" — they say the same thing, that is what is
// being asked. The evidence that two verbs are one meaning must come from notes of OTHER sources (`exclude` names the sources under test): an
// independent witness, the way a shared chain counts as one witness (khora corroboration).
//
// MEASURED (eval/origin/RESULTS.md, 2026-10-06): on six real articles of 45–85k characters, two different labels share a slot in 0–3 of 97–368
// slots and the few that do are not synonyms; on a lone claim plus one page the reader admits no verb at all. So on ONE turn this earns almost
// nothing and every pair is a typed gap. It is therefore OFF by default (fold-chat-origin.js takes a ledger only when a caller passes one), and
// stays so until a corpus of real turns shows it earning more than it costs. Declared, not measured (Constitution II.11).
// THE ONE READER (the Isthmus, khora native/docs/THE-ISTHMUS.md; THE-READING-PIPELINE.md: "nothing assembles a second reader"): the ledger is
// what khora's master pipeline hears (vendor/khora/native/the-fold/read-core.mjs::readWith, byte-identical to khora main), each source in
// the language it is heard in, never a reader assembled here from the cut, the surfaces and the relation vocabulary. Before 2026-10-26 this
// file assembled that second reader itself (splitSentences + extractSurfaces + discoverRelationVocab + extractRelations, English closed
// classes); the measured null below was that reader's.
import { readWith } from "./vendor/khora/native/the-fold/read-core.mjs";

export const MEANING = Object.freeze({
  giver: "the user's definition of identity/meaning (2026-10-06) via fold-stress-session/hyperlexicon-meaning.mjs; declared, not measured (II.11)",
  minSurfaces: 2,     // a verb is admitted only after it follows ≥ this many DISTINCT names (the relation reader's own recurrence discipline; the caller's to declare)
  maxChars: 200000,   // a source longer than this is read up to here
});

import { foldText } from "./fold-chat-foldtext.js";   // the khora's fold scope (II.13)
const fold = (s) => foldText(s).replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** The reading's ledger over `sources` ([{ ref, text }]). The verb vocabulary is measured on all of them pooled; each source's own notes keep their `ref`
 *  (so a decision can set the sources under test aside). Never throws: a reader failure is an empty ledger. */
export function readLedger(sources, { fw = null } = {}) {
  const empty = { notes: [], verbs: new Set(), sources: [] };
  try {
    const list = (Array.isArray(sources) ? sources : []).filter((s) => s && typeof s.text === "string" && s.text.trim()).map((s) => ({ ref: String(s.ref ?? ""), text: s.text.slice(0, MEANING.maxChars) }));
    if (!list.length) return empty;
    const notes = [], verbs = new Set(), languages = [];
    for (const s of list) {
      const W = readWith(s.text, { address: s.ref, minCharacters: 0, quality: false });
      if (W.language) languages.push({ ref: s.ref, ...W.language });
      for (const e of W.edges ?? []) {
        const end1 = fold(e.end1Face ?? e.end1), label = fold(e.label), end2 = fold(e.end2Face ?? e.end2);
        if (end1 && label && end2) { notes.push({ ref: s.ref, end1, label, end2, polarity: e.polarity === "-" ? "-" : "+" }); verbs.add(label); }
      }
    }
    return { notes, verbs, sources: list.map((s) => s.ref), languages, reader: "khora read-core readWith (vendored)" };
  } catch { return empty; }
}

/** Are the words `a` and `b` one meaning in this reading? "same" only when both fill a common (end1, end2) slot, with the same polarity, in notes of
 *  sources OTHER than `exclude`; "other" when each fills slots but never a common one; "refused" (a typed gap) when either fills none. A word's own
 *  surface identity (the same folded word) is "same" without the ledger. */
export function sameMeaning(a, b, ledger, { exclude = [] } = {}) {
  const x = fold(a), y = fold(b);
  if (!x || !y) return { verdict: "refused", why: "no-word" };
  if (x === y) return { verdict: "same", via: "folded" };
  const skip = new Set((exclude || []).map(String));
  const notes = (ledger && Array.isArray(ledger.notes) ? ledger.notes : []).filter((n) => !skip.has(String(n.ref)));
  const slotsOf = (w) => { const m = new Map(); for (const n of notes) if (n.label === w) { const k = `${n.end1}|${n.end2}|${n.polarity}`; (m.get(k) || m.set(k, []).get(k)).push(n.ref); } return m; };
  const sa = slotsOf(x), sb = slotsOf(y);
  if (!sa.size && !sb.size) return { verdict: "refused", why: "neither word fills any slot in this reading" };
  if (!sa.size || !sb.size) return { verdict: "refused", why: `"${sa.size ? y : x}" fills no slot in this reading` };
  const shared = [...sa.keys()].filter((k) => sb.has(k));
  if (!shared.length) return { verdict: "other", why: "the reading never heard them relate the same ends" };
  return { verdict: "same", via: "slot", slots: shared.map((k) => k.replace(/\|[+-]$/, "").replace("|", " → ")), witnesses: [...new Set(shared.flatMap((k) => [...sa.get(k), ...sb.get(k)]))] };
}
