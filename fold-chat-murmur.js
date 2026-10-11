// fold-chat-murmur.js — THE SYSTEM THINKING ALOUD ABOUT WHAT THE QUESTION IS.
//
// The failures this answers (2026-10-10): "who is it now?" was answered with a rice-planting
// sentence matched on the adverb "now"; "who is itnow?" was answered about ITNOW, a British
// Computer Society magazine, because "itnow" was carried as a NAME. Neither turn ever said, out
// loud, what it thought the question WAS. This module does exactly that, in the open.
//
// Pure: no DOM, no IO, no model. It reads the question with the same real instruments the turn
// uses — the language detector, the POSPrior-derived salience inference (fold-chat-salience-infer),
// the anaphora resolver (fold-chat-anaphora), the sense probe (fold-chat-senses) — and emits an
// ordered list of typed murmurs: what it hears, what it thinks the subject is, what it suspects,
// what it is reading the question as about, and what it intends to do. The surface draws them
// live (a stream above the turn); a person can refuse an interpretation (fold-chat-minds).
//
// It never decides and never answers: a murmur is a proposal about the question, disclosed.
import { detectLang } from "./fold-chat-lang.js";
import { FUNCTION_WORDS } from "./fold-chat-function-words.js";
import { classifyTurn } from "./fold-chat-discourse.js";
import { anaphoraOf } from "./fold-chat-anaphora.js";
import { salienceOf } from "./fold-chat-salience-infer.js";
import { SALIENCE_PRIOR } from "./fold-chat-salience-prior.js";
import { senseTerm } from "./fold-chat-senses.js";
import { stemOf } from "./fold-chat-ground.js";

import { foldText as fold } from "./fold-chat-foldtext.js";   // the khora's fold scope (II.13): Latin vowel accents only, never a blanket mark strip

export const MURMUR_SCHEMA = "Murmur@1";
const toksOf = (s) => fold(s).match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) || [];

const known = (t, fw) => fw.has(t) || SALIENCE_PRIOR[t] != null;
// A piece that carries no content of its own: a function word, or a measured low-salience form.
const weak = (t, fw) => fw.has(t) || (salienceOf(t) != null && salienceOf(t) < 0.5);

/** One run-together token that splits into two WEAK forms ("itnow" -> it + now). A split into real
 *  content words is NOT a run-together typo — "lovelace" -> love + lace is a name, not a mistake. Null otherwise. */
export function splitRunTogether(u, fw) {
  if (u.length < 4) return null;
  for (let i = 2; i < u.length - 1; i++) {
    const a = u.slice(0, i), b = u.slice(i);
    if (a.length >= 2 && b.length >= 2 && weak(a, fw) && weak(b, fw)) return [a, b];
  }
  return null;
}

/**
 * murmurOf({ question, carried, rejected, prior, hints, hasMaterial }) -> Murmur@1
 *   lines: [{ op, text, ... }] — what the system thinks the question is, in order.
 *   carried: the referents the thread already established (the caller resolves the record); `rejected`
 *            are the surfaces the person refused (fold-chat-minds) and are never carried.
 */
