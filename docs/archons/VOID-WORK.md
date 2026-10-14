# The void work: who owns it, how it is built, what is settled

2026-10-14. This is the record of the work on defining the void a question names and finding what satisfies it, so none of it is reinvented. Its sources are the pre-registration `eval/void/PREREG.md` (Amendments 1–6), the results `eval/void/RESULTS.md`, and the commits on the-fold branch `void/universe`.

## The archon in charge: Nagarjuna (corrected by the user, 2026-10-14)

The user: "no Nagarjuna should be about the void, koestler is about holons."

**Nagarjuna owns the void** (śūnyatā: emptiness as the ground a filler must be shown to depend on). In Solon's register Nagarjuna is already "the four corners", the one lattice for every mechanical verdict (khora `hl.js`'s Belnap-Dunn FDE: is / is-not / both / neither). A void's outcome lives on exactly that lattice:
- **is:** filled. A filler is admitted, probable past its Born null.
- **is-not:** refuted. A candidate is shown not to fill it (the wrong kind, an order violation).
- **both:** contested. Two fillers stand, and the contest does not crown one.
- **neither:** a gap. Nothing is shown either way, and that is a typed void, never a guess.

The void's declaration is khora `the-fold/void-shape.js` `declareVoid` (nine operators, every omission typed). Its verdicts are Nagarjuna's four corners, checked against `hl.js`'s real values, never a second lattice under another name.

**Koestler owns the holons:** khora `organs/void-holarchy.js`, the void laid out as a recursion of levels, every level a whole-and-part. His compendium entry carries the recursion rule this work runs on: "Low sets possibility for high; high sets probability for low." A lower layer makes a candidate *possible*; a higher layer makes it *probable* and re-weights the lower layers' candidates (PREREG "Recursion", Amendment 5). Koestler also owns `organs/output-holograph.js`: every generated sentence is a pointer (a byte address in the record or a marked `self:model`), so both the snip and the paraphrase answer to that typing.

## Who else, and the seams

