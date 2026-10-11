// fold-chat-foldtext.js — the fold's text folding, at the KHORA's declared scope. Pure; node-testable.
//
// WHY THIS EXISTS. Fourteen fold modules fold text with `normalize("NFKD").replace(/\p{M}+/gu, "")`
// — a Latin accent trick (strip the combining mark, keep the base letter). Applied to every script
// it is wrong: it deletes the matras of Brahmic scripts and Thai, where the mark IS the vowel, and
// it decomposes Hangul syllables into jamo. Proven 2026-10-11:
//     "भारत"            -> "भरत"          (the long आ is gone: the word no longer says India)
//     "मेरा नाम राहुल है" -> "मर नम रहल ह"   (every vowel sign stripped: the sentence is gibberish)
//     "서울"             -> "서울"           (NFKD split the syllable)
//
// THE KHORA ALREADY REVERTED THIS. Its perceiver folds ONLY the five Latin vowels' accents and says
// so, citing Constitution II.13 (the script earning test): a blanket strip "silently claimed
// cross-script generality with no invariance fixture to back it ... the silence is the more severe
// failure than the scope" (native/legacy-ported/packages/engine/perceiver/text/surfaces.js). This is
// the fold's copy of that scope — `diaNorm` — so the surface stops claiming a generality it does not
// have. A script whose marks carry content is left untouched; a form that cannot be folded is a
// typed gap (`unmeasured`), never a corrupted token.
//
// SCOPE (declared, II.13): folds á à â ä é è ê ë í ì î ï ó ò ô ö ú ù û ü and Greek tonos/dialytika and
// final sigma ς→σ. It does NOT fold ñ ç ø å æ ß š ž ł, Cyrillic (ё and й are distinct letters), Hebrew
// niqqud, Arabic tashkil, or Devanagari/Thai matras. Each script added here carries its own giver and
// invariance fixture (II.2/II.13) — or the reading goes to the khora, which is the reader of record.

// NFKC first: it folds the compatibility variants the old NFKD caught for free — the ligature
// ﬁ, fullwidth Ａ, the math alphanumerics 𝐀 — while, UNLIKE NFKD, it does NOT decompose Hangul
// (canonical composition) and does NOT touch Indic/Thai marks. Then lowercase, then the five Latin
// vowels' accents. (A falsification found NFC silently dropped ligature/fullwidth folding.)
const DIA_RE = /[áàâäéèêëíìîïóòôöúùûü]/g;
const DIA_TO = { "á": "a", "à": "a", "â": "a", "ä": "a", "é": "e", "è": "e", "ê": "e", "ë": "e", "í": "i", "ì": "i", "î": "i", "ï": "i", "ó": "o", "ò": "o", "ô": "o", "ö": "o", "ú": "u", "ù": "u", "û": "u", "ü": "u" };
// Greek, added by the author (giver, II.2) WITH its fixture (fold-chat-foldtext.test.mjs), the
// extension II.13 requires: tonos/dialytika are accents (like Latin é), and final sigma ς is a
// case variant of σ. Cyrillic is NOT folded: ё and й are distinct letters, not accents.
const GREEK_RE = /[άέήίόύώϊϋΐΰς]/g;
const GREEK_TO = { "ά": "α", "έ": "ε", "ή": "η", "ί": "ι", "ό": "ο", "ύ": "υ", "ώ": "ω", "ϊ": "ι", "ϋ": "υ", "ΐ": "ι", "ΰ": "υ", "ς": "σ" };

/** Fold text at the khora's declared scope (Latin vowel accents only). Never strips other marks. */
export function foldText(s) {
  const t = String(s ?? "");
  const n = t.normalize ? t.normalize("NFKC") : t;
  // Turkish dotted/dotless I → i: the two Latin i's collide for matching (toLowerCase would leave
  // "İ" as "i"+combining-dot, so the collision silently failed). Declared, Latin-only.
  return n.replace(/[İı]/g, "i").toLowerCase().replace(DIA_RE, (c) => DIA_TO[c]).replace(GREEK_RE, (c) => GREEK_TO[c]);
}

export const FOLD_SCOPE = Object.freeze({
  giver: "Latin vowels: the khora's diaNorm (perceiver/text/surfaces.js). Greek tonos/dialytika/final-sigma: the author, with its fixture. Constitution II.13 · 2026-10-11",
  folds: "the five Latin vowels' acute/grave/circumflex/umlaut accents, and Greek tonos/dialytika and final sigma ς→σ",
  doesNotFold: "ñ ç ø å æ ß š ž ł, Cyrillic (ё/й are letters), Hebrew niqqud, Arabic tashkil, Devanagari/Thai matras",
});
