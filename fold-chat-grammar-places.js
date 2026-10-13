// fold-chat-grammar-places.js — declared closed-class tables for PLACE reading, one export per language (never code paths).
//
// PLACE_NOUNS_EN: nouns that name a KIND OF PLACE ("the capital OF Egypt", "a landmark OF Paris"): only these let the name after
// "of" say where a thing is, for a place ask with no relation word. "birthplace of X" and "headquarters of X" do not. Declared, not
// measured (giver: the author's reading of English, 2026-10-13, the archon compliance read). A language without a table has no such
// rule — the rule's absence is the earlier behaviour. Kept out of fold-chat-frame.js so the grammar table file stays free of the
// word-level source scans that police it for case logic.
export const PLACE_NOUNS_EN = Object.freeze(["capital", "city", "town", "village", "state", "province", "region", "county", "district", "country", "island", "port", "landmark", "suburb", "borough", "prefecture", "territory", "kingdom", "republic", "colony", "seaport", "desert", "peak", "neighborhood", "neighbourhood", "mountain", "river", "lake", "ocean", "sea", "continent", "valley", "peninsula", "plateau", "archipelago", "bay", "coast"]);