export function murmurOf({ question, carried = [], rejected = [], prior = null, hints = null, hasMaterial = false } = {}) {
  const q = String(question ?? "").trim();
  const lines = [];
  const say = (op, text, extra = {}) => lines.push({ op, text, ...extra });
  if (!q) return { schema: MURMUR_SCHEMA, question: q, lines, kind: null };

  // 1. LISTEN — language
  const d = (() => { try { return detectLang(q, { prior }); } catch { return { lang: "unknown", confident: false }; } })();
  const lang = d.lang && d.lang !== "unknown" ? d.lang : "en";
  const fw = new Set(FUNCTION_WORDS[lang] || FUNCTION_WORDS.en || []);
  say("listen", "listening for what is being asked");
  say("language", `language: ${lang}` + (d.confident === false ? " (uncertain)" : ""), { lang });

  // 2. WEIGH THE WORDS — salience from the real POSPrior, not a hand list.
  //    A form the prior lacks is NOT automatically "a word I do not hold": stem-fold it (perspectives → perspective,
  //    a known word in another inflection), and a CAPITALIZED token is a NAME (Strauss) — never an unheld word.
  const cased = new Map();
  for (const rt of (String(q).match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || [])) { const f = fold(rt); if (!cased.has(f)) cased.set(f, /^\p{Lu}/u.test(rt)); }
  const names = [], content = [], low = [], unknown = [];
  for (const t of [...new Set(toksOf(q))]) {
    const s = salienceOf(t);
    if (s != null) { if (s >= 0.8) names.push([t, s]); else if (s >= 0.5) content.push([t, s]); else low.push([t, s]); continue; }
    if (fw.has(t)) continue;                                   // a function word: nothing to weigh
    let st = t; try { st = stemOf(t); } catch (e) { st = t; }
    const s2 = (st && st !== t) ? salienceOf(st) : null;
    if (s2 != null) { (s2 >= 0.5 ? content : low).push([t, s2]); continue; }   // a known word in another inflection
    if (cased.get(t) && t.length > 1) { names.push([t, 0.9]); continue; }      // a Capitalized token is a NAME
    if (t.length > 1) unknown.push(t);                          // genuinely OOV: a coinage, a typo, a fused word
  }
  if (names.length) say("subject", `the ask names ${names.map(([t]) => `"${t}"`).join(", ")}`, { names: names.map(([t]) => t) });
  else if (content.length) say("subject", `the ask is about ${content.map(([t]) => `"${t}"`).join(", ")}`, { content: content.map(([t]) => t) });

  // 3. SUSPECT — a run-together token the prior never saw, and the pieces it should have been
  for (const u of unknown) {
    const parts = splitRunTogether(u, fw);
    if (parts) say("suspicion", `"${u}" is one run-together token the prior has never seen; it should be "${parts[0]} ${parts[1]}" — not a name`, { token: u, split: parts, serious: true });
    else say("unknown", `"${u}" is not in the prior: a name, a coinage, or a typo — never a name by default`, { token: u });
  }

  // 4. LEAN — does it point back, or name nothing of its own?
  const ana = (() => { try { return anaphoraOf(q, { lang, hints }); } catch { return null; } })();
  const carriedClean = (Array.isArray(carried) ? carried : []).filter((c) => c && !rejected.includes(c));
  if (carriedClean.length) say("referent", `read as being about ${carriedClean.join(" and ")}`, { carried: carriedClean, basis: "carried" });
  else if (ana && ana.kind && ana.kind !== "standalone") say("referent", "leans on the earlier turn — no subject of its own", { basis: ana.kind });
  // No content word AND nothing to lean on: the ask names nothing at all — that alone is hard.
  if (!names.length && !content.length && !carriedClean.length) say("warning", "no content word of its own and nothing to point back to — this names nothing on its own", { serious: true });

  // 5. CAUTION — a leftover low-salience word must not drive a match ("now" is why a rice sentence won)
  if (low.length) say("caution", `${low.map(([t]) => `"${t}"`).join(", ")} ${low.length === 1 ? "is" : "are"} low-salience (${low.map(([t]) => t).join("/")}) — a follow-up word, not a subject: it must never choose the source`, { low: low.map(([t]) => t) });

  // 6. AMBIGUITY — a bare term that names several things. It is ambiguous whether or not it scores as a
  // name: "president" is a role with many holders, "mercury" is a god and a planet. senseTerm only fires
  // when the whole ask IS that term (plus a frame), so this is exactly the bare-term case.
  const term = (() => { try { return senseTerm(q); } catch { return null; } })();
  if (term) say("ambiguity", `the bare term "${term}" may name several things — the senses will be listed`, { term, ambiguous: true });

  // 7. INTERPRETATION — the one line the person reads and may refuse
  const about = carriedClean.length ? carriedClean.join(" and ") : (names.map(([t]) => t).join(", ") || (content[0] ? content[0][0] : null));
  if (about) say("interpretation", `reading the question as being about ${about}`, { about });

  // 8. DIFFICULTY — is this an ORDINARY ask the machine reads itself, or a HARD one only a model can parse?
  // The murmur is modelless either way; it never asks a model to ANSWER. A hard ask is one the machine's own
  // instruments cannot read: a run-together token, or an ask with no measured word and nothing to lean on.
  const hardWhy = [];
  for (const l of lines) if (l.serious) hardWhy.push(l.op);
  if (!names.length && !content.length && unknown.length && !hardWhy.length) hardWhy.push("unreadable-words");
  const hard = hardWhy.length > 0;
  if (hard) say("escalate", "this one the machine cannot read on its own — the mouth is asked only what the question means", { hard: true, why: hardWhy });

  // 9. PLAN — what it will do with it (never an answer)
  const kind = (() => { try { return classifyTurn(q, { hasMaterial }); } catch { return null; } })();
  if (kind) say("plan", `treating it as a ${kind} ask`);

  return { schema: MURMUR_SCHEMA, question: q, lang, kind, hard, hardWhy, ambiguous: lines.some((l) => l.op === "ambiguity"), names: names.map(([t]) => t), content: content.map(([t]) => t), unknown, low: low.map(([t]) => t), carried: carriedClean, interpretation: about || null, lines };
}

