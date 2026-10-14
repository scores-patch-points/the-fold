# The void work: who owns it, how it is built, what is settled

2026-10-14. This is the record of the work on defining the void a question names and finding what satisfies it, so none of it is reinvented. Its sources are the pre-registration `eval/void/PREREG.md` (Amendments 1–6), the results `eval/void/RESULTS.md`, and the commits on the-fold branch `void/universe`.

## The archon in charge: Koestler

khora `organs/void-holarchy.js` (Handle: Koestler; compendium `archon-compendium.js` "koestler"; dossier `docs/archons/dossier/koestler.json`).

> "Low sets possibility for high; high sets probability for low." (the compendium's own entry for Koestler)

That sentence is this work's design:
- **The void is a holon recursion.** Every level is a whole-and-part, declared over the nine operators: khora `the-fold/void-shape.js` `declareVoid`, where every omission is a typed gap.
- **The layers are levels of that holarchy.** A lower layer makes a candidate *possible*; a higher layer makes it *probable*. Higher layers recursively re-weight the lower layers' candidates (PREREG "Recursion", Amendment 5).
- Koestler also owns `organs/output-holograph.js`: every generated sentence is a pointer, either a byte address in the record or a marked `self:model`. Both the verbatim snip and the net-new paraphrase answer to that typing.

## Who else, and the seams

| archon / organ | owns | seam with the void |
|---|---|---|
| **Koestler**, `void-holarchy.js`, `void-shape.js` | the void: its declaration, its levels, possible → probable | this work |
| **Callimachus**, khora `organs/callimachus.js`, `pinax.js`, `prose-laws.js`, `cube-telling.js`, `question-void.js`, `answer-ladder.js`, `telling-grammar.*` (merged in khora#6) | **the record** (sources pinned by sha256 in the Pinax; atoms, chains, standing) and **the telling** (lenses at sizes; `realizeClaim`, in progress) | Callimachus **reads a question into Koestler's void** (`question-void.js`: slot, anchor, admits-as-asked, relation; nothing else) and **tells what the void's fill holds** (snip plus paraphrase). It never admits fillers and never reads kind edges: that is the fill, owned here. **Not yet a registered archon:** there is no Handle line and no Solon or compendium entry, so it needs a proposal ratified by the person (Solon's amendment rule). |
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

## What is measured so far (`eval/void/RESULTS.md`; offline replay of a sha-pinned recording, byte-exact)

| stack | dev Useful / WRONG | held Useful / WRONG | standing |
|---|---|---|---|
| L0, the pipeline as merged | 6 / 0 | 4 / 1 | baseline |
| L1, the declared void (perception + grammar + pathos) | **16** / 0 | **14** / 1 | **admitted** (above the void-null p95) |
| L2, the clause universe with hand rules | 16 / 0 | 14 / **2** | **not admitted** (V2 fails on held) |
| L1.1 + L2′ on organs (Amendments 4–6) | — | — | being built |

## Settled findings (so they are not rediscovered)

- **The cause, located.**
  - The chat's frame (`askFrame`) is {slot, referents, predicate}. It reads a slot only from a front wh-word, and it never says what would satisfy the slot.
  - khora's nine-field `declareVoid` was never vendored into the-fold.
  - The hyperlexicon is never read on the slot path.
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
