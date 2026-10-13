// grammars.mjs — DECLARED grammar tables for five creoles (eval/creole/GRAMMAR-PREREG.md), written from creole sources, never copied
// from the lexifier. Haitian (hat), Nigerian Pidgin (pcm), Tok Pisin (tpi), Mauritian (mfe), Jamaican Patois (jam).
//   DECLARED, NOT MEASURED (Constitution II.11): every entry has a giver, named below; the author reversed none after the first run.
//   Registered only through withGrammars() for a falsification run. NEVER in production GRAMMAR — the user signs that off.
//
// GIVERS (every field cites one or more of these; "n×" is the entry's token count in the on-disk creole text, counted 2026-10-13):
//   [A]  APiCS Online, Michaelis/Maurer/Haspelmath/Huber (eds.) 2013, CC BY-SA/BY 4.0 — the feature tables (typology: which side an
//        article stands on, whether a copula exists) and the survey chapters (glossed examples), under
//        /Users/mlacy/Documents/3.0/live_priors-latest/11-multi-language/dialects-pidgins-creoles/apics/ :
//        Haitian = chapter 49 (Fattier, Dejean, DeGraff), Nigerian Pidgin = 17 (Faraclas), Tok Pisin = 22 (Smith/Siegel),
//        Mauritian = 55 (Baker/Kriegel), Jamaican = 08 (Farquharson).
//   [M]  CreoleVal MCTest Haitian and Mauritian translations (real questions with their stories) — .../creoleval/mctest/
//   [R]  CreoleVal relation_classification tpi.csv / jam.csv (Wikipedia-derived sentences, Wikidata-labelled) — real sentences
//   [H]  CreoleVal mt_mit_haiti ht_monolingual_sample.txt, tatoeba hat-eng, mt_kreolmorisien en-cr (Bible translations)
//   [N]  CreoleVal UD_Naija-NSC (spoken Nigerian Pidgin) and MasakhaNER pcm (news); khora pos-pcm.json / pos-hat.json (UD closed
//        classes: ADP DET PRON AUX CCONJ SCONJ PART), READ ONLY — the packs belong to the POS-projection ant
//   [U]  UNATTESTED in the on-disk text: the author's reading of the language (disclosed; `node eval/creole/battery.mjs --audit` lists
//        every table word the corpus never shows)
//   [P]  the six questions of eval/creole/prompts.json
// A "homograph" note marks a word that fills two roles the schema cannot tell apart (the schema has one list per role, not one
// reading per position): the table lists it where the language uses it and the finding is reported, not hidden.
const F = (a) => Object.freeze(a);
// the declared Latin-script leet table (same for every Latin-script table in omnilingual/grammars.mjs; GRAMMAR.en carries its own)
const LEET = { "4": ["a"], "3": ["e"], "1": ["i", "l"], "0": ["o"], "5": ["s"], "7": ["t"], "8": ["b"], "@": ["a"], "$": ["s"] };
const YEAR = Object.freeze({ minDigits: 3, maxDigits: 4 });

