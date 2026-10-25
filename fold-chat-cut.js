// fold-chat-cut.js — THE CHAT'S ONE SENTENCE CUT (2026-10-25). khora's spans.js::splitSentences — the cut every reader in the suite
// shares — told which dotted tokens are words by janus's priors, vendored with khora: English's MEASURED punctuation prior
// (punctuation-eng.json) and the hyperlexicon's dotted words READ AHEAD (dotted-eng.json: the forms the hyperlexicon's givers write
// with their period, read off janus's ledger as written — its giver is the ledger, named by its head; "etc.", "e.g.", "U.S." …, kept
// where this text never writes the token without its period — organs/lexicon.js::dottedIn), plus the text's own
// (spans.js::deriveAbbreviations). No typed list. A line is the outer unit: a line break always ends
// a sentence, as every splitter this replaced did; inside a line the cut is khora's (a decimal point is not a stop; 。！？ are).
// SCOPE: English. The priors are English's (janus has punctuation and dotted-word priors for no other language yet); a text in
// another language is cut by khora's splitter with English's dotted words, which it rarely writes, and its own derived ones.
//   cutLines(text, { abbreviations })  → [{ text, start, end }]   ranges slice back exactly: text.slice(start, end) === text
//   cutText(text, opts)                → [text]
//   abbreviationsOf(text, extra)       → Set: the tokens (as the splitter tests them, the letter run before the period) kept whole
//   endsWithAbbreviation(t)            → does `t` end on a dotted word, a lone initial or a run of dotted initials?
import { splitSentences, deriveAbbreviations } from "./vendor/khora/native/adapters/text/spans.js";
import { dottedIn } from "./vendor/khora/native/organs/lexicon.js";
import PUNCT from "./vendor/khora/native/priors/punctuation-eng.json" with { type: "json" };
import DOTTED from "./vendor/khora/native/priors/dotted-eng.json" with { type: "json" };

const MEASURED = (PUNCT.abbreviations || []).map(String);
const DOTTED_WORDS = new Set(DOTTED.words || []);
const variants = (t) => { const s = String(t); return [s, s.toLowerCase(), s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(), s.toUpperCase()]; };
const lastRun = (form) => String(form).replace(/\.$/, "").split(".").pop();

export function abbreviationsOf(text, extra = []) {
  const src = String(text ?? "");
  const derived = [...deriveAbbreviations(src)];
  const known = new Set([...MEASURED, ...derived].map((a) => a.toLowerCase()));
  const dotted = dottedIn(src, DOTTED_WORDS, known).map(lastRun);
  const set = new Set();
  for (const t of [...MEASURED, ...derived, ...dotted, ...(extra || [])]) if (t) for (const v of variants(t)) set.add(v);
  return set;
}

export function cutLines(text, { abbreviations = null } = {}) {
  const src = String(text ?? "");
  const abbr = abbreviations instanceof Set ? abbreviations : abbreviationsOf(src, abbreviations || []);
  const out = []; const lineRe = /[^\n]+/g; let m;
  while ((m = lineRe.exec(src))) {
    const line = m[0].replace(/\r/g, " ");
    for (const x of splitSentences(line, { abbreviations: abbr })) {
      const start = m.index + x.offset, end = start + x.text.length;
      out.push({ text: src.slice(start, end), start, end });
    }
  }
  return out;
}
export const cutText = (text, opts) => cutLines(text, opts).map((x) => x.text);

export function endsWithAbbreviation(t) {
  const x = String(t ?? "").replace(/["')\]”’]+$/u, "");
  const m = x.match(/(?:^|[\s(])((?:\p{L}+\.)*\p{L}+)\.$/u);
  if (!m) return false;
  const form = m[1] + ".", run = lastRun(form);
  if (/^\p{Lu}$/u.test(run)) return true;   // a lone initial ("J."), or the last of a run of dotted initials ("U.S.")
  return DOTTED_WORDS.has(form) || DOTTED_WORDS.has(form.toLowerCase()) || MEASURED.includes(run.toLowerCase());
}
