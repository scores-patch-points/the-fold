// battery.mjs — the omnilingual falsification of the slot-pipeline improvements (PREREG.md). node eval/omnilingual/battery.mjs [--json]
// Each improvement's falsifier case, stated in en / es / fr with the same meaning, runs through the REAL askFrame, bindSentence and
// runAnswerTurn; es/fr tables are the declared ones in grammars.mjs, registered only for this run. ru (function words, no table) is the
// control that must end in a typed null. A verdict is the filler text (or "∅"); a case HOLDS when its verdict matches the expectation.
import { askFrame, withGrammars } from "../../fold-chat-frame.js";
import { bindSentence } from "../../fold-chat-witness.js";
import { runAnswerTurn } from "../../fold-chat-answerturn.js";
import { functionWordsOf } from "../../fold-chat-snippets.js";
import { ES, FR } from "./grammars.mjs";

const door = (T) => async (xs) => new Map(xs.map((x) => { const t = T[String(x).toLowerCase()]; return [x, t ? { title: t, redirectedFrom: null, disambiguation: false } : null]; }));
async function bindCase(lang, c) {
  const fw = functionWordsOf(lang);
  const f = await askFrame(c.ask, { fw, lang, resolveTitles: door(c.titles) });
  if (!f || !f.ok) return { verdict: "∅", why: "frame:" + (f && f.gap && f.gap.kind || "none"), frame: f };
  const r = bindSentence({ text: c.s, start: 0, end: c.s.length }, f, { fw, lang, page: c.page || null });
  const alts = r && r.filler && r.filler.alts ? r.filler.alts.map((a) => a.text) : null;
  return { verdict: r && r.filler ? (alts ? alts[0] : r.filler.text) : "∅", tier: r && r.tier, polarity: r && r.polarity, frame: { slot: f.slot, refs: f.referents.map((x) => x.surface), attrs: (f.attributes || []).map((a) => a.surface), pred: f.predicate.map((p) => p.surface + (p.rel ? "*" : "") + (p.kind ? "#" : "")) } };
}
async function turnCase(lang, c) {
  const pass = Object.entries(c.pages).map(([title, text], i) => ({ ref: "S" + (i + 1), title, url: "https://" + lang + ".wikipedia.org/wiki/" + i, host: lang + ".wikipedia.org", lang, text }));
  const t = await runAnswerTurn({ question: c.ask, lang, passages: pass, now: { year: 2026 }, deps: { fw: functionWordsOf, resolveTitles: door(c.titles), fetchLead: async () => null, searchPassages: async () => [] } });
  if (t.answer) return { verdict: t.answer.filler.text, outcome: "answer" };
  if (t.contest && t.contest.length) return { verdict: "contest:" + t.contest.map((r) => r.filler && r.filler.text).join("|"), outcome: "contest" };
  return { verdict: "∅", outcome: "gap:" + (t.gap && t.gap.kind || t.handoff && t.handoff.kind || "none") };
}
const ok = (v, e) => (e === "∅" ? v === "∅" : e instanceof RegExp ? e.test(v) : v === e);

