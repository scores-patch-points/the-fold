// battery.mjs — the creole grammar falsification (GRAMMAR-PREREG.md). node eval/creole/battery.mjs [--json] [--mutate] [--audit] [--verify]
// Each case is a creole ask and the creole sentence that answers it (a REAL corpus sentence, or a corpus FRAME with names substituted),
// run through the REAL askFrame and bindSentence with a STUB title door (never the network). The creole tables are the declared ones in
// grammars.mjs, registered only for the run (withGrammars) — never in production. Controls: no table, the lexifier's table, ru, the
// English gloss, and one mutation per table field. A case HOLDS when every check its `expect` states is right.
import fs from "node:fs";
import path from "node:path";
import { askFrame, withGrammars, GRAMMAR } from "../../fold-chat-frame.js";
import { bindSentence } from "../../fold-chat-witness.js";
import { functionWordsOf } from "../../fold-chat-snippets.js";
import { CREOLES, FW, LEXIFIER } from "./grammars.mjs";
import { FR } from "../omnilingual/grammars.mjs";
import { CONTROL } from "../omnilingual/battery.mjs";

const door = (T) => async (xs) => new Map(xs.map((x) => { const t = T[String(x).toLowerCase()]; return [x, t ? { title: t, redirectedFrom: null, disambiguation: false } : null]; }));
const LES = { "les misérables": "Les Misérables" };
const LES_EN = { "les misérables": "Les Misérables" };

