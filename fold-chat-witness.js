// fold-chat-witness.js — the grammar of the PASSAGE: which source sentence can witness an answer, and what it says.
// (docs/ANSWER-PIPELINE.md: stage "parse the grammar of the PASSAGE".) Pure: no DOM, no IO, no model, no clock, no network.
//
//   sentencesOf(text)                           → [{ text, start, end }]   UTF-16 offsets that slice back into `text`, so a row's
//                                                  sentence can be re-verified against the passage (fold-chat-strand.js verifySnip)
//   bindSentence(sentence, frame, { fw, lang }) → Row | null
//
// BINDING (the only way a sentence becomes a Row):
//   T1  EVERY referent group of the frame (any of its aliases, stem-folded, caseless) AND at least one predicate stem occur in that
//       ONE sentence. A frame with no predicate needs only the referent groups. A T1 row is the only thing that can witness an answer.
//   T2  the referent groups only. Drawn as "closest", never a witness; it carries no filler.
//   null  some referent group is absent (a sentence about something else), or the frame is not ok, or the language has no declared table.
//   "The war began in 1939" has no 'end'; "World War II lasted from … to 1945" has the referent but not the predicate 'end': both are
//   T2-or-nothing, which is the point — word overlap is not a witness.
//
// WHAT A ROW CARRIES (all read from the sentence's OWN words, by declared closed classes; offsets are relative to the sentence):
//   polarity  "-" when a negator of the language's closed class (GRAMMAR.en.negation, or any n't) occurs, else "+"
//   tense     the FIRST copula/auxiliary of GRAMMAR.en.tense (present / past / future), else "unknown"
//             — the row never decides whether a past sentence may answer a present ask; the CALLER does (the release rule)
//   filler    person / place / thing: the COPULA-SIDE rule — split at the first copula; the side that does not carry a referent word is
//             the filler side; it is cut at the first clause boundary (a comma, semicolon, "(" or the words who/which/since/that/having).
//             Both sides carrying a referent word, no copula, or a filler made only of function words → null.
//             quantity: the number (digits, or the declared English numeral words) NEAREST the predicate stem (the referent when the
//             frame has no predicate); a number inside a referent ("World War 2") is not a quantity.
//             time: the year in the sentence (3–4 plain digits; "2 September" is a day). Several different years are ALL reported in
//             row.fillerCandidates and the filler is left null: the sentence does not say which one answers.
//   emphasis  [[a, b]] spans to draw bold: the filler and the matched referent and predicate words
//
// OPT-IN `topic` (not in the contract; off unless the caller passes it): the title of the page the sentence was read on. A referent group
// the sentence leaves unsaid ("The current prime minister is Andy Burnham" on the page "Prime Minister of the United Kingdom") counts
// as present when the topic's own words carry it, provided at least one referent group is really in the sentence. It is a looser
// witness than the contract's rule and can bind a sentence whose "filler" is not a name ("The prime minister is appointed by the
// monarch"), so a caller that turns it on should verify the filler by title (resolveTitles on row.filler.text) before it counts.
//
// Declared (not measured) tables live in fold-chat-frame.js GRAMMAR with their giver named; a language without a table binds nothing.
// No capital letter is read: matching is stem-folded and caseless (toLocaleLowerCase("und")), the filler is shown as the page wrote it.

import { sentencesWithOffsets } from "./fold-chat-impression.js";
import { GRAMMAR, tokensOf, stemOf, closedClassOf, posRankOf } from "./fold-chat-frame.js";
import { salienceOf, isName } from "./fold-chat-salience-infer.js";

/** Sentences of a text with UTF-16 offsets (the repo's own splitter, fold-chat-impression.js sentencesWithOffsets). */
export function sentencesOf(text) {
  return sentencesWithOffsets(String(text ?? "")).map(({ text: t, start, end }) => ({ text: t, start, end }));
}

const gapless = (text, a, b) => /^\s+$/.test(text.slice(a.end, b.start));
const NUMBER = /^\p{N}+(?:[.,]\p{N}+)*$/u;

function occurrences(toks, text, seq) {
  const out = [];
  for (let i = 0; i + seq.length <= toks.length; i++) {
    let ok = true;
    for (let k = 0; k < seq.length && ok; k++) ok = toks[i + k].stem === seq[k] && (k === 0 || gapless(text, toks[i + k - 1], toks[i + k]));
    if (ok) out.push({ from: i, to: i + seq.length - 1, start: toks[i].start, end: toks[i + seq.length - 1].end });
  }
  return out;
}
const containsSeq = (hay, seq) => { for (let i = 0; i + seq.length <= hay.length; i++) if (seq.every((s, k) => hay[i + k] === s)) return true; return false; };

function mergeSpans(spans) {
  const s = spans.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0] || y[1] - x[1]);
  const out = [];
  for (const sp of s) { const last = out[out.length - 1]; if (last && sp[0] < last[1]) last[1] = Math.max(last[1], sp[1]); else out.push([sp[0], sp[1]]); }
  return out;
}


