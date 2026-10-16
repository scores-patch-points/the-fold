// fold-chat-provenance.js — WHERE AN ANSWER CAME FROM, said mechanically. Pure: no DOM, no IO, no model, no clock. (docs/VOICE.md "The three product behaviours")
//
// User, 2026-10-06: "chat needs to always say mechanically where it got information from, and that grounding needs to not happen through the talking part of the model. There needs
// to be at least two model calls per output: one is the answer, the other is an explanation of the source … We need to snip out what it's claiming the source was and mechanically insert it,
// and use it to frame the answer of what it did in a prosified way: 'I checked this on Wikipedia, but I consider Wikipedia more like an index for primary sources, so I went and verified it on
// XYZ, and it also said it on here.'"
//
//   pointerMessages({ answer, passages })      the messages for the POINTING call (B): the model is asked to COPY the sentence from the sources that says what the answer says
//   parsePointerReply(text)                    → { none:true } | { source, sentence } | null          (the model's reply, as a claim to be CHECKED, never believed)
//   locate(sentence, passages, hint)           → { ok, index, start, end, text } | { ok:false, why }     the sentence must occur in a passage, character for character (whitespace and typographic
//                                               marks normalised); what is returned is the SOURCE'S OWN slice, never the model's copy, with offsets
//   verifyPointer({ reply, claim, passages })  locate + a minimal relevance check (a shared content stem; every figure of the claim present) → a verified pointer, or why not
//   narrate(pointers, { found })               the narration, AUTHORED BY THE APP from the templates below, around the verbatim quotes; { text, parts[] } (every part tagged app | quote)
//   verifyNarration(narr, passages)            the check on the narrator: every quote part is a verbatim slice of its passage, every app part is a rendering of a declared template
//
// The model's words reach the person only as (a) the answer (read by the Pivot) and (b) NOTHING about provenance: a sentence about where something came from is never model-written. A pointer the
// model made up is rejected and the narration says, in the app's words, that no source sentence could be found. DECLARED, not measured (II.11): the templates and bounds; giver: the user's brief
// of 2026-10-06 for their shape, the author for their wording.

import * as ground from "./fold-chat-ground.js";
import { isTertiary as isWikiIndex } from "./fold-chat-tertiary.js";
import { namesOf } from "./fold-chat-falsify-answer.js";

// An INDEX is a pointer, not a source: Wikipedia (declared in fold-chat-tertiary.js) and the other encyclopedias / reference works (declared in fold-chat-primary.js ENCYCLOPEDIAS;
// kept as a small copy here because primary imports this module). Measured 2026-10-06: the source line for "Who is the king of the UK?" said "I got this from Britannica" — an encyclopedia
// worded as if it were the source — so a later "find a primary source" read it back as already primary. Giver: the user (an encyclopedia is an index to primary sources).
const REFERENCE_HOSTS = /(^|\.)(britannica\.com|encyclopedia\.com|newworldencyclopedia\.org|citizendium\.org|worldhistory\.org|encyclopedia\.pub|thefamouspeople\.com|famousbirthdays\.com|infoplease\.com|thefreedictionary\.com|dictionary\.com|merriam-webster\.com|worldatlas\.com|mappr\.co)$/i;
const hostName = (u) => { try { return new URL(String(u)).hostname.replace(/^www\./, ""); } catch { return ""; } };
export const isTertiary = (url) => isWikiIndex(url) || REFERENCE_HOSTS.test(hostName(url));
import { askTerms, salientExcerpt } from "./fold-chat-salience.js";
import { sentencesWithOffsets } from "./fold-chat-impression.js";

export const PROVENANCE = Object.freeze({
  giver: "the user's brief 2026-10-06 (shape); the author's draft wording; declared, not measured (II.11)",
  minSentence: 20,           // a copy shorter than this is not a sentence worth pointing at
  maxQuote: 320,             // a quote longer than this is cut at the sentence, never mid-word
  maxPointers: 2,            // the verified source and one that independently says it
  maxCandidate: 420,         // a candidate sentence longer than this is a scraped run-on, not a sentence
});

