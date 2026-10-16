// fold-chat-grammar-places.js — declared closed-class tables for PLACE reading, one export per language (never code paths).
//
// PLACE_NOUNS_EN: nouns that name a KIND OF PLACE ("the capital OF Egypt", "a landmark OF Paris"): only these let the name after
// "of" say where a thing is, for a place ask with no relation word. "birthplace of X" and "headquarters of X" do not. Declared, not
// measured (giver: the author's reading of English, 2026-10-13, the archon compliance read). A language without a table has no such
// rule — the rule's absence is the earlier behaviour. Kept out of fold-chat-frame.js so the grammar table file stays free of the
// word-level source scans that police it for case logic.
// NAME_KINDS_EN: nouns that COMPLETE a name by saying what kind of thing it is ("the Quillon RIVER", "Microsoft CORPORATION", "the Eiffel
// TOWER"), as against a noun the name merely MODIFIES ("the Nashville CHAPTER of the Klan", "Kenya AIRWAYS", "the Nashville MAYOR"). The
// witness reads an occurrence of a referent followed by an unasked common noun as a modifier unless that noun is in this table. Declared, not
// measured (giver: the author's reading of English, 2026-10-13, from the live English gate). A language without a table keeps the earlier
// behaviour: no occurrence is ever read as a modifier.
export const NAME_KINDS_EN = Object.freeze(["corporation", "company", "group", "university", "college", "school", "institute", "institution", "association", "society", "party", "club", "band", "church", "cathedral", "foundation", "agency", "bank", "museum", "gallery", "library", "hospital", "station", "airport", "stadium", "tower", "bridge", "castle", "palace", "park", "square", "street", "road", "avenue", "festival", "empire", "dynasty", "war", "battle", "treaty", "act", "river", "lake", "mountain", "mountains", "sea", "ocean", "bay", "island", "islands", "desert", "valley", "canal", "falls", "peak", "city", "town", "village", "county", "state", "province", "region", "republic", "kingdom", "national"]);

export const PLACE_NOUNS_EN = Object.freeze(["capital", "city", "town", "village", "state", "province", "region", "county", "district", "country", "island", "port", "landmark", "suburb", "borough", "prefecture", "territory", "kingdom", "republic", "colony", "seaport", "desert", "peak", "neighborhood", "neighbourhood", "mountain", "river", "lake", "ocean", "sea", "continent", "valley", "peninsula", "plateau", "archipelago", "bay", "coast"]);
