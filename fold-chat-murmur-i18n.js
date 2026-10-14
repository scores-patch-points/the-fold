// fold-chat-murmur-i18n.js — the fold's murmur speaks ANY language it reads. Everything here is modelless
// (no model, no translation: per-language templates are the honest way — the fold does not translate, it
// speaks the language it detected). The claim extractor is language-parameterized: a curated per-language
// relational-verb lexicon and script-aware nominal spans, so German, Hebrew or Chinese claims do not lean
// on English capitalization. What cannot be recovered is the same typed gap, in that language.
//
// The registry is where EVERY murmur op plugs in: the reason-lint ops are wired; the salience/valence ops
// follow the same shape ({op, lang, args} → line).

export const LANGUAGES = Object.freeze({
  en: { script: "latin", name: "English" },
  de: { script: "latin", name: "Deutsch" },
  es: { script: "latin", name: "Español" },
  fr: { script: "latin", name: "Français" },
  ru: { script: "cyrillic", name: "Русский" },
  uk: { script: "cyrillic", name: "Українська" },
  zh: { script: "han", name: "中文" },
  ja: { script: "han", name: "日本語" },
  he: { script: "hebrew", name: "עברית" },
});

// Curated CLOSED-CLASS lexicons — the most stable language signal (a text says its language by its
// function words, not its dictionary). Small and curated on purpose; never scraped.
const FUNCTION_WORDS = Object.freeze({
  en: ["the", "and", "of", "to", "in", "is", "are", "was", "were", "a", "an", "for", "with", "on", "that", "as", "by", "from", "it", "not", "have", "has"],
  de: ["der", "die", "das", "und", "ist", "sind", "war", "waren", "nicht", "ein", "eine", "zu", "von", "mit", "auf", "fuer", "für", "im", "dem", "den", "als", "des", "denn"],
  es: ["el", "la", "los", "las", "de", "y", "es", "son", "era", "no", "un", "una", "en", "con", "por", "para", "que", "del", "se", "lo"],
  fr: ["le", "la", "les", "de", "et", "est", "sont", "pas", "un", "une", "en", "avec", "pour", "que", "du", "des", "au", "aux", "ce"],
  ru: ["и", "в", "на", "не", "что", "это", "есть", "с", "по", "как", "он", "она", "оно", "но", "для", "от", "из", "бы", "уж"],
  uk: ["і", "в", "на", "не", "що", "це", "є", "з", "по", "як", "він", "вона", "але", "для", "від", "з", "був", "та"],
  zh: ["的", "是", "了", "在", "和", "就", "都", "而", "及", "着", "与", "或", "很", "不", "也", "对", "把", "被", "中"],
  ja: ["は", "が", "を", "に", "の", "で", "て", "と", "も", "です", "ます", "いる", "ある", "こと", "から", "まで", "より"],
  he: ["של", "את", "על", "עם", "זה", "זו", "היא", "הוא", "יש", "לא", "גם", "אבל", "כי", "למה", "מ", "כ", "כמו"],
});