// id, creole, rel, prov, ask/s (the creole), src (the corpus sentence a REAL/FRAME witness comes from; null when none), expect, gloss (English)
export const CASES = [
  // ── hat ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  { id: "H1", creole: "hat", rel: "capital-of", prov: "PROMPT+FRAME", slot: "thing", ask: "Ki kapital Ayiti?", titles: { ayiti: "Ayiti", kapital: "Kapital" },
    s: "Pòtoprens se kapital Ayiti.", src: "Roger se te yon krikèt.", expect: { filler: "Pòtoprens" },
    gloss: { ask: "What is the capital of Haiti?", titles: { haiti: "Haiti", capital: "Capital" }, s: "Port-au-Prince is the capital of Haiti.", filler: "Port-au-Prince" } },
  { id: "H2", creole: "hat", rel: "capital-of", prov: "PROMPT+FRAME", slot: "thing", ask: "Ki kapital Ayiti?", titles: { ayiti: "Ayiti", kapital: "Kapital" },
    s: "Kapital Ayiti se Pòtoprens.", src: "Roger se te yon krikèt.", expect: { filler: "Pòtoprens" },
    gloss: { ask: "What is the capital of Haiti?", titles: { haiti: "Haiti", capital: "Capital" }, s: "The capital of Haiti is Port-au-Prince.", filler: "Port-au-Prince" } },
  { id: "H3", creole: "hat", rel: "author-of", prov: "PROMPT+FRAME", slot: "person", ask: "Ki moun ki ekri Les Misérables?", titles: LES,
    s: "Victor Hugo te ekri Les Misérables.", src: "Pòl te ekri kretyen Korent yo", expect: { filler: "Victor Hugo" },
    gloss: { ask: "Who wrote Les Misérables?", titles: LES_EN, s: "Victor Hugo wrote Les Misérables.", filler: "Victor Hugo" } },
  { id: "H4", creole: "hat", rel: "who-is", prov: "REAL", slot: "person", ask: "Kiyès Roger ye?", titles: { roger: "Roger" },
    s: "Roger se te yon krikèt.", src: "Roger se te yon krikèt.", expect: { filler: "yon krikèt", tense: "past" },
    gloss: { ask: "Who is Roger?", titles: { roger: "Roger" }, s: "Roger was a cricket.", filler: "a cricket", tense: "past" } },
  { id: "H5", creole: "hat", rel: "count", prov: "REAL", slot: "quantity", ask: "Konbyen eleman biyotòp la gen?", titles: { "biyotòp": "Biyotòp" },
    s: "Biyotòp la gen 5 eleman ki endispansab pou lavi : Dlo, tè, limyè, lè, tanperati.", src: "Biyotòp la gen 5 eleman ki endispansab pou lavi : Dlo, tè, limyè, lè, tanperati.", expect: { filler: "5" },
    gloss: { ask: "How many elements does the biotope have?", titles: { biotope: "Biotope" }, s: "The biotope has 5 elements that are essential for life: water, earth, light, air, temperature.", filler: "5" } },
  { id: "H5b", creole: "hat", rel: "count", prov: "REAL", slot: "quantity", ask: "Konbyen eleman biyotòp la genyen?", titles: { "biyotòp": "Biyotòp" },
    s: "Biyotòp la gen 5 eleman ki endispansab pou lavi : Dlo, tè, limyè, lè, tanperati.", src: "Biyotòp la gen 5 eleman ki endispansab pou lavi : Dlo, tè, limyè, lè, tanperati.", expect: { filler: "5" },
    gloss: { ask: "How many elements does the biotope have?", titles: { biotope: "Biotope" }, s: "The biotope has 5 elements that are essential for life: water, earth, light, air, temperature.", filler: "5" } },
  { id: "H6", creole: "hat", rel: "born", prov: "REAL", slot: "place", ask: "Ki kote Alexandre Dumas te fèt ?", titles: { "alexandre dumas": "Alexandre Dumas", dumas: "Alexandre Dumas" },
    s: "Alexandre Dumas, ki te fèt an Ayiti 1762, se te youn nan moun ki moun inoubliyab.", src: "Alexandre Dumas, ki te fèt an Ayiti 1762, se te youn nan moun ki moun inoubliyab.", expect: { filler: "Ayiti" },
    gloss: { ask: "Where was Alexandre Dumas born?", titles: { "alexandre dumas": "Alexandre Dumas", dumas: "Alexandre Dumas" }, s: "Alexandre Dumas, who was born in Haiti in 1762, was one of those unforgettable men.", filler: "Haiti" } },
  { id: "H7", creole: "hat", rel: "author-of (passive)", prov: "FRAME", slot: "person", ask: "Ki moun ki ekri Les Misérables?", titles: LES,
    s: "Les Misérables te ekri pa Victor Hugo.", src: "ekri pa plizyè otè", expect: { filler: "Victor Hugo", polarity: "+" },
    gloss: { ask: "Who wrote Les Misérables?", titles: LES_EN, s: "Les Misérables was written by Victor Hugo.", filler: "Victor Hugo", polarity: "+" } },
  { id: "H8", creole: "hat", rel: "capital-of", prov: "FRAME", slot: "thing", ask: "Ki kapital Ayiti?", titles: { ayiti: "Ayiti", kapital: "Kapital" },
    s: "Kapital Ayiti se Pòtoprens la.", src: "Roger se te yon krikèt.", expect: { filler: "Pòtoprens" },
    gloss: { ask: "What is the capital of Haiti?", titles: { haiti: "Haiti", capital: "Capital" }, s: "The capital of Haiti is Port-au-Prince.", filler: "Port-au-Prince" } },
  { id: "H9", creole: "hat", rel: "negation", prov: "FRAME", slot: "thing", ask: "Ki kapital Ayiti?", titles: { ayiti: "Ayiti", kapital: "Kapital" },
    s: "Pòtoprens pa se kapital Ayiti.", src: null, apics: "ch.49 ex.(20) Elifèt p(a) ap manje", expect: { filler: "Pòtoprens", polarity: "-" },
    gloss: { ask: "What is the capital of Haiti?", titles: { haiti: "Haiti", capital: "Capital" }, s: "Port-au-Prince is not the capital of Haiti.", filler: "Port-au-Prince", polarity: "-" } },
  // ── tpi ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  { id: "T1", creole: "tpi", rel: "capital-of", prov: "PROMPT+FRAME", slot: "thing", ask: "Wanem em kapital bilong Papua Niugini?", titles: { "papua niugini": "Papua Niugini", kapital: "Kapital" },
    s: "Port Moresby em i kapital bilong Papua Niugini .", src: "Budapest em i kapitol bilong Hangari .", expect: { filler: "Port Moresby" },
    gloss: { ask: "What is the capital of Papua New Guinea?", titles: { "papua new guinea": "Papua New Guinea", capital: "Capital" }, s: "Port Moresby is the capital of Papua New Guinea.", filler: "Port Moresby" } },
  { id: "T2", creole: "tpi", rel: "capital-of", prov: "REAL", slot: "thing", ask: "Wanem em kapitol bilong Hangari?", titles: { hangari: "Hangari", kapitol: "Kapitol" },
    s: "Budapest em i kapitol bilong Hangari .", src: "Budapest em i kapitol bilong Hangari .", expect: { filler: "Budapest" },
    gloss: { ask: "What is the capital of Hungary?", titles: { hungary: "Hungary", capital: "Capital" }, s: "Budapest is the capital of Hungary.", filler: "Budapest" } },
  { id: "T3", creole: "tpi", rel: "capital-of (P36)", prov: "REAL", slot: "thing", ask: "Wanem em kapitol bilong Slovakia?", titles: { slovakia: "Slovakia", kapitol: "Kapitol" },
    s: "Kapitol bilong Slovakia i Bratislava .", src: "Kapitol bilong Slovakia i Bratislava .", expect: { filler: "Bratislava" },
    gloss: { ask: "What is the capital of Slovakia?", titles: { slovakia: "Slovakia", capital: "Capital" }, s: "The capital of Slovakia is Bratislava.", filler: "Bratislava" } },
  { id: "T4", creole: "tpi", rel: "who-holds", prov: "REAL", slot: "person", ask: "Husat i praim minista bilong Tuvalu?", titles: { tuvalu: "Tuvalu", "praim minista": "Praim minista" },
    s: "Apisai Ielemia i praim minista bilong Tuvalu .", src: "Apisai Ielemia i praim minista bilong Tuvalu .", expect: { filler: "Apisai Ielemia" },
    gloss: { ask: "Who is the prime minister of Tuvalu?", titles: { tuvalu: "Tuvalu", "prime minister": "Prime minister" }, s: "Apisai Ielemia is the prime minister of Tuvalu.", filler: "Apisai Ielemia" } },
  { id: "T5", creole: "tpi", rel: "capital-of (spelling)", prov: "REAL", slot: "thing", ask: "Wanem em kapital bilong Hangari?", titles: { hangari: "Hangari", kapital: "Kapital" },
    s: "Budapest em i kapitol bilong Hangari .", src: "Budapest em i kapitol bilong Hangari .", expect: { filler: "Budapest" },
    gloss: { ask: "What is the capital of Hungary?", titles: { hungary: "Hungary", capital: "Capital" }, s: "Budapest is the capital of Hungary.", filler: "Budapest" } },
  { id: "T6", creole: "tpi", rel: "author-of", prov: "FRAME", slot: "person", ask: "Husat i raitim Les Misérables?", titles: LES,
    s: "Viktor Hugo i raitim Les Misérables .", src: "Moses i lukim lain Israel", expect: { filler: "Viktor Hugo" },
    gloss: { ask: "Who wrote Les Misérables?", titles: LES_EN, s: "Viktor Hugo wrote Les Misérables.", filler: "Viktor Hugo" } },
  { id: "T7", creole: "tpi", rel: "negation", prov: "FRAME", slot: "thing", ask: "Wanem em kapitol bilong Hangari?", titles: { hangari: "Hangari", kapitol: "Kapitol" },
    s: "Budapest em i no kapitol bilong Hangari .", src: "Budapest em i kapitol bilong Hangari .", expect: { filler: "Budapest", polarity: "-" },
    gloss: { ask: "What is the capital of Hungary?", titles: { hungary: "Hungary", capital: "Capital" }, s: "Budapest is not the capital of Hungary.", filler: "Budapest", polarity: "-" } },
  { id: "T8", creole: "tpi", rel: "where", prov: "REAL", slot: "place", ask: "We Morobe i stap?", titles: { morobe: "Morobe" },
    s: "Morobe em i wanpela provins long Papua Niugini .", src: "Morobe em i wanpela provins long Papua Niugini .", expect: { filler: "Papua Niugini" },
    gloss: { ask: "Where is Morobe?", titles: { morobe: "Morobe" }, s: "Morobe is a province in Papua New Guinea.", filler: "Papua New Guinea" } },
  { id: "T9", creole: "tpi", rel: "where (in situ)", prov: "REAL", slot: "place", ask: "Morobe i stap we?", titles: { morobe: "Morobe" },
    s: "Morobe em i wanpela provins long Papua Niugini .", src: "Morobe em i wanpela provins long Papua Niugini .", expect: { filler: "Papua Niugini" },
    gloss: { ask: "Where is Morobe?", titles: { morobe: "Morobe" }, s: "Morobe is a province in Papua New Guinea.", filler: "Papua New Guinea" } },
  { id: "T10", creole: "tpi", rel: "author-of (-im)", prov: "FRAME", slot: "person", ask: "Husat i raitim Les Misérables?", titles: LES,
    s: "Viktor Hugo i rait Les Misérables .", src: null, apics: "ch.22 §6.2 ex.(16)-(17) kuk / kuk-im", expect: { filler: "Viktor Hugo" },
    gloss: { ask: "Who wrote Les Misérables?", titles: LES_EN, s: "Viktor Hugo wrote Les Misérables.", filler: "Viktor Hugo" } },
  // ── jam ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  { id: "J1", creole: "jam", rel: "capital-of", prov: "PROMPT+FRAME", slot: "thing", ask: "Weh a di capital a Jamaica?", titles: { jamaica: "Jamaica", capital: "Capital" },
    s: "Kingston a di capital fi Jamaica .", src: "Athens a di capital fi Greece .", expect: { filler: "Kingston" },
    gloss: { ask: "What is the capital of Jamaica?", titles: { jamaica: "Jamaica", capital: "Capital" }, s: "Kingston is the capital of Jamaica.", filler: "Kingston" } },
  { id: "J2", creole: "jam", rel: "capital-of", prov: "REAL", slot: "thing", ask: "Weh a di capital fi Greece?", titles: { greece: "Greece", capital: "Capital" },
    s: "Athens a di capital fi Greece .", src: "Athens a di capital fi Greece .", expect: { filler: "Athens" },
    gloss: { ask: "What is the capital of Greece?", titles: { greece: "Greece", capital: "Capital" }, s: "Athens is the capital of Greece.", filler: "Athens" } },
  { id: "J3", creole: "jam", rel: "capital-of", prov: "REAL", slot: "thing", ask: "Weh a di capital a Portugal?", titles: { portugal: "Portugal", capital: "Capital" },
    s: "Di capital a Portugal name Lisban .", src: "Di capital a Portugal name Lisban .", expect: { filler: "Lisban" },
    gloss: { ask: "What is the capital of Portugal?", titles: { portugal: "Portugal", capital: "Capital" }, s: "The capital of Portugal is named Lisbon.", filler: "Lisbon" } },
  { id: "J4", creole: "jam", rel: "who-is", prov: "REAL", slot: "person", ask: "Uu a Anna Netrebco?", titles: { "anna netrebco": "Anna Netrebco" },
    s: "Anna Netrebco a wan singa from Russia .", src: "Anna Netrebco a wan singa from Russia .", expect: { filler: "wan singa from Russia" },
    gloss: { ask: "Who is Anna Netrebco?", titles: { "anna netrebco": "Anna Netrebco" }, s: "Anna Netrebco is a singer from Russia.", filler: "a singer from Russia" } },
  { id: "J5", creole: "jam", rel: "who-holds", prov: "REAL", slot: "person", ask: "Uu a di president a France?", titles: { france: "France", president: "President" },
    s: "Jack Sherach use to bi di president ah France .", src: "Jack Sherach use to bi di president ah France .", expect: { filler: "Jack Sherach" },
    gloss: { ask: "Who is the president of France?", titles: { france: "France", president: "President" }, s: "Jack Sherach used to be the president of France.", filler: "Jack Sherach" } },
  { id: "J6", creole: "jam", rel: "author-of", prov: "FRAME", slot: "person", ask: "Uu rait Les Misérables?", titles: LES,
    s: "Victor Hugo rait Les Misérables .", src: null, apics: "ch.08 ex.(58) A uda rait dehn rait i", expect: { filler: "Victor Hugo" },
    gloss: { ask: "Who wrote Les Misérables?", titles: LES_EN, s: "Victor Hugo wrote Les Misérables.", filler: "Victor Hugo" } },
  { id: "J7", creole: "jam", rel: "negation", prov: "FRAME", slot: "thing", ask: "Weh a di capital a Jamaica?", titles: { jamaica: "Jamaica", capital: "Capital" },
    s: "Kingston no a di capital fi Jamaica .", src: "Athens a di capital fi Greece .", expect: { filler: "Kingston", polarity: "-" },
    gloss: { ask: "What is the capital of Jamaica?", titles: { jamaica: "Jamaica", capital: "Capital" }, s: "Kingston is not the capital of Jamaica.", filler: "Kingston", polarity: "-" } },
  { id: "J8", creole: "jam", rel: "capital-of (spelling)", prov: "FRAME", slot: "thing", ask: "Weh a di kapital fi Greece?", titles: { greece: "Greece", kapital: "Kapital" },
    s: "Athens a di capital fi Greece .", src: "Athens a di capital fi Greece .", expect: { filler: "Athens" },
    gloss: { ask: "What is the capital of Greece?", titles: { greece: "Greece", capital: "Capital" }, s: "Athens is the capital of Greece.", filler: "Athens" } },
  // ── pcm ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  { id: "P1", creole: "pcm", rel: "capital-of", prov: "PROMPT+FRAME", slot: "thing", ask: "Wetin be di capital of Nigeria?", titles: { nigeria: "Nigeria", capital: "Capital" },
    s: "Abuja na di capital of Nigeria .", src: "Di Ebute - Metta Station na di biggest station for di train corridor .", expect: { filler: "Abuja" },
    gloss: { ask: "What is the capital of Nigeria?", titles: { nigeria: "Nigeria", capital: "Capital" }, s: "Abuja is the capital of Nigeria.", filler: "Abuja" } },
  { id: "P2", creole: "pcm", rel: "who-is", prov: "REAL", slot: "person", ask: "Who be di FACT leader?", titles: { fact: "FACT" },
    s: "FACT leader na Mahamat Mahadi Ali wey be ogbologbo insurgent wey don live for France befor .", src: "FACT leader na Mahamat Mahadi Ali wey be ogbologbo insurgent wey don live for France befor .", expect: { filler: "Mahamat Mahadi Ali" },
    gloss: { ask: "Who is the FACT leader?", titles: { fact: "FACT" }, s: "FACT leader is Mahamat Mahadi Ali who was an old insurgent who has lived in France before.", filler: "Mahamat Mahadi Ali" } },
  { id: "P3", creole: "pcm", rel: "what-is", prov: "REAL", slot: "thing", ask: "Wetin be LCCI?", titles: { lcci: "LCCI" },
    s: "LCCI na di lead Chamber of Commerce and one of di leading voices for di organised private sector ( OPS ) for Nigeria .", src: "LCCI na di lead Chamber of Commerce and one of di leading voices for di organised private sector ( OPS ) for Nigeria .", expect: { filler: /^di lead Chamber of Commerce/ },
    gloss: { ask: "What is LCCI?", titles: { lcci: "LCCI" }, s: "LCCI is the lead Chamber of Commerce and one of the leading voices for the organised private sector (OPS) in Nigeria.", filler: /^the lead Chamber of Commerce/ } },
  { id: "P4", creole: "pcm", rel: "author-of", prov: "FRAME", slot: "person", ask: "Who write Les Misérables?", titles: LES,
    s: "Victor Hugo write Les Misérables .", src: "Comr Hassan Ahmad write say", expect: { filler: "Victor Hugo" },
    gloss: { ask: "Who wrote Les Misérables?", titles: LES_EN, s: "Victor Hugo wrote Les Misérables.", filler: "Victor Hugo" } },
  { id: "P5", creole: "pcm", rel: "negative (attribute unsaid)", prov: "FRAME", slot: "thing", ask: "Wetin be di capital of Nigeria?", titles: { nigeria: "Nigeria", capital: "Capital" },
    s: "Lagos na di biggest city for Nigeria .", src: "Di Ebute - Metta Station na di biggest station for di train corridor .", expect: { filler: "∅" },
    gloss: { ask: "What is the capital of Nigeria?", titles: { nigeria: "Nigeria", capital: "Capital" }, s: "Lagos is the biggest city in Nigeria.", filler: "∅" } },
  { id: "P6", creole: "pcm", rel: "negation", prov: "FRAME", slot: "thing", ask: "Wetin be di capital of Nigeria?", titles: { nigeria: "Nigeria", capital: "Capital" },
    s: "Lagos no be di capital of Nigeria .", src: "No be only say na di first time wey we go get double standard gauge", expect: { filler: "Lagos", polarity: "-" },
    gloss: { ask: "What is the capital of Nigeria?", titles: { nigeria: "Nigeria", capital: "Capital" }, s: "Lagos is not the capital of Nigeria.", filler: "Lagos", polarity: "-" } },
  { id: "P7", creole: "pcm", rel: "capital-of (in situ)", prov: "FRAME", slot: "thing", ask: "Di capital of Nigeria na wetin?", titles: { nigeria: "Nigeria", capital: "Capital" },
    s: "Abuja na di capital of Nigeria .", src: "Di Ebute - Metta Station na di biggest station for di train corridor .", expect: { filler: "Abuja" },
    gloss: { ask: "What is the capital of Nigeria?", titles: { nigeria: "Nigeria", capital: "Capital" }, s: "Abuja is the capital of Nigeria.", filler: "Abuja" } },
  // ── mfe ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  { id: "M1", creole: "mfe", rel: "capital-of (zero copula)", prov: "PROMPT+FRAME", slot: "thing", ask: "Ki kapital Moris?", titles: { moris: "Moris", kapital: "Kapital" },
    s: "Por-Lwi kapital Moris .", src: "Ana ti enn tifi intelizan.", expect: { filler: "Por-Lwi" },
    gloss: { ask: "What is the capital of Mauritius?", titles: { mauritius: "Mauritius", capital: "Capital" }, s: "Port Louis is the capital of Mauritius.", filler: "Port Louis" } },
  { id: "M2", creole: "mfe", rel: "capital-of", prov: "PROMPT+FRAME", slot: "thing", ask: "Ki kapital Moris?", titles: { moris: "Moris", kapital: "Kapital" },
    s: "Por-Lwi se kapital Moris .", src: "Premie sa douz disip-l se Simon, so ti-nom Pier.", expect: { filler: "Por-Lwi" },
    gloss: { ask: "What is the capital of Mauritius?", titles: { mauritius: "Mauritius", capital: "Capital" }, s: "Port Louis is the capital of Mauritius.", filler: "Port Louis" } },
  { id: "M3", creole: "mfe", rel: "who-is", prov: "REAL", slot: "person", ask: "Kisann-la Simon?", titles: { simon: "Simon" },
    s: "Premie sa douz disip-l se Simon , so ti-nom Pier .", src: "Premie sa douz disip-l se Simon, so ti-nom Pier.", expect: { filler: "Premie sa douz disip-l" },
    gloss: { ask: "Who is Simon?", titles: { simon: "Simon" }, s: "The first of the twelve disciples is Simon, whose nickname is Peter.", filler: "The first of the twelve disciples" } },
  { id: "M4", creole: "mfe", rel: "author-of", prov: "FRAME", slot: "person", ask: "Kisann-la ki ekrir Les Misérables?", titles: LES,
    s: "Victor Hugo ti ekrir Les Misérables .", src: "Sally ti ousi al bor lamer avek so fami.", expect: { filler: "Victor Hugo" },
    gloss: { ask: "Who wrote Les Misérables?", titles: LES_EN, s: "Victor Hugo wrote Les Misérables.", filler: "Victor Hugo" } },
  { id: "M5", creole: "mfe", rel: "capital-of (hyphen article)", prov: "FRAME", slot: "thing", ask: "Ki kapital Moris?", titles: { moris: "Moris", kapital: "Kapital" },
    s: "Por-Lwi se kapital Moris-la .", src: "Premie sa douz disip-l se Simon, so ti-nom Pier.", expect: { filler: "Por-Lwi" },
    gloss: { ask: "What is the capital of Mauritius?", titles: { mauritius: "Mauritius", capital: "Capital" }, s: "Port Louis is the capital of Mauritius.", filler: "Port Louis" } },
  { id: "M6", creole: "mfe", rel: "negation", prov: "FRAME", slot: "thing", ask: "Ki kapital Moris?", titles: { moris: "Moris", kapital: "Kapital" },
    s: "Por-Lwi pa kapital Moris .", src: null, apics: "ch.55 ex.(6) mo pà trùv mo laklè", expect: { filler: "Por-Lwi", polarity: "-" },
    gloss: { ask: "What is the capital of Mauritius?", titles: { mauritius: "Mauritius", capital: "Capital" }, s: "Port Louis is not the capital of Mauritius.", filler: "Port Louis", polarity: "-" } },
  { id: "M7", creole: "mfe", rel: "where (zero copula)", prov: "FRAME", slot: "place", ask: "Kot Moris?", titles: { moris: "Moris" },
    s: "Moris enn pei dan Losean Indyen .", src: "Kot Todd reste?", expect: { filler: "Losean Indyen" },
    gloss: { ask: "Where is Mauritius?", titles: { mauritius: "Mauritius" }, s: "Mauritius is a country in the Indian Ocean.", filler: "Indian Ocean" } },
];