// improvement → { level, en, es, fr } ; each language case: { ask, titles, s|pages, page?, expect }
export const CASES = [
  { id: "relative clause: the antecedent is the subject", level: "bind",
    en: { ask: "Who is the king of the United Kingdom?", titles: { "united kingdom": "United Kingdom", king: "King" }, s: "Charles III, who is the king of the United Kingdom, was crowned in 2023.", expect: /Charles III/ },
    es: { ask: "¿Quién es el rey de España?", titles: { "españa": "España", rey: "Rey" }, s: "Felipe VI, que es el rey de España, fue proclamado en 2014.", expect: /Felipe VI/ },
    fr: { ask: "Qui est le roi de Belgique ?", titles: { belgique: "Belgique", roi: "Roi" }, s: "Philippe, qui est le roi de Belgique, fut intronisé en 2013.", expect: /Philippe/ } },
  { id: "passive agent inside a relative clause", level: "bind",
    en: { ask: "Who discovered penicillin?", titles: { penicillin: "Penicillin" }, s: "Penicillin, which was discovered by Alexander Fleming in 1928, is an antibiotic.", expect: /Alexander Fleming/ },
    es: { ask: "¿Quién descubrió la penicilina?", titles: { "penicilina": "Penicilina" }, s: "La penicilina, que fue descubierta por Alexander Fleming en 1928, es un antibiótico.", expect: /Alexander Fleming/ },
    fr: { ask: "Qui a découvert la pénicilline ?", titles: { "pénicilline": "Pénicilline" }, s: "La pénicilline, qui fut découverte par Alexander Fleming en 1928, est un antibiotique.", expect: /Alexander Fleming/ } },
  { id: "derivative page is another entity", level: "bind",
    en: { ask: "Who wrote Pride and Prejudice?", titles: { "pride and prejudice": "Pride and Prejudice" }, s: "Seth Grahame-Smith wrote Pride and Prejudice and Zombies in 2009.", page: "Pride and Prejudice and Zombies", expect: "∅" },
    es: { ask: "¿Quién escribió Orgullo y prejuicio?", titles: { "orgullo y prejuicio": "Orgullo y prejuicio" }, s: "Seth Grahame-Smith escribió Orgullo y prejuicio y zombis en 2009.", page: "Orgullo y prejuicio y zombis", expect: "∅" },
    fr: { ask: "Qui a écrit Orgueil et Préjugés ?", titles: { "orgueil et préjugés": "Orgueil et Préjugés" }, s: "Seth Grahame-Smith a écrit Orgueil et Préjugés et Zombies en 2009.", page: "Orgueil et Préjugés et Zombies", expect: "∅" } },
  { id: "derivative control: the work's own page binds", level: "bind",
    en: { ask: "Who wrote Pride and Prejudice?", titles: { "pride and prejudice": "Pride and Prejudice" }, s: "Jane Austen wrote Pride and Prejudice.", page: "Pride and Prejudice", expect: /Austen/ },
    es: { ask: "¿Quién escribió Orgullo y prejuicio?", titles: { "orgullo y prejuicio": "Orgullo y prejuicio" }, s: "Jane Austen escribió Orgullo y prejuicio.", page: "Orgullo y prejuicio", expect: /Austen/ },
    fr: { ask: "Qui a écrit Orgueil et Préjugés ?", titles: { "orgueil et préjugés": "Orgueil et Préjugés" }, s: "Jane Austen a écrit Orgueil et Préjugés.", page: "Orgueil et Préjugés", expect: /Austen/ } },
  { id: "place: the relation's containment phrase", level: "bind",
    en: { ask: "Where was Mozart born?", titles: { mozart: "Wolfgang Amadeus Mozart" }, s: "Wolfgang Amadeus Mozart was born on 27 January 1756 at Getreidegasse 9 in Salzburg.", expect: "Salzburg" },
    es: { ask: "¿Dónde nació Mozart?", titles: { mozart: "Wolfgang Amadeus Mozart" }, s: "Wolfgang Amadeus Mozart nació el 27 de enero de 1756 en Salzburgo.", expect: "Salzburgo" },
    fr: { ask: "Où est né Mozart ?", titles: { mozart: "Wolfgang Amadeus Mozart" }, s: "Wolfgang Amadeus Mozart est né le 27 janvier 1756 à Salzbourg.", expect: "Salzbourg" } },
  { id: "place: a later clause's place is not the relation's", level: "bind",
    en: { ask: "Where was Mozart born?", titles: { mozart: "Wolfgang Amadeus Mozart" }, s: "Mozart was born in 1756 and died in Vienna.", expect: "∅" },
    es: { ask: "¿Dónde nació Mozart?", titles: { mozart: "Wolfgang Amadeus Mozart" }, s: "Mozart nació en 1756 y murió en Viena.", expect: "∅" },
    fr: { ask: "Où est né Mozart ?", titles: { mozart: "Wolfgang Amadeus Mozart" }, s: "Mozart est né en 1756 et mourut à Vienne.", expect: "∅" } },
  { id: "place: a possessor/kinsman is not the anchor", level: "bind",
    en: { ask: "Where was Mozart born?", titles: { mozart: "Wolfgang Amadeus Mozart" }, s: "The father of Mozart was born in Augsburg.", expect: "∅" },
    es: { ask: "¿Dónde nació Mozart?", titles: { mozart: "Wolfgang Amadeus Mozart" }, s: "El padre de Mozart nació en Augsburgo.", expect: "∅" },
    fr: { ask: "Où est né Mozart ?", titles: { mozart: "Wolfgang Amadeus Mozart" }, s: "Le père de Mozart est né à Augsbourg.", expect: "∅" } },
  { id: "place: a description is not where (locative cue)", level: "bind",
    en: { ask: "Where is the Great Barrier Reef?", titles: { "great barrier reef": "Great Barrier Reef" }, s: "The Great Barrier Reef is a biodiversity hotspot.", expect: "∅" },
    es: { ask: "¿Dónde está la Gran Barrera de Coral?", titles: { "gran barrera de coral": "Gran Barrera de Coral" }, s: "La Gran Barrera de Coral es un punto caliente de biodiversidad.", expect: "∅" },
    fr: { ask: "Où est la Grande Barrière de corail ?", titles: { "grande barrière de corail": "Grande Barrière de corail" }, s: "La Grande Barrière de corail est un haut lieu de biodiversité.", expect: "∅" } },
  { id: "place: relation-less containment phrase", level: "bind",
    en: { ask: "Where is the Taj Mahal?", titles: { "taj mahal": "Taj Mahal" }, s: "The Taj Mahal is a mausoleum in Agra.", expect: "Agra" },
    es: { ask: "¿Dónde está el Taj Mahal?", titles: { "taj mahal": "Taj Mahal" }, s: "El Taj Mahal es un mausoleo en Agra.", expect: "Agra" },
    fr: { ask: "Où est le Taj Mahal ?", titles: { "taj mahal": "Taj Mahal" }, s: "Le Taj Mahal est un mausolée à Agra.", expect: "Agra" } },
  { id: "place: a calendar word is a time", level: "bind",
    en: { ask: "Where is Salzburg?", titles: { salzburg: "Salzburg" }, s: "Salzburg is busiest in July.", expect: "∅" },
    es: { ask: "¿Dónde está Salzburgo?", titles: { salzburgo: "Salzburgo" }, s: "Salzburgo es más concurrida en julio.", expect: "∅" },
    fr: { ask: "Où est Salzbourg ?", titles: { salzbourg: "Salzbourg" }, s: "Salzbourg est plus animée en juillet.", expect: "∅" } },
  { id: "place: 'the capital OF X' says where", level: "bind",
    en: { ask: "Where is Cairo?", titles: { cairo: "Cairo" }, s: "Cairo is the capital of Egypt.", page: "Cairo", expect: "Egypt" },
    es: { ask: "¿Dónde está El Cairo?", titles: { "el cairo": "El Cairo", cairo: "El Cairo" }, s: "El Cairo es la capital de Egipto.", page: "El Cairo", expect: "Egipto" },
    fr: { ask: "Où est Le Caire ?", titles: { "le caire": "Le Caire", caire: "Le Caire" }, s: "Le Caire est la capitale de l'Égypte.", page: "Le Caire", expect: /Égypte/ } },
  { id: "attribute qualified by an ordinal is not the attribute", level: "bind",
    en: { ask: "What is the capital of Brazil?", titles: { brazil: "Brazil", capital: "Capital" }, s: "The fourth and unofficial capital of Brazil is São Paulo.", expect: "∅" },
    es: { ask: "¿Cuál es la capital de Brasil?", titles: { brasil: "Brasil", capital: "Capital" }, s: "La cuarta y no oficial capital de Brasil es São Paulo.", expect: "∅" },
    fr: { ask: "Quelle est la capitale du Brésil ?", titles: { "brésil": "Brésil", capitale: "Capitale" }, s: "La quatrième et officieuse capitale du Brésil est São Paulo.", expect: "∅" } },
  { id: "attribute control: the capital", level: "bind",
    en: { ask: "What is the capital of Brazil?", titles: { brazil: "Brazil", capital: "Capital" }, s: "The capital of Brazil is Brasília.", expect: /Bras/ },
    es: { ask: "¿Cuál es la capital de Brasil?", titles: { brasil: "Brasil", capital: "Capital" }, s: "La capital de Brasil es Brasilia.", expect: /Bras/ },
    fr: { ask: "Quelle est la capitale du Brésil ?", titles: { "brésil": "Brésil", capitale: "Capitale" }, s: "La capitale du Brésil est Brasília.", expect: /Bras/ } },
  { id: "false premise: the kind noun must be said", level: "turn",
    en: { ask: "Who was the first woman to walk on the Moon?", titles: { moon: "Moon", "neil armstrong": "Neil Armstrong" }, pages: { A: "Neil Armstrong was the first person to walk on the Moon." }, expect: "∅" },
    es: { ask: "¿Quién fue la primera mujer en caminar sobre la Luna?", titles: { luna: "Luna", "neil armstrong": "Neil Armstrong" }, pages: { A: "Neil Armstrong fue la primera persona en caminar sobre la Luna." }, expect: "∅" },
    fr: { ask: "Qui fut la première femme à marcher sur la Lune ?", titles: { lune: "Lune", "neil armstrong": "Neil Armstrong" }, pages: { A: "Neil Armstrong fut la première personne à marcher sur la Lune." }, expect: "∅" } },
  { id: "a hedged row is no rival", level: "turn",
    en: { ask: "How many continents are there?", titles: { continents: "Continent" }, pages: { A: "There are seven continents on our planet.", B: "You may have learned that there are four continents." }, expect: /seven/ },
    es: { ask: "¿Cuántos continentes hay?", titles: { continentes: "Continente" }, pages: { A: "Hay siete continentes en nuestro planeta.", B: "Quizás aprendiste que hay cuatro continentes." }, expect: /siete/ },
    fr: { ask: "Combien de continents y a-t-il ?", titles: { continents: "Continent" }, pages: { A: "Il y a sept continents sur notre planète.", B: "Vous avez peut-être appris qu'il y a quatre continents." }, expect: /sept/ } },
  { id: "dominance: the row that says the ask's scope word", level: "turn",
    en: { ask: "How many players does a football team have on the field?", titles: { "football team": "Football team" }, pages: { A: "An NFL football team carries 53 players on its active roster.", B: "A football team has 11 players on the field." }, expect: /\b11\b/ },
    es: { ask: "¿Cuántos jugadores tiene un equipo de fútbol en el campo?", titles: { "equipo de fútbol": "Equipo de fútbol" }, pages: { A: "Un equipo de fútbol de la NFL tiene 53 jugadores en su plantilla.", B: "Un equipo de fútbol tiene 11 jugadores en el campo." }, expect: /\b11\b/ },
    fr: { ask: "Combien de joueurs une équipe de football a-t-elle sur le terrain ?", titles: { "équipe de football": "Équipe de football" }, pages: { A: "Une équipe de football de la NFL compte 53 joueurs dans son effectif.", B: "Une équipe de football a 11 joueurs sur le terrain." }, expect: /\b11\b/ } },
];
// the control: a language with function words but no table never guesses (bind and turn)
export const CONTROL = { lang: "ru", ask: "Где родился Моцарт?", titles: { "моцарт": "Моцарт, Вольфганг Амадей" }, s: "Вольфганг Амадей Моцарт родился в Зальцбурге.", expect: "∅" };

