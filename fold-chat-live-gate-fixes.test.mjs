// fold-chat-live-gate-fixes.test.mjs — falsifiers for the first live held-out gate run (eval/gate/LIMIT-MAP.md, 2026-10-13).
// Each case is a row that committed WRONG, contested with the right answer present, or gapped with the right sentence as "closest".
// Every assertion here FAILED on 4019850 before the fix (the failure is the pre-registration).
import test from "node:test";
import assert from "node:assert/strict";
import { askFrame } from "./fold-chat-frame.js";
import { bindSentence } from "./fold-chat-witness.js";
import { functionWordsOf } from "./fold-chat-snippets.js";

const fw = functionWordsOf("en");
const door = (T) => async (xs) => new Map(xs.map((x) => [x, T[x.toLowerCase()] ? { title: T[x.toLowerCase()], redirectedFrom: null, disambiguation: false } : null]));
const frameOf = (q, T) => askFrame(q, { fw, lang: "en", resolveTitles: door(T) });
const bind = (frame, text, opts = {}) => bindSentence({ text, start: 0, end: text.length }, frame, { fw, lang: "en", ...opts });

test("LIVE-1 derivative page: an occurrence inside the LONGER title the sentence was read on is not the referent's", async () => {
  const f = await frameOf("Who wrote Pride and Prejudice?", { "pride and prejudice": "Pride and Prejudice" });
  const s = "Steve Hockensmith also wrote a sequel in the series titled Pride and Prejudice and Zombies: Dreadfully Ever After, which was released on March 22, 2011.";
  const r = bind(f, s, { page: "Pride and Prejudice and Zombies" });
  assert.ok(!r || r.tier !== "T1" || !r.filler, "the sequel's author must not be the novel's: " + JSON.stringify(r && r.filler));
  const ok = bind(f, "Jane Austen wrote Pride and Prejudice, published in 1813.", { page: "Pride and Prejudice" });
  assert.ok(ok && ok.filler && /Austen/.test(ok.filler.text), "control: the novel's own page still binds");
});

test("LIVE-2 a PERSON filler is somebody: no date, and a role word is not a name", async () => {
  const f = await frameOf("Who was the first president of the United States?", { "united states": "United States", "first president": "President of the United States" });
  const d = bind(f, "On April 30, 1789, Washington was sworn in as the first president of the United States at New York's City Hall.");
  assert.ok(!d || !d.filler || !/April/.test(d.filler.text), "a date is not a person: " + JSON.stringify(d && d.filler));
  const c = await frameOf("Who is the chancellor of Germany?", { germany: "Germany", chancellor: "Chancellor", "chancellor of germany": "Chancellor of Germany" });
  const r = bind(c, "With the unification of Germany and establishment of the German Empire in 1871, the Confederation evolved into a German nation-state and its leader became known as the chancellor of Germany.");
  assert.ok(!r || !r.filler, "'its leader became known as the chancellor' names a role, not a person: " + JSON.stringify(r && r.filler));
});

test("LIVE-3 a PLACE ask with a relation keeps every place the sentence gives, in order, so the title door can pick the resolvable one", async () => {
  const f = await frameOf("Where was Mozart born?", { mozart: "Wolfgang Amadeus Mozart", salzburg: "Salzburg" });
  const s = "Wolfgang Amadeus Mozart was born on 27 January 1756 to Leopold Mozart and Anna Maria, née Pertl, at Getreidegasse 9 in Salzburg.";
  const r = bind(f, s, { page: "Wolfgang Amadeus Mozart" });
  assert.ok(r && r.filler, "a filler, not null (both sides carry the surname)");
  assert.deepEqual((r.filler.alts || []).map((a) => a.text), ["Salzburg"], "an address (a digit) is never sent to the title door");
});