const hostOf = (u) => { try { return new URL(String(u)).hostname.replace(/^www\./, ""); } catch { return ""; } };
const titleOf = (p) => { const ref = String(p?.ref ?? ""); const t = ref.includes(" — ") ? ref.slice(ref.indexOf(" — ") + 3) : (p?.title || ref); return String(t).replace(/\s+[-–—|]\s+(Wikipedia|Britannica)\s*$/i, "").trim(); };
const nameOfHost = (h) => (/(^|\.)wikipedia\.org$/i.test(h) ? "Wikipedia" : h);

// ─────────────── call B: the pointing task ───────────────

export function pointerMessages({ answer, passages, question = "" }) {
  const list = (Array.isArray(passages) ? passages : []).map((p, i) => `[S${i + 1}] ${titleOf(p) || hostOf(p.url || p.source)}\n${String(p.text ?? "").slice(0, 2400)}`).join("\n\n");
  const system = "You check an answer against the sources it was written from. You are given SOURCES and an ANSWER. Find the ONE sentence in the sources that says what the answer says, and copy it exactly, "
    + "character for character. If no source says it, reply NONE. Reply in exactly this form:\nSOURCE: S<number>\nSENTENCE: <the sentence, copied exactly>";
  return [{ role: "system", content: system }, { role: "user", content: `SOURCES\n${list}\n\nANSWER\n${String(answer ?? "").trim()}` }];
}