// PERTURBATION ARMS (PREREG.md §Version 3): only the person's ask is perturbed, never a source. Deterministic.
const contentWords = (ask, lang) => { const fw = functionWordsOf(lang) || new Set(); return (ask.match(/[\p{L}\p{N}]+/gu) || []).filter((w) => w.length >= 3 && !fw.has(w.toLowerCase())); };
export const ARMS = {
  asWritten: (a) => a,
  noAccent: (a) => a.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC"),
  typo: (a, lang) => { const w = contentWords(a, lang).sort((x, y) => y.length - x.length)[0]; if (!w || w.length < 4) return a; const t = w[0] + w[2] + w[1] + w.slice(3); return a.replace(w, t); },
  leet: (a, lang) => { const L = { a: "4", e: "3", i: "1", o: "0", s: "5" }; let out = a; for (const w of contentWords(a, lang)) out = out.replace(w, w.replace(/[aeios]/gi, (c) => L[c.toLowerCase()])); return out; },
  caps: (a) => a.toUpperCase().replace(/[¿?¡!.,]/g, "").trim(),
};
export async function runArms() {
  return withGrammars({ es: ES, fr: FR }, async () => {
    const table = {};
    for (const [arm, fn] of Object.entries(ARMS)) {
      table[arm] = { en: [0, 0], es: [0, 0], fr: [0, 0], pos: { en: [0, 0], es: [0, 0], fr: [0, 0] }, falls: [] };
      for (const c of CASES) for (const lang of ["en", "es", "fr"]) {
        const k = c[lang]; if (!k) continue;
        const kk = { ...k, ask: fn(k.ask, lang) };
        let r; try { r = c.level === "turn" ? await turnCase(lang, kk) : await bindCase(lang, kk); } catch (e) { r = { verdict: "CRASH" }; }
        const held = ok(r.verdict, k.expect);
        table[arm][lang][1]++; if (held) table[arm][lang][0]++; else table[arm].falls.push(`${lang} ${c.id} :: ${kk.ask} → ${r.verdict}`);
        if (k.expect !== "∅") { table[arm].pos[lang][1]++; if (held) table[arm].pos[lang][0]++; }      // positive cases: an answer is expected
      }
    }
    return table;
  });
}

