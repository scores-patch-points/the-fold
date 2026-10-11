// fold-chat-lang-facts.test.mjs — facts read in the person's language, and the limits named honestly.
import test from "node:test";
import assert from "node:assert/strict";
import { extractStatedName, statedStatements, attestedNames, NAME_INTROS, PLACE } from "./fold-chat-lang-facts.js";

test("the fold reads a name in every language it serves", () => {
  const cases = [
    ["en", "my name is Michael", "Michael"], ["es", "me llamo Ana", "Ana"], ["fr", "je m'appelle Léa", "Léa"],
    ["de", "ich heiße Klaus", "Klaus"], ["pt", "meu nome é João", "João"], ["it", "mi chiamo Marco", "Marco"],
    ["nl", "ik heet Sanne", "Sanne"], ["ru", "меня зовут Иван", "Иван"], ["ar", "اسمي أحمد", "أحمد"],
    ["he", "שמי דוד", "דוד"], ["el", "με λένε Νίκο", "Νίκο"], ["zh", "我叫小明", "小明"],
    ["ja", "私の名前は太郎です", "太郎"], ["ko", "제 이름은 민수입니다", "민수"], ["hi", "मेरा नाम राहुल है", "राहुल"],
  ];
  for (const [lang, text, want] of cases) assert.equal(extractStatedName(text), want, `${lang}: ${text}`);
});

test("the fold reads a place in every language it serves", () => {
  const cases = [
    ["en", "I live in Nashville"], ["es", "vivo en Madrid"], ["fr", "j'habite à Paris"],
    ["de", "ich wohne in Berlin"], ["pt", "moro em Lisboa"], ["it", "vivo a Roma"],
    ["nl", "ik woon in Utrecht"], ["ru", "я живу в Москве"], ["ar", "أعيش في القاهرة"],
    ["he", "אני גר בתל אביב"], ["el", "μένω στην Αθήνα"], ["zh", "我住在上海"],
    ["ja", "東京に住んでいます"], ["ko", "서울에 살아요"], ["hi", "मैं दिल्ली में रहता हूँ"],
  ];
  for (const [lang, text] of cases) assert.ok(statedStatements(text).length > 0, `${lang}: ${text}`);
});

test("an explicit instruction to remember is read in several languages", () => {
  assert.ok(statedStatements("recuerda que soy alérgico a los cacahuetes").some((s) => /alérgico/.test(s)));
  assert.ok(statedStatements("remember that I hate cilantro").some((s) => /hate cilantro/.test(s)));
  assert.ok(statedStatements("记住我不吃花生").some((s) => /不吃花生/.test(s)));
});

test("FALSIFIER (Chomsky) — a place never becomes a name, in any language", () => {
  for (const s of ["vivo en Madrid", "j'habite à Paris", "ich wohne in Berlin", "я живу в Москве", "أعيش في القاهرة", "我住在上海"]) {
    const invented = statedStatements(s).some((x) => /my name is/i.test(x));
    assert.equal(invented, false, s);
  }
});

test("DECLARED LIMIT (Chomsky) — the copula form is NOT auto-read; the table is a frame, not a grammar", () => {
  // These are the same fact as the introductions above, in the copula construction. They are
  // deliberately NOT auto-learned: "soy cansado" / "我是学生" are indistinguishable, without a
  // per-language predicate lexicon, from a name. The interview covers this gap; the table must
  // not guess. If a future patch makes these pass, it must bring a declared predicate guard.
  for (const s of ["soy Ana", "je suis Léa", "ich bin Klaus", "我是小明", "मैं राहुल हूँ", "아는 민수예요"]) {
    assert.equal(extractStatedName(s), null, s);
  }
});

test("a multi-word name is read WHOLE, bounded by the language's own markers", () => {
  assert.equal(extractStatedName("me llamo María José"), "María José");
  assert.equal(extractStatedName("اسمي عبد الله"), "عبد الله");
  assert.equal(extractStatedName("मेरा नाम राहुल कुमार है"), "राहुल कुमार");   // the copula है ends it
  assert.equal(extractStatedName("je m'appelle Jean-Luc"), "Jean-Luc");       // a hyphenated name is one token
  assert.equal(extractStatedName("my name is Anna and I live in Paris"), "Anna");  // stops at "and"
  assert.equal(extractStatedName("mi nombre es María y José"), "María");           // stops at "y"
  assert.equal(extractStatedName("my name is not important"), null);               // the first token is a stop
  assert.equal(extractStatedName("I'm tired"), null);                              // the copula stays single-token
});

test("CHAMPOLLION — a name by recurrence, in any script, with no phrase table and no English prior", () => {
  const turns = [{ role: "user", content: "Ahmed said the report was late" }, { role: "user", content: "I told Ahmed to wait" }, { role: "user", content: "Ahmed is the client" }];
  const got = attestedNames(turns);
  assert.equal(got[0].name, "Ahmed");
  assert.ok(got[0].count >= 3);
  // a non-Latin script the English prior cannot read at all
  const ar = [{ role: "user", content: "أحمد قال ذلك" }, { role: "user", content: "أحمد هنا" }, { role: "user", content: "أحمد معي" }];
  assert.equal(attestedNames(ar)[0].name, "أحمد");
});

test("CHAMPOLLION — recurrence is a SUGGESTION: function words and rare tokens are never offered", () => {
  const turns = [{ role: "user", content: "the project is here" }, { role: "user", content: "the project is late" }, { role: "user", content: "the project is done" }, { role: "assistant", content: "Rareword Rareword Rareword" }];
  const names = attestedNames(turns).map((x) => x.name.toLowerCase());
  assert.ok(!names.includes("the"), "function word must not be suggested");
  assert.ok(!names.includes("rareword"), "an assistant's words are never mined");
});