export function parsePointerReply(text) {
  const t = String(text ?? "").trim();
  if (!t) return null;
  if (/^\s*NONE\b/i.test(t) && !/SENTENCE\s*:/i.test(t)) return { none: true };
  const src = /SOURCE\s*:\s*\[?S?(\d+)\]?/i.exec(t);
  const sen = /SENTENCE\s*:\s*([^]*)$/i.exec(t);
  if (!sen) return null;
  let sentence = sen[1].trim().replace(/^["“”'‘’]+|["“”'‘’]+$/g, "").replace(/^\s*[-*•]\s+/, "").trim();
  if (!sentence) return null;
  return { source: src ? Number(src[1]) : null, sentence };
}

// ─────────────── verification: verbatim or rejected ───────────────

const PUNCT = new Map([["‘", "'"], ["’", "'"], ["“", '"'], ["”", '"'], ["–", "-"], ["—", "-"], ["−", "-"], [" ", " "], ["…", "."]]);
/** A text with whitespace runs collapsed and typographic marks mapped 1:1, plus a map from each normalised index to the ORIGINAL index. */
function normalise(text) {
  const src = String(text ?? "");
  let out = ""; const map = []; let lastSpace = true;
  for (let i = 0; i < src.length; i++) {
    let c = src[i]; c = PUNCT.get(c) ?? c;
    if (/\s/.test(c)) { if (lastSpace) continue; out += " "; map.push(i); lastSpace = true; continue; }
    lastSpace = false; out += c.toLowerCase(); map.push(i);
  }
  map.push(src.length);
  return { out, map };
}

export function locate(sentence, passages, hint = null) {
  const s = normalise(sentence).out.replace(/[.\s]+$/g, "").trim();
  if (s.length < PROVENANCE.minSentence) return { ok: false, why: "too_short" };
  const list = Array.isArray(passages) ? passages : [];
  const order = list.map((_, i) => i);
  if (hint != null && hint >= 1 && hint <= list.length) { order.splice(order.indexOf(hint - 1), 1); order.unshift(hint - 1); }   // the claimed source is only a HINT: searched first, never trusted
  for (const i of order) {
    const n = normalise(list[i]?.text);
    const at = n.out.indexOf(s);
    if (at < 0) continue;
    const start = n.map[at];
    // extend to the end of the source's own sentence (its terminal mark), so the slice is a whole sentence of the SOURCE
    let end = n.map[Math.min(at + s.length, n.map.length - 1)];
    const orig = String(list[i].text);
    const m = /^[.!?]["')\]”’]*/u.exec(orig.slice(end));
    if (m) end += m[0].length;
    return { ok: true, index: i, start, end, text: orig.slice(start, end) };
  }
  return { ok: false, why: "not_in_sources" };
}

const stemsOf = (t, fw) => ground.tokenize(String(t ?? "")).filter((x) => x.length > 2 && !(fw && fw.has(x))).map((x) => (ground.stemOf ? ground.stemOf(x) : x));
// opposite superlatives of MAGNITUDE (F4 P6/P7 F23/F24: "lowest" vs "highest"). Declared PAIRS
// (giver: author, II.11) — deliberately NOT most/least/first/last/best/worst, which co-occur innocently
// across different referents ("first" here, "last" there). Kept as pairs (not a reversed map: several
// share an end — "tallest"/"longest" both oppose "shortest" — and a reversed map keeps only the last).
// Matched on raw words, never stems.
const OPPOSITE_PAIRS = [
  ["highest", "lowest"], ["largest", "smallest"], ["tallest", "shortest"], ["longest", "shortest"],
  ["biggest", "smallest"], ["fastest", "slowest"], ["deepest", "shallowest"], ["widest", "narrowest"],
  ["heaviest", "lightest"], ["oldest", "youngest"], ["strongest", "weakest"],
];
const rawWords = (s) => String(s ?? "").toLowerCase().match(/[\p{L}]+/gu) || [];
/** The minimal relevance check on a pointer: the sentence shares at least HALF of the claim's content stems (rounded up), every figure of the claim is in the sentence (same value in the same dimension — "1,083 metres" is not "1,083 ft"), polarity is not flipped across the pair, every name the claim commits to resolves (in the sentence or, for a shortened form, in the page title), and no opposite superlative stands in its place. Nothing finer is claimed.
 *  Measured 2026-10-06 (live chat): with "shares one stem" the source line for "The King of the UK is King Charles III." quoted "In 1917 King George V changed the royal house's name to Windsor…" (shared: "king").
 *  DECLARED, NOT MEASURED (II.11): one half. Giver: the author; it keeps a paraphrase that names the entity and drops a filler, and refuses a sentence that shares only the commonest word. */
export function bearsOn(claim, sentence, fw, titleText = "") {
  const c = new Set(stemsOf(claim, fw)), s = new Set(stemsOf(sentence, fw));
  const shared = [...c].filter((x) => s.has(x));
  // figures, strict and unit-aware (F4 P6 F05/F06 + P1): same norm AND (both unitless or same
  // dimension+factor). "330 metres" meets "330 m"; it never meets "1,083 ft" or "324 m".
  let cfigs = [], sfigs = [];
  try { cfigs = ground.figuresIn(String(claim ?? "")); sfigs = ground.figuresIn(String(sentence ?? "")); } catch { cfigs = []; sfigs = []; }
  const figOk = (f, w) => f.norm === w.norm && ((!f.unit && !w.unit) || (f.unit && w.unit && f.unit.dim === w.unit.dim && f.unit.f === w.unit.f));
  const missing = cfigs.filter((f) => !sfigs.some((w) => figOk(f, w)));
  if (!shared.length) return { ok: false, why: "unrelated" };
  if (missing.length) return { ok: false, why: "figure_missing:" + missing.map((f) => f.raw).join(",") };
  if (shared.length < Math.ceil(c.size / 2)) return { ok: false, why: "unrelated" };
  // polarity, verifier-strict (F4 P6 polarity): ANY asymmetry of negation is unverifiable — a claim
  // the sentence negates differently is not support. (Falsification uses the precise same-proposition
  // flip; verification refuses what it cannot resolve. Mutual negation passes through to the checks below.)
  // ("without" is a PREPOSITION, not a clausal negator: "loves the people without partiality" does not deny that God rewards the virtuous —
  // fold-chat-counsel.test.mjs pins it; it made the counsel tie gate refuse its own canon's sentences)
  const hasNeg = (t) => /\b(?:not|no|never|neither|nor|none|cannot|n't|failed to|did not|does not|is not|was not)\b/i.test(String(t ?? "").replace(/\bnot\s+(?:only|just|merely|simply)\b|\bno\s+(?:doubt|question)\b/i, " "));
  if (hasNeg(claim) !== hasNeg(sentence)) return { ok: false, why: "polarity" };
  // entities (F4 P6 name/place/keyword-only + P1 true names): every name resolves in the sentence or,
  // for a shortened form, in the page title ("Eiffel Tower" via "The tower…" on its own page; the fold's
  // own rule that a source title is the strongest authority for a name). Names read leniently
  // (ground.namesIn keeps sentence-initial singles like "Sydney" — the non-claim gate, which runs first,
  // already filtered greetings with namesOf-strict). Single-token ALL-CAPS ("US") is adjectival, not
  // identifying — skipped both sides. A claim naming nobody needs nothing. Without a title (old callers:
  // unit tests, c8) the check is skipped entirely — exactly the old behavior, which had none.
  const capName = (n) => /\s/.test(n.trim()) || !/^[A-Z]{2,}$/.test(n.trim());
  // a function word is never a name, whatever its case ("Does justice reward…": the sentence-initial "Does" is not a name to find)
  const cn = ground.namesIn(claim).filter(capName).filter((n) => !(fw && n.split(/\s+/).every((w) => fw.has(w.toLowerCase()))));
  if (titleText && cn.length) {
    const low = String(sentence).toLowerCase(), titleLow = String(titleText ?? "").toLowerCase();
    const stemOf = (w) => { try { return ground.stemOf ? ground.stemOf(w) : w; } catch { return w; } };
    const bad = cn.filter((n) => {
      const parts = n.split(/[^a-z0-9]+/i).filter((x) => x.length > 1);
      // inflected forms meet ("Prizes"/"Prize", F4 S04) — stemmed or raw, sentence or title
      return !parts.every((p) => {
        const pl = p.toLowerCase(), ps = String(stemOf(pl)).toLowerCase();
        return low.includes(pl) || low.includes(ps) || titleLow.includes(pl) || titleLow.includes(ps);
      });
    });
    if (bad.length) return { ok: false, why: "unstated_name:" + bad[0] };
  }
  // opposite superlatives (F4 P6/P7 F23/F24): either end in the claim met by the other end.
  const rw = new Set(rawWords(sentence));
  for (const t of rawWords(claim)) {
    const hit = OPPOSITE_PAIRS.find(([a, b]) => (t === a && rw.has(b)) || (t === b && rw.has(a)));
    if (hit) return { ok: false, why: "opposite:" + t };
  }
  return { ok: true, shared };
}

export function verifyPointer({ reply, claim, passages, fw = null }) {
  const r = typeof reply === "string" ? parsePointerReply(reply) : reply;
  if (!r) return { ok: false, why: "unparsed" };
  if (r.none) return { ok: false, why: "none" };
  const at = locate(r.sentence, passages, r.source);
  if (!at.ok) return { ok: false, why: at.why, claimedSource: r.source };
  const rel = bearsOn(claim, at.text, fw, titleOf((passages || [])[at.index] || {}));
  if (!rel.ok) return { ok: false, why: rel.why };
  const p = passages[at.index];
  const url = p.url || p.source || "";
  const host = hostOf(url);
  const tier = p.origin ? "origin" : (p.tertiary || isTertiary(url)) ? "index" : "primary";
  return { ok: true, index: at.index, ref: p.ref || null, url, host, title: titleOf(p), tier, foundVia: p.foundVia || null, start: at.start, end: at.end, quote: clip(at.text, PROVENANCE.maxQuote), shared: rel.shared };
}

function clip(text, max) { const t = String(text).replace(/\s+/g, " ").trim(); if (t.length <= max) return t; const cut = t.slice(0, max); const sp = cut.lastIndexOf(" "); return (sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd() + "…"; }

// ─────────────── the NUMBERED protocol: the model points by NUMBER, it never copies ───────────────
// A small model cannot copy a sentence character for character, and a rejected honest copy looks like a missing source. So the app numbers the candidate sentences (the ones of each page that bear on
// the claim, as verbatim slices) and the model replies with a NUMBER. The sentence is then the page's own by construction; what remains to check is that it BEARS ON the claim.

/** A scraped run-on ("…strikes.Q&A"Why do spiders…") is not a sentence of anyone's: too long, glued sentence ends ("word.Word"), or mostly not letters. */
export function looksLikeSentence(t) {
  const s = String(t ?? "");
  if (s.length > PROVENANCE.maxCandidate) return false;
  if (/[a-z0-9][.!?][A-Z]/.test(s)) return false;                  // two sentences glued without a space
  if (((s.match(/\p{L}/gu) || []).length) / s.length < 0.6) return false;
  // a heading is not a sentence of anyone's saying anything: measured 2026-10-06, the quote under "The King of the UK is Charles III." was the page title "Royal Family tree: King Charles III's closest family and line of succession"
  if (!/[.!?\u3002\uff01\uff1f\u201d"\u2019')\]]\s*$/u.test(s.trim())) return false;
  return true;
}

export function candidatesFor(claim, passages, fw = null, { perPage = 6, max = 20 } = {}) {
  const terms = askTerms({ question: claim }, fw);
  const out = [];
  const have = new Set();
  (Array.isArray(passages) ? passages : []).forEach((p, passageIndex) => {
    const text = String(p?.text ?? "");
    if (!text.trim()) return;
    let slices = [];
    const ex = terms ? salientExcerpt(p, terms, { chars: 1600, neighbours: 0 }) : null;
    if (ex && ex.slices.length) slices = ex.slices;
    else slices = sentencesWithOffsets(text).slice(0, perPage).map((s) => ({ start: s.start, end: s.end }));
    for (const s of slices.slice(0, perPage)) {
      const t = text.slice(s.start, s.end).trim();
      if (t.length >= PROVENANCE.minSentence && looksLikeSentence(t)) { out.push({ passageIndex, start: s.start, end: s.end, text: t }); have.add(passageIndex + ":" + s.start + ":" + s.end); }
    }
    // RECALL BACKSTOP (F4 P1 S01/S13): a sentence carrying a distinctive stem of the ask (in ≤2
    // sentences of its page — figures, names, rare words) is always offered, past perPage, within max.
    // Page order is kept for the first perPage; the backstop appends after them, in page order.
    // Stems match exactly the way askTerms stems (ground.tokenize + ground.stemOf), or nothing meets.
    if (terms && out.length < max) {
      const units = sentencesWithOffsets(text);
      const stem = (t) => (ground.stemOf ? ground.stemOf(t) : t);
      const sts = units.map((u) => new Set(ground.tokenize(text.slice(u.start, u.end)).map(stem)));
      const df = new Map();
      for (const t of terms) { let n = 0; for (const s of sts) if (s.has(t)) n++; df.set(t, n); }
      const rare = [...terms].filter((t) => (df.get(t) || 0) >= 1 && (df.get(t) || 0) <= 2);
      if (rare.length) {
        units.forEach((u, i) => {
          if (out.length >= max) return;
          const k = passageIndex + ":" + u.start + ":" + u.end;
          if (have.has(k)) return;
          if (!rare.some((t) => sts[i].has(t))) return;
          const t = text.slice(u.start, u.end).trim();
          if (t.length >= PROVENANCE.minSentence && looksLikeSentence(t)) { out.push({ passageIndex, start: u.start, end: u.end, text: t }); have.add(k); }
        });
      }
    }
  });
  return out.slice(0, max).map((c, i) => ({ ...c, n: i + 1 }));
}

export function numberedMessages({ claim, candidates, passages }) {
  const list = candidates.map((c) => `[${c.n}] ${c.text.replace(/\s+/g, " ")}`).join("\n");
  const system = "You check an answer against the sources it was written from. You are given a numbered list of SENTENCES taken from the sources, and an ANSWER. "
    + "Reply with the number of the ONE sentence that says what the answer says. If none of them does, reply NONE. Reply with just the number, for example: 3";
  return [{ role: "system", content: system }, { role: "user", content: `SENTENCES\n${list}\n\nANSWER\n${String(claim ?? "").trim()}` }];
}

export function parsePointerNumber(text) {
  const t = String(text ?? "").trim();
  if (!t) return null;
  if (/^\W*NONE\b/i.test(t)) return { none: true };
  const m = /(?:^|[^\d.])\[?(\d{1,3})\]?(?![\d])/.exec(t);
  return m ? { n: Number(m[1]) } : null;
}

export function verifyNumber({ reply, claim, candidates, passages, fw = null }) {
  const r = typeof reply === "string" ? parsePointerNumber(reply) : reply;
  if (!r) return { ok: false, why: "unparsed" };
  if (r.none) return { ok: false, why: "none" };
  const c = (candidates || []).find((x) => x.n === r.n);
  if (!c) return { ok: false, why: "no_such_sentence" };
  const pass0 = (passages || [])[c.passageIndex] || {};
  const rel = bearsOn(claim, c.text, fw, titleOf(pass0));
  if (!rel.ok) return { ok: false, why: rel.why };
  const pass = passages[c.passageIndex];
  const url = pass.url || pass.source || "";
  const host = hostOf(url);
  const tier = pass.origin ? "origin" : (pass.tertiary || isTertiary(url)) ? "index" : "primary";
  return { ok: true, index: c.passageIndex, ref: pass.ref || null, url, host, title: titleOf(pass), tier, foundVia: pass.foundVia || null, start: c.start, end: c.end, quote: clip(String(pass.text).slice(c.start, c.end), PROVENANCE.maxQuote), shared: rel.shared, by: "number" };
}

// ─────────────── the narration: the app's words around the source's words ───────────────

export const TEMPLATES = Object.freeze({
  primary: (v) => `I got this from ${v.title || v.host} (${v.host}) for the answer's first sentence. It says:`,
  origin: (v, idx) => `I checked this on ${idx ? nameOfHost(idx.host) : "an encyclopedia"} for the answer's first sentence, but I treat that as an index to primary sources, so I followed it to ${v.host} and verified it there. It says:`,
  index: (v) => `I found this on ${nameOfHost(v.host)} for the answer's first sentence, which I treat as a pointer rather than a source, and I could not reach a primary page that says it, so treat it as unconfirmed. It says:`,
  also: (v) => `It also says what the first sentence says on ${v.host}:`,
  none: () => "I couldn't point to a sentence in what I read that says what the answer's first sentence says, so I'm treating it as unsupported.",
});

/** An answer that asserts nothing checkable — a greeting, a hedge, a refusal to answer ("I don't
 *  know", "It depends", "The sources do not say"). No names, no figures, no number-words: there is
 *  nothing a pointer could verify, so there is nothing to point at. Pure. */
const NUMBER_WORDS = new Set(("one two three four five six seven eight nine ten eleven twelve hundred thousand million billion dozen half quarter").split(" "));
// a negated assertion about a WORLD subject ("Water is not an inorganic compound") IS checkable —
// the positive is what a pointer verifies against. Hedges stay hedges: first-person ("I could not
// find"), existential ("There is no single answer"), and meta-subject ("The sources do not say",
// "The answer is not straightforward") negations assert nothing about the world. F4 P6/P7 F19.
const NEGATION_WORD = /\b(?:not|no|never|neither|nor|none|without|cannot|can't|don't|doesn't|isn't|aren't|wasn't|weren't|couldn't|wouldn't|shouldn't|n't|failed to|unable to)\b/i;
const META_SUBJECT = new Set(("sources source answer answers question questions opinion opinions views view information historians historian evidence debate dispute doubt knowledge readers people everyone everybody it there that this these those here what which who whom whose").split(" "));
const HEDGE_WORD = new Set(("the a an of in on to for and are was were is be been being does did do had has have its their his her your our my as at by or if then than so such only some more most other very will would could should shall may might must can cannot not no never neither nor none without also into over under about after before between through during out up down off again once when where why how all any both each few many much own same too until while am".split(" ")));
export function isNonClaim(text) {
  const s = String(text ?? "").trim();
  if (!s) return true;
  if (namesOf(s).length) return false;
  let figs = [];
  try { figs = ground.numbersIn(s); } catch { figs = []; }
  if (figs.length) return false;
  const words = s.toLowerCase().match(/[\p{L}]+/gu) || [];
  if (words.some((w) => NUMBER_WORDS.has(w))) return false;
  if (NEGATION_WORD.test(s)) {
    const ws = (s.toLowerCase().match(/[\p{L}']+/gu) || []).map((w) => w.replace(/'s$/, "").replace(/n't$/, ""));
    if (/^(i|we|you)$/.test(ws[0] || "")) return true;
    if (/^\s*there\s+(is|are|was|were|['’]s|['’]re)\b/i.test(s)) return true;
    const fc = ws.find((w) => !HEDGE_WORD.has(w) && w.length > 1);
    if (!fc || META_SUBJECT.has(fc)) return true;
    return false;
  }
  return true;
}

/** The narration for the verified pointers (best first). `indexPassage` names the encyclopedia an origin was reached through, when known. Returns { text, parts[] }: each part is { kind:"app", text, rule } or { kind:"quote", text, index, start, end, host }. */
export function narrate(pointers, { indexHost = null } = {}) {
  const ok = (pointers || []).filter((p) => p && p.ok).slice(0, PROVENANCE.maxPointers);
  const parts = [];
  if (!ok.length) { parts.push({ kind: "app", text: TEMPLATES.none(), rule: "none" }); return { text: parts[0].text, parts, verified: 0 }; }
  const lead = ok[0];
  const idxHost = indexHost || lead.foundVia?.host || null;
  parts.push({ kind: "app", text: TEMPLATES[lead.tier](lead, idxHost ? { host: idxHost } : null), rule: lead.tier });
  parts.push({ kind: "quote", text: `“${lead.quote}”`, index: lead.index, start: lead.start, end: lead.end, host: lead.host });
  for (const p of ok.slice(1)) {
    if (p.host === lead.host) continue;               // the same site twice is not a second witness
    parts.push({ kind: "app", text: TEMPLATES.also(p), rule: "also" }, { kind: "quote", text: `“${p.quote}”`, index: p.index, start: p.start, end: p.end, host: p.host });
  }
  return { text: parts.map((x) => x.text).join(" "), parts, verified: ok.length };
}

/** The check on the narrator: the narration is EXACTLY what the templates render from the verified pointers (so no app word is anyone's invention), and every quote is a verbatim slice of its passage. */
export function verifyNarration(narr, passages, pointers, opts = {}) {
  const bad = [];
  const want = narrate(pointers, opts);
  if (JSON.stringify((narr?.parts || []).map((x) => [x.kind, x.text])) !== JSON.stringify(want.parts.map((x) => [x.kind, x.text]))) bad.push({ why: "not_the_rendering_of_the_pointers" });
  for (const part of narr?.parts || []) {
    if (part.kind !== "quote") continue;
    const pass = passages?.[part.index];
    const slice = pass ? String(pass.text).slice(part.start, part.end) : null;
    const inner = String(part.text).replace(/^\u201c|\u201d$/g, "").replace(/\u2026$/, "");
    if (slice == null || !normalise(slice).out.includes(normalise(inner).out.trim())) bad.push({ why: "quote_not_in_source", text: part.text.slice(0, 60) });
  }
  return { ok: bad.length === 0, bad };
}

// ─────────────── the turn: call B (and a corroborating call), verified, narrated ───────────────

/** THE SWITCH. ON unless the person (or a test) turns it off: localStorage "fold-chat:provenance" === "off". Never throws. */
export const PROVENANCE_KEY = "fold-chat:provenance";
export function provenanceEnabled(storage = (typeof localStorage !== "undefined" ? localStorage : null)) {
  try { return storage?.getItem?.(PROVENANCE_KEY) !== "off"; } catch { return true; }
}

const firstSentence = (s) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); const m = /^(.+?[.!?。！？])(?:\s|$)/u.exec(t); return m ? m[1] : t; };

/**
 * provenanceFor({ answer, passages, point, fw, preferRefs, corroborate }) → { narr, pointers, calls, claim, ps, stored }
 *   point(messages) → Promise<string>   the MODEL CALL, injected (a rejected AbortError propagates; any other failure is a typed "call_failed" pointer, never a crash)
 *   The claim is the answer's FIRST sentence (the answer itself); the pages are those the answer was witnessed by first, then the rest, at most 4.
 *   The model POINTS BY NUMBER at one of the numbered candidate sentences (it never copies one). Call 1 asks over all of them; when it verifies and another HOST is available, call 2 asks over the other hosts only (an independent witness), so a turn makes 2 or 3 model calls in all.
 */
export async function provenanceFor({ answer, passages, point, fw = null, preferRefs = null, corroborate = true, maxPages = 4 }) {
  const claim = firstSentence(answer);
  // NON-CLAIMS (F4 P4): greetings, hedges, refusals-to-answer assert nothing checkable — no names, no
  // figures, no number-words. There is nothing to point at, so no box is drawn (and no model call spent):
  // showing "unsupported" for "I don't know" is the falsehood P4 falsified.
  if (isNonClaim(claim)) {
    const skip = { text: "", parts: [], verified: 0 };
    return { narr: skip, pointers: [], calls: 0, claim, ps: [], stored: { schema: "Provenance@1", claim, calls: 0, verified: 0, parts: [], pointers: [], why: "nonclaim" } };
  }
  const all = (Array.isArray(passages) ? passages : []).filter((p) => p && String(p.text ?? "").trim());
  const pref = preferRefs instanceof Set ? preferRefs : new Set(preferRefs || []);
  const rank = (p) => (p.origin ? 4 : 0) + (p.tertiary || isTertiary(p.url || p.source) ? 0 : 2) + (pref.has(String(p.ref)) ? 1 : 0);   // an origin or a primary page before the encyclopedia; the witnessing page first within a tier
  const ps = [...all].sort((a, b) => rank(b) - rank(a)).slice(0, maxPages);
  const run = async (list, retry = true) => {
    let candidates = candidatesFor(claim, list, fw).map((c) => ({ ...c, passageIndex: ps.indexOf(list[c.passageIndex]) }));
    if (!candidates.length) return { ok: false, why: "no_candidates" };
    for (let attempt = 0; attempt < (retry ? 2 : 1); attempt++) {
      let reply = "";
      try { reply = await point(numberedMessages({ claim, candidates, passages: ps })); calls++; }
      catch (e) { if (e && (e.name === "AbortError" || /abort|stopped/i.test(String(e.message || "")))) throw e; return { ok: false, why: "call_failed:" + String(e?.message || e).slice(0, 60) }; }
      const v = verifyNumber({ reply, claim, candidates, passages: ps, fw });
      if (v.ok || v.why === "none" || v.why === "unparsed") return v;
      // the pick was a real number but a sentence that does not say it. Re-ask ONCE over the rest
      // only when the pick failed as a sentence (no_such_sentence), lacks the claim's figure, or
      // does not bear on it (unrelated) — the pointer may have grabbed a neighbour (F4 P3). A pick
      // rejected for polarity, an unstated name, or an opposite is a verdict on the CLAIM, not a
      // pointing slip: re-asking shops the rest for a weaker sentence that verifies spuriously
      // (F4 P7 F12/F14 — the first pick exonerates, the second launders). So those stop here.
      const code = String(v.why || "").split(":")[0];   // "figure_missing:330" is failure class "figure_missing"
      if (code !== "no_such_sentence" && code !== "figure_missing" && code !== "unrelated") return v;
      const asked = parsePointerNumber(reply);
      const rest = candidates.filter((c) => c.n !== asked?.n).map((c, i) => ({ ...c, n: i + 1 }));
      if (attempt === 0 && retry && rest.length) candidates = rest; else return v;
    }
    return { ok: false, why: "rejected" };
  };
  let calls = 0;
  const pointers = [];
  if (!claim || !ps.length) return { narr: narrate([]), pointers: [], calls: 0, claim, ps, stored: null };
  const v1 = await run(ps); pointers.push(v1);
  if (v1.ok && corroborate) {
    const others = ps.filter((p) => hostOf(p.url || p.source) !== v1.host);
    if (others.length) {
      const v2 = await run(others, false);
      // "It ALSO says it" is a stronger claim than a pointer: the second sentence must carry EVERY content stem of the claim (a heading that merely shares words — "Myth: 'Eight legs' always means
      // 'spider'" — does not say what the claim says), and a figure the claim states.
      const claimStems = new Set(stemsOf(claim, fw));
      const have = new Set(stemsOf(String(ps[v2.index]?.text ?? "").slice(v2.start || 0, v2.end || 0), fw));
      const strong = v2.ok && [...claimStems].every((s) => have.has(s));
      if (v2.ok && strong && v2.host !== v1.host) pointers.push(v2);
    }
  }
  const narr = narrate(pointers);
  const ok = pointers.filter((p) => p.ok);
  const stored = {
    schema: "Provenance@1", claim, calls, verified: narr.verified, parts: narr.parts,
    pointers: ok.map((p) => ({ index: p.index, ref: p.ref, url: p.url, host: p.host, title: p.title, tier: p.tier, start: p.start, end: p.end })),
    why: ok.length ? null : (pointers[0]?.why || "none"),
  };
  return { narr, pointers, calls, claim, ps, stored };
}
