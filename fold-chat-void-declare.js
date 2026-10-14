// fold-chat-void-declare.js — L1: THE VOID AN ASK DECLARES, read from the ask's own grammar (eval/void/PREREG.md). Pure but for the injected
// title door (askFrame's own resolveTitles). No DOM, no model, no clock.
//
// The answer pipeline's frame (fold-chat-frame.js askFrame) is { slot, referents, predicate }: a slot only when a wh-word stands at the FRONT,
// and nothing that says what would SATISFY it. khora's declareVoid (vendor/khora/native/the-fold/void-shape.js) declares a void across nine
// operators, every omission a typed gap. This module fills the fields the ask's grammar can state, and leaves the rest typed:
//
//   slot         time | person | place | thing | quantity — from an interrogative ANYWHERE in the ask ("…finished in what year?"), from "how"
//                + a measure word ("how tall"), or, with no interrogative at all, from the ask's role noun ("year the Titanic sank" → time,
//                "Hamlet author" → person, "capital of Australia?" → thing)
//   anchor       the referent the ask is about — askFrame's own resolution (the same title door, the same agreement and position rules)
//   admits       what kind of thing may stand there, as far as GRAMMAR can say: time → date, person → person, quantity → its measure's
//                dimension, place → place, thing → the role noun itself ("capital", "currency"). That a capital is a CITY, or that a
//                beginning two thousand years ago is an ERA, the grammar cannot say: the referent's universe (L2/L3) must.
//   relation     the ask's predicate words (askFrame) plus the role noun
//   cardinality  1, or "many" when the role noun or the copula is plural
//   extent       the ask's own year span, when it states one
//   composition, admission, reopensOn — not read from grammar: typed gaps here (L3 declares admission)
//
// THE FULL STACK (PREREG Amendment 1). PERCEPTION: the khora's surface reader reads the ask too. `anchor.by` names what touched the anchor,
// and they are NOT two independent witnesses of the referent (chorus: Pearl): the perceiver witnesses only the SURFACE (that these words are
// a name in the ask); the TITLE always comes from the one title door; when the title door reads no referent, the perceived surfaces are offered to the SAME
// title door (one call), longest first, and the anchor is taken only when the door resolves one. PATHOS: the void is a belief held FOR
// someone — withExperiencer stamps it with the person asking and the address of what they said (`ask#0-n`), never a default.
//
// DECLARED, NOT MEASURED (Constitution II.11). Giver of every table below: the author's reading of English, 2026-10-14 (eval/void/PREREG.md);
// English only — a language with no table gets the typed gap `no_grammar_for_language`, never an English guess.
import { askFrame, grammarOf, tokensOf, closedClassOf, stemOf } from "./fold-chat-frame.js";
import { declareVoid } from "./vendor/khora/native/the-fold/void-shape.js";
import { cellOf } from "./vendor/khora/native/kernel/cube.js";
import { extractSurfaces } from "./vendor/khora/native/adapters/text/surfaces.js";   // PERCEPTION: the khora's own reading of the ask (eval/void PREREG Amendment 1)
import { splitSentences } from "./vendor/khora/native/adapters/text/spans.js";
import { withExperiencer } from "./vendor/khora/native/organs/experiencer.js";          // PATHOS: every void names who it is for (Panini)

export const VOID_GRAMMAR = Object.freeze({
  en: Object.freeze({
    giver: "the author's reading of English measure adjectives, time nouns, agent-noun suffixes and request verbs (2026-10-14); declared, not measured",
    measures: Object.freeze({ tall: "length", high: "length", long: "length", deep: "length", wide: "length", far: "length", heavy: "mass", old: "age", hot: "temperature", cold: "temperature" }),
    counts: Object.freeze({ many: "count", much: "amount" }),
    timeNouns: Object.freeze(["year", "date", "day", "month", "century", "decade"]),
    agentSuffix: /(?:or|er|ist|ian|ess)s?$/u,
    requestVerbs: Object.freeze(["tell", "name", "give", "list", "show", "say"]),
    linkers: Object.freeze(["of", "in", "for", "on", "at", "from", "to", "by"]),
    plural: /(?:s)$/u,
    pluralCopulas: Object.freeze(["are", "were"]),
  }),
});

const SLOT_ADMITS = Object.freeze({ time: "date", person: "person", place: "place" });