const matches = (want, got) => (want === "∅" ? got === "∅" : want instanceof RegExp ? want.test(got) : got === want);

/** Read one ask and one sentence under a language code. Pure but for the stub door. */
export async function readCase(lang, fw, { ask, titles, s }) {
  const f = await askFrame(ask, { fw, lang, resolveTitles: door(titles) });
  const frame = f && f.ok ? { slot: f.slot, refs: f.referents.map((x) => x.surface), attrs: (f.attributes || []).map((a) => a.surface),
    pred: f.predicate.map((p) => p.surface + (p.rel ? "*" : "") + (p.name ? "!" : "") + (p.kind ? "#" : "")) } : null;
  if (!f || !f.ok) return { read: false, gap: f && f.gap ? f.gap.kind : f && f.slot ? "slot_without_gap" : "not_a_slot_ask", slot: f ? f.slot : null, verdict: "∅", frame: null, row: null };
  const r = bindSentence({ text: s, start: 0, end: s.length }, f, { fw, lang });
  const alts = r && r.filler && r.filler.alts ? r.filler.alts.map((a) => a.text) : null;
  return { read: true, gap: null, slot: f.slot, verdict: r && r.filler ? (alts ? alts[0] : r.filler.text) : "∅", frame,
    row: r ? { tier: r.tier, polarity: r.polarity, tense: r.tense } : null };
}