test("LIVE-4 'for' governs the head noun of the ask; and NO apposition rule lifts a neighbour's attribute or a function word", async () => {
  const f = await frameOf("What is the chemical symbol for sodium?", { sodium: "Sodium", "chemical symbol": "Chemical symbol" });
  assert.deepEqual(f.attributes.map((a) => a.surface), ["chemical symbol"], "'for' at the head governs the attribute");
  assert.deepEqual(f.referents.map((r) => r.surface), ["sodium"]);
  const g = await frameOf("What is the capital of Australia?", { australia: "Australia", capital: "Capital", city: "City", jakarta: "Jakarta", melbourne: "Melbourne" });
  const t = (x) => { const r = bind(g, x); return r && r.filler ? r.filler.text : null; };
  assert.equal(t("Canberra is the capital city of Australia."), "Canberra", "the attribute's own head noun is not the answer");
  assert.notEqual(t("Australia lies south of Indonesia, whose capital Jakarta is large."), "Jakarta", "another country's capital");
  assert.equal(t("Canberra is the capital of Australia, while the former capital Melbourne hosted parliament until 1927."), "Canberra");
  const s = await frameOf("What is the chemical symbol for sodium?", { sodium: "Sodium", "chemical symbol": "Chemical symbol", there: "There", it: "It" });
  for (const x of ["Sodium has the chemical symbol it [1], and it is soft.", "Australia's capital there, Canberra, is inland."]) {
    const r = bind(s, x); assert.ok(!r || !r.filler || !/^(it|there)$/i.test(r.filler.text), "a function word is never the answer: " + x);
  }
});

test("LIVE-5 'for' governs only at the head of the ask, never a purpose ('the Nobel Prize in Chemistry for the discovery of …')", async () => {
  const f = await frameOf("Who won the Nobel Prize for Physics?", { "nobel prize": "Nobel Prize", physics: "Physics" });
  assert.deepEqual(f.attributes, [], "no run is read as an attribute of another here");
});

test("LIVE-6 an anchor that does not resolve is a typed gap, not the role as anchor ('CEO of Tesla' → the CEO page)", async () => {
  const f = await frameOf("Who is the CEO of Tesla?", { ceo: "Chief executive officer" });
  assert.equal(f.ok, false);
  assert.equal(f.gap && f.gap.kind, "referents_unresolved");
});

test("LIVE-7 a relative clause's antecedent IS its subject: the appositive 'X, who/which is …' still binds X, and a passive in it still names its agent", async () => {
  const k = await frameOf("Who is the king of the United Kingdom?", { "united kingdom": "United Kingdom", king: "King" });
  assert.equal(bind(k, "Charles III, who is the king of the United Kingdom, was crowned in 2023.").filler.text, "Charles III");
  const c = await frameOf("What is the capital of Australia?", { australia: "Australia", capital: "Capital" });
  assert.equal(bind(c, "Canberra, which is the capital of Australia, hosts Parliament.").filler.text, "Canberra");
  const p = await frameOf("Who discovered penicillin?", { penicillin: "Penicillin" });
  assert.equal(bind(p, "Penicillin, which was discovered by Alexander Fleming in 1928, is an antibiotic.").filler.text, "Alexander Fleming");
  const m = await frameOf("Where was Mozart born?", { mozart: "Wolfgang Amadeus Mozart", salzburg: "Salzburg" });
  const r = bind(m, "Mozart, who was born in Salzburg, died in Vienna.");
  assert.ok(r && r.filler && /Salzburg/.test(r.filler.text), "the place of the relation clause, never the later one");
});

test("LIVE-8 place alternatives live INSIDE the relation's own clause: a later verb, a relative clause, another person's birth, 'a house' never answer", async () => {
  const m = await frameOf("Where was Mozart born?", { mozart: "Wolfgang Amadeus Mozart", salzburg: "Salzburg", vienna: "Vienna", augsburg: "Augsburg", house: "House", home: "Home", hospital: "Hospital" });
  const alts = (x) => { const r = bind(m, x, { page: "Wolfgang Amadeus Mozart" }); return r && r.filler && r.filler.alts ? r.filler.alts.map((a) => a.text) : []; };
  for (const x of [
    "Wolfgang Amadeus Mozart was born in 1756 and died in Vienna in 1791.",
    "Wolfgang Amadeus Mozart was born in 1756, but he died in Vienna.",
    "Wolfgang Amadeus Mozart was born on 27 January 1756 to Leopold Mozart, who worked in Vienna.",
    "Wolfgang Amadeus Mozart was the son of Leopold Mozart, who was born in Augsburg.",
    "Leopold Mozart was born in Augsburg, and his son Wolfgang Amadeus Mozart was born in Salzburg.",
  ]) assert.ok(!alts(x).some((t) => /Vienna|Augsburg/.test(t)), "wrong person's or wrong event's place in: " + x + " → " + JSON.stringify(alts(x)));
  assert.deepEqual(alts("Wolfgang Amadeus Mozart was born in a house in Salzburg."), ["Salzburg"], "an indefinite noun phrase is not a place name");
  assert.ok(!alts("Wolfgang Amadeus Mozart was born at home in Salzburg, Austria.").includes("home"), "a common noun is not the place");
});