export function bindSentence(sentence, frame, { fw = null, lang = null, source = null, topic = null, page = null } = {}) {
  const L = frame?.lang || lang;
  const G = L ? GRAMMAR[L] : null;
  if (!sentence || typeof sentence.text !== "string" || !frame || !frame.ok || !G) return null;
  // every language fact below is read from the language's GRAMMAR table; a table that does not declare a field simply never fires
  // that rule (the rule's absence is the old behaviour), so a language is added by writing a table, never by touching this file
  const ROLE_VERBS = new Set(G.roleVerbs || []);
  if (!Array.isArray(frame.referents) || !frame.referents.length) return null;
  const text = sentence.text;
  const closed = closedClassOf(fw, L);
  const toks = tokensOf(text).map((t) => ({ ...t, stem: stemOf(t.fold, L) }));
  if (!toks.length) return null;
  const attrs = Array.isArray(frame.attributes) ? frame.attributes : [];
  const attrSaid = attrs.every((a) => a.stems.every((st) => toks.some((t) => t.stem === st)));

  // ── referent groups: any alias, stem-folded; a group is present when one alias occurs contiguously ───────────────
  // A DERIVATIVE PAGE (the first live gate run, 2026-10-13: "who wrote Pride and Prejudice" committed a sentence about "Pride and
  // Prejudice and Zombies"): when the page the sentence was read on has a title that CONTAINS the referent's name and EXTENDS it, and the
  // sentence continues the occurrence with the same extending words, the occurrence belongs to the longer entity, not to the referent.
  const pageTokObjs = page ? tokensOf(String(page).replace(/\s*\([^)]*\)\s*$/u, "")) : null;
  const pageToks = pageTokObjs ? pageTokObjs.map((t) => stemOf(t.fold, L)) : null;
  const sameStems = (x, y) => x.length === y.length && x.every((st, k) => st === y[k]);
  // the page IS the ask's own referent (its resolved title): its lead names it by the title, and that is no derivative of anything
  const pageIsReferent = !!pageToks && frame.referents.some((r) => r && r.title && sameStems(tokensOf(String(r.title).replace(/\s*\([^)]*\)\s*$/u, "")).map((t) => stemOf(t.fold, L)), pageToks));
  // the words of the ASK itself (its attribute and relation stems): a longer title made of them is the ask's own phrase, not another
  // entity ("Attack on Pearl Harbor" for "when was Pearl Harbor attacked", "President of France" for "who is the president of France")
  // …including every referent's own words: "Longest Rivers in Africa" is made of the ask's relation and BOTH its referents
  const askedStems = new Set([...(frame.attributes || []).flatMap((x) => x.stems || []), ...(frame.predicate || []).map((x) => x.stem),
    ...frame.referents.flatMap((r) => [r.surface, r.title, ...((Array.isArray(r.aliases) ? r.aliases : []))].filter(Boolean).flatMap((n) => tokensOf(String(n)).map((t) => stemOf(t.fold, L))))]);
  const partOfLongerTitle = (o, seqs) => {
    if (!pageToks || pageToks.length < 2 || pageIsReferent) return false;
    for (const seq of seqs) {
      if (seq.length >= pageToks.length) continue;
      for (let i = 0; i + seq.length <= pageToks.length; i++) {
        if (!seq.every((st, k) => pageToks[i + k] === st)) continue;
        const left = pageToks.slice(0, i), right = pageToks.slice(i + seq.length);
        if (!left.length && !right.length) continue;
        const extra = [...left.map((st, k) => [st, pageTokObjs[k]]), ...right.map((st, k) => [st, pageTokObjs[i + seq.length + k]])];
        if (extra.every(([st, t]) => askedStems.has(st) || closed(t.fold))) continue;      // the extension is the ask's own words
        const lOk = left.every((st, k) => toks[o.from - left.length + k] && toks[o.from - left.length + k].stem === st);
        const rOk = right.every((st, k) => toks[o.to + 1 + k] && toks[o.to + 1 + k].stem === st);
        if (lOk && rOk) return true;
      }
    }
    return false;
  };
  const groups = frame.referents.map((r) => {
    const names = Array.isArray(r.aliases) && r.aliases.length ? r.aliases : [r.surface, r.title];
    const seqs = [], content = new Set();
    for (const a0 of names) {
      const a = String(a0 ?? "").replace(/\s*\([^)]*\)\s*$/u, "");          // "Jaws (film)" is Jaws: the qualifier is the encyclopedia's, not the referent's (MF18)
      const at = tokensOf(a);
      if (!at.length) continue;
      seqs.push(at.map((t) => stemOf(t.fold, L)));
      for (const t of at) if (!closed(t.fold)) content.add(stemOf(t.fold, L));
    }
    return { seqs, content, occ: seqs.flatMap((s) => occurrences(toks, text, s)).filter((o) => !partOfLongerTitle(o, seqs)) };
  });
  const topicStems = topic ? tokensOf(String(topic)).map((t) => stemOf(t.fold, L)) : null;
  const carriedByTopic = (g) => !!topicStems && g.seqs.some((s) => containsSeq(topicStems, s));
  // DECLARED (2026-10-11, giver: the author — the real-web holder sentence):
  // a ROLE page ("King Charles III …", "President of the United States")
  // witnesses a person-role ask when the page's own title carries the ROLE
  // (the frame predicate) and the sentence carries the subject name — that is
  // how "Charles III became king on 8 September 2022" binds for "who is the
  // king of the UK". Only for a person slot with a predicate: otherwise the
  // referent group must still appear, exactly as before.
  const predStems = (frame.predicate || []).map((p) => p.stem);
  const roleInSentence = predStems.some((s) => toks.some((t) => t.stem === s));
  // PREDICATE-LESS ROLE FRAMES (real web, declared 2026-10-11): the ask "who is the king of the
  // UK" can resolve "king of the uk" as ONE referent, leaving the predicate empty. The role word
  // then lives in the referent's own surface — the title must literally carry ONE of the
  // referent's content words and the sentence must hold it too (with a real predicate, every
  // predicate stem must be carried, exactly as before).
  const referentContent = predStems.length ? [] : [...new Set(groups.flatMap((g) => [...g.content]).filter((s) => s.length >= 3))];
  const roleStems = predStems.length ? predStems : referentContent;
  // A role page must not be ANOTHER anchor's page (2026-10-12). "Prime Minister of Australia" carried the role words of "who is the prime
  // minister of Canada" and so witnessed it; its title DECLARES its own anchor through the same connector the ask uses (GRAMMAR.governs:
  // "<role> of <anchor>"). When the title says "<role word> of X", X must be the referent's own or the sentence's. A headline that only
  // names a person ("Who is King Charles III? A look at his life") declares no anchor and still binds, as declared on 2026-10-11.
  // Residual, disclosed: a page for another country's king titled only by his name is not caught here.
  const sentStems = new Set(toks.map((t) => t.stem));
  const refStemsAll = new Set(groups.flatMap((g) => [...g.content]));
  const titleToks = topic ? tokensOf(String(topic)) : [];
  const governsSet = new Set(G.governs || []);
  // "<role word> of X" with X not the referent's own: the text declares ANOTHER anchor for the same role
  const roleWords = new Set([...roleStems, ...attrs.flatMap((a) => a.stems)]);      // the role may be the ask's attribute ("king OF the UK")
  const declaresOtherAnchor = (tk, src) => tk.some((t, k) => {
    if (!roleWords.has(stemOf(t.fold, L)) || !governsSet.has(tk[k + 1]?.fold)) return false;
    // X is the noun phrase right after "of": determiners and content words, up to a coordinator, a clause word, another preposition or a
    // break — "king of the United Kingdom AND the other Commonwealth realms" declares the United Kingdom, nothing more
    const detsX = new Set(G.determiners || []), coordX = new Set(G.coordinators || []);
    const after = [];
    for (let m = k + 2; m < tk.length && !/[|:;,.()–—]/u.test(String(src).slice(tk[m - 1].end, tk[m].start)); m++) {
      const f = tk[m].fold;
      const rkX = posRankOf(tk[m].text);
      if (coordX.has(f) || G.clauseWords.includes(f) || (closed(f) && !detsX.has(f)) || (!closed(f) && rkX != null && rkX <= 6)) break;   // "… of the United Kingdom NOW": an adverb ends the phrase
      after.push(tk[m]);
    }
    const content = after.filter((x) => !closed(x.fold));
    return content.length > 0 && content.some((x) => !refStemsAll.has(stemOf(x.fold, L)));
  });
  const titleOtherAnchor = declaresOtherAnchor(titleToks, topic || "");
  const roleCarriedByTopic = (predStems.length ? roleStems.every((s) => topicStems?.includes(s)) : roleStems.some((s) => topicStems?.includes(s))) && !titleOtherAnchor;
  const roleInSentenceNow = predStems.length ? roleInSentence : roleStems.some((s) => toks.some((t) => t.stem === s));
  const titleCarriesRole = !!topicStems && frame.slot === "person" && roleStems.length > 0 && roleInSentenceNow && roleCarriedByTopic;
  if (!groups.every((g) => g.occ.length || carriedByTopic(g) || titleCarriesRole)) return null;
  // An ATTRIBUTE said in the sentence anchors it when the page's own title carries the anchor (2026-10-12): "The current prime
  // minister is Andy Burnham" on the page "Prime Minister of the United Kingdom" — the role is said, the UK is the page.
  const titleIsRolePage = !!topic && tokensOf(String(topic).replace(/\s*\([^)]*\)\s*$/u, "")).filter((t) => !closed(t.fold)).every((t) => { const st = stemOf(t.fold, L); return refStemsAll.has(st) || attrs.some((a) => a.stems.includes(st)) || predStems.includes(st); });
  const attrAnchors = attrs.length > 0 && attrSaid && titleIsRolePage && groups.every((g) => g.occ.length || carriedByTopic(g));
  if (!groups.some((g) => g.occ.length) && !titleCarriesRole && !attrAnchors) return null;
  if (declaresOtherAnchor(toks, text)) return null;   // "the prime minister of Australia is …" for Canada — even beside a mention of Canada (MF12)
  // An attribute is part of what the ask is ABOUT: a sentence that never says it ("The United Kingdom is a country" for "who is the
  // king of the UK") is about something else — no row, not even a closest one (the same standing the attribute had as a referent).
  if (attrs.length && !attrSaid) return null;   // no anchor at all: only the declared role page may carry the whole group anaphorically

  // ── predicate stems ─────────────────────────────────────────────────────────────────────────────────────────────
  const predMatches = [];                                             // token indices that carry a predicate stem
  for (const p of frame.predicate || []) toks.forEach((t, k) => { if (t.stem === p.stem && !predMatches.includes(k)) predMatches.push(k); });
  // A RELATION MUST MATCH (battery 2026-10-12): when the ask carries a relation word (verb/adjective/adverb by the received prior:
  // "wrote", "largest"), a sentence is a witness only if IT says the relation. Leftover noun words of the ask ("solar", "system") that
  // happen to occur must not stand in for it — they made Saturn's "second-largest" a rival to "largest".
  // Not for a COUNT: "how many kilometres does the Quillon run" is pinned by the counted noun's own number, and "flows for 640
  // kilometres" says the same count in other words (the Pivot's rung 2 relies on exactly that).
  const relStems = frame.slot === "quantity" ? [] : (frame.predicate || []).filter((p) => p.rel).map((p) => p.stem);
  const ordinalBefore = (k) => k > 0 && ((G.ordinals || []).includes(toks[k - 1].fold) || /^\d+(?:st|nd|rd|th)$/iu.test(toks[k - 1].text));
  const relMatched = !relStems.length || predMatches.some((k) => relStems.includes(toks[k].stem) && !ordinalBefore(k));   // "the SECOND largest" is not the largest (MF16)
  const nameStems = (frame.predicate || []).filter((p) => p.name).map((p) => p.stem);
  const namesSaid = nameStems.every((st) => toks.some((t) => t.stem === st));                                        // "where was ZELDA born" needs Zelda (MF20)
  const tier = attrSaid && namesSaid && (!(frame.predicate || []).length || (predMatches.length && relMatched)) ? "T1" : "T2";

  // ── polarity and tense: the sentence's own closed-class words ──────────────────────────────────────────────────
  // STANCE (the archon panel, MF2): a sentence that only might, if, allegedly or by legend says so, or that ASKS, is neither a witness
  // nor a denial — its polarity is "?" and nothing downstream counts it as either.
  // "may" is the month when a number or a preposition is beside it ("in May 1945", "8 May"), the modal otherwise
  const isMonthMay = (k) => toks[k].fold === "may" && ((toks[k + 1] && /^\p{Nd}/u.test(toks[k + 1].text)) || (toks[k - 1] && (/^\p{Nd}/u.test(toks[k - 1].text) || (G.agentStops || []).includes(toks[k - 1].fold))));
  const hedged = toks.some((t, k) => (G.hedges || []).includes(t.fold) && !isMonthMay(k)) || /\?\s*["”’')\]]*\s*$/u.test(text);
  // a negation word directly before a NUMBER is the abbreviation "No. 1" / "no. 14" ("Symphony No. 1"), not a denial: the live
  // "Moonlight Sonata" sentence was read as negative because its subordinate clause named another work's number
  const numberSign = (k) => toks[k + 1] && /^\p{Nd}/u.test(toks[k + 1].text) && /^\s*\.?\s*$/u.test(text.slice(toks[k].end, toks[k + 1].start));
  const polarity = hedged ? "?" : toks.some((t, k) => (G.negation.includes(t.fold) && !numberSign(k)) || /n['’]t$/.test(t.fold)) ? "-" : "+";
  let tense = "unknown";
  for (const t of toks) {
    const hit = ["present", "past", "future"].find((k) => G.tense[k].includes(t.fold));
    if (hit) { tense = hit; break; }
  }

  const inRef = new Set(); for (const g of groups) for (const o of g.occ) for (let k = o.from; k <= o.to; k++) inRef.add(k);
  const carry = new Set(); for (const g of groups) for (const s of g.content) carry.add(s);
  // ATTRIBUTES (fold-chat-frame.js 4b) decide WHICH sentences can witness (attrSaid, above). They mark the anchor's SIDE only when used
  // as a DESCRIPTION — a determiner before it, adjectives allowed between ("THE current prime minister is Andy Burnham") — never when
  // they open a name ("King Charles III is …"), where the word is part of the answer itself. Determiner = closed class; adjective = the
  // received POSPrior's ADJ rank.
  const attrDescIdx = new Set();
  for (const a of attrs) toks.forEach((t, k) => {
    if (t.stem !== a.stems[0]) return;
    let m = k - 1;
    while (m >= 0 && !closed(toks[m].fold) && posRankOf(toks[m].text) === 4) m--;
    if (m >= 0 && closed(toks[m].fold) && !G.copulas.includes(toks[m].fold)) attrDescIdx.add(k);
    else if (m >= 0 && G.copulas.includes(toks[m].fold)) {
      // "… is King OF the United Kingdom" / "… is king." is a predicate noun; "… is King Charles III" opens a name
      const nx = toks[k + a.stems.length];
      const gap = nx ? text.slice(toks[k + a.stems.length - 1].end, nx.start) : "";
      if (!nx || /[,;.()]/u.test(gap) || (G.governs || []).includes(nx.fold)) attrDescIdx.add(k);
    }
  });
  const spanOf = (a, b) => [toks[a].start, toks[b].end];

  // ── filler (T1 only) ────────────────────────────────────────────────────────────────────────────────────────────
  let filler = null, fillerCandidates = null;
  if (tier === "T1") {
    if (frame.slot === "person" || frame.slot === "place" || frame.slot === "thing") filler = copulaSideFiller() || subjectFiller();
    else if (frame.slot === "quantity") filler = nearestNumber();
    else if (frame.slot === "time") ({ filler, fillerCandidates } = years());
  }

  function copulaSideFiller() {
    // "been" counts (L1 real-web shape, declared 2026-10-11: "Charles has been
    // King since 8 September 2022"): the perfect copula is a copula for the
    // filler; the auxiliary before it is trimmed off whatever side is read.
    const ci = toks.findIndex((t, k) => (G.copulas.includes(t.fold) || t.fold === "been") && !inRef.has(k));
    let fromAgent = false;
    const typeStems = new Set();      // stems of a TYPE WORD that recurs inside the answer's own name (below)
    if (ci < 0) return null;
    const carries = (a, b) => toks.some((t, k) => k >= a && k <= b && (carry.has(t.stem) || attrDescIdx.has(k)));
    const holdsPredicate = (a, b) => predMatches.some((k) => k >= a && k <= b);
    let cl = carries(0, ci - 1), cr = carries(ci + 1, toks.length - 1);
    // The referent's WHOLE name is on exactly one side: that side is the subject's, whatever stems of the ask's alias ("theory" of
    // "theory of general relativity") the other side happens to share — a stem is not the referent (the live "who developed the theory
    // of general relativity": "General relativity is a theory of gravitation developed by Einstein" carried 'theory' on both sides).
    {
      const nameIn = (a, b) => groups.some((g) => g.occ.some((o) => o.from >= a && o.to <= b));
      const gl = nameIn(0, ci - 1), gr = nameIn(ci + 1, toks.length - 1);
      if (gl !== gr && (gl || gr)) { cl = gl; cr = gr; }
    }
    // A TYPE WORD recurs inside the answer's own name: "The Nile RIVER is the longest RIVER in Africa" names the referent "river" on both
    // sides, but the left names nothing the right does not and the right names an ANCHOR the left lacks (Africa): the left is the
    // answer. Decided by referent GROUPS (whole names), never by shared stems — "Leopold Mozart … his son Wolfgang Amadeus Mozart" is
    // one group on both sides and stays a refusal.
    if (cl && cr) {
      const here = (g, a, b) => g.occ.some((o) => o.from >= a && o.to <= b);
      const onL = groups.filter((g) => here(g, 0, ci - 1)), onR = groups.filter((g) => here(g, ci + 1, toks.length - 1));
      if (onL.length && onL.every((g) => onR.includes(g)) && onR.some((g) => !onL.includes(g))) { cl = false; for (const g of onL) for (const st of g.content) typeStems.add(st); }
    }
    let side;
    // Both sides carry the anchor's word ("Wolfgang Amadeus Mozart was born … to Leopold Mozart …"): for a PLACE ask with a relation
    // the anchor is the subject on the LEFT and the right side is the relation's complement — the place alternatives below decide
    // what on it is the place (a person's surname there is another person, never the filler)
    // "Leopold Mozart was born in Augsburg, and his son Wolfgang Amadeus Mozart …" carries the surname on the left too, but it is
    // the father: the left side must hold the anchor's FULL name (its longest alias), not a stem of it
    // …and that occurrence must BEGIN the subject: no content word gaplessly before it ("LOUIS Napoleon was born in Paris" is another
    // Napoleon, whose one-word name matches a one-word alias)
    const beginsSubject = (o) => !(o.from > 0 && !closed(toks[o.from - 1].fold) && gapless(text, toks[o.from - 1], toks[o.from]));
    const fullLeft = groups.some((g) => { const L0 = Math.max(0, ...g.seqs.map((q) => q.length)); return g.occ.some((o) => o.to < ci && o.to - o.from + 1 >= L0 && beginsSubject(o)); });
    if (cl && cr) { if (frame.slot === "place" && relStems.length && fullLeft) side = "right"; else return null; }
    else if (cl) side = "right"; else if (cr) side = "left";
    else {                                                            // neither side names the referent (topic mode): the predicate's side is the subject
      const pl = holdsPredicate(0, ci - 1), pr = holdsPredicate(ci + 1, toks.length - 1);
      // Both sides carrying the predicate happens when the role word is ALSO in
      // the name ("King Charles III has been king since…"): the LEFT side is the
      // sentence's subject — declared, and the aux-trim below cuts its "has".
      if (pl && !pr) side = "right"; else if (pr && !pl) side = "left"; else if (pl && pr) side = "left"; else return null;
    }
    const from = side === "right" ? toks[ci].end : 0, to = side === "right" ? text.length : toks[ci].start;
    let cut = to;
    for (let i = from; i < to; i++) if (",;(".includes(text[i])) { cut = i; break; }
    for (const t of toks) if (t.start >= from && t.start < cut && G.clauseWords.includes(t.fold)) { cut = t.start; break; }
    let a = from, b = cut;
    while (a < b && /[\s"“‘'(]/u.test(text[a])) a++;
    while (b > a && /[\s.,:;!?"”’')]/u.test(text[b - 1])) b--;
    if (b <= a) return null;
    // AUXILIARY TRIM (the perfect copula, declared 2026-10-11): the left side of
    // "has/have/had/will been" ends at the last auxiliary — "King Charles III
    // has been king since …" yields the filler "King Charles III", never
    // "King Charles III has". Right-side leading auxiliaries are already out of
    // the filler's edge by the same rule read backwards.
    {
      const AUX = new Set([...(G.auxiliaries || []), ...(G.copulas || [])]);
      let moved = true;
      while (moved) {
        moved = false;
        for (const t of toks) {
          if (t.start >= a && t.end <= b && AUX.has(t.fold)) {
            if (side === "left" && t.end === b) { b = t.start; moved = true; }
            else if (side === "right" && t.start === a) { a = t.end; moved = true; }
          }
        }
      }
      while (a < b && /[\s"“‘'(]/u.test(text[a])) a++;
      while (b > a && /[\s.,:;!?"”’')]/u.test(text[b - 1])) b--;
      if (b <= a) return null;
    }
    // THE PASSIVE AGENT (2026-10-12): "Penicillin was discovered in 1928 by the physician Alexander Fleming at St Mary's" — when a
    // PERSON slot's filler side holds the ask's RELATION followed by the agent marker (GRAMMAR.agentBy), the filler is the agent: from
    // after "by" to the first declared agent-stop preposition or clause word. The relation on that side with no agent means the side is
    // the event, not a person: no filler.
    if (frame.slot === "person" && relStems.length && G.agentBy) {
      const inSide = (t) => t.start >= a && t.end <= b;
      const relK = toks.findIndex((t) => inSide(t) && relStems.includes(t.stem));
      if (relK >= 0) {
        const byK = toks.findIndex((t, k) => k > relK && inSide(t) && t.fold === G.agentBy);
        if (byK < 0 || byK + 1 >= toks.length || !inSide(toks[byK + 1])) return null;
        // the agent of THIS verb in THIS clause (the archon panel, MF3): between the verb and "by" there is no coordinator, no clause
        // break and no second verb ("discovered in 1928 and later DEVELOPED by Howard Florey" is Florey's development, not his discovery)
        const coord = new Set(G.coordinators || []);
        for (let k = relK + 1; k < byK; k++) {
          const rk = posRankOf(toks[k].text);
          if (coord.has(toks[k].fold) || (rk === 6 && !G.auxiliaries.includes(toks[k].fold))) return null;
        }
        if (/[,;:()]/u.test(text.slice(toks[relK].end, toks[byK].start))) return null;
        const stops = new Set(G.agentStops || []);
        let e = byK + 1;
        while (e < toks.length && inSide(toks[e]) && !stops.has(toks[e].fold) && !coord.has(toks[e].fold) && !G.clauseWords.includes(toks[e].fold) && !/[,;:()]/u.test(text.slice(toks[e - 1].end, toks[e].start))) e++;
        if (e <= byK + 1) return null;
        // an agent is somebody: a number ("by 1930") or a common noun alone ("by accident") is manner or time, not a person (MF3)
        const run = toks.slice(byK + 1, e);
        if (/^\p{Nd}/u.test(run[0].text) || !run.some((t) => !closed(t.fold) && !/^\p{Nd}/u.test(t.text) && (posRankOf(t.text) == null || posRankOf(t.text) >= 8))) return null;
        a = toks[byK + 1].start; b = toks[e - 1].end;
        fromAgent = true;
      }
    }
    // PLACE ALTERNATIVES (the first live gate run: "where was Mozart born" had the right sentence and no filler): the cut above stops at
    // the first comma, which in "born on 27 January 1756 to Leopold and Anna Maria, née Pertl, at Getreidegasse 9 in Salzburg" is
    // before the place. The candidates are the phrases after a CONTAINMENT preposition inside the RELATION'S OWN CLAUSE: the walk starts
    // at the relation word, which must belong to the anchor's clause (no relative word between the copula and it), and ends at the
    // first relative word, semicolon, coordinator that opens a new clause (a verb or a pronoun follows it) or second predicate.
    // A candidate after an indefinite article ("a hospital", "a log cabin") is a common noun, one holding a digit (an address, a
    // year) is never sent to the title door, and one with no name-like word (the received prior: a name, or never seen) is dropped.
    // Every alternative is vetted by the title door downstream; with none, the leading-preposition cut below is the old behaviour.
    // A relation-less place ask ("where is the Taj Mahal") has the copula's complement as its region: "is an ivory-white mausoleum on the
    // right bank of the Yamuna IN Agra" — the walk starts at the copula and takes the containment phrases of that clause.
    if (frame.slot === "place" && (relStems.length || side === "right") && G.containment) {
      const relIn = relStems.length ? toks.findIndex((t, k) => k > ci && relStems.includes(t.stem) && !ordinalBefore(k)) : ci;
      if (relIn >= 0 && !toks.slice(ci + 1, relIn).some((t) => G.clauseWords.includes(t.fold))) {
        const SUB = new Set(G.subordinators || []);
        const CONT = new Set(G.containment), INDEF = new Set(G.indefinites || []), dets = new Set(G.determiners || []), coord = new Set(G.coordinators || []);
        const isVerb = (k) => posRankOf(toks[k].text) === 6 && !closed(toks[k].fold) && !(G.auxiliaries || []).includes(toks[k].fold);
        let end = toks.length;
        for (let k = relIn + 1; k < toks.length; k++) {
          const t = toks[k];
          if (G.clauseWords.includes(t.fold) || SUB.has(t.fold) || /;/.test(text.slice(toks[k - 1].end, t.start))) { end = k; break; }
          if (coord.has(t.fold)) { const nx = toks[k + 1]; if (nx && ((closed(nx.fold) && !dets.has(nx.fold)) || isVerb(k + 1))) { end = k; break; } }
          else if (isVerb(k)) { end = k; break; }
        }
        const alts = [];
        let chainEnd = -1;          // where the previous candidate (kept or not) ended: a later one must continue its phrase without punctuation
        for (let k = relIn + 1; k < end - 1; k++) {
          if (!CONT.has(toks[k].fold)) continue;
          if (chainEnd >= 0 && /[,;:()]/u.test(text.slice(chainEnd, toks[k].start))) break;     // "in Salzburg, in the Holy Roman Empire": a wider phrase, not the place
          let s2 = k + 1, indef = false;
          while (s2 < end && dets.has(toks[s2].fold)) { if (INDEF.has(toks[s2].fold)) indef = true; s2++; }
          if (indef) continue;
          let e2 = s2;
          while (e2 < end && !CONT.has(toks[e2].fold) && !G.clauseWords.includes(toks[e2].fold) && !coord.has(toks[e2].fold) && !/[,;:()]/u.test(text.slice(toks[e2 - 1].end, toks[e2].start))) e2++;
          const run = toks.slice(s2, e2);
          if (run.length) chainEnd = toks[e2 - 1].end;
          k = Math.max(k, e2 - 1);
          if (!run.length || run.some((t) => /\p{Nd}/u.test(t.text))) continue;
          if (!run.some((t) => !closed(t.fold) && (salienceOf(t.text) == null || isName(t.text)))) continue;
          alts.push({ text: text.slice(toks[s2].start, toks[e2 - 1].end), span: [toks[s2].start, toks[e2 - 1].end] });
        }
        if (alts.length) return { ...alts[0], alts };
      }
    }
    // A PLACE filler must be the PLACE, not the phrase that leads to it
    // (2026-10-11; declared, not measured): "was born in Queens" → "Queens",
    // "is located in New York" → "New York". Only a LEADING run of prepositions
    // and predicate stems is cut — never a name, and never on any other slot.
    if (frame.slot === "place") {
      const PREP = new Set(G.prepositions || []);
      // the declared place verbs are compared as STEMS (the stemmer drops the final -e: "located" is "locat"); comparing the surface
      // form never matched once the stemmer changed, and "located in the Coral Sea" kept its lead
      const PLACE_STEMS = new Set((G.placeVerbs || []).map((w) => stemOf(w, L)));
      const dets = new Set(G.determiners || []);
      let k = toks.findIndex((t) => t.start >= a);
      const lead = [];
      while (k < toks.length && (PREP.has(toks[k].fold) || predMatches.includes(k) || PLACE_STEMS.has(toks[k].stem))) { lead.push(toks[k]); k++; }
      // a PLACE is introduced: by a preposition or a place verb ("in Agra", "located in the Coral Sea", "born at …"). A complement with
      // neither is a description of the subject ("a biodiversity hotspot", "endemic"), never where it is: no filler, a typed gap upstream.
      if (!lead.length) return null;
      while (k < toks.length && dets.has(toks[k].fold)) k++;
      if (k < toks.length) a = toks[k].start;
    }
    const inside = toks.filter((t) => t.start >= a && t.end <= b);
    if (!inside.length || inside.every((t) => closed(t.fold))) return null;
    if (inside.some((t) => carry.has(t.stem) && !typeStems.has(t.stem))) return null;
    // a passive AGENT was already required to be somebody above (not digit-led, a name-like word inside); a description that carries
    // its name ("by the Scottish physician Alexander Fleming") is unpacked to the name by the title-door variants downstream
    if (frame.slot === "person" && !fromAgent && !personLike(inside)) return null;
    if (startsAdverbial(inside)) return null;
    return { text: text.slice(a, b), span: [a, b] };
  }
  // A filler that BEGINS with a preposition or a subordinator is an adverbial, not an entity ("Before the first Portuguese explorers
  // arrived in 1500, what is now Brazil was inhabited …" answered "what language is spoken in Brazil" with that clause). Table-driven:
  // the language's own prepositions, agent-stop prepositions and subordinators; a place filler has its own lead rule above.
  function startsAdverbial(run) {
    if (frame.slot === "place" || !run.length) return false;
    const lead = new Set([...(G.prepositions || []), ...(G.agentStops || []), ...(G.subordinators || [])]);
    return lead.has(run[0].fold);
  }
  // A PERSON FILLER IS SOMEBODY, not a description and not a date (the first live gate run: "April 30", "March 22", "its leader", "the
  // chancellor"). Structural, from the language's own table: a run with a digit-led word ("April 30") is a date or a count; a run
  // LED BY a determiner or possessive ("the leader", "a former banker", "its leader") is a description UNLESS it holds a word the
  // received prior ranks a name or has never seen ("the Scottish physician Alexander Fleming", "The Beatles" keep their names; the
  // title door unpacks them downstream). A run with no determiner is a name, whatever its words are ("Cary Grant", "Jobs", "Hope Solo").
  function personLike(run) {
    const dets = new Set(G.determiners || []);
    const content = run.filter((t) => !closed(t.fold));
    if (!content.length || content.some((t) => /^\p{Nd}/u.test(t.text))) return false;
    const first = toks.indexOf(run[0]);
    const led = dets.has(run[0].fold) || (first > 0 && dets.has(toks[first - 1].fold) && gapless(text, toks[first - 1], run[0]));
    if (!led) return true;
    return content.some((t) => salienceOf(t.text) == null || isName(t.text));
  }

  // A SUBJECT-VERB filler for the real-web holder sentence (declared 2026-10-11,
  // giver: the author): "Charles III became king on 8 September 2022" has no
  // copula; the filler is the SUBJECT run before the role verb. A pronoun
  // subject ("He became king") is closed class and yields nothing — never a
  // guess; the title-resolution stage still vets whatever the run names.
  function subjectFiller() {
    // the ask's own RELATION verb counts too (2026-10-12), but only when an ANCHOR is its direct object — nothing but closed class
    // between the verb and the anchor ("discovered penicillin", "painted the Mona Lisa"), so "Voltaire wrote a negative review OF
    // Hamlet" never makes Voltaire the author
    const dets = new Set(G.determiners || []);
    const objectAfter = (k) => groups.some((g) => g.occ.some((o) => o.from > k && toks.slice(k + 1, o.from).every((t) => dets.has(t.fold))));   // never "wrote ABOUT Hamlet" (MF1)
    const vi = toks.findIndex((t, k) => !inRef.has(k) && (ROLE_VERBS.has(t.fold) || (relStems.includes(t.stem) && objectAfter(k))));
    if (vi <= 0) return null;
    let s = vi;
    while (s - 1 >= 0 && !closed(toks[s - 1].fold) && !inRef.has(s - 1) && /^\s+$/.test(text.slice(toks[s - 1].end, toks[s].start))) s--;
    if (s >= vi) return null;                                    // nothing but closed class before the verb: no subject to name
    const a = toks[s].start, b = toks[vi - 1].end;
    const inside = toks.filter((t) => t.start >= a && t.end <= b);
    if (!inside.length || inside.every((t) => closed(t.fold))) return null;
    if (inside.some((t) => carry.has(t.stem))) return null;
    if (frame.slot === "person" && !personLike(inside)) return null;     // "its LEADER became known as the chancellor": a role, not a person
    if (startsAdverbial(inside)) return null;
    return { text: text.slice(a, b), span: [a, b] };
  }

  function numberRuns() {
    const isNum = (k) => !inRef.has(k) && (NUMBER.test(toks[k].text) || toks[k].fold.split("-").every((p) => G.numerals.includes(p)));
    const isWord = (k) => !NUMBER.test(toks[k].text);
    const runs = [];
    for (let k = 0; k < toks.length; k++) {
      if (!isNum(k)) continue;
      let e = k;
      while (e + 1 < toks.length && isNum(e + 1) && isWord(e + 1) && gapless(text, toks[e], toks[e + 1]) && (isWord(e) || G.magnitudes.includes(toks[e + 1].fold))) e++;
      runs.push({ from: k, to: e }); k = e;
    }
    return runs;
  }

  function nearestNumber() {
    const runs = numberRuns();
    if (!runs.length) return null;
    // A COUNTED NOUN owns its number (battery 2026-10-12: "how many legs does a spider have" took 52,075, the SPECIES). When the
    // ask counted a noun, the number must sit in that noun's own phrase: <number> (closed class | adjective)* <the noun>, with no
    // clause break between them. Otherwise the sentence does not answer the count and yields no filler.
    if (frame.counted && frame.counted.stem) {
      const at = toks.map((t, k) => (t.stem === frame.counted.stem ? k : -1)).filter((k) => k >= 0);
      let best = null;
      for (const r of runs) for (const a of at) {
        if (a <= r.to) continue;
        let ok = true;
        for (let k = r.to + 1; k < a && ok; k++) {
          const rank = (() => { const v = salienceOf(toks[k].text); return v == null ? null : Math.round(v * 9); })();
          ok = closed(toks[k].fold) || (rank != null && rank === 4);          // determiner/preposition or an adjective-dominant form
        }
        if (ok && /^[^,;.()!?]*$/.test(text.slice(toks[r.to].end, toks[a].start))) { if (!best || a - r.to < best.d) best = { r, d: a - r.to }; }
      }
      if (!best) return null;
      const [a0, b0] = spanOf(best.r.from, best.r.to);
      return { text: text.slice(a0, b0), span: [a0, b0] };
    }
    const anchors = predMatches.length ? predMatches : [...inRef];
    if (!anchors.length) return null;
    let best = null;
    for (const r of runs) {
      let d = Infinity;
      for (const a of anchors) d = Math.min(d, a < r.from ? r.from - a : a > r.to ? a - r.to : 0);
      if (d === 0) continue;                                          // a number that is itself the anchor word
      if (!best || d < best.d) best = { r, d };
    }
    if (!best) return null;
    const [a, b] = spanOf(best.r.from, best.r.to);
    return { text: text.slice(a, b), span: [a, b] };
  }

  function years() {
    const re = new RegExp(`^\\p{Nd}{${G.year.minDigits},${G.year.maxDigits}}$`, "u");
    const seen = new Map();
    toks.forEach((t, k) => { if (!inRef.has(k) && re.test(t.text) && !seen.has(t.text)) seen.set(t.text, { text: t.text, span: spanOf(k, k) }); });
    const all = [...seen.values()];
    if (all.length === 1) return { filler: all[0], fillerCandidates: null };
    return { filler: null, fillerCandidates: all.length ? all : null };
  }

  // ── emphasis ────────────────────────────────────────────────────────────────────────────────────────────────────
  const spans = [];
  for (const g of groups) for (const o of g.occ) spans.push([o.start, o.end]);
  for (const a of attrs) for (const st of a.stems) toks.forEach((t) => { if (t.stem === st) spans.push([t.start, t.end]); });   // the attribute is drawn bold too ("eight legs")
  for (const k of predMatches) spans.push([toks[k].start, toks[k].end]);
  if (filler) spans.push(filler.span);
  if (fillerCandidates) for (const c of fillerCandidates) spans.push(c.span);

  const row = {
    tier, sentence: text, source: source ?? sentence.source ?? null, span: [sentence.start, sentence.end],
    polarity, tense, filler, emphasis: mergeSpans(spans),
  };
  if (fillerCandidates) row.fillerCandidates = fillerCandidates;
  return row;
}