/** One case under one table. `status` HOLDS iff every check the expectation states is right; `checks` names each. */
export function judge(c, res) {
  const e = c.expect, checks = {};
  checks.ask = res.read && res.slot === c.slot && res.frame.refs.length > 0;
  checks.filler = matches(e.filler, res.verdict);
  if (e.polarity) checks.polarity = !!res.row && res.row.polarity === e.polarity;
  if (e.tense) checks.tense = !!res.row && res.row.tense === e.tense;
  const stated = Object.entries(checks).filter(([k]) => k === "filler" || k === "polarity" || k === "tense");
  const holds = stated.every(([, v]) => v);
  return { status: holds ? "HOLDS" : "FALLS", checks, failed: stated.filter(([, v]) => !v).map(([k]) => k) };
}

const tableFor = (creole) => CREOLES[creole];
const emptied = (v) => (Array.isArray(v) ? [] : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Array.isArray(x) ? [] : x])) : typeof v === "string" ? null : v);
const SKIP_FIELDS = new Set(["giver", "leet", "year", "maxRun", "minStem"]);

/** Every case under its own declared table (registered only for the call). */
export async function run({ tables = CREOLES } = {}) {
  const rows = [];
  for (const c of CASES) {
    const fw = new Set(FW[c.creole]);
    const own = await withGrammars({ [c.creole]: tables[c.creole] }, () => readCase(c.creole, fw, c));
    const j = judge(c, own);
    // controls for THIS ask
    const noTable = await readCase(c.creole, fw, c);                       // nothing registered → must be the typed gap
    const lex = LEXIFIER[c.creole];
    const lexTable = lex === "fr" ? FR : GRAMMAR.en;
    const asLexifier = await withGrammars({ [c.creole]: lexTable }, () => readCase(c.creole, functionWordsOf(lex), c));
    const en = await readCase("en", functionWordsOf("en"), { ask: c.gloss.ask, titles: c.gloss.titles, s: c.gloss.s });
    const enHolds = matches(c.gloss.filler, en.verdict) && (!c.gloss.polarity || (en.row && en.row.polarity === c.gloss.polarity)) && (!c.gloss.tense || (en.row && en.row.tense === c.gloss.tense));
    rows.push({ id: c.id, creole: c.creole, rel: c.rel, prov: c.prov, ask: c.ask, s: c.s, expect: String(c.expect.filler) + (c.expect.polarity ? ` polarity ${c.expect.polarity}` : "") + (c.expect.tense ? ` tense ${c.expect.tense}` : ""),
      ...own, ...j, noTable: { read: noTable.read, gap: noTable.gap },
      asLexifier: { read: asLexifier.read, gap: asLexifier.gap, slot: asLexifier.slot, verdict: asLexifier.verdict, refs: asLexifier.frame && asLexifier.frame.refs },
      en: { status: enHolds ? "HOLDS" : "FALLS", verdict: en.verdict, polarity: en.row && en.row.polarity, read: en.read, gap: en.gap } });
  }
  return rows;
}

