// eval/void/battery-intl.mjs — the omnilingual void battery: six asks, each in English (the control) and in eight languages, with LANGUAGE-FREE gold
// (a property id and a value id, or a year), written 2026-10-14 BEFORE any arm ran (eval/void/PREREG.md Amendment 16). FROZEN by battery-intl.sha.
// Questions are the author's own, NOT native-reviewed (declared). They use the noun form of the relation ("the capital", "the creator", "the date of
// opening") on purpose: it separates the language question from the already-known verb → noun derivation gap (a verb stratum is future work).
// Gold ids were checked against Wikidata labels before freezing (Q408 Australia, Q16 Canada, Q12418 Mona Lisa, Q45178 Sydney Opera House, Q254 Mozart,
// Q17 Japan; values Q3114 Canberra, Q1930 Ottawa, Q762 Leonardo da Vinci, Q34713 Salzburg, Q8146 yen; properties P36 capital, P170 creator,
// P1619 date of official opening, P19 place of birth, P38 currency).
const A = [
  { key: "capital-au", set: "dev", anchorQ: "Q408", goldP: "P36", goldQ: ["Q3114"], q: {
    en: "What is the capital of Australia?", es: "¿Cuál es la capital de Australia?", fr: "Quelle est la capitale de l'Australie ?", de: "Was ist die Hauptstadt von Australien?",
    ru: "Какая столица Австралии?", ja: "オーストラリアの首都はどこですか。", ko: "호주의 수도는 어디입니까?", tr: "Avustralya'nın başkenti neresidir?", hi: "ऑस्ट्रेलिया की राजधानी क्या है?" } },
  { key: "capital-ca", set: "held", anchorQ: "Q16", goldP: "P36", goldQ: ["Q1930"], q: {
    en: "What is the capital of Canada?", es: "¿Cuál es la capital de Canadá?", fr: "Quelle est la capitale du Canada ?", de: "Was ist die Hauptstadt von Kanada?",
    ru: "Какая столица Канады?", ja: "カナダの首都はどこですか。", ko: "캐나다의 수도는 어디입니까?", tr: "Kanada'nın başkenti neresidir?", hi: "कनाडा की राजधानी क्या है?" } },
  { key: "creator-mona", set: "dev", anchorQ: "Q12418", goldP: "P170", goldQ: ["Q762"], q: {
    en: "Who is the creator of the Mona Lisa?", es: "¿Quién es el creador de la Mona Lisa?", fr: "Qui est le créateur de la Joconde ?", de: "Wer ist der Schöpfer der Mona Lisa?",
    ru: "Кто создатель Моны Лизы?", ja: "モナ・リザの作者は誰ですか。", ko: "모나리자의 작가는 누구입니까?", tr: "Mona Lisa'nın yaratıcısı kimdir?", hi: "मोना लिसा का रचयिता कौन है?" } },
  { key: "opening-syd", set: "held", anchorQ: "Q45178", goldP: "P1619", goldYear: "1973", q: {
    en: "What is the opening date of the Sydney Opera House?", es: "¿Cuál es la fecha de apertura de la Ópera de Sídney?", fr: "Quelle est la date d'ouverture de l'opéra de Sydney ?",
    de: "Was ist das Eröffnungsdatum des Sydney Opera House?", ru: "Какова дата открытия Сиднейской оперы?", ja: "シドニー・オペラハウスの開館日はいつですか。",
    ko: "시드니 오페라 하우스의 개관일은 언제입니까?", tr: "Sidney Opera Binası'nın açılış tarihi nedir?", hi: "सिडनी ओपेरा हाउस की उद्घाटन तिथि क्या है?" } },
  { key: "birthplace-mozart", set: "dev", anchorQ: "Q254", goldP: "P19", goldQ: ["Q34713"], q: {
    en: "What is the place of birth of Wolfgang Amadeus Mozart?", es: "¿Cuál es el lugar de nacimiento de Wolfgang Amadeus Mozart?",
    fr: "Quel est le lieu de naissance de Wolfgang Amadeus Mozart ?", de: "Was ist der Geburtsort von Wolfgang Amadeus Mozart?",
    ru: "Каково место рождения Вольфганга Амадея Моцарта?", ja: "ヴォルフガング・アマデウス・モーツァルトの出生地はどこですか。",
    ko: "볼프강 아마데우스 모차르트의 출생지는 어디입니까?", tr: "Wolfgang Amadeus Mozart'ın doğum yeri neresidir?", hi: "वोल्फगांग आमाडेउस मोत्सार्ट का जन्मस्थान क्या है?" } },
  { key: "currency-jp", set: "held", anchorQ: "Q17", goldP: "P38", goldQ: ["Q8146"], q: {
    en: "What is the currency of Japan?", es: "¿Cuál es la moneda de Japón?", fr: "Quelle est la monnaie du Japon ?", de: "Was ist die Währung von Japan?",
    ru: "Какая валюта Японии?", ja: "日本の通貨は何ですか。", ko: "일본의 통화는 무엇입니까?", tr: "Japonya'nın para birimi nedir?", hi: "जापान की मुद्रा क्या है?" } },
];
export const LANGS = Object.freeze(["en", "es", "fr", "de", "ru", "ja", "ko", "tr", "hi"]);
export const BATTERY_INTL = Object.freeze(A.flatMap((a) => LANGS.map((lang) => Object.freeze({
  id: `${a.key}.${lang}`, ask: a.key, lang, set: a.set, q: a.q[lang], anchorQ: a.anchorQ, goldP: a.goldP, goldQ: a.goldQ || null, goldYear: a.goldYear || null,
}))));
export default BATTERY_INTL;
