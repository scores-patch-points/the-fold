// eval/void/battery.mjs — the VOID battery: asks with a gold void and gold fillers, written 2026-10-14 BEFORE any arm was run (eval/void/PREREG.md).
// FROZEN: battery.sha holds this file's sha256; the runner refuses a battery whose hash differs.
//
// Each row: { id, set, q, void: { slot, admits, anchor, relation, cardinality }, fillers: [accepted strings], neg?: true }
//   slot      the hole the ask's grammar names: time | person | place | thing | quantity
//   admits    what kind of thing may stand there (the void's INS field): date | person | city | country | language | currency | symbol |
//             length | count | planet | mountain | era — the author's reading, declared
//   anchor    the referent the ask is about (an English Wikipedia title)
//   relation  the content word(s) of the ask that bind the filler to the anchor (stems)
//   fillers   any one of these, found in the answer (case- and space-folded), is RIGHT; an answer containing none is WRONG
//   neg       a false-premise or unanswerable ask: any answer is WRONG, a gap is right
// set: "dev" (looked at while building) | "held" (aggregates only, until the stage closes). Alternating by position, fixed now.
// Giver of every gold value: the author's knowledge, 2026-10-14, declared; a filler absent from every recorded page is reported, never edited.

const R = [];
const add = (q, slot, admits, anchor, relation, fillers, more = {}) => R.push({ q, void: { slot, admits, anchor, relation, cardinality: more.cardinality || 1 }, fillers, ...(more.neg ? { neg: true } : {}) });