/** The ru control of the omnilingual battery, unchanged (function words, no table → a typed null). */
export async function ruControl() {
  const fw = functionWordsOf(CONTROL.lang);
  const f = await askFrame(CONTROL.ask, { fw, lang: CONTROL.lang, resolveTitles: door(CONTROL.titles) });
  const r = f && f.ok ? bindSentence({ text: CONTROL.s, start: 0, end: CONTROL.s.length }, f, { fw, lang: CONTROL.lang }) : null;
  const verdict = r && r.filler ? r.filler.text : "∅";
  return { verdict, gap: f && f.gap ? f.gap.kind : null, status: verdict === "∅" ? "HOLDS" : "FALLS" };
}

/** Empty each declared field in turn; list the cases whose observable result changes (verdict, polarity, tense, ask read, attributes). */
export async function mutate({ creoles = Object.keys(CREOLES) } = {}) {
  const sig = (r) => JSON.stringify([r.read, r.verdict, r.row && r.row.polarity, r.row && r.row.tense, r.frame && r.frame.attrs.length, r.frame && r.frame.refs.length]);
  const out = [];
  for (const creole of creoles) {
    const base = tableFor(creole), cs = CASES.filter((c) => c.creole === creole);
    const fw = new Set(FW[creole]);
    const baseline = new Map();
    for (const c of cs) baseline.set(c.id, sig(await withGrammars({ [creole]: base }, () => readCase(creole, fw, c))));
    for (const field of Object.keys(base)) {
      if (SKIP_FIELDS.has(field)) continue;
      const t = { ...base, [field]: emptied(base[field]) };
      const flipped = [];
      for (const c of cs) {
        const r = await withGrammars({ [creole]: t }, () => readCase(creole, fw, c));
        if (sig(r) !== baseline.get(c.id)) flipped.push({ id: c.id, now: r.read ? r.verdict + (r.row ? ` [${r.row.polarity}]` : "") : `not read (${r.gap})` });
      }
      out.push({ creole, field, flipped });
    }
  }
  return out;
}

