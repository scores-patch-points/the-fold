# The void and the felt field are the same need
### ideation after the swarm — 2026-10-10

Read with `docs/WHAT-IT-ACTUALLY-DOES.ascii`. Citations are file:line.

## 0. The synthesis (the surviving reading)

The fold already owns a concept for *"this does not stand"* — **the void**. It is not one
thing; it is five shapes that never reconciled (ascii map §2), and none of them is calibrated.
The khora **felt field** is the calibration that is missing: raw signal in abundance
(`feltSense`, `bayesianSurprise`, `exchangeSurprise`, `observe`, pathos rhyme/curve) but **no
producer whose input is the felt field and output is "off"** (swarm brief C). So the answer to
"how do we know if some FEELS off" and to "it's fucked up on defining the void" is the *same
change*: one calibrated standing signal, one shape.

---

## 1. Hyperlexicon → answer almost instantly

### What is already callable today (proven, O(1))

- `createCurrentFactsStore({file,search,now,lensForAsk}).resolve(ask,{rng})`
  → `{route, kind, link, ms, ok, request, lens, order, contested}`
  (khora `native/organs/current-facts.js:271`). Frozen index `buildRouteIndex`
  (`native/kernel/hyperlexicon-routes.js:184`), five O(1) hops — `exact-kind, alias,
  jurisdiction, ordinal, holder` (`:34-45`).
  **This path already answers the president case instantly and correctly**: it resolves the
  ask to `kind:role:president` and the live `link.holder`, and is contested-not-guessed when
  ambiguous (`current-facts.js:279`).
- `applyVerdictGate({ask,answer,ground,kind,link,route,now,lens})`
  (khora `native/organs/fact-gate.js:377`) — splices the model's draft against `link.holder`,
  appends *"Checked against Wikidata, as of <date>"*, **never mints a byte span**.

This is why the web-scrape path (president → disambiguation → 14–24 s → sometimes wrong) is
strictly worse for *dated role-kind* questions: there is already a sub-second, correct, null-
checked answer in the khora.

### The assertion ledger / text face (promising, unmeasured)

- Identity is the triple: `noteId(end1,label,end2)` (khora `native/kernel/notes.js:87`).
- `fold(log)` returns ALL notes sorted by witnesses (notes.js:986) — **O(n) recompute, and the
  log is in-memory only** ("born and discarded", `cli/claude-code-context.mjs:251`). No loader.

### To go from a loaded hyperlexicon to a sub-second grounded answer

1. **Persist the ledger** (append-only `.jsonl`) — today nothing survives the process.
2. **Build the fold once** into an inverted index keyed by `(subject|label|object|faces)`, so
   lookup is O(1) instead of `fold()`'s O(n) scan.
3. **Persist the kernel affordance projection** (`hyperlexiconAt`, `hypergraph-projection.js:154`)
   so it is not replayed per request.
4. **Question → (route | triple)** parser: extend `parseRouteRequest`
   (`routes.js:112`) beyond head/jurisdiction/ordinal/holder; for arbitrary triples, normalize
   the relation reader's output to a triple.
5. **Entity resolution onto ledger faces** (`end1Face`/`end2Face` are carried, not indexed).
6. **Answer assembly**: sentence + span address (`spans[].at` is already `ref#start-end`) +
   standing, ranked by `witnesses.length` (the only ranker that exists).
7. **Miss → fall through to the web** — which is exactly today's `unreached` void.

### DISSENT (measured — do not bury it)

`native/eval/competence/r3-hyperlexicon.mjs` **falsified** the lookup arms: hyperlexicon /
keyedHl / keyedRefs scored at or below a plain `keyed` baseline on **every** stem
(eng 0.207 vs 0.585 keyed; 416 net-new forms, 0 PROPN gold).
So: **"instant" is proven for structured role-kind facts (the routes store — and that is the
president case); it is NOT proven for the hyperlexicon as a general lexical lookup.** Lead with
the routes store. Treat the ledger index as promising but unmeasured.

---

## 2. Khora felt field → know when something FEELS off

### What exists (raw signal) vs what does not (a verdict)

| signal | file:line | shape |
|---|---|---|
| `feltSense(text)` | `native/adapters/text/felt-sense.js:50` | per-token `score`,`verby` ∈ [−1,1]; `byPos` centre; `axes`; `polarity` |
| `reGroundCondition(read)` | `native/organs/pathos.js:140` | categorical `ground_holds / stale / collapse / contested / lifted` |
| `strainOf(...)` | `native/the-fold/strain.js:60` | `{level 0..3, reasons, coverage}` — "something is off: thin retrieval…" (`:53`) |
| `exchangeSurprise` | `native/the-fold/aperture.js:333` | 0..1 scalar (max of arrivals) |
| `bayesianSurprise` / `admit` | `kernel/bayes-surprise.js:113` | bits (KL vs prior) |
| `observe` / `huntSettled` | `emergence/tiers.js:222`, `metacognition.js:483` | `{surprise, rank, censored, passed}` vs a continuation null |

**The problem:** the two calibrated off/rise ladders are `reGroundCondition` (curve-based) and
`strainOf` (retrieval-based) — and **neither consumes the felt field**. Worse, on the surface the
pathos curve is `measured:false` (`pathos.js:106`), so `collapse` *structurally cannot fire where
the person reads* (measured 0/24). `feltSense` is imported only by eval scripts — **not wired into
any reading path**.

### To turn the field into a surface-usable "this reads off"

1. **Reduce the field** to a per-text scalar: `mean |cos − byPos|` — distance from the text's own
   felt centre (there is no such reducer today).
2. **Give it a null**: a resample/shuffle control of the same shape — the codebase already does
   this for coverage (`the-fold/calibration.js:65` `placeCoverage`); the felt field has no null.
3. **A cut measured from the stream**, never a declared threshold (`calibration.js:107-122` is the
   house rule: "a null answers surprise; some cuts need badness").
4. **Per-claim attribution**: `feltAttestations` (`felt-sense.js:125`) already carries the
   first-mention byte offset — map it onto a claim's `basis.support` span.
5. **Surface it as the void's basis**, not as a new banner: "this answer reads off" carries the
   felt number AND the span.

---

## 3. The one change that fixes both

Replace the five void shapes and the unwired felt field with **one standing signal**:

```
Standing@1 = {
  stands:  false,                       // the human-readable disposition
  kind:    "no-span" | "off-topic" | "stale" | "contested" | "reads-off" | "unreached",
  basis:   { felt: <scalar + null>, coverage: {total, grounded}, surprise: <bits> },
  at:      "<ref#start-end>",           // the span the verdict is about
  claims:  [ { text, at, stands } ],    // per-claim, not per-turn
  closeBy: [...]
}
```

- One shape (§2 map → one), one kind vocabulary, one meaning of `read`.
- The felt field becomes the `basis.felt` term; the coverage check becomes `basis.coverage`;
  the surprise meters become `basis.surprise`.
- A miss falls through to the hyperlexicon routes store (§1) for an instant role-kind answer
  before it ever touches the web; only a real index miss becomes `unreached`.
- `looksDisambiguation` (`fold-chat-senses.js:53`) is consulted in the READ chain, so a
  disambiguation page is a pointer, never ground (kills the president case at the source).
