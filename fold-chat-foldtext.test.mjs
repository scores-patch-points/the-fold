// fold-chat-fold.test.mjs — folding at the khora's declared scope: Latin vowel accents folded,
// every other script left UNTOUCHED (the blanket strip the khora reverted is gone).
import test from "node:test";
import assert from "node:assert/strict";
import { foldText, FOLD_SCOPE } from "./fold-chat-foldtext.js";

test("FALSIFIER — the reverted blanket strip is gone: Indic, Thai, Hangul, CJK are not corrupted", () => {
  for (const s of ["भारत", "मेरा नाम राहुल है", "কলকাতা", "ประเทศไทย", "서울", "東京", "شكرا"]) {
    assert.equal(foldText(s), s.toLowerCase(), s);
  }
});

test("Latin vowel accents ARE folded (the one thing that is earned)", () => {
  assert.equal(foldText("Café Société"), "cafe societe");
  assert.equal(foldText("naïve"), "naive");
  assert.equal(foldText("ÜBER"), "uber");
  // a decomposed input is composed first (NFKC), then folded
  assert.equal(foldText("cafe\u0301"), "cafe");
});

test("compatibility variants still fold (NFKC, not NFC): ligature, fullwidth, math letters, Turkish İ", () => {
  assert.equal(foldText("ﬁle"), "file");
  assert.equal(foldText("ＡＢＣ"), "abc");
  assert.equal(foldText("\u{1D400}bc"), "abc");   // MATHEMATICAL BOLD CAPITAL A
  assert.equal(foldText("İSTANBUL"), "istanbul"); // the dotless/dotted I collision holds
  assert.equal(foldText("ırmak"), "irmak");
});

test("DECLARED SCOPE (II.13) — non-vowel Latin diacritics are NOT folded, and the scope says so", () => {
  assert.equal(foldText("ñandú"), "ñandu");   // ñ is not one of the five vowels' accents
  assert.equal(foldText("garçon"), "garçon");
  assert.match(FOLD_SCOPE.doesNotFold, /ñ ç/);
  assert.match(FOLD_SCOPE.giver, /khora/);
});

test("Greek tonos/dialytika/final-sigma fold (declared + fixture); Cyrillic LETTERS do not", () => {
  assert.equal(foldText("Αθήνα"), "αθηνα");         // tonos folds, like a Latin accent
  assert.equal(foldText("Θεσσαλονίκη"), "θεσσαλονικη");
  assert.equal(foldText("Οδυσσεύς"), "οδυσσευσ");   // final sigma ς → σ
  assert.equal(foldText("Москва"), "москва");       // case folds
  assert.equal(foldText("ёж"), "ёж");               // ё is a LETTER, not folded to е
  assert.equal(foldText("Йемен"), "йемен");         // й stays a distinct letter
});