| archon / organ | owns | seam with the void |
|---|---|---|
| **Nagarjuna**, `hl.js` four corners; `void-shape.js` `declareVoid` | **the void**: its declaration and its verdicts (is / is-not / both / neither) | this work |
| **Koestler**, `void-holarchy.js`, `output-holograph.js` | the holons: levels, possible → probable across them; sentences as pointers | the layers, and the recursion between them |
| **Callimachus**, khora `organs/callimachus.js`, `pinax.js`, `prose-laws.js`, `cube-telling.js`, `question-void.js`, `answer-ladder.js`, `telling-grammar.*` (merged in khora#6) | **the record** (sources pinned by sha256 in the Pinax; atoms, chains, standing) and **the telling** (lenses at sizes; `realizeClaim`, in progress) | Callimachus **reads a question into Nagarjuna's void** (`question-void.js`: slot, anchor, admits-as-asked, relation; nothing else) and **tells what the void's fill holds** (snip plus paraphrase). It never admits fillers and never reads kind edges: that is the fill, owned here. **Not yet a registered archon:** there is no Handle line and no Solon or compendium entry, so it needs a proposal ratified by the person (Solon's amendment rule). |
| **Wald**, `organs/wald.js` (shadow) | what a prompt must **pull**: none / thread / local / structured / web | supplies the pages the void's universe is read from |
| **Huginn** | which model, if any | none here: no layer calls a model (V6) |
| **Gary / Kondo** | what a model is handed | only if a model is ever the mouth |
| **Kanada**, khora `kernel/terrain-induction.js` (renamed from kind-induction, khora `terrain-induction` @ ca92fc6d) | induction across terrains; `terrainEvidence` | the anchor's kinds, and so `admits` from the universe |
| **Talmy**, `gfp-claim.js` | figure against ground | the open edge as a claim: `claimFromTriple` |
| **Xushen**, `hyperlexicon.js`; **Berge**, `hypergraph.js` (rich S50 reader, `reader-bundle.js`) | the relation ledger | the engine witness. Measured: it binds name → name only |
| **Mozi** (grounding), **Bukhari** (corroboration), **Tungara** (`contest.js`) | witnessed, independent, adjudicated | admission and contest (EVA) |
| **Panini**, `experiencer.js`; **Abhinavagupta**, `pathos.js` | for whom | every void carries its experiencer (pathos) |
| **YadaYadaYada**, `run-dmca.js` | paraphrase equated, model-free | checks that the paraphrase is the same claim |
| **Koopman**, `dmd.js`; `for-whom.js` `coherentMass` / `trajectoryNull` | the dynamics | DMD over the recursion; the Born-rule coherent mass against a shuffled null |

## The house rules this work is bound by (each from the user, 2026-10-14)

1. **Every stage gives a useful answer, more useful as they stack.** A layer is admitted only if Useful rises and WRONG never rises, on dev **and** held (bars V1–V4).
2. **The layers recurse.** Higher layers re-weight lower layers' probabilities, and the recursion must beat feed-forward and a feedback-null (V5).
3. **The full stack.** Perception (khora surfaces, spans, relations), logos (the reasoning organs), pathos (experiencer, the person's next act), all from the khora's own organs, never hand-rolled (Amendment 1).
4. **Induction for ALL terrains** (Kanada → terrainInduction), not only Kind (Amendment 4).
5. **No hand-set thresholds.** Weights are Born-rule amplitudes (ψ = Σ_w √n), and *probable* means beating every draw of a per-ask Born null. Organ gates that demand a number are opened, and the decision moves to the null. DMD with rank "numerical" runs up and down (Amendment 5).
6. **Logos is the dependency order.** Every binding must be prefix-closed under khora `OPERATOR_CHAIN`; paraphrases are checked through `CELL_OF_GRAMMAR` (Amendment 6).
7. **Two forms of every answer:** the verbatim snip, and a net-new paraphrase realized EOT → NL by the Callimachus writer and equated by YadaYadaYada (Amendment 3).
8. No model anywhere on this path. The model is only ever the mouth.

## What is measured so far (`eval/void/RESULTS.md` "CLEAN RESULTS"; offline replay of a sha-pinned recording, byte-exact)

The first recording had frozen 84 Wikipedia rate-limit 429s as evidence (Amendment 10); every arm was re-recorded and these are the clean figures.

| stack | dev RIGHT / WRONG / Useful | held RIGHT / WRONG / Useful | standing |
|---|---|---|---|
| L0, the pipeline as merged | 7 / 0 / 8 | 5 / 1 / 7 | baseline |
| L1, the declared void (perception + grammar + pathos) | 7 / 0 / **20** | 5 / 1 / **18** | **admitted** (above the void-null p95) |
| L1.1, longest perceived name | 7 / 0 / 20 | 5 / 1 / 19 | admitted |
| **L1.2, longest name from the ask's own runs** | 7 / 0 / **21** | 5 / 1 / **19** | **admitted: the last admitted stack** |
| L2, clause universe with hand rules | 8 / 0 / 20 | 6 / **4** / 17 | **refused** (held WRONG 1 → 4) |
| L2′, L2c, L2c-noorder, L2d (Born parliament, engine, order check, counterfactual nulls) | = L1.2 | = L1.2 | **refused**: each is identical to L1.2 |

The gain is informative gaps (the void says WHAT is missing), not new correct answers. **The open gap is a slot-fill witness**, one that picks which licensed filler fills the slot.

## The structured door (Amendment 14, the user's rule: "kinds have specific parameters (keys), that's what makes them a kind")

Identity by Wikidata item (the encyclopedia's own `wikibase_item`), the kind's key set = the item's own keys ∪ its classes' declared `P1963`, a relation matches a key by label, alias or dominant lemma (open-class words only), the property's own datatype is the `admits` kind, verdicts on hl.js's four corners. **L5-keyed: RIGHT dev 7 → 18, held 5 → 15 (11 and 10 from the door); WRONG +1 each, so not admitted under the written rule.** Ablation L5-open (property-label search over all properties) is worse, so the rule holds. See RESULTS.md. Open: verb/adjective → noun-label derivation (*tall* → *height*), the admission rule's treatment of finer-grained true answers and set answers.

## The principle (the user, 2026-10-14): EOT is the pivot; every language goes in and out through its OWN grammar

"We need to respect every language's grammar. We can go from any grammar in to EOT and out to any grammar and language as we want."

NL(any grammar) → **EOT** → NL(any grammar), with no language as the pivot. English is one output grammar among many, never the interlingua. Earlier wording in this file and in the amendments that said "englished" or "P-id → English label" means *the language-free claim rendered in English as one target*, and should be read that way. Consequences:
- A language's word order, case marking and function words are **its grammar's** (RoleConfig@1, order parameters, forms), never an English default.
- The door's answer is an **EOT claim** (anchor Q-id, property P-id, typed values, grounds), and the line the person reads is a **realization** in the grammar and language asked for. Dates and numbers go through CLDR (`Intl`) for the language, labels come from Wikidata in that language.
- A language with no declared grammar is a typed gap (`no_grammar_for_language`), never a fall-through to English.

## Omnilingual: how it was solved before, and what the keyed door inherits (read 2026-10-14)

**The user's ask:** make whatever we do "englished and SOV shaped as needed", and do things that improve general omnilingual reading.

**What exists, measured:**
- **The record is GFP, not English** (khora `relations-language.js`): `{end1, label, end2}` typed by cube cell. "English-SVO" comes online per language **only** when a `RoleConfig@1` is declared, built from that language's own treebank by `build-role-config.mjs`. About **50 languages** have one (`janus/priors/role-config-*.json`: jpn, kor, tur, hin, fas, arb, heb, cmn, lzh, fin, hun, eus, …), plus POS priors for **200+** languages.
- **SOV is a measured parameter, not a rule.** `role-config-jpn`: subject before its head 7149 / 7149, object before 4606 / 4606, with the case markers が (precision 0.75 against a shuffled-null ceiling of 0.19) and を (0.92 against 0.15). Order is a measured per-language property of each relation.
- **"Englished" is a projection of the meaning layer** (khora `eot-realize.js`, `eot-rich.js` `linearize`): the EOT meaning layer holds content nodes, cube-addressed arcs and absorbed function words with **no word order and no surface form**; a language's grammar projects it to words (order from `before / meanLeft / meanRight` per relation|UPOS; form from a measured irregular table; function words re-realized). Model-free, "measured honestly, never a claim the original is recoverable". Callimachus's realizer is the same shape.
- **Omnilingual falsification** (`eval/omnilingual/RESULTS.md`): with only declared es/fr tables, **11 of 16** English-built improvements hold in es and fr; 5 fall with **named causes**: (PRIOR, 3) the received priors were English (no stemmer or POS prior for es/fr), (RULE: fold, 2) stripping diacritics makes *né* the function word *ne*, (RULE: tokenizer, 1) the French inversion *y a-t-il*. Fixed in code: every accented table word had silently never matched, and English shapes had been spelled in rules instead of tables. The creole work (`eval/creole`) added measured tables for hat/pcm/tpi/mfe/jam, and POS packs by **alignment projection** from a parallel text.
- **Language of the ask** comes from `detectLang` (40 languages' priors); `askFrame`'s production `GRAMMAR` has **one language, English**. Wikipedia editions for the title door: 17 (`WIKI_EDITIONS`: en es fr de pt it nl ru uk zh ja ko ar he hi th el).

**What the keyed door already has for free:**
- Q-ids and P-ids are language-free, and **a property id is the interlingua**: it is exactly the GFP label. "Englished" is `P…` → its English label.
- A kind's keys (`P1963`, the item's own keys) are language-free.
- Matching a relation to a key is a **bag of open-class words**: **word order does not matter**, so SOV does not break it. The door only needs the language's labels (`languages=xx`), the question language's Wikipedia edition for identity, and that language's open-class test (its POS prior, 200+ languages, in place of EWT).

**What SOV does touch** (the slot frame and the anchor, not the door):
- The interrogative stands **in situ before the verb** (ja *いつ…か*, ko, tr, hi): L1 already finds the interrogative anywhere, which is why it was written that way.
- Anchor candidates are whitespace runs: Japanese and Chinese need the language ear (`language-context.js`, which the chat already has for Chinese and Arabic).
- Interrogative **tables**: only `en` is declared in production, by the author's reading. They could be **received** instead of declared: every UD treebank carries `PronType=Int`, and the PUD parallel treebanks (20 languages) give an alignment-projected slot type, the same technique the creole POS packs used.

**What doing the door would teach the general reader** (each reusable beyond the void):
1. **An omnilingual relation lexicon.** Wikidata property labels and aliases exist in hundreds of languages: every one is a (surface word → P-id) pair in that language, with the language's lemma from its morphology prior. That is a relation vocabulary the reader does not have today (its relation vocabulary is induced per text, by recurrence).
2. **The verb → noun derivation gap, learned instead of tabled.** For an item whose page states a typed value, the sentence on the page that holds both the anchor and the value carries the surface relation (*wrote*, *was born*, *completed*). Aggregated over the items of a kind and a language, against a shuffled null, that is a measured *verb → property* lexicon (*wrote* → P50, *completed* → P1619), per language, with no derivation table. It is the open failure of the door (*sank*, *tall*, *compose*), and it is distant supervision the reader already has the pieces for (khora `kind-functional-induction.js`, `hl-acquire.js`).
3. **Interrogatives and role markers per language**, received from treebank features and projected by alignment, replacing the declared English table.

**Proposed order (each a pre-registered arm; none built yet):**
1. The door in the question's language, on a labelled non-English battery (es, fr, de, ja, ko, tr, hi, ru), with identity through that edition's `wikibase_item`, the language's POS prior, and the language's labels. The declared English-only pieces are listed as typed gaps (`no_grammar_for_language`, as now).
2. The distant-supervision relation lexicon (above, item 2), English first, with its null; then the same code on es and ja.
3. Interrogative tables received from `PronType=Int` and PUD alignment, scored against the omnilingual battery's es/fr declared tables.

## Settled findings (so they are not rediscovered)

- **The cause, located.**
  - The chat's frame (`askFrame`) is {slot, referents, predicate}. It reads a slot only from a front wh-word, and it never says what would satisfy the slot.
  - khora's nine-field `declareVoid` was never vendored into the-fold.
  - The hyperlexicon is never read on the slot path.
- **A null licenses fillers and cannot choose between them.** Under the relation-counterfactual Born null (L2d) the right fillers become probable, but each ask then has two probable fillers (contested), so nothing answers. Callimachus's drive eval (khora PR #12) found the same from the other side: the claims picked are about the figure, not filling the slot, and its contest was wrong 5 of 5.
- **The engine's rich reader binds name → name.** The date and the referring expression land inside connector text ("peter hall —, the building was formally opened by→ queen elizabeth"). So the unit for binding a void is the clause, with the engine as one witness (Amendment 2).
- **Six dev causes, each a missing organ:**
  - a nominal relation (painting by → paint);
  - the anchor ("Prejudice" for "Pride and Prejudice", fixed by L1.1, the longest name with both witnesses);
  - a quantity slot (the dimension is the relation);
  - an elided subject ("Born in Ulm");
  - a light verb (happen: no organ, a typed gap);
  - the capital of Canada (open).
- **Relation identity** is khora `sameAct` (inflection, received morphology prior), plus a shared gold lemma in UD English-EWT r2.14 (khora `native/eval/fixtures/ud-english-ewt`). It is never a stemmer or a word list.
- **`resolvePronouns`** binds he/himself to Einstein on his page, and binds nothing on the Opera House page. "The building" is reached by kind, not by a pronoun.
- **Mechanical paraphrase prior art** (swept 2026-10-14): only the Callimachus realizer writes net-new frames. `eot-realize.js` `regularForm` holds the morphology. `chaseParaphrase` equates by label substring, so it is one-directional. The rest only re-cite. The plan agreed with Callimachus: voice from the claim's roles, tense from the source verb's features, the preposition from the filler's precision, forms from EWT, a reverse-parse equate, a net-new check against a null, and the logos order check.

## Where everything is

- **the-fold** (branch `void/universe`): `fold-chat-void-declare.js` (L1), `fold-chat-void-universe.js` (L2), `eval/void/` (battery, PREREG, harness, run, nulls, RESULTS, recording), and the vendored `void-shape.js` and `terrain-induction.js`.
- **khora:** the organs above. The terrain-induction rename is on branch `terrain-induction` (c12416c2 → ca92fc6d), not pushed.
- **Coordination:** the Callimachus session builds `realizeClaim`. The Wald session's archon is in shadow (the-fold#4, khora#5).