/** Read the void of one ask. → { decl: EOVoidDeclaration@1 | null, fields, anchor: {surface,title}|null, frame, gap? } */
export async function declareAskVoid(question, { fw = null, lang = "en", resolveTitles = null, experiencer = null, longestName = false } = {}) {
  const said = String(question ?? "");
  const G = grammarOf(lang), V = VOID_GRAMMAR[lang];
  if (!G || !V || !(fw instanceof Set) || !fw.size) return { decl: null, fields: {}, anchor: null, frame: null, gap: { kind: "no_grammar_for_language" } };
  const closed = closedClassOf(fw, lang);
  const toks = tokensOf(said, lang);
  const folds = toks.map((t) => t.fold);

  // 1. the slot: an interrogative phrase ANYWHERE (longest first), or "how" + a measure word, or (none) the role noun
  let slot = null, admits = null, slotAt = -1, slotLen = 0;
  const phrases = [...G.interrogatives].sort((a, b) => b.words.length - a.words.length);
  for (let at = 0; at < toks.length && !slot; at++) {
    if (folds[at] === "how" && toks[at + 1]) {
      const m = V.measures[folds[at + 1]], c = V.counts[folds[at + 1]];
      if (m || c) { slot = "quantity"; admits = m || c; slotAt = at; slotLen = 2; break; }
    }
    const hit = phrases.find((p) => p.words.every((w, k) => folds[at + k] === w));
    if (hit) { slot = hit.slot; slotAt = at; slotLen = hit.words.length; }
  }
  if (slot && !admits && SLOT_ADMITS[slot]) admits = SLOT_ADMITS[slot];

  // 2. the anchor and the predicate: askFrame's own reading. An ask whose slot is not at the front is read through an INTERNAL probe
  //    ("what" + the ask without its slot phrase and request verbs) — the probe is never shown, searched or stored; only its referents are kept.
  let frame = await askFrame(said, { fw, lang, resolveTitles });
  if (!(frame && frame.ok)) {
    const keep = toks.filter((t, i) => !(i >= slotAt && i < slotAt + slotLen) && !V.requestVerbs.includes(t.fold) && t.fold !== "me");
    const probe = "what " + keep.map((t) => t.text).join(" ");
    const f2 = await askFrame(probe, { fw, lang, resolveTitles });
    if (f2 && f2.ok) frame = { ...f2, said, probedAs: "internal" };
  }
  let referents = frame && frame.ok ? frame.referents : [];
  // PERCEPTION, the second witness: the khora's surfaces of the ask itself
  let perceived = [];
  try { perceived = extractSurfaces(splitSentences(said)).map((x) => x.surface).sort((a, b) => b.length - a.length); } catch { perceived = []; }
  let anchorBy = referents.length ? ["title-door"] : [];
  if (!referents.length && perceived.length && typeof resolveTitles === "function") {
    let table = null;
    try { table = await resolveTitles(perceived.slice()); } catch { table = null; }
    const hit = table instanceof Map ? perceived.map((surface) => ({ surface, res: table.get(surface) })).find((x) => x.res && x.res.title && !x.res.disambiguation) : null;
    if (hit) { referents = [{ surface: hit.surface, title: hit.res.title, aliases: [hit.surface, hit.res.title] }]; anchorBy = ["perceiver", "title-door"]; }
  } else if (referents.length && perceived.some((p) => p.toLowerCase() === String(referents[0].surface).toLowerCase())) anchorBy.push("perceiver");
  // L1.1 (eval/void Amendment 4): the LONGEST NAME, with both witnesses — a perceived surface that strictly contains the door's anchor
  // surface, and that the same door resolves, is the anchor ("Pride and Prejudice" ⊃ "Prejudice"). Off unless asked (L1 stays as admitted).
  if (longestName && referents.length && typeof resolveTitles === "function") {
    const inner = String(referents[0].surface).toLowerCase();
    const wider = perceived.filter((p) => p.toLowerCase() !== inner && p.toLowerCase().includes(inner));
    if (wider.length) {
      let table = null;
      try { table = await resolveTitles(wider.slice()); } catch { table = null; }
      const hit = table instanceof Map ? wider.map((surface) => ({ surface, res: table.get(surface) })).find((x) => x.res && x.res.title && !x.res.disambiguation) : null;
      if (hit) { referents = [{ surface: hit.surface, title: hit.res.title, aliases: [hit.surface, hit.res.title] }, ...referents]; anchorBy = ["perceiver", "title-door", "longest-name"]; }
    }
  }
  const anchor = referents[0] ? { surface: referents[0].surface, title: referents[0].title, by: anchorBy } : null;
  const refFolds = new Set(referents.flatMap((r) => tokensOf(r.surface, lang).map((t) => t.fold)));

  // 3. the role noun: the head of the content run that names WHAT is asked for ("the capital of …", "the chemical symbol for …",
  //    "tallest mountain in …", "Hamlet author") — the last content word before a linker, outside every referent; else the first such word
  const content = toks.map((t, i) => ({ t, i })).filter(({ t, i }) => !closed(t.fold) && !refFolds.has(t.fold) && !(i >= slotAt && i < slotAt + slotLen)
    && !V.requestVerbs.includes(t.fold) && t.fold !== "me" && /\p{L}/u.test(t.text));
  let role = null;
  for (let k = 0; k < content.length; k++) {
    const next = toks[content[k].i + 1];
    if (next && V.linkers.includes(next.fold)) { role = content[k].t; break; }
  }
  if (!role && content.length) {
    const nouny = content.filter(({ t }) => !/est$/u.test(t.fold) && !/(?:ed|ing)$/u.test(t.fold));
    role = (nouny[nouny.length - 1] || content[content.length - 1]).t;
  }
  const roleFold = role ? role.fold : null;

  if (!slot && roleFold) {
    if (V.timeNouns.includes(stemOf(roleFold, lang)) || V.timeNouns.includes(roleFold)) { slot = "time"; admits = "date"; }
    else if (V.agentSuffix.test(roleFold)) { slot = "person"; admits = "person"; }
    else { slot = "thing"; }
  }
  if (slot === "thing" && !admits && roleFold) admits = stemOf(roleFold, lang);
  if (slot === "time" && roleFold && V.timeNouns.includes(stemOf(roleFold, lang)) && roleFold !== "year" && roleFold !== "date") admits = stemOf(roleFold, lang);

  // 4. relation, cardinality, extent
  // with the longest name taken, a predicate word that now sits inside the anchor's own name is the name's, not the relation's
  const inName = new Set(longestName && anchor ? tokensOf(anchor.surface, lang).map((t) => t.fold) : []);
  const predicate = frame && frame.ok ? frame.predicate.filter((p) => !inName.has(String(p.surface).toLowerCase())) : [];
  const relation = [...new Set([...predicate.map((p) => p.stem), ...(roleFold && slot === "thing" ? [stemOf(roleFold, lang)] : [])])];
  const pluralRole = role && V.plural.test(roleFold) && stemOf(roleFold, lang) !== roleFold;
  const pluralCopula = folds.some((f) => V.pluralCopulas.includes(f));
  const cardinality = pluralRole || pluralCopula ? "many" : 1;
  const years = [...said.matchAll(/\b(1\d{3}|20\d{2})\b/g)].map((m) => Number(m[1]));
  const extent = years.length ? { from: Math.min(...years), to: Math.max(...years), unit: "year" } : null;

  const fields = {
    slot: slot || null,
    anchor: anchor ? anchor.title : null,
    admits: admits || null,
    extent,
    relation: relation.length ? relation : null,
    cardinality: slot ? cardinality : null,
  };
  const decl = slot ? declareVoid(fields, { cellOf }) : null;
  const forWhom = experiencer || { who: "the person asking", read: `ask#0-${said.length}`, revision: null };
  const held = decl ? withExperiencer({ void: decl }, forWhom) : null;
  const relationWords = [...new Set([...predicate.map((p) => p.surface), ...(role ? [role.text] : [])])];
  return { decl, fields, anchor, perceived, relationWords, experiencer: held ? held.experiencer : null, frame, ...(slot ? {} : { gap: { kind: "no_slot_read" } }) };
}

/** The void, in plain words, for a gap card: "a date when the Sydney Opera House was opened". Fields it does not hold are left out. */
export function voidLine(res) {
  const f = res && res.fields;
  if (!f || !f.slot) return "";
  const what = f.admits === "person" ? "the person" : f.admits === "date" ? "the date" : f.admits ? `the ${f.admits}` : `the ${f.slot}`;
  const rel = Array.isArray(f.relation) && f.relation.length ? ` (${f.relation.join(", ")})` : "";
  return f.anchor ? `${what}${rel} of ${f.anchor}` : `${what}${rel}`;
}

export default { declareAskVoid, voidLine, VOID_GRAMMAR };