// ══ HAITIAN (hat) — lexifier French; French is NOT its grammar ═══════════════════════════════════════════════════════════════════
export const HAT = Object.freeze({
  leet: LEET,
  giver: "APiCS ch.49 + CreoleVal MCTest Haitian + ht_monolingual_sample + UD Haitian_Creole-Adolphe closed classes (2026-10-13); declared, not measured",
  interrogatives: F([
    { words: ["ki", "moun"], slot: "person" },      // [A] §8 "ki moun ('who?')"; [M] "Ki moun ki te ale nan plaj la avèk Sally ?" (2×)
    { words: ["kiyès"], slot: "person" },           // [M] "Kiyès ki t ap fete fèt li ?" (12×); [N] UD kiyès PRON
    { words: ["kilès"], slot: "person" },           // [M] kreyol2 spelling of the same word (16×)
    { words: ["ki", "kote"], slot: "place" },       // [A] §8 "ki kote ('where?')"; [M] "Ki kote Todd ap viv ?"
    { words: ["ki", "bò"], slot: "place" },         // [A] §8 "ki bò ('where?')"; [M] "Ki bò lekòl la te fè piknik lan ?"
    { words: ["kote"], slot: "place" },             // [A] §9 "interrogative adverbs (kote, ki lè, poukisa …)"; 196×
    { words: ["ki", "lè"], slot: "time" },          // [A] §8 "ki lè ('when?')"
    { words: ["konbyen"], slot: "quantity" },       // [M] "Konbyen zanmi ki te vini nan fèt Jessie a ?" (41×)
    { words: ["konben"], slot: "quantity" },        // [A] §5 ex.(2) "Konben moun ki la nan klas la ?"
    { words: ["ki", "sa"], slot: "thing" },         // [A] §8 "ki sa ('what?')"; [M] 7×
    { words: ["ki"], slot: "thing" },               // [A] §8 "(ki) sa — ki is optional in focus position"; [P] "Ki kapital Ayiti?"
  ]),
  // [A] feature 73 "invariant copula" (se) for NPs; features 74/75 "no copula" for adjectives and locatives — the ABSENCE is not
  // expressible: a table lists the copulas that exist, not the sentences that have none (reported in GRAMMAR-RESULTS.md)
  copulas: F(["se", "ye"]),                         // [A] ex.(1) "Eskòpyon se yon bèt …"; [M] "Roger se te yon krikèt" (880×); ye = clause-final copula, [M] "… gwo rèv Ana a te ye ?" (54×)
  // TAM markers stand between the subject and the verb and are never a referent (they are NOT copulas); [A] §6 Table 4
  auxiliaries: F(["se", "ye", "te", "t", "ap", "pral", "prale", "apral", "va", "av", "ava", "ka", "kapab", "dwe", "fin", "fèk", "sot", "ta"]),
  // homograph: "a" is both the future marker (a/va/ava) and the postposed article — left out of the lists (it would read as a tense)
  tense: Object.freeze({ present: ["se", "ye", "ap"], past: ["te", "t"], future: ["pral", "prale", "apral", "va", "av", "ava"] }),
  // [A] ex.(20) "Elifèt p(a) ap manje"; [M] "pa t … okenn/ankenn/pèsonn/janm" (APiCS ex.(102) negative concord); [N] UD pa ADV 612
  negation: F(["pa", "p", "janm", "okenn", "ankenn", "pèsonn", "anyen", "ni"]),
  clauseWords: F(["ki", "ke", "depi"]),            // [A] §8 relative "ki"; [M] "Aktivite ke Sally prefere a …" (ke 214×); depi ~ since (62×)
  // [H] "Leta d Ayiti", "Inivèsite Leta d Ayiti": the only overt linker of a possessor; the usual order possessum-possessor is JUXTAPOSED
  // ("kay nonm nan", [A] feature 2/38 "no marking") and has no token for the schema to read (homograph: "de" is also the numeral 'two')
  governs: F(["d", "de"]),
  governsAtHead: F([]),
  roleVerbs: F(["vin", "genyen"]),                  // [M] "pou l vin yon chanpyon" (vin 232×), "Ana te genyen chanpyona eple a" (genyen 138×)
  placeVerbs: F(["fèt", "viv", "rete", "nesans"]),  // [H] "ki te fèt an Ayiti 1762"; [M] "Todd t ap viv nan yon katye"; "Mikaben te pran nesans" (nesans 5×)
  prepositions: F(["nan", "an", "sou", "ak", "avèk", "avè", "pou", "depi", "apre", "anvan", "anba", "ant", "pami", "bò"]),   // [N] UD ADP forms; [M]
  countHeads: F(["kantite", "nonb"]),               // [M] kantite 26×; [H] nonb 3×
  subordinators: F(["lè", "kote", "pandan", "paske", "si", "apre", "anvan", "jiskaske", "byenke", "depi"]),   // [N] UD SCONJ: lè 281, paske 80, si 160 …
  temporal: F(["janvye", "fevriye", "mas", "avril", "me", "jen", "jiyè", "out", "septanm", "oktòb", "novanm", "desanm",
    "lendi", "madi", "mèkredi", "jedi", "vandredi", "samdi", "dimanch", "prentan", "ete", "otòn", "ivè"]),     // [H] "12 janvye 2010", "26 avril 1963"; weekdays 1–6×
  placeNouns: F(["kapital", "vil", "peyi", "depatman", "vilaj", "zile", "mòn", "rivyè", "lanmè", "komin", "pwovens"]),   // [P] kapital; [H] peyi 79×, vil 27×
  possessiveRelatives: F([]),
  indefinites: F(["yon"]),                          // [A] §5 "the indefinite determiner yon (… not the numeral youn)"
  containment: F(["nan", "an"]),                    // [H] "ki te fèt an Ayiti"; [M] "nan yon katye" (nan 2096×, an 750×)
  agentBy: "pa",                                     // [N] UD pa ADP 48× — the passive agent; homograph with the negator "pa" (reported)
  agentStops: F(["nan", "an", "sou", "pandan", "ant", "depi", "jiskaske", "pou", "apre", "anvan", "anba", "avèk"]),
  // the postposed definite article in its five contextual variants and the plural "yo" ([A] §5: ti nèg la, zo a, pon an, fanm nan,
  // mont lan, ti nèg yo) STAND AFTER the noun; the schema's `determiners` is read as preposed (reported); "yon" is preposed
  determiners: F(["yon", "la", "lan", "a", "an", "nan", "yo", "sa"]),
  hedges: F(["petèt", "si", "sipoze", "ta", "sanble", "kwè"]),   // [A] ta (= te+a, conditional); [H] petèt 14×, sanble 39×, kwè 16×, sipoze 1×
  ordinals: F(["dezyèm", "twazyèm", "katriyèm", "senkyèm", "sizyèm", "setyèm", "wityèm", "nevyèm", "dizyèm", "pwochen"]),   // [A] "'first' is suppletive"; [H] 27/22/4/1/7×
  coordinators: F(["e", "epi", "men", "oswa", "ni", "oubyen"]),
  numerals: F(["zewo", "youn", "de", "twa", "kat", "senk", "sis", "sèt", "uit", "nèf", "dis", "onz", "douz", "trèz", "katòz", "kenz", "sèz",
    "disèt", "dizuit", "diznèf", "ven", "trant", "karant", "senkant", "swasant", "san", "mil", "milyon", "milya"]),   // [A] "dizuit liv"; [H] counts 1–59×
  magnitudes: F(["san", "mil", "milyon", "milya"]),
  year: YEAR, maxRun: 4,
});