test("LIVE-9 a PERSON is a name, not a description and not a date: surnames that are common words, and the role's own holder, still answer", async () => {
  const j = await frameOf("Who founded Apple?", { apple: "Apple Inc." });
  assert.equal(bind(j, "Jobs founded Apple in 1976.").filler.text, "Jobs");
  const t = await frameOf("Who is the CEO of Tesla?", { tesla: "Tesla, Inc.", ceo: "Chief executive officer" });
  assert.equal(bind(t, "Musk is the CEO of Tesla.").filler.text, "Musk");
  const u = await frameOf("Who is the prime minister of the United Kingdom?", { "united kingdom": "United Kingdom", "prime minister": "Prime Minister of the United Kingdom" });
  const r = bind(u, "The prime minister of the United Kingdom is Brown.");
  assert.ok(r && r.filler && r.filler.text === "Brown");
  const d = bind(u, "The prime minister of the United Kingdom is the leader.");
  assert.ok(!d || !d.filler, "a description of known common words is not somebody (a word the prior has never seen is admitted: the title door is the net)");
});

test("LIVE-10 the longer-title discount consults the referent: the page that IS the referent, or whose extra words are the ask's own, is never discounted", async () => {
  const pearl = await frameOf("When was Pearl Harbor attacked?", { "pearl harbor": "Pearl Harbor" });
  const r1 = bind(pearl, "The attack on Pearl Harbor occurred on December 7, 1941.", { page: "Attack on Pearl Harbor" });
  assert.ok(r1 && r1.tier === "T1", "the extension 'attack on' is the ask's own relation");
  const tesla = await frameOf("Who founded Tesla?", { tesla: "Tesla, Inc." });
  assert.equal(bind(tesla, "Tesla, Inc. was founded by Martin Eberhard and Marc Tarpenning in 2003.", { page: "Tesla, Inc." }).filler.text, "Martin Eberhard");
  const fr = await frameOf("Who is the president of France?", { france: "France", president: "President" });
  assert.equal(bind(fr, "The president of France is Emmanuel Macron.", { page: "President of France" }).filler.text, "Emmanuel Macron");
  const pp = await frameOf("Who wrote Pride and Prejudice?", { "pride and prejudice": "Pride and Prejudice" });
  const z = bind(pp, "Seth Grahame-Smith wrote Pride and Prejudice and Zombies in 2009.", { page: "Pride and Prejudice and Zombies" });
  assert.ok(!z || z.tier !== "T1" || !z.filler, "control: a different entity's page is still discounted");
});

test("LIVE-11 the unresolved-anchor gap fires only when NO word after the governing word is in a chosen run", async () => {
  const w = await frameOf("What is the capital of western Australia?", { australia: "Australia", capital: "Capital" });
  assert.equal(w.ok, true);
  const x = await frameOf("What is the capital of the state of Texas?", { texas: "Texas", capital: "Capital" });
  assert.equal(x.ok, true);
  const g = await frameOf("Who is the CEO of Tesla?", { ceo: "Chief executive officer" });
  assert.equal(g.ok, false);
});

test("LIVE-12 OMNILINGUAL: every language fact is a GRAMMAR table; a language without one is a typed null, a table without the new fields is the old behaviour", async () => {
  const { GRAMMAR } = await import("./fold-chat-frame.js");
  const src = (await import("node:fs")).readFileSync(new URL("./fold-chat-witness.js", import.meta.url), "utf8");
  // no English closed-class list lives in the witness code any more
  for (const lit of ['"became"', '"succeeded"', '"born", "located"', '"in", "at", "on", "near"', '"has", "have", "had", "will"']) assert.ok(!src.includes(lit), "an English table is inlined in the code: " + lit);
  assert.ok(GRAMMAR.en.roleVerbs.length && GRAMMAR.en.placeVerbs.length && GRAMMAR.en.prepositions.length && GRAMMAR.en.containment.length && GRAMMAR.en.indefinites.length);
  // a language with NO table: bindSentence is null (a typed gap upstream), never an English guess
  const f = await frameOf("Where was Mozart born?", { mozart: "Wolfgang Amadeus Mozart", salzburg: "Salzburg" });
  const s = "Wolfgang Amadeus Mozart was born on 27 January 1756 to Leopold Mozart, at Getreidegasse 9 in Salzburg.";
  assert.equal(bindSentence({ text: s, start: 0, end: s.length }, { ...f, lang: "xx" }, { fw, lang: "xx" }), null);
  // GRAMMAR is frozen, so the table-absent path is pinned structurally: the alternatives rule is gated on the table's own field
  assert.ok(/frame\.slot === "place" && \(relStems\.length \|\| side === "right"\) && G\.containment/.test(src), "place alternatives fire only where the language declares containment prepositions");
});