// ── time
add("When was the Sydney Opera House opened?", "time", "date", "Sydney Opera House", ["open"], ["1973"]);
add("When did construction of the Great Wall of China begin?", "time", "era", "Great Wall of China", ["construction", "begin"], ["7th century BC", "7th century BCE", "seventh century BC"]);
add("When was the Eiffel Tower completed?", "time", "date", "Eiffel Tower", ["complet"], ["1889"]);
add("When was Harvard University founded?", "time", "date", "Harvard University", ["found"], ["1636"]);
add("When did the Titanic sink?", "time", "date", "Titanic", ["sink", "sank"], ["1912"]);
add("When was the Golden Gate Bridge opened?", "time", "date", "Golden Gate Bridge", ["open"], ["1937"]);
add("When did Apollo 11 land on the Moon?", "time", "date", "Apollo 11", ["land"], ["1969"]);
add("When was the Berlin Wall built?", "time", "date", "Berlin Wall", ["built", "build"], ["1961"]);
add("When did the Berlin Wall fall?", "time", "date", "Berlin Wall", ["fall", "fell"], ["1989"]);
add("When was the Statue of Liberty dedicated?", "time", "date", "Statue of Liberty", ["dedicat"], ["1886"]);
add("In what year did the Chernobyl disaster happen?", "time", "date", "Chernobyl disaster", ["happen", "occur"], ["1986"]);
add("When was Isaac Newton born?", "time", "date", "Isaac Newton", ["born"], ["1643", "1642"]);
add("When did Queen Victoria die?", "time", "date", "Queen Victoria", ["die", "death"], ["1901"]);
add("When was the Panama Canal opened?", "time", "date", "Panama Canal", ["open"], ["1914"]);
add("When was the Empire State Building completed?", "time", "date", "Empire State Building", ["complet"], ["1931"]);
// ── person
add("Who wrote Hamlet?", "person", "person", "Hamlet", ["wrote", "writ"], ["Shakespeare"]);
add("Who painted the Mona Lisa?", "person", "person", "Mona Lisa", ["paint"], ["Leonardo"]);
add("Who designed the Sydney Opera House?", "person", "person", "Sydney Opera House", ["design"], ["Utzon"]);
add("Who discovered penicillin?", "person", "person", "Penicillin", ["discover"], ["Fleming"]);
add("Who directed Jaws?", "person", "person", "Jaws (film)", ["direct"], ["Spielberg"]);
add("Who wrote Pride and Prejudice?", "person", "person", "Pride and Prejudice", ["wrote", "writ"], ["Austen"]);
add("Who founded Microsoft?", "person", "person", "Microsoft", ["found"], ["Gates", "Allen"], { cardinality: 2 });
add("Who composed The Four Seasons?", "person", "person", "The Four Seasons (Vivaldi)", ["compos"], ["Vivaldi"]);
add("Who painted The Starry Night?", "person", "person", "The Starry Night", ["paint"], ["van Gogh"]);
add("Who invented the telephone?", "person", "person", "Telephone", ["invent"], ["Bell"]);
add("Who was the first person to walk on the Moon?", "person", "person", "Moon landing", ["first", "walk"], ["Armstrong"]);
add("Who wrote One Hundred Years of Solitude?", "person", "person", "One Hundred Years of Solitude", ["wrote", "writ"], ["García Márquez", "Garcia Marquez"]);
// ── thing (the slot is a thing; admits names WHICH kind of thing)
add("What is the capital of Australia?", "thing", "city", "Australia", ["capital"], ["Canberra"]);
add("What is the capital of Canada?", "thing", "city", "Canada", ["capital"], ["Ottawa"]);
add("What is the capital of Turkey?", "thing", "city", "Turkey", ["capital"], ["Ankara"]);
add("What is the currency of Japan?", "thing", "currency", "Japan", ["currency"], ["yen"]);
add("What is the official language of Brazil?", "thing", "language", "Brazil", ["official", "language"], ["Portuguese"]);
add("What is the largest planet in the Solar System?", "thing", "planet", "Solar System", ["largest", "planet"], ["Jupiter"]);
add("What is the capital of Switzerland?", "thing", "city", "Switzerland", ["capital"], ["Bern"]);
add("What is the capital of New Zealand?", "thing", "city", "New Zealand", ["capital"], ["Wellington"]);
add("What is the chemical symbol for gold?", "thing", "symbol", "Gold", ["chemical", "symbol"], ["Au"]);
// ── place
add("Where is the Taj Mahal?", "place", "city", "Taj Mahal", ["where"], ["Agra"]);
add("Where was Mozart born?", "place", "city", "Wolfgang Amadeus Mozart", ["born"], ["Salzburg"]);
add("Where is Machu Picchu located?", "place", "country", "Machu Picchu", ["locat"], ["Peru"]);
add("Where is the Louvre?", "place", "city", "Louvre", ["where"], ["Paris"]);
add("Where was Albert Einstein born?", "place", "city", "Albert Einstein", ["born"], ["Ulm"]);
// ── quantity
add("How tall is Mount Everest?", "quantity", "length", "Mount Everest", ["tall"], ["8,848", "8,849", "8848", "8849", "29,03"]);
add("How long is the Nile?", "quantity", "length", "Nile", ["long"], ["6,650", "6650", "4,130", "4130", "6,695"]);
add("How many moons does Mars have?", "quantity", "count", "Mars", ["moon"], ["two", "2"]);
add("How tall is the Eiffel Tower?", "quantity", "length", "Eiffel Tower", ["tall"], ["330", "1,083", "300"]);
add("How many players are on a soccer team?", "quantity", "count", "Association football", ["player"], ["eleven", "11"]);
add("How deep is the Mariana Trench?", "quantity", "length", "Mariana Trench", ["deep"], ["10,9", "10 9", "36,0", "35,8"]);
add("How many strings does a violin have?", "quantity", "count", "Violin", ["string"], ["four", "4"]);
// ── no wh-word at the front: the void is still there
add("capital of Australia?", "thing", "city", "Australia", ["capital"], ["Canberra"]);
add("Hamlet author", "person", "person", "Hamlet", ["author"], ["Shakespeare"]);
add("year the Titanic sank", "time", "date", "Titanic", ["sank", "sink"], ["1912"]);
add("Tell me who painted the Mona Lisa", "person", "person", "Mona Lisa", ["paint"], ["Leonardo"]);
add("tallest mountain in Africa", "thing", "mountain", "Africa", ["tallest", "mountain"], ["Kilimanjaro"]);
add("The Eiffel Tower was finished in what year?", "time", "date", "Eiffel Tower", ["finish"], ["1889"]);
add("Name the author of Don Quixote", "person", "person", "Don Quixote", ["author"], ["Cervantes"]);
// ── false premise / nothing to fill: a gap is the right answer
add("When did Shakespeare visit Australia?", "time", "date", "William Shakespeare", ["visit"], [], { neg: true });
add("Who was the first president of Antarctica?", "person", "person", "Antarctica", ["first", "president"], [], { neg: true });
add("What is the capital of the Moon?", "thing", "city", "Moon", ["capital"], [], { neg: true });

export const BATTERY = Object.freeze(R.map((r, i) => Object.freeze({ id: `v${String(i + 1).padStart(2, "0")}`, set: i % 2 === 0 ? "dev" : "held", ...r })));
export default BATTERY;