// ══ NIGERIAN PIDGIN (pcm) — lexifier English; English is NOT its grammar ═════════════════════════════════════════════════════════
export const PCM = Object.freeze({
  leet: LEET,
  giver: "APiCS ch.17 (Faraclas) + UD_Naija-NSC + MasakhaNER pcm (BBC Pidgin news) + khora pos-pcm closed classes (2026-10-13); declared, not measured",
  interrogatives: F([
    { words: ["how", "many"], slot: "quantity" },  // [N] "how much de dey give una for una bill ?" (the lexifier phrase, kept); [U] "how many"
    { words: ["how", "much"], slot: "quantity" },
    { words: ["wetin"], slot: "thing" },            // [A] §7 "wé̱tíng 'what?'"; [P] "Wetin be di capital of Nigeria?"; [N] wetin PRON 360×
    { words: ["which"], slot: "thing" },            // [N] which DET 41×
    { words: ["who"], slot: "person" },             // [A] "hu"; [N] who PRON 43×
    { words: ["hu"], slot: "person" },
    { words: ["wia"], slot: "place" },              // [A] "wé / wéplés 'where?'"; [N] wia 49×
    { words: ["wen"], slot: "time" },               // [N] wen SCONJ 60×; [A] "hústáym 'when?'"
  ]),
  // [A] §6 "separate forms for the identity copula (bì), the locative/existential copula (de) and the copular highlighter (nà)";
  // [N] na AUX 1604×, be AUX 689×, dey AUX 2497× (homograph: "dey" is also the progressive marker; "na" also the cleft highlighter)
  copulas: F(["na", "be", "dey"]),
  auxiliaries: F(["na", "be", "dey", "don", "go", "bin", "fit", "wan", "make", "gats", "suppose", "must"]),   // [A] Table 4; [N] AUX counts
  // homograph: "go" is also the verb 'go' (VERB 763×) — it reads a motion sentence as future (tense is the caller's decision, not a witness)
  tense: Object.freeze({ present: ["na", "be", "dey"], past: ["bin", "don"], future: ["go"] }),
  negation: F(["no", "nor", "neva", "never", "nobody", "nothing", "noting"]),   // [A] §7 "no … never replaces no+don"; [N] no AUX 1265×, nor 82×, neva 36×
  clauseWords: F(["wey", "sey", "say", "who", "which"]),   // [A] §7 relativizer "we̱", complementizer "se"; [N] wey SCONJ 1252×, sey 1446×
  governs: F(["of"]),                               // [N] "Chief Executive Officer of Visionage …" (1271×); "for" is the general adposition (left out)
  governsAtHead: F([]),
  roleVerbs: F(["become", "win"]),                  // [U] — one attested "become" (1×); the table is deliberately short
  placeVerbs: F(["born", "live", "stay"]),          // [N] "pipo wey dey live for Umuahia"; [U] born, stay
  prepositions: F(["for", "from", "of", "wit", "to", "inside", "ontop", "near", "around", "afta", "before", "like", "by", "about", "at", "on", "in", "under", "between", "as", "outside"]),
  countHeads: F(["numba", "number", "total", "amount"]),   // [N] "about 20 for numba"
  subordinators: F(["wen", "becos", "because", "if", "afta", "after", "before", "bifor", "until", "while", "as", "since", "wheder", "weda"]),
  temporal: F(["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "christmas", "easter"]),   // [N] 13/3/17/13/32/17/2/1/3/4/3/6; days 25–29×
  placeNouns: F(["capital", "state", "city", "town", "kontri", "country", "village", "area", "community", "island", "river", "sea"]),
  modalMonths: F(["may"]),                          // "may" the month vs the modal (kept from GRAMMAR.en's field; the month is the attested use, 32×)
  numberSigns: F(["no", "nomba", "numba"]),
  possessiveRelatives: F([]),
  indefinites: F(["one", "wan", "som", "some", "won"]),   // [A] §5 "(e) wo̱n; (f) so̱m"
  containment: F(["for", "inside"]),                // [A] §7 "a general adposition fò̱r — 'in/at/on/inside/beside/near the house'" (for 2111×)
  // [A] feature 90: "absence of passive construction" — no agentBy is declared; the schema's passive-agent rule never fires
  agentStops: F(["for", "from", "wit", "afta", "before", "inside", "ontop", "around", "near", "under"]),
  determiners: F(["di", "dis", "dat", "dese", "dose", "my", "mah", "ma", "meh", "your", "yor", "our", "awa", "dia", "deir"]),   // [A] §5 "dì … dis, dat"; [N]
  hedges: F(["maybe", "perhaps", "if"]),            // [N] maybe 7×, perhaps 1×, if 108×
  ordinals: F(["second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "next"]),   // [A] "no̱mba tu ~ se̱kond"; [N] 24/12/3/5×
  coordinators: F(["and", "or", "nor", "but"]),     // [A] §7 "ànd, bò̱t, ò̱, ayda"; [N] and 1356×, but 172×, or 102×
  numerals: F(["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen",
    "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
    "hundred", "thousand", "million", "billion", "tu", "tri", "fayv", "siks"]),   // [A] §5 "tu, tri, fo̱r, fayv, siks"; [N] one 329×, two 98×, million 24×
  magnitudes: F(["hundred", "thousand", "million", "billion", "trillion"]),
  year: YEAR, maxRun: 4,
});

// ══ TOK PISIN (tpi) — lexifier English; the predicate marker "i" and the possessor marker "bilong" are its own ══════════════════════
export const TPI = Object.freeze({
  leet: LEET,
  // a declared light stemmer (the omnilingual precedent): [A] §6.2 the transitive suffix -im (luk/lukim, kuk/kukim), §5 the adjective
  // suffix -pela (gut/gutpela, bik/bikpela, wan/wanpela); longest first, a stem of at least 3 letters kept
  minStem: 3, suffixes: F(["pela", "im"]),
  giver: "APiCS ch.22 + CreoleVal relation_classification tpi.csv (real Wikipedia sentences) + tatoeba tpi (2026-10-13); declared, not measured",
  interrogatives: F([
    { words: ["wanem", "taim"], slot: "time" },    // [A] §8 "wanem taim 'when'"
    { words: ["wanem"], slot: "thing" },            // [A] §8 "wanem 'what' (< what name)"; [P] "Wanem em kapital bilong Papua Niugini?"; wanem 180×
    { words: ["husat"], slot: "person" },           // [A] §8 "husat 'who' (< who's that)"; husat 33×
    { words: ["we"], slot: "place" },               // [A] §8 "we 'where'"; we 8× — also the relative "we" (homograph)
    { words: ["hamas"], slot: "quantity" },         // [N-tatoeba] "Hamas yia long wok painia" (2×)
  ]),
  // [A] feature 73 "no copula" for NPs, 75 "invariant copula" for locatives; [R] "Budapest em i kapitol bilong Hangari", "Stockholm i
  // kapitol bilong Suwidan", "Kapitol bilong Slovakia i Bratislava", "Brussels emi kapitol", "Singapo i stap wanpela kantri". The
  // predicate marker "i" (2029×) precedes EVERY verb: it is declared as a pivot because the equational sentences have no other
  // (homograph: "em" is the 3sg pronoun; "i" is the predicate marker — neither is a copula in the sense the schema assumes)
  copulas: F(["em", "emi", "i", "stap", "istap"]),
  auxiliaries: F(["i", "em", "emi", "bin", "bai", "pinis", "save", "sa", "mas", "ken", "inap", "laik", "wok", "stap", "istap"]),   // [A] §6.3 Table 4
  // the present is zero-marked ([A] "many verbs with past time reference are unmarked"): only the real markers are declared
  tense: Object.freeze({ present: ["stap", "istap"], past: ["bin"], future: ["bai"] }),
  negation: F(["no", "nogat"]),                     // [A] §6.3 "no ken", "no inap" ex.(31)-(32); no 246×, nogat 20×
  clauseWords: F(["husat", "we"]),                  // [A] §9 relativizers "husat" and "we" ex.(36)-(37)
  governs: F(["bilong"]),                           // [A] §5 "possession is indicated by bilong between possessum and possessor": mama bilong dok; bilong 1102×
  governsAtHead: F([]),
  roleVerbs: F(["kamap", "winim"]),                 // [N-tatoeba] kamap 113×, winim 27×
  placeVerbs: F(["stap", "istap", "bon", "karim"]), // [R] "Brisbin stap wanpela biktaun …"; [U] bon; karim 16× ('bear')
  prepositions: F(["long", "bilong", "wantaim", "olsem", "insait", "antap", "klostu", "bihain", "bipo"]),   // [A] §7 "four simple prepositions: long, bilong, wantaim, olsem"
  countHeads: F(["namba"]),                         // 23×
  subordinators: F(["taim", "sapos", "bikos", "bihain", "bipo", "maski", "we"]),   // [A] §9 "bipo, bihain, long wanem or bikos, long taim, sapos"
  temporal: F(["janueri", "februeri", "mas", "epril", "me", "jun", "julai", "ogas", "septemba", "oktoba", "novemba", "desemba",
    "mande", "tunde", "trinde", "fonde", "fraide", "sarere", "sande"]),   // [R] "Sanna Marin ( Novemba 16 1985 )"; [A] "lo Sarere" ex.(12); homograph: "mas" is 'must'
  placeNouns: F(["kapitol", "kapital", "siti", "taun", "biktaun", "provins", "kantri", "ailan", "ples", "hailans", "distrik"]),   // [R] kapitol 18×, kantri 41×, provins 23×
  possessiveRelatives: F([]),
  indefinites: F(["wanpela"]),                      // [A] §5 "wanpela may act as an indefinite article"
  containment: F(["long", "insait"]),               // [A] "long 'to, at, in'"; [R] "wanpela provins long Papua Niugini"
  // [A] feature 90 "absence of passive construction": no agentBy
  agentStops: F(["long", "bilong", "wantaim", "olsem", "bihain", "bipo", "insait", "klostu"]),
  // [A] §5 "no definite article"; "ol" is the PRE-posed plural particle, "dispela" the demonstrative
  determiners: F(["dispela", "displa", "wanpela", "olgeta", "sampela", "narapela", "arapela", "ol"]),
  hedges: F(["ating", "sapos"]),                    // [N-tatoeba] ating 24×; sapos 62×
  ordinals: F(["nambatu", "nambatri", "nambafo"]),  // [U] — "namba tu" is attested only as a free phrase (namba 23×); declared short
  coordinators: F(["na", "o", "tasol"]),            // [A] §9 "coordinating conjunctions are na, o and tasol"; na 661×
  numerals: F(["wan", "tu", "tri", "foa", "fo", "faiv", "faif", "sikis", "seven", "et", "nain", "ten", "tupela", "tripela", "fopela", "faipela",
    "sikispela", "sevenpela", "etpela", "nainpela", "tenpela", "handet", "tausen", "taosen", "milien"]),   // [R] tu 51×, wan 42×, tupela 27×
  magnitudes: F(["handet", "tausen", "taosen", "milien"]),
  year: YEAR, maxRun: 4,
});

// ══ MAURITIAN (mfe) — lexifier French; "-la" is its postposed article, written WITH A HYPHEN ═════════════════════════════════════
export const MFE = Object.freeze({
  leet: LEET,
  // the postposed definite article is written hyphen-joined to its noun ("fet-la", "lavil-la", "kamarad-la": [M]) and the tokenizer keeps
  // a hyphen-joined form whole; a declared suffix stemmer is the one door the schema has to make "fet-la" meet "fet" ([A] §5.2 la,
  // "obligatorily NP-final"; §9.3 focus suffix -mem). Not a stemmer in the linguistic sense — a workaround, reported as such.
  minStem: 3, suffixes: F(["-la", "-mem"]),
  giver: "APiCS ch.55 (Baker/Kriegel) + CreoleVal MCTest Mauritian + mt_kreolmorisien en-cr (2026-10-13); declared, not measured",
  interrogatives: F([
    { words: ["ki", "sann-la"], slot: "person" },  // [M] "Ki sann-la ti pe fet so laniverser ?" (18×)
    { words: ["ki", "sanla"], slot: "person" },    // [A] §9.2 "ki senla (or sanla)"
    { words: ["ki", "senla"], slot: "person" },
    { words: ["kisann-la"], slot: "person" },      // [M] "Kisann-la ti al bor lamer avek Sally ?" (2×)
    { words: ["kisannla"], slot: "person" },       // [H] "kisannla sa ?" (17×)
    { words: ["ki", "kantite"], slot: "quantity" },// [M] "Ki kantite kamarad ti vinn fet Jessie ?" (12×)
    { words: ["konbien"], slot: "quantity" },      // [M] "Konbien letan zen koup-la ti bizin …" (3×)
    { words: ["komye"], slot: "quantity" },        // [A] §6 "Kómye kán li kapàv kùpe par zùr ?"
    { words: ["kot"], slot: "place" },             // [M] "Kot Todd reste ?", "Kot nou ti ale ?" (149×); [P] — the survey's chapter has no where-word
    { words: ["kan"], slot: "time" },              // [U] as an interrogative ("kan" 208× is the subordinator 'when' — homograph)
    { words: ["ki"], slot: "thing" },              // [A] §9.2 "ki 'who, what' … moved to sentence-initial position"; [P] "Ki kapital Moris?"
  ]),
  // [A] feature 73 "NO COPULA" for NPs, adjectives and locatives ("Zórz en bòṅ profesèr" ex.(22); [M] "Ana ti enn tifi intelizan");
  // "se" is real but rare (23×): [H] "Premie sa douz disip-l se Simon, so ti-nom Pier."; "ète" is the dummy copula of FRONTED predicates
  // ([A] §6 ex.(10), §9.2 ex.(27)). The zero copula — the ordinary equational sentence — is not expressible.
  copulas: F(["se", "ete"]),
  auxiliaries: F(["ti", "finn", "fin", "in", "pe", "pu", "va", "ava", "ete", "se", "kapav", "bizin"]),   // [A] §6 Table 5: ti, fin/in/'n, pe, a/va/ava, pu; kapav, bizin
  tense: Object.freeze({ present: ["ete", "se", "pe"], past: ["ti", "finn", "fin", "in"], future: ["pu", "va", "ava"] }),
  negation: F(["pa", "pena", "napa", "pa'n", "okenn", "personn", "zame", "ni"]),   // [A] §6 "pa follows the subject … p'èna, pà'n"; [M] pa 433×, pena 30×
  clauseWords: F(["ki"]),                           // [A] §5.2 "the relative pronoun ki"; ki 1051×
  // no overt genitive linker ([A] feature 2: both orders; 38: "no marking"); the possessor-before-possessum order uses "so"
  // ("Sally so vakans lete", [M]) which is NOT a governs relation — it needs the possessiveSuffix regex, whose 3-character window
  // misfires on every "so…" word (sorti 65×): not declared (reported)
  governs: F([]),
  governsAtHead: F([]),
  roleVerbs: F(["vinn", "gagn"]),                   // [H] vinn 144×, gagn 117×
  placeVerbs: F(["viv", "reste", "res", "abite", "ne"]),   // [M] "Todd ti viv dan enn ti lavil", "Kot Jenny ti abite"; ne ('born') 13×
  prepositions: F(["dan", "lor", "avek", "ar", "depi", "apre", "avan", "pandan", "par", "ziska", "devan", "deryer", "pre", "andeor", "anba", "pou"]),
  countHeads: F(["kantite", "nomb", "total"]),      // [M] kantite 12×
  subordinators: F(["kan", "ler", "si", "parski", "apre", "avan", "pandan", "depi", "ziska", "kot", "akoz", "malgre", "pwiske"]),   // [A] §8 "kan, si, parskì/akòz, àpre, avàṅ"
  // homograph: "me" is the month 'May' AND the conjunction 'but' (186×) — left to the conjunction, the month is not declared
  temporal: F(["zanvie", "fevriye", "mars", "avril", "zin", "zilye", "out", "septam", "oktob", "novam", "desam",
    "lindi", "mardi", "merkredi", "zedi", "vandredi", "samdi", "dimans"]),   // [M]/[H] zanvie 1×, mars 14×, septam 3×, novam 1×, desam 2×; weekdays 1–4×
  placeNouns: F(["kapital", "lavil", "pei", "pays", "vilaz", "lil", "distrik", "provins", "rivier", "lamer", "montayn", "sato"]),   // [P] kapital (0× on disk); [H] lavil 47×
  possessiveRelatives: F([]),
  indefinites: F(["enn", "en"]),                    // [A] §5.3 "the indefinite article en"; enn 1008× (homograph: also the numeral 'one')
  containment: F(["dan"]),                          // [M] "dan enn ti lavil", [H] "dan lavil Magadan" (791×)
  agentBy: "par",                                    // [H] "zot ete par seki zot fer" — [U] as an agent marker
  agentStops: F(["dan", "lor", "avek", "ar", "depi", "apre", "avan", "pandan", "ziska", "devan", "deryer", "pre", "pou"]),
  determiners: F(["enn", "en", "sa", "bann", "ban", "so", "mo", "to", "nou", "zot", "la"]),   // [A] §5 "ban, so, sa …, -la NP-final"
  hedges: F(["si", "sipoze", "petet"]),             // [H] sipoze 10×, si 120×; [U] petet
  ordinals: F(["dezyem", "trwaziem", "katriem", "sinkiem", "siziem", "setiem", "uitiem", "neviem", "diziem", "prosin"]),   // [H] trwaziem 6×, prosin 2×; others [U]
  coordinators: F(["e", "ek", "me", "be", "ubyen", "ni"]),   // [A] §8 "e, be, me, ubyeṅ"; "ek" nominal conjunction
  numerals: F(["zero", "de", "trwa", "kat", "sink", "sis", "set", "uit", "nef", "dis", "onz", "douz", "trez", "katorz", "kenz", "sez",
    "ven", "trant", "karant", "senkant", "swasant", "san", "mil", "milyon"]),   // [H] trwa 25×, sink 21×, san 36×; "enn" is NOT declared (indefinite article)
  magnitudes: F(["san", "mil", "milyon"]),
  year: YEAR, maxRun: 4,
});

// ══ JAMAICAN PATOIS (jam) — lexifier English; written in at least three orthographies (Cassidy "iich ier", Wikipedia "ina", "inna") ══
export const JAM = Object.freeze({
  leet: LEET,
  giver: "APiCS ch.08 (Farquharson) + CreoleVal relation_classification jam.csv (real Wikipedia sentences) + tatoeba jam-eng (2026-10-13); declared, not measured",
  interrogatives: F([
    { words: ["wa", "taim"], slot: "time" },       // [A] §9 "wen ~ wa-taim 'when'"
    { words: ["wich", "paat"], slot: "place" },    // [A] §9 "wich-paat ~ we(-paat) 'where'"
    { words: ["weh", "paat"], slot: "place" },
    { words: ["how", "many"], slot: "quantity" },  // [U] the lexifier phrase ("how" 2×)
    { words: ["how", "much"], slot: "quantity" },
    { words: ["uu"], slot: "person" },             // [A] §9 "uu 'who'"; uu 3×, huu 1× ("a huu kot i")
    { words: ["huu"], slot: "person" },
    { words: ["hu"], slot: "person" },
    { words: ["wen"], slot: "time" },              // [A] §9; wen 8×
    // ONE reading per form: "weh" is both 'what' ([A] "wa/we 'what'"; [P] "Weh a di capital a Jamaica?") and 'where' ([N-tatoeba]
    // "Weh yuh did deh ?"); the schema cannot hold both for one word — 'what' is declared because it is the prompt (reported)
    { words: ["weh"], slot: "thing" },
    { words: ["wa"], slot: "thing" },
    { words: ["we"], slot: "thing" },
  ]),
  // [A] feature 73 "invariant copula" (a) for NPs, 74 "no copula" for adjectives, 75 "variable copula" for locatives (de/deh);
  // [R] "Athens a di capital fi Greece", "Sofia ah di capital fi Bulgaria", "Jack Sherach use to bi di president ah France".
  // homograph: "a" is the copula, the focus marker, the preposition 'of' ("di capital a Portugal"), the locative 'at' and the
  // progressive — one word, five roles, one list. "name" ("Di capital a Portugal name Lisban", [R]) is a copula-like verb and is
  // NOT declared: as a pivot it would read every "di name a …" as an equational sentence.
  copulas: F(["a", "ah", "iz", "bi", "de", "deh"]),
  auxiliaries: F(["a", "ah", "iz", "bi", "de", "deh", "wehn", "did", "bin", "don", "ago", "goo", "wi", "uda", "kuda", "shuda", "wuda", "mos", "mosa",
    "maita", "kyahn", "kyaan", "afi", "hafi", "use", "to"]),   // [A] §6 Table 5; [R] "use to bi" — both words belong to one habitual-past construction
  tense: Object.freeze({ present: ["a", "ah", "iz", "de", "deh"], past: ["wehn", "did", "bin", "don"], future: ["ago", "goo", "wi"] }),
  negation: F(["no", "nuh", "neva", "nobadi", "notn", "nof"]),   // [A] §6/§7 "no" before the TMA marker; ex.(12) nobadi, (13) notn; no 22×, nuh 2×; [U] neva
  clauseWords: F(["weh", "we", "se"]),              // [A] §5 "a place where"; §8 "se … finite complementizer"
  governs: F(["fi", "fe", "a", "ah"]),              // [R] "capital fi Greece" (fi 65×), "capital a Portugal"; [A] ex.(33) "di bag a manggo"; homograph: a/ah are copulas
  governsAtHead: F([]),
  roleVerbs: F([]),                                  // no attested role verb in the on-disk text; the rule simply never fires (reported)
  placeVerbs: F(["born", "bon", "liv", "stay"]),    // [U]
  prepositions: F(["ina", "inna", "fi", "fe", "wid", "pan", "pon", "pahn", "frah", "from", "fram", "bout", "afta", "ova"]),   // [R] ina 106×, inna 31×, wid 57×
  countHeads: F(["numba", "nomba", "amount", "total"]),   // [R] "atomic numba 12" (12×)
  subordinators: F(["wen", "afta", "ef", "kaaz", "bikaaz", "az", "bifuo", "til", "weh", "we"]),   // [A] ex.(41) "kaaz"; [R] wen 8×, ef 7×, kaaz 15×
  temporal: F(["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]),   // [U] lexifier forms — no month is attested in the on-disk jam text
  placeNouns: F(["capital", "kapital", "country", "countri", "cuntry", "contri", "city", "citi", "siti", "province", "provins", "municipality",
    "monicipality", "town", "island", "ailan"]),   // [R] capital 20×, country/countri/cuntry 8/7/4×, city 7×, monicipality 6×
  possessiveRelatives: F([]),
  indefinites: F(["wan", "wah", "whaan", "wahn", "one"]),   // [A] §5 "wahn"; [R] "a wan countri" (27×), "a wah chemical element" (54×), "a whaan city"
  containment: F(["ina", "inna"]),                  // [R] "inna Germany", "ina Africa"; the locative "a" is left to the copula list (homograph)
  // [A] feature 90: "passive without verbal coding" — no agentBy
  agentStops: F(["ina", "inna", "fi", "wid", "pan", "from", "frah", "afta"]),
  determiners: F(["di", "d", "the", "dis", "dat", "wan", "wah", "whaan", "wahn", "one"]),   // [A] §5 "the definite article (d)i"; [R] di 219×
  hedges: F(["maita", "mosa", "mos", "uda", "kuda", "wuda", "shuda", "ef"]),   // [A] Table 5 "mos(a), maita epistemic; uda conditional"
  ordinals: F(["sekan", "tod", "fuot", "fif", "sebm", "iet", "naint", "tent"]),   // [A] §5 "fos, sekan, tod, fuot, fif, siks, sebm, iet, naint, tent"
  coordinators: F(["an", "ahn", "and", "bot", "but", "or"]),   // [A] §8 "a(h)n"; [R] an 23×, bot 8×
  numerals: F(["tuu", "chrii", "chri", "fuo", "fuor", "faiv", "siks", "sebm", "iet", "nain", "ten", "milian", "milyan"]),   // [A] §5 "wan, tuu, ch(r)ii, fuo(r), faiv, …"; milian 9×
  magnitudes: F(["milian", "milyan", "hondred", "tousan"]),
  year: YEAR, maxRun: 4,
});

export const CREOLES = Object.freeze({ hat: HAT, pcm: PCM, tpi: TPI, mfe: MFE, jam: JAM });
export const LEXIFIER = Object.freeze({ hat: "fr", mfe: "fr", pcm: "en", tpi: "en", jam: "en" });

// ══ FUNCTION WORDS — the second door ═════════════════════════════════════════════════════════════════════════════════════════════
// askFrame/bindSentence need `fw`, the language's function-word set (functionWordsOf → fold-chat-function-words.js, generated from the
// khora's UD POS packs). It has NO entry for any creole, so a table alone does not read: the pipeline ends at `no_grammar_for_language`
// (measured by the battery's no-table control). The schema has no field for pronouns or particles, so the set is declared here, apart
// from the table. hat and pcm: the khora pack rule (≥5 tokens, ≥50% closed-class UPOS) applied to pos-hat.json / pos-pcm.json,
// FROZEN 2026-10-13 — what production would get by regenerating fold-chat-function-words.js — plus the declared extras below; tpi, mfe,
// jam have no UD pack: declared from [A] pronoun tables and the corpus's most frequent closed-class forms.
const UD_HAT = "yo pou ki te nan l nou sa n a yon ap ak li se w an la e ka lè sou t tout ou epi men k si m dwe pral oswa kèk èske de ta paske kòm san mwen kont pandan y ann youn depi apre avèk anba avè lan plizyè chak ni antanke toutpandan konsènan okenn tankou devan grasa anvan byenke nenpòt kèlkeswa olye anyen piske akoz anvè ke kit lefètke dèske tank etandone pami pèsonn ant pifò sila selon jiskaske kiyès dèyè kòmsi malgre oubyen toutotan".split(" ");
const UD_PCM = "dey go i di you na no sey for e wey am we de be con and dat dem dis to me don make im of my o if your like as but wetin fit because all inside us una in some on our from meh deir sef a or before up she about everybody is with at bin dose out after down any wit by wen it never sha everyting anoder anyting mah are which moh her will must every dese outside who not someting abi since the everything once noting anoda ma into till wheder around shey mey ni something n't until what anybody nobody was yourself through ba mysef yoursef over can gats anything near myself oursef dan while wheda except somebody imsef 's may nna under plus 'm each nothing that dough against during ontop sometin weda self were without oders between demsef he himsef bah it's him upon sotay anyone within both unto everytin behind nko should mahnsef".split(" ");
export const FW = Object.freeze({
  hat: F([...new Set([...UD_HAT, "kilès", "konben", "ye", "p", "janm", "ankenn", "prale", "apral", "va", "av", "ava", "fèk", "sot", "kapab", "fòk", "mèt", "petèt", "pi", "lòt", "menm", "sipoze", "kwè", "sanble", "pa"])]),
  pcm: F([...new Set([...UD_PCM, "hu", "wia", "wich", "nor", "neva", "how", "when", "why", "tu", "tri", "won", "nomba"])]),
  tpi: F(["i", "long", "ol", "bilong", "na", "em", "emi", "olsem", "yumi", "yu", "mi", "mipela", "yupela", "en", "dispela", "displa", "wanpela", "wanem", "husat", "we",
    "no", "nogat", "o", "tasol", "sapos", "bai", "bin", "pinis", "save", "sa", "mas", "ken", "inap", "laik", "wok", "stap", "istap", "olgeta", "sampela",
    "narapela", "arapela", "nau", "yet", "wantaim", "bihain", "bipo", "insait", "antap", "klostu", "bikos", "ating", "maski", "tumas", "moa", "orait", "hamas", "taim"]),
  mfe: F(["ti", "li", "zot", "ki", "enn", "en", "pou", "bann", "ban", "dan", "e", "so", "la", "pa", "mo", "sa", "ek", "pe", "lor", "ena", "to", "kan", "avek",
    "tou", "nou", "me", "be", "kouma", "mwa", "twa", "ar", "apre", "si", "depi", "par", "parski", "ler", "osi", "eski", "kot", "kifer", "okenn", "personn",
    "fin", "finn", "in", "pu", "va", "ava", "ete", "se", "ziska", "devan", "kikenn", "seki", "pli", "ankor", "mem", "pena", "napa", "u", "ou", "ubyen", "ni",
    "avan", "pandan", "akoz", "kapav", "bizin", "zame", "konbien", "komye", "kantite", "sann-la", "kisann-la", "kisannla", "sanla", "senla"]),
  jam: F(["a", "ah", "di", "d", "the", "ina", "inna", "fi", "fe", "wid", "an", "ahn", "and", "ar", "im", "ih", "dem", "mi", "yu", "yuh", "wi", "unu", "deh", "de",
    "no", "nuh", "neva", "weh", "we", "wa", "uu", "huu", "hu", "wen", "wan", "wah", "whaan", "wahn", "bot", "but", "from", "frah", "afta", "ef", "kaaz",
    "dis", "dat", "az", "of", "pan", "pon", "pahn", "bout", "to", "bi", "did", "wehn", "don", "iz", "se", "use", "ago", "goo", "wi", "uda", "kuda", "mos", "mosa", "maita", "kyahn"]),
});