// ── corpus audit and quote verification (read-only; the corpus is on disk, nothing is fetched) ─────────────────────────────────────
const D = process.env.CREOLEVAL_DIR || "/Users/mlacy/Documents/3.0/live_priors-latest/11-multi-language/dialects-pidgins-creoles/creoleval/";
const rd = (p) => { try { return fs.readFileSync(path.join(D, p), "utf8").replace(/^﻿/, ""); } catch { return ""; } };
const tsv0 = (p) => rd(p).split("\n").slice(1).map((l) => l.split("\t")[0]);
const conllu = (p) => rd(p).split("\n").filter((l) => l.startsWith("# text = ")).map((l) => l.slice(9));
const bio = (p) => { const out = []; let cur = []; for (const l of rd(p).split("\n")) { if (!l.trim()) { if (cur.length) out.push(cur.join(" ")); cur = []; } else cur.push(l.split(/[ \t]/)[0]); } if (cur.length) out.push(cur.join(" ")); return out; };
const csv0 = (p) => rd(p).split("\n").map((l) => l.replace(/^"/, "").split(/",|,(?=[^,]*,[^,]*,[^,]*,[^,]*$)/)[0]);
export function corpusOf(creole) {
  if (creole === "hat") return [...rd("mt_mit_haiti/ht_monolingual_sample.txt").split("\n"), ...rd("mt_mit_haiti/ht-en.trg").split("\n"), ...rd("mctest/CreoleTranslations/mc160.dev.kreyol1.txt").split(/\r?\n/), ...rd("mctest/CreoleTranslations/mc160.dev.kreyol2_localized.txt").split(/\r?\n/), ...tsv0("tatoeba_sentence_mining/hat-eng_sample1.tsv")];
  if (creole === "pcm") return [...conllu("pos_ud_naija_pcm/pcm_nsc-ud-train_sample.conllu"), ...conllu("pos_ud_naija_pcm/pcm_nsc-ud-dev_sample.conllu"), ...conllu("pos_ud_naija_pcm/pcm_nsc-ud-test_sample.conllu"), ...bio("ner_masakhaner_pcm/train_sample.txt"), ...bio("ner_masakhaner_pcm/dev.txt"), ...bio("ner_masakhaner_pcm/test.txt")];
  if (creole === "tpi") return [...tsv0("tatoeba_sentence_mining/tpi-eng_sample1.tsv"), ...csv0("relation_classification/tpi.csv")];
  if (creole === "jam") return [...tsv0("tatoeba_sentence_mining/jam-eng.tsv"), ...csv0("relation_classification/jam.csv")];
  if (creole === "mfe") return [...["train_sample", "dev", "test"].flatMap((f) => rd(`mt_kreolmorisien/en-cr_${f}.jsonl`).split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l).target; } catch { return ""; } })),
    ...rd("mctest/CreoleTranslations/mc160.dev.mauritian.txt").split(/\r?\n|\r/)];
  return [];
}
const flat = (s) => String(s).replace(/\s+/g, " ").replace(/ ([.,?!:;)])/g, "$1").replace(/\( /g, "(").trim();
export function verify() {
  const prompts = JSON.parse(fs.readFileSync(new URL("./prompts.json", import.meta.url), "utf8")).categories[0].turns.map((t) => t[0]);
  const out = [];
  for (const c of CASES) {
    const text = flat(corpusOf(c.creole).join("\n"));
    const norm = flat(c.src || "");
    const witness = c.prov === "REAL" ? (text.includes(flat(c.s)) ? "found" : "MISSING") : null;
    const frame = c.prov !== "REAL" && c.src ? (text.includes(norm) ? "found" : "MISSING") : null;
    const prompt = c.prov.startsWith("PROMPT") ? (prompts.includes(c.ask) ? "found" : "MISSING") : null;
    out.push({ id: c.id, prov: c.prov, witness, frame, prompt });
  }
  return out;
}
export function audit() {
  const out = {};
  const w = (s) => String(s).toLowerCase().match(/[\p{L}\p{N}'’-]+/gu) || [];
  for (const creole of Object.keys(CREOLES)) {
    const cnt = new Map();
    for (const line of corpusOf(creole)) for (const t of w(line)) cnt.set(t, (cnt.get(t) || 0) + 1);
    const t = CREOLES[creole], missing = {}, seen = {};
    for (const [field, v] of Object.entries(t)) {
      if (SKIP_FIELDS.has(field) || field === "leet") continue;
      const words = field === "interrogatives" ? v.flatMap((i) => i.words) : Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v).flat() : typeof v === "string" ? [v] : [];
      for (const x of new Set(words)) { const n = x.split(" ").length > 1 ? 0 : (cnt.get(String(x).toLowerCase()) || 0); (n ? seen : missing)[field] = (n ? seen : missing)[field] || []; (n ? seen : missing)[field].push(x); }
    }
    const nSeen = Object.values(seen).reduce((a, b) => a + b.length, 0), nMiss = Object.values(missing).reduce((a, b) => a + b.length, 0);
    out[creole] = { tokens: [...cnt.values()].reduce((a, b) => a + b, 0), attested: nSeen, unattested: nMiss, missing };
  }
  return out;
}

const main = import.meta.url === `file://${process.argv[1]}`;
if (main) {
  const arg = (n) => process.argv.includes(n);
  if (arg("--verify")) { for (const v of verify()) console.log(JSON.stringify(v)); }
  else if (arg("--audit")) { const a = audit(); for (const [k, v] of Object.entries(a)) { console.log(`${k}: ${v.attested} attested, ${v.unattested} unattested (corpus ${v.tokens} tokens)`); for (const [f, ws] of Object.entries(v.missing)) console.log(`   ${f}: ${ws.join(" ")}`); } }
  else if (arg("--mutate")) { for (const m of await mutate()) console.log(`${m.creole} ${m.field.padEnd(20)} ${m.flipped.length ? m.flipped.map((f) => `${f.id}→${f.now}`).join("; ") : "(inert)"}`); }
  else {
    const rows = await run();
    if (arg("--json")) console.log(JSON.stringify({ rows, ru: await ruControl() }, null, 1));
    else {
      for (const r of rows) console.log(`${r.id.padEnd(4)} ${r.creole} ${r.status.padEnd(5)} ${r.prov.padEnd(13)} ask:${r.read ? "read" : "NOT(" + r.gap + ")"} got:${JSON.stringify(r.verdict)} want:${r.expect}${r.row ? " pol:" + r.row.polarity + " tense:" + r.row.tense : ""}  | no-table:${r.noTable.read ? "READ" : r.noTable.gap} lexifier:${r.asLexifier.read ? "read " + JSON.stringify(r.asLexifier.verdict) : r.asLexifier.gap} en:${r.en.status}`);
      const by = {};
      for (const r of rows) { const b = (by[r.creole] = by[r.creole] || { n: 0, read: 0, holds: 0, real: 0, realHolds: 0 }); b.n++; if (r.read) b.read++; if (r.status === "HOLDS") b.holds++; if (r.prov === "REAL") { b.real++; if (r.status === "HOLDS") b.realHolds++; } }
      for (const [k, b] of Object.entries(by)) console.log(`${k}: ${b.holds}/${b.n} hold, ${b.read}/${b.n} asks read, REAL ${b.realHolds}/${b.real}`);
      console.log("ru control:", JSON.stringify(await ruControl()));
    }
  }
}