test("LIVE-13 a described passive agent still names its person ('by the Scottish physician Alexander Fleming'); a bare description is still not one", async () => {
  const p = await frameOf("Who discovered penicillin?", { penicillin: "Penicillin" });
  const r = bind(p, "Penicillin was discovered in 1928 by the Scottish physician Alexander Fleming at St Mary's Hospital.");
  assert.ok(r && r.filler && /Alexander Fleming/.test(r.filler.text), JSON.stringify(r && r.filler));
  const q = await frameOf("Who painted the Mona Lisa?", { "mona lisa": "Mona Lisa" });
  const m = bind(q, "The Mona Lisa was painted by the Italian artist Leonardo da Vinci.");
  assert.ok(m && m.filler && /Leonardo da Vinci/.test(m.filler.text), JSON.stringify(m && m.filler));
});

test("LIVE-14 two rows whose fillers resolve to ONE page are one claimant: no contest between 'Leo Tolstoy' and 'Count Tolstoy'", async () => {
  const { runAnswerTurn } = await import("./fold-chat-answerturn.js");
  const titles = { "war and peace": "War and Peace", "leo tolstoy": "Leo Tolstoy", "count tolstoy": "Leo Tolstoy", tolstoy: "Leo Tolstoy" };
  const pages = {
    "War and Peace": "War and Peace was written by Leo Tolstoy. It was published in 1869.",
    "Leo Tolstoy": "War and Peace was written by Count Tolstoy in the 1860s.",
  };
  const pass = Object.entries(pages).map(([title, text], i) => ({ ref: "S" + (i + 1), title, url: "https://en.wikipedia.org/wiki/" + title.replace(/ /g, "_"), host: "en.wikipedia.org", lang: "en", text }));
  const deps = { fw: functionWordsOf, resolveTitles: door(Object.fromEntries(Object.entries(titles))), fetchLead: async (n) => { const t = titles[String(n).toLowerCase()]; return t && pages[t] ? { title: t, extract: pages[t], url: "u" } : null; }, searchPassages: async () => [] };
  const t = await runAnswerTurn({ question: "Who wrote War and Peace?", lang: "en", passages: pass, now: { year: 2026 }, deps });
  assert.ok(!(t.contest && t.contest.length), "one page is one claimant: " + JSON.stringify(t.contest && t.contest.map((c) => c.filler && c.filler.text)));
});

test("LIVE-15 a determiner-led run keeps its NAME ('the Scottish physician Alexander Fleming', 'The Beatles', 'A. Fleming'); a bare description is still no person", async () => {
  const p = await frameOf("Who discovered penicillin?", { penicillin: "Penicillin" });
  const t = (q, x) => { const r = bind(q, x); return r && r.filler ? r.filler.text : null; };
  assert.match(t(p, "The Scottish physician Alexander Fleming discovered penicillin in 1928.") || "", /Alexander Fleming/);
  assert.match(t(p, "Penicillin was discovered by A. Fleming in 1928.") || "", /Fleming/);
  const ar = await frameOf("Who recorded Abbey Road?", { "abbey road": "Abbey Road" });
  assert.match(t(ar, "The Beatles recorded Abbey Road in 1969.") || "", /Beatles/);
  const c = await frameOf("Who is the chancellor of Germany?", { germany: "Germany" });
  assert.equal(t(c, "With the unification of Germany in 1871 its leader became known as the chancellor of Germany."), null, "'its leader' is a description (every word is a known common noun)");
});