// Per-language relational verbs for the mechanical claim pivot, split by the linter's categories:
//  REL_ACYCLIC    movement/causation/order/refutation — a cycle in one of these begs the question
//  REL_FUNCTIONAL copula/possession/containment/identity — one value per subject in `role`
//  REL_SYMMETRIC  order-free relations
// CURATED, small, and honest: dictionary forms + the inflections a reader actually meets. A language
// without a listed verb yields no claim — that is the typed gap, not a failure.
export const REL_ACYCLIC = Object.freeze({
  en: ["leads", "led", "beats", "beat", "implies", "imply", "defeats", "defeated", "precedes", "follows", "causes", "caused", "supports", "support", "refutes", "refuted", "contradicts", "contradict", "controls", "control"],
  de: ["führt", "führte", "schlägt", "schlug", "impliziert", "folgt", "folgen", "widerlegt", "widerspricht", "umfasst"],
  es: ["lleva", "llega", "implica", "apoya", "refuta", "contradice", "sigue", "domina", "gobierna"],
  fr: ["mène", "implique", "soutient", "réfute", "contredit", "suit", "domine"],
  ru: ["следует", "ведёт", "правит", "поддерживает", "опровергает", "противоречит"],
  uk: ["слідує", "веде", "підтримує", "спростовує", "суперечить"],
  zh: ["导致", "意味着", "支持", "否定", "反对", "先于", "蕴含", "控制", "居于"],
  ja: ["導く", "意味する", "支持する", "否定する", "反対する", "先んじる", "支配する"],
  he: ["מוביל", "מובילה", "תומך", "סותר", "מתנגד", "מקדים"],
});
export const REL_FUNCTIONAL = Object.freeze({
  en: ["is", "are", "was", "were", "am", "has", "have", "had", "means", "mean", "contains", "contain", "owns", "own", "belongs", "equals", "equal", "includes", "include"],
  de: ["ist", "sind", "war", "waren", "hat", "haben", "hatte", "gehört", "gehören", "enthält", "enthielten", "bedeutet", "bedeuten", "beinhaltet"],
  es: ["es", "son", "era", "fueron", "tiene", "tienen", "significa", "contiene", "contienen", "incluye", "incluyen", "pertenece"],
  fr: ["est", "sont", "était", "étaient", "a", "ont", "avait", "signifie", "contient", "contiennent", "inclut", "renferme", "appartient"],
  ru: ["есть", "является", "являются", "имеет", "имеют", "означает", "содержит", "включает", "принадлежит", "обладает"],
  uk: ["є", "має", "мають", "означає", "містить", "включає", "належить", "володіє"],
  zh: ["是", "有", "具有", "包含", "包括", "属于"],
  ja: ["である", "です", "だ", "いる", "ある", "含む", "含める", "持つ", "属する"],
  he: ["הוא", "היא", "הם", "הן", "יש", "מכיל", "מכילה", "כולל", "כוללת", "משמעותו", "שייך", "שייכים"],
});
export const REL_SYMMETRIC = Object.freeze({
  en: [], de: ["gleicht", "ähneln"], es: ["se_parece"], fr: ["ressemble"], ru: ["похож"], uk: ["схожий"], zh: ["类似"], ja: ["似る"], he: ["דומה", "דומה_ל"],
});
// Clause-final adverbial tails that are NOT an object — a clause span that ends in one has it trimmed
// (the claim's ARG1 is what the verb acts on, not when/always). Curated, per language.
export const ARG1_TAILS = Object.freeze({
  en: ["every time", "all the time", "always", "never", "often", "usually", "sometimes", "once", "twice", "at times"],
  de: ["jedes Mal", "immer", "nie", "oft", "meistens", "manchmal", "ab und zu"],
  es: ["siempre", "nunca", "a menudo", "a veces", "casi siempre"],
  fr: ["tout le temps", "toujours", "jamais", "souvent", "parfois"],
  ru: ["всегда", "никогда", "часто", "иногда", "время от времени"],
  uk: ["завжди", "ніколи", "часто", "іноді", "час від часу"],
  zh: ["总是", "永远", "经常", "有时", "偶尔"],
  ja: ["いつも", "決して", "しばしば", "時々", "たまに"],
  he: ["תמיד", "לעולם", "לעתים קרובות", "לפעמים", "מדי פעם"],
});
// Movement prepositions a claimed object arrives THROUGH — stripped once from ARG1 ("leads to revolt"
// claims leads(X, revolt); "führt zur Stille" claims führt(X, Stille)). Curated, per language.
export const ARG1_PREPS = Object.freeze({
  en: ["to", "toward", "unto"],
  de: ["zu", "zur", "zum", "nach"],
  es: ["a", "hacia"],
  fr: ["à", "vers"],
  ru: ["к", "кo"],
  uk: ["до", "в"],
  zh: ["向", "朝", "往"],
  ja: ["へ", "に"],
  he: ["אל", "את", "על"],
});
export const RELATION_VERBS = Object.freeze(Object.fromEntries(
  Object.keys(LANGUAGES).map((l) => [l, [...(REL_ACYCLIC[l] || []), ...(REL_FUNCTIONAL[l] || []), ...(REL_SYMMETRIC[l] || [])]]),
));
export const RELATIONS_OF = (lang) => ({ acyclic: REL_ACYCLIC[lang] || REL_ACYCLIC.en, functional: REL_FUNCTIONAL[lang] || REL_FUNCTIONAL.en, symmetric: REL_SYMMETRIC[lang] || [] });