export async function run() {
  return withGrammars({ es: ES, fr: FR }, async () => {
    const rows = [];
    for (const c of CASES) {
      const row = { id: c.id, level: c.level };
      for (const lang of ["en", "es", "fr"]) {
        const k = c[lang];
        if (!k) { row[lang] = { status: "N/A" }; continue; }
        let r;
        try { r = c.level === "turn" ? await turnCase(lang, k) : await bindCase(lang, k); } catch (e) { r = { verdict: "CRASH", why: String(e && e.message || e).slice(0, 160) }; }
        row[lang] = { status: ok(r.verdict, k.expect) ? "HOLDS" : "FALLS", ...r, expected: String(k.expect) };
      }
      rows.push(row);
    }
    const ru = await bindCase(CONTROL.lang, CONTROL).catch((e) => ({ verdict: "CRASH", why: String(e) }));
    return { rows, control: { ...ru, status: ru.verdict === "∅" ? "HOLDS" : "FALLS" } };
  });
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes("--arms")) {
  const t = await runArms();
  for (const [arm, v] of Object.entries(t)) console.log(`${arm.padEnd(10)} all: en ${v.en[0]}/${v.en[1]}  es ${v.es[0]}/${v.es[1]}  fr ${v.fr[0]}/${v.fr[1]}   positive: en ${v.pos.en[0]}/${v.pos.en[1]}  es ${v.pos.es[0]}/${v.pos.es[1]}  fr ${v.pos.fr[0]}/${v.pos.fr[1]}`);
  if (process.argv.includes("--falls")) for (const [arm, v] of Object.entries(t)) for (const f of v.falls) console.log(`  [${arm}] ${f}`);
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const { rows, control } = await run();
  if (process.argv.includes("--json")) { console.log(JSON.stringify({ rows, control }, null, 1)); }
  else {
    for (const r of rows) console.log(`${r.id.padEnd(58)} en:${r.en.status.padEnd(6)} es:${r.es.status.padEnd(6)} fr:${r.fr.status.padEnd(6)}  ${["en", "es", "fr"].filter((l) => r[l].status === "FALLS").map((l) => `${l}=${JSON.stringify(r[l].verdict)} ${r[l].why || ""} ${r[l].frame ? JSON.stringify(r[l].frame) : r[l].outcome || ""}`).join(" ; ")}`);
    console.log(`control ru (no table): ${control.status} verdict=${control.verdict} ${control.why || ""}`);
  }
}