test("LIVE-16 place alternatives: a subordinate clause ('a day when …'), a wider appositive phrase ('…, in the Holy Roman Empire') and a different Napoleon never answer", async () => {
  const m = await frameOf("Where was Mozart born?", { mozart: "Wolfgang Amadeus Mozart", salzburg: "Salzburg", augsburg: "Augsburg", "holy roman empire": "Holy Roman Empire" });
  const alts = (q, x) => { const r = bind(q, x); return r && r.filler && r.filler.alts ? r.filler.alts.map((a) => a.text) : []; };
  assert.ok(!alts(m, "Wolfgang Amadeus Mozart was born on 27 January 1756, a day when Leopold was away in Augsburg.").includes("Augsburg"));
  assert.ok(!alts(m, "Wolfgang Amadeus Mozart was born in Salzburg, in the Holy Roman Empire.").includes("Holy Roman Empire"));
  const n = await frameOf("Where was Napoleon born?", { napoleon: "Napoleon", paris: "Paris", ajaccio: "Ajaccio" });
  const r = bind(n, "Louis Napoleon was born in Paris, and his uncle Napoleon was born in Ajaccio.");
  assert.ok(!r || !r.filler, "another Napoleon's birth is not the ask's: " + JSON.stringify(r && r.filler));
  const u = await frameOf("Who is the president of the United States of America?", { "united states": "United States", president: "President" });
  assert.equal(u.ok, true, "'United States' inside its own longer name is not an unresolved anchor");
});

test("LIVE-17 a PLACE is introduced: 'located in the Coral Sea' answers 'Coral Sea'; 'endemic' / 'a biodiversity hotspot' are descriptions, never where", async () => {
  const f = await frameOf("Where is the Great Barrier Reef?", { "great barrier reef": "Great Barrier Reef" });
  const t = (x) => { const r = bind(f, x, { page: "Great Barrier Reef" }); return r && r.filler ? r.filler.text : null; };
  assert.equal(t("The Great Barrier Reef is located in the Coral Sea, off the coast of Queensland in Australia."), "Coral Sea");
  assert.equal(t("The islands of the Great Barrier Reef also support 2,195 known plant species; three of these are endemic."), null);
  assert.equal(t("The Great Barrier Reef is a biodiversity hotspot, housing at least 450 species of hard coral."), null);
  const g = await frameOf("Where is the Taj Mahal?", { "taj mahal": "Taj Mahal" });
  const r = bind(g, "The Taj Mahal is situated in Agra, Uttar Pradesh, India.", { page: "Taj Mahal" });
  assert.equal(r && r.filler && r.filler.text, "Agra", "'situated' and 'lived' and 'raised' lead into a place (declared place verbs are compared as stems)");
});

test("LIVE-18 a page whose title is made only of the ask's own words (relation + referents) is the ask's page, never a derivative: 'Longest Rivers in Africa'", async () => {
  const f = await frameOf("What is the longest river in Africa?", { africa: "Africa", river: "River" });
  const r = bind(f, "The Nile is the longest river in Africa.", { page: "Longest Rivers in Africa" });
  assert.ok(r && r.tier === "T1" && r.filler && /Nile/.test(r.filler.text), JSON.stringify(r && r.filler));
});

test("LIVE-19 a type word recurs inside the answer's name: 'The Nile River is the longest river in Africa' answers 'The Nile River'; two Mozarts still do not", async () => {
  const f = await frameOf("What is the longest river in Africa?", { africa: "Africa", river: "River" });
  const r = bind(f, "The Nile River is not only the longest river in Africa but also in the world.", { page: "Longest Rivers in Africa" });
  assert.ok(r && r.filler && /Nile/.test(r.filler.text), JSON.stringify(r && r.filler));
  const m = await frameOf("Where was Mozart born?", { mozart: "Wolfgang Amadeus Mozart" });
  const x = bind(m, "Leopold Mozart was born in Augsburg, and his son Wolfgang Amadeus Mozart was born in Salzburg.");
  assert.ok(!x || !x.filler, "both sides carry the same name and neither has an anchor the other lacks: no filler");
});

test("LIVE-20 'No. 1' is a number sign, not a negation: a sentence that names another work's number is still a positive witness", async () => {
  const f = await frameOf("Who composed the Moonlight Sonata?", { "moonlight sonata": "Piano Sonata No. 14 (Beethoven)" });
  const r = bind(f, 'Beethoven composed the "Moonlight Sonata" during a particularly productive period of his life, a time when he was also working on his "Symphony No. 1".');
  assert.ok(r && r.polarity === "+" && r.filler && r.filler.text === "Beethoven", JSON.stringify(r && { p: r.polarity, f: r.filler }));
  const n = bind(f, "Mozart did not compose the Moonlight Sonata.");
  assert.equal(n && n.polarity, "-", "a real negation is still a negation");
});

