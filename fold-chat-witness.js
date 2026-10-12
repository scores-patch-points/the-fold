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
import { GRAMMAR, tokensOf, stemOf, closedClassOf } from "./fold-chat-frame.js";

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

const ROLE_VERBS = new Set(["became", "become", "becomes", "succeeded", "succeeds", "assumed", "assumes", "took", "takes", "taken", "elected", "elects", "crowned", "crowns", "acceded", "accedes", "appointed", "appoints", "named", "won", "serves", "served", "holds", "held", "leads", "led"]);   // the declared role-verb set (2026-10-11; giver: the author)

export function bindSentence(sentence, frame, { fw = null, lang = null, source = null, topic = null } = {}) {
  const L = frame?.lang || lang;
  const G = L ? GRAMMAR[L] : null;
  if (!sentence || typeof sentence.text !== "string" || !frame || !frame.ok || !G) return null;
  if (!Array.isArray(frame.referents) || !frame.referents.length) return null;
  const text = sentence.text;
  const closed = closedClassOf(fw, L);
  const toks = tokensOf(text).map((t) => ({ ...t, stem: stemOf(t.fold, L) }));
  if (!toks.length) return null;

  // ── referent groups: any alias, stem-folded; a group is present when one alias occurs contiguously ───────────────
  const groups = frame.referents.map((r) => {
    const names = Array.isArray(r.aliases) && r.aliases.length ? r.aliases : [r.surface, r.title];
    const seqs = [], content = new Set();
    for (const a of names) {
      const at = tokensOf(a);
      if (!at.length) continue;
      seqs.push(at.map((t) => stemOf(t.fold, L)));
      for (const t of at) if (!closed(t.fold)) content.add(stemOf(t.fold, L));
    }
    return { seqs, content, occ: seqs.flatMap((s) => occurrences(toks, text, s)) };
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
  const roleCarriedByTopic = predStems.length ? roleStems.every((s) => topicStems?.includes(s)) : roleStems.some((s) => topicStems?.includes(s));
  const roleInSentenceNow = predStems.length ? roleInSentence : roleStems.some((s) => toks.some((t) => t.stem === s));
  const titleCarriesRole = !!topicStems && frame.slot === "person" && roleStems.length > 0 && roleInSentenceNow && roleCarriedByTopic;
  if (!groups.every((g) => g.occ.length || carriedByTopic(g) || titleCarriesRole)) return null;
  if (!groups.some((g) => g.occ.length) && !titleCarriesRole) return null;   // no anchor at all: only the declared role page may carry the whole group anaphorically

  // ── predicate stems ─────────────────────────────────────────────────────────────────────────────────────────────
  const predMatches = [];                                             // token indices that carry a predicate stem
  for (const p of frame.predicate || []) toks.forEach((t, k) => { if (t.stem === p.stem && !predMatches.includes(k)) predMatches.push(k); });
  const tier = !(frame.predicate || []).length || predMatches.length ? "T1" : "T2";

  // ── polarity and tense: the sentence's own closed-class words ──────────────────────────────────────────────────
  const polarity = toks.some((t) => G.negation.includes(t.fold) || /n['’]t$/.test(t.fold)) ? "-" : "+";
  let tense = "unknown";
  for (const t of toks) {
    const hit = ["present", "past", "future"].find((k) => G.tense[k].includes(t.fold));
    if (hit) { tense = hit; break; }
  }

  const inRef = new Set(); for (const g of groups) for (const o of g.occ) for (let k = o.from; k <= o.to; k++) inRef.add(k);
  const carry = new Set(); for (const g of groups) for (const s of g.content) carry.add(s);
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
    if (ci < 0) return null;
    const carries = (a, b) => toks.some((t, k) => k >= a && k <= b && carry.has(t.stem));
    const holdsPredicate = (a, b) => predMatches.some((k) => k >= a && k <= b);
    const cl = carries(0, ci - 1), cr = carries(ci + 1, toks.length - 1);
    let side;
    if (cl && cr) return null;
    if (cl) side = "right"; else if (cr) side = "left";
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
      const AUX = new Set(["has", "have", "had", "will", "shall", "was", "were", "is", "are", "am", "be"]);
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
    // A PLACE filler must be the PLACE, not the phrase that leads to it
    // (2026-10-11; declared, not measured): "was born in Queens" → "Queens",
    // "is located in New York" → "New York". Only a LEADING run of prepositions
    // and predicate stems is cut — never a name, and never on any other slot.
    if (frame.slot === "place") {
      const PREP = new Set(["in", "at", "on", "near", "from", "around", "outside", "inside", "beside", "above", "below", "across"]);
      let k = toks.findIndex((t) => t.start >= a);
      const lead = [];
      while (k < toks.length && (PREP.has(toks[k].fold) || predMatches.includes(k) || ["born", "located", "lived", "found", "raised", "grew", "situated"].includes(toks[k].stem))) { lead.push(toks[k]); k++; }
      if (lead.length && k < toks.length) a = toks[k].start;
    }
    const inside = toks.filter((t) => t.start >= a && t.end <= b);
    if (!inside.length || inside.every((t) => closed(t.fold))) return null;
    if (inside.some((t) => carry.has(t.stem))) return null;
    return { text: text.slice(a, b), span: [a, b] };
  }

  // A SUBJECT-VERB filler for the real-web holder sentence (declared 2026-10-11,
  // giver: the author): "Charles III became king on 8 September 2022" has no
  // copula; the filler is the SUBJECT run before the role verb. A pronoun
  // subject ("He became king") is closed class and yields nothing — never a
  // guess; the title-resolution stage still vets whatever the run names.
  function subjectFiller() {
    const vi = toks.findIndex((t, k) => !inRef.has(k) && ROLE_VERBS.has(t.fold));
    if (vi <= 0) return null;
    let s = vi;
    while (s - 1 >= 0 && !closed(toks[s - 1].fold) && !inRef.has(s - 1) && /^\s+$/.test(text.slice(toks[s - 1].end, toks[s].start))) s--;
    if (s >= vi) return null;                                    // nothing but closed class before the verb: no subject to name
    const a = toks[s].start, b = toks[vi - 1].end;
    const inside = toks.filter((t) => t.start >= a && t.end <= b);
    if (!inside.length || inside.every((t) => closed(t.fold))) return null;
    if (inside.some((t) => carry.has(t.stem))) return null;
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
