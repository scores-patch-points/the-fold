# The limit map — where the model-free path ends (2026-10-13)

Operator's question: *"we know eventually we need to bring the local LLM in, we just want to find the limit."*
This is the measured answer, from the first gate run (GATE.md): live web, no model reachable, held-out set (49 scripts) and the 96-prompt battery.
Every row below was read, not inferred; `eval/modelless/` has the runs and the classifier.

## 1. The ceiling for one-fact asks (held-out: 27 slot + 6 holder + 4 compute = 37)

| | count | share |
|---|---|---|
| committed and correct today | 13 | 35% |
| the right answer **on screen** (an oracle selector over what retrieval handed the fold would commit it) | 29 | **78%** |
| committed WRONG | 3 | 8% |
| right answer not in anything shown (a retrieval limit, not an answering limit) | 5 | 14% |

So, for single facts, **78% is the ceiling of any answering layer, with or without a model, over today's retrieval.** The model-free layer sits
at 35%. The 43-point gap is the headroom, and it is almost all mechanical.

## 2. The 24 factual rows that did not commit correctly, by cause

| cause | n | what it is | what closes it | model needed? |
|---|---|---|---|---|
| **contest with the right answer present** | 11 | fillers of the wrong TYPE or the wrong SCOPE sit beside the right one: *April 30* for "who was first president", *city* / *irrigation* for a place / a river, *53* (NFL roster) vs *11*, *12* (an electric violin) vs *4*, a duplicate surface of one entity | rival typing by the ask's slot; same-entity merge through the title door; independent-source majority against a null (Bukhari's chains); a scope word of the ask ("on the field", "typical") must appear | **No** for type and duplicates; scope is the only place a mouth could help |
| **gap with the right sentence as "closest"** | 5 | the sentence is right and the filler is not extracted: *born … at Getreidegasse 9 **in Salzburg***, *the chemical symbol or formula **Na***, *composed the "Moonlight Sonata"*, a tense gate that refuses a present-tense fact because the nearest sentence is in the past | three grammar rules: the last title-resolved place in a "born" phrase; apposition to a said attribute; a quoted title as the referent | **No** |
| **retrieval: right answer not shown** | 5 | the pages read hold only anniversaries, productions, past capitals (*Berlin Wall* 2009, *Titanic Sinks Tonight*, *Alexandria* for Egypt) | prefer the referent's own page lead and a sentence where the anchor is the subject of a stated relation over a mention; query reformulation | **No** for the lead and subject preference; a mouth may help reformulate the query |
| **committed wrong** | 3 | a derivative page whose title *contains* the asked title (*Pride and Prejudice and Zombies*), a role-definition sentence for a holder ask, a product sentence for a company ask | the occurrence belongs to the longer entity: discount it; holder rows must name a person | **No** |

**Reading:** of 24 failures, none *needs* a model. One slice (scope words) is where a mouth could add something at the margin.

## 2b. Everything that is not a single fact (96-prompt battery, live, pre-panel code)

| class | n | today | nature |
|---|---|---|---|
| compound asks | 8 | 0 committed; a step graph then nothing | **mechanical, unbuilt** at the live seam (the stub proof passes 3/3); the fix session is on it |
| follow-ups | 6 | 0 committed; R0 with sources shown | **mechanical, unbuilt**: carry an anchor and a relation, not a pronoun |
| URL asks | 4 | read, sources shown | mechanical to select the sentence; **the model phrases** |
| multilingual | 6 | gap or sources shown | **priors**, not a model: languages without a grammar table end in typed gaps |
| explain (grounded prose) | 10 | sources shown for an absent mouth | **model**: the writing step; the fold's role is to ground and check it |
| opinion / advice | 6 | typed gap or sources | **model**, behind a policy line (the fold does not answer from memory) |
| generate (poem, email, code, translate) | 10 | typed refusal | **model**, and `ALONE_KINDS = []` is a policy decision, not a capability |
| WildChat (50 real asks) | 50 | 0 committed; 24 sources shown; 12 gaps | mostly generation and open conversation: the model's territory |

## 3. The limit, stated

- **Facts:** the model-free limit is the retrieval limit, ~78% on this set, not an answering limit; the model adds little to a one-fact ask
  except phrasing and, at the margin, scope. The next ~40 points are rival typing, three extraction rules and the lead/subject preference.
- **Conversation:** follow-ups and compound asks are not model-bound either: they need an anchor-and-relation carried across turns. The
  anchor/relation/attribute frame (4019850) is the structure for it; the cross-turn binding is the unbuilt part.
- **Prose:** explanation, opinion, summary, translation, generation and open dialogue are where the model is *required*. About a quarter
  of the 96-prompt battery (26 of 96) and most of real WildChat traffic are in this class.

So the local model is not a fix for the factual layer; it is the writing layer. Its three declared roles (R0: *steer*, *residue*,
*prosify*) map onto exactly the rows above: steer = carry the anchor across turns and reformulate a failed query; residue = the grounded
prose of an explanation; prosify = the sentence around a computed or committed value.

## 4. What this measurement does NOT show

- It does not measure the model. Headless Chromium has no WebGPU, so no in-tab model ran. Whether a 1–2B local model writes grounded prose
  well enough for the 27% (C6) is untested and is the first thing the model arm must measure.
- It does not test the model as a *selector* among candidates. The lineage's rule is that the model never decides; if that rule is
  relaxed, the oracle number above (78%) is the ceiling that experiment would be measured against.
- One run per condition; live web varies about ±15 points. 49 held-out scripts is a small sample.