test("LIVE-21 the referent's WHOLE name on one side decides the copula's side, not a stem the other side shares ('theory' of 'theory of general relativity')", async () => {
  const f = await frameOf("Who developed the theory of general relativity?", { "theory of general relativity": "General relativity", "general relativity": "General relativity" });
  const r = bind(f, "General relativity is a theory of gravitation developed by Einstein in the years 1907–1915.", { page: "Theory of relativity" });
  assert.equal(r && r.filler && r.filler.text, "Einstein");
});

test("LIVE-22 a hedged row is no rival: 'you may have learned that there are … four continents' does not contest 'seven'", async () => {
  const { runAnswerTurn } = await import("./fold-chat-answerturn.js");
  const titles = { continents: "Continent" };
  const pages = {
    Continent: "There are seven continents on our planet: Asia, Africa, North America, South America, Antarctica, Europe, and Australia. However, depending on where you live, you may have learned that there are five, six, or even four continents.",
  };
  const pass = Object.entries(pages).map(([title, text], i) => ({ ref: "S" + (i + 1), title, url: "https://en.wikipedia.org/wiki/" + title, host: "en.wikipedia.org", lang: "en", text }));
  const deps = { fw: functionWordsOf, resolveTitles: door(titles), fetchLead: async () => null, searchPassages: async () => [] };
  const t = await runAnswerTurn({ question: "How many continents are there?", lang: "en", passages: pass, now: { year: 2026 }, deps });
  assert.ok(!(t.contest && t.contest.length), "hedged rows are not rivals: " + JSON.stringify(t.contest && t.contest.map((c) => c.filler && c.filler.text)));
  assert.ok(t.answer && /seven/i.test(t.answer.filler.text), JSON.stringify(t.answer && t.answer.filler));
});

test("LIVE-23 one row says every word of the ask another says AND more: 'on the field' → 11, not a contest with the NFL roster's 53", async () => {
  const { runAnswerTurn } = await import("./fold-chat-answerturn.js");
  const pages = {
    "How Many Players on a Football Team": "An NFL football team carries 53 players on its active roster during the regular season.",
    "Football team": "A football team has 11 players on the field at one time.",
  };
  const titles = { "football team": "Football team" };      // "field" does not resolve to a page: it is a word of the ask, not an anchor
  const pass = Object.entries(pages).map(([title, text], i) => ({ ref: "S" + (i + 1), title, url: "https://en.wikipedia.org/wiki/" + title.replace(/ /g, "_"), host: "en.wikipedia.org", lang: "en", text }));
  const deps = { fw: functionWordsOf, resolveTitles: door(titles), fetchLead: async () => null, searchPassages: async () => [] };
  const t = await runAnswerTurn({ question: "How many players does a football team have on the field?", lang: "en", passages: pass, now: { year: 2026 }, deps });
  assert.ok(!(t.contest && t.contest.length), "the narrower sentence is no rival: " + JSON.stringify(t.contest && t.contest.map((c) => c.filler && c.filler.text)));
  assert.ok(t.answer && /\b11\b/.test(t.answer.filler.text), JSON.stringify(t.answer && t.answer.filler));
  assert.ok(t.answer.unmeasured.some((u) => /53/.test(u)), "the dominated row is disclosed, not hidden: " + JSON.stringify(t.answer.unmeasured));
});

test("LIVE-24 a relation-less PLACE ask takes the containment phrase of the copula's complement: 'on the right bank of the Yamuna in … Agra'", async () => {
  const f = await frameOf("Where is the Taj Mahal?", { "taj mahal": "Taj Mahal" });
  const alts = (x) => { const r = bind(f, x, { page: "Taj Mahal" }); return r && r.filler ? (r.filler.alts || [r.filler]).map((a) => a.text) : []; };
  assert.deepEqual(alts("The Taj Mahal is an ivory-white marble mausoleum on the right bank of the river Yamuna in the Indian city of Agra, Uttar Pradesh."), ["Indian city of Agra"]);
  assert.deepEqual(alts("The Taj Mahal is located in Agra, Uttar Pradesh, India."), ["Agra"]);
  assert.deepEqual(alts("The Taj Mahal is a famous monument."), [], "no containment phrase, no place");
  assert.deepEqual(alts("In 1983, the Taj Mahal was designated as a UNESCO World Heritage Site for being the jewel of Islamic art in India."), [], "a sentence about the designation does not say where it is");
});