/** The model's ONLY job on a hard ask: propose what the question was, never answer it. Pure (builds the prompt). */
export function interpretPrompt(m) {
  const sys = "You do not answer. You only restate the question the person meant, in one short line, and nothing else. If it is already clear, repeat it unchanged.";
  const notes = (m?.lines || []).filter((l) => l.op === "suspicion" || l.op === "unknown" || l.op === "warning").map((l) => "- " + l.text);
  const user = `A person asked: ${JSON.stringify(m?.question || "")}\nWhat the machine could not read:\n${notes.join("\n") || "- (nothing flagged)"}\nRestate the question they meant, one line, no answer.`;
  return [{ role: "system", content: sys }, { role: "user", content: user }];
}

// ── THE MURMUR IN CLEAN NL — mechanically, no model ────────────────────────────
// The telling's discipline (telling.mjs) applied to the question: compose WHOLE SENTENCES from the
// typed lines, grammatical and grounded in the line's own content, claiming nothing the line did not
// measure. Sentence-initial capital, terminal period, no invented fact. Pure.

const LANG_NAME = { en: "English", es: "Spanish", fr: "French", de: "German", pt: "Portuguese", it: "Italian", nl: "Dutch", ru: "Russian", ar: "Arabic", he: "Hebrew", zh: "Chinese", ja: "Japanese", ko: "Korean", hi: "Hindi", el: "Greek", la: "Latin" };
const q = (s) => `\u201c${s}\u201d`;
const joinList = (xs) => { const a = xs.filter(Boolean); return a.length <= 1 ? (a[0] || "") : a.length === 2 ? `${a[0]} and ${a[1]}` : a.slice(0, -1).join(", ") + ", and " + a[a.length - 1]; };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** One clean sentence for one murmur line — or null when the line says nothing a sentence should carry. */
export function sentenceFor(l) {
  switch (l.op) {
    case "listen": return "I am reading your question.";
    case "language": return l.lang && l.lang !== "en" ? `It arrives in ${LANG_NAME[l.lang] || l.lang}.` : null;
    case "subject": return l.names?.length ? `It names ${joinList(l.names.map(q))}.` : l.content?.length ? `It is about ${joinList(l.content.map(q))}.` : null;
    case "suspicion": return `You wrote ${q(l.token)}; I read that as ${q(l.split.join(" "))} — a run-together, not a name.`;
    case "unknown": return `${cap(q(l.token))} is a word I do not hold, so I will not take it for a name.`;
    case "referent": return l.carried?.length ? `It points back to ${joinList(l.carried)}.` : "It leans on your last turn and names no subject of its own.";
    case "warning": return "It carries no content word of its own.";
    case "caution": return l.low?.length === 1 ? `${cap(q(l.low[0]))} is a follow-up word, so I will not let it choose the source.` : `${joinList((l.low || []).map(q))} are follow-up words, so I will not let them choose the source.`;
    case "ambiguity": return `The bare term ${q(l.term || (l.text.match(/\u201c([^\u201d]+)\u201d/) || l.text.match(/"([^"]+)"/) || [])[1] || "")} can name more than one thing.`;
    case "interpretation": return `So I am reading the question as being about ${joinList(l.about.split(" and "))}.`;
    case "plan": return "I will look for that, and show only what a source actually says.";
    case "page": return `Reading the page${l.host ? " at " + l.host : ""}.`;
    case "heal": return `A past lesson taught me to read ${q(l.from)} as ${q(l.to)}.`;
    case "interpreted": return `I could not read the ask, so I asked the mouth what you meant: it read ${q(l.from)} as ${q(l.to)}.`;
    default: return null;
  }
}

/** The murmur as clean sentences (one per line that says something). */
export function murmurSay(m) { return (m?.lines || []).map(sentenceFor).filter(Boolean); }
/** The murmur as one clean paragraph. */
export function murmurText(m) { return murmurSay(m).join(" "); }