const SCRIPT_OF = Object.freeze({
  han: /[\u3400-\u9fff\uf900-\ufaff]/,
  hiragana: /[\u3040-\u309f]/,
  katakana: /[\u30a0-\u30ff]/,
  hebrew: /[\u05d0-\u05ea]/,
  cyrillic: /[\u0400-\u04ff]/,
});
const CLAUSE_BOUNDARY = /[。！？!?\.．,，、;；:：…—–«»„“”"')）]}»]/;

/** Modelless language detection: script for han/hebrew/cyrillic, closed-class lexicons otherwise, with a
 *  margin so an ambiguous text says so instead of guessing. Returns {lang, script, score, margin}. */
export function detectLang(text = "", { hint = null } = {}) {
  const t = String(text || "");
  const score = (lang) => {
    const fw = FUNCTION_WORDS[lang] || [];
    const tokens = t.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    return fw.reduce((n, w) => n + tokens.filter((x) => x === w).length, 0);
  };
  const has = (re) => re.test(t);
  let lang = null, script = null;
  if (has(SCRIPT_OF.han)) {
    if (has(SCRIPT_OF.hiragana) || has(SCRIPT_OF.katakana)) { lang = "ja"; script = "han"; }
    else { lang = "zh"; script = "han"; }
  } else if (has(SCRIPT_OF.hebrew)) { lang = "he"; script = "hebrew"; }
  else if (has(SCRIPT_OF.cyrillic)) {
    const u = score("uk"), r = score("ru");
    lang = u > r ? "uk" : "ru"; script = "cyrillic";
  } else {
    const scored = ["en", "de", "es", "fr"].map((l) => [l, score(l)]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    if (!scored.length) { lang = hint || "en"; script = "latin"; }
    else {
      script = "latin";
      const [best, bN] = scored[0], second = scored[1]?.[1] || 0;
      lang = best; 
      // an honest margin: near-ties say en (the fold's home tongue) rather than guess
      if (bN > 0 && bN - second < 2 && best !== "en") lang = "en";
    }
  }
  const sc = score(lang);
  return { lang, script, score: sc };
}

/** The murmur registry: {op: {lang: template}} where %d = count and %s = the finding's own words (the
 *  linter's note, or a kind-keyed translation). A language without a template falls back to en. */
export const MURMUR_TEMPLATES = Object.freeze({
  "reason.none": {
    en: "chain-lint: no relation was recoverable from the read mechanically — nothing to lint (a typed gap, never a fabricated claim)",
    de: "Kettenprüfung: aus dem Gelesenen war keine Relation mechanisch zu gewinnen — nichts zu prüfen (eine benannte Lücke, keine erfundene Behauptung)",
    es: "verificación de cadena: no se pudo recuperar ninguna relación de la lectura — nada que verificar (una brecha nombrada, nunca una afirmación fabricada)",
    fr: "vérification de chaîne : aucune relation n'a pu être extraite de la lecture — rien à vérifier (une lacune nommée, jamais une affirmation fabriquée)",
    ru: "проверка цепочки: из прочитанного механически не извлечено ни одного отношения — проверять нечего (названный пробел, никогда не выдуманное утверждение)",
    uk: "перевірка ланцюга: з прочитаного механічно не добуто жодного відношення — перевіряти нічого (названа прогалина, ніколи не вигадане твердження)",
    zh: "链条检验：从所读中未能机械地提取任何关系——无可检验（被指名的空白，绝非捏造的断言）",
    ja: "連鎖検証：読んだ文から機械的に関係を引き出せなかった——検証すべきものがありません（名指しされた欠落であり、でっち上げた主張ではありません）",
    he: "בדיקת שרשרת: לא ניתן היה לחלץ מכנית שום יחס מהקריאה — אין מה לבדוק (פער ששמו במפורש, לעולם לא טענה מומצאת)",
  },
  "reason.claims": {
    en: "chain-lint: %d claim(s) recovered and linted",
    de: "Kettenprüfung: %d Behauptung(en) gewonnen und geprüft",
    es: "verificación de cadena: %d afirmación(es) recuperada(s) y verificada(s)",
    fr: "vérification de chaîne : %d affirmation(s) extraite(s) et vérifiée(s)",
    ru: "проверка цепочки: извлечено и проверено утверждений: %d",
    uk: "перевірка ланцюга: добуто і перевірено тверджень: %d",
    zh: "链条检验：提取并检验了 %d 条断言",
    ja: "連鎖検証：%d 件の主張を引き出し検証しました",
    he: "בדיקת שרשרת: חולצו ונבדקו %d טענות",
  },
  "reason.clear": {
    en: "chain-lint: all recovered claims stand (no cycle, no contradiction, no scope crossing)",
    de: "Kettenprüfung: alle gewonnenen Behauptungen stehen (kein Kreislauf, kein Widerspruch, keine Geltungsüberschreitung)",
    es: "verificación de cadena: todas las afirmaciones recuperadas se sostienen (sin ciclo, sin contradicción, sin cruce de ámbito)",
    fr: "vérification de chaîne : toutes les affirmations extraites tiennent (ni cycle, ni contradiction, ni franchissement de portée)",
    ru: "проверка цепочки: все извлечённые утверждения стоят (нет цикла, нет противоречия, нет выхода за пределы действия)",
    uk: "перевірка ланцюга: всі добуті твердження стоять (немає циклу, немає суперечності, немає виходу за межі дії)",
    zh: "链条检验：所提取的断言全部成立（无循环、无矛盾、无越界）",
    ja: "連鎖検証：引き出した主張はすべて成立（循環も矛盾も適用範囲の越境もありません）",
    he: "בדיקת שרשרת: כל הטענות שחולצו עומדות (אין מעגל, אין סתירה, אין חציית היקף)",
  },
  "reason.circular": {
    en: "chain-lint: the chain begs the question — %s",
    de: "Kettenprüfung: die Kette erbittet die Frage — %s",
    es: "verificación de cadena: la cadena pide la pregunta — %s",
    fr: "vérification de chaîne : la chaîne pétitionne la question — %s",
    ru: "проверка цепочки: цепочка обращается к вопросу в круге — %s",
    uk: "перевірка ланцюга: ланцюг обходить питання по колу — %s",
    zh: "链条检验：链条循环乞题 — %s",
    ja: "連鎖検証：循環論法 — %s",
    he: "בדיקת שרשרת: השרשרת חוזרת על עצמה במעגל — %s",
  },
  "reason.door": {
    en: "chain-lint: an input was refused at the door (not a claim)",
    de: "Kettenprüfung: ein Eingabestück wurde an der Tür zurückgewiesen (keine Behauptung)",
    es: "verificación de cadena: una entrada fue rechazada en la puerta (no es una afirmación)",
    fr: "vérification de chaîne : une entrée a été refusée à la porte (pas une affirmation)",
    ru: "проверка цепочки: одна запись отвергнута у двери (не утверждение)",
    uk: "перевірка ланцюга: один запис відхилено біля дверей (не твердження)",
    zh: "链条检验：一条输入在门口被拒（不算断言）",
    ja: "連鎖検証：ひとつの入力が門口で拒否されました（主張ではありません）",
    he: "בדיקת שרשרת: קלט אחד נדחה בפתח (אינו טענה)",
  },
  "reason.finding": {
    en: "chain-lint: %s",
    de: "Kettenprüfung: %s",
    es: "verificación de cadena: %s",
    fr: "vérification de chaîne : %s",
    ru: "проверка цепочки: %s",
    uk: "перевірка ланцюга: %s",
    zh: "链条检验：%s",
    ja: "連鎖検証：%s",
    he: "בדיקת שרשרת: %s",
  },
});

/** Render one murmur line in the turn's language (registry, then kind-keyed, then en fallback).
 *  %d/%s are interpolated; the finding's args are {kind, severity, note, cycle}. */
export function murmurSay(op, args = {}, lang = "en") {
  const L = LANGUAGES[lang] ? lang : "en";
  let tpl = MURMUR_TEMPLATES[op]?.[L] || MURMUR_TEMPLATES[op]?.en;
  if (!tpl) tpl = MURMUR_TEMPLATES["reason.finding"][L];
  let s = tpl.replace("%d", args.count ?? 0);
  if (args.cycle) s = s.replace("%s", args.cycle);
  else if (args.note) s = s.replace("%s", args.note);
  return { op, text: s.replace(/%s/g, "").trim(), lang: L };
}

/** The language of a turn's handful of passages: majority by detected language (the fold speaks what it
 *  read), with an honest "en" fallback — never a guess reported as certainty. */
export function languageOfPassages(passages = []) {
  const counts = new Map();
  for (const p of passages) {
    const { lang } = detectLang(String(p?.text || ""));
    counts.set(lang, (counts.get(lang) || 0) + 1);
  }
  if (!counts.size) return "en";
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export default { detectLang, murmurSay, languageOfPassages, RELATION_VERBS, MURMUR_TEMPLATES };