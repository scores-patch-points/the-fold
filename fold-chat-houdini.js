// fold-chat-houdini.js — HOUDINI, the archon of the projection: fold ALL the context into precisely the shape the ask needs, at the moment it needs it.
// Pure: no DOM, no IO, no model, no clock, no randomness. Same inputs, same messages. Spec and the meaning of 100%: docs/HOUDINI.md; the measure: eval/houdini/.
//
// What it replaces. vendor/the-fold/fold.js::buildTurnMessages projects the STORE by POSITION: the last RECORDS_IN_PROMPT records, the last RECENCY_WINDOW raw
// messages, whatever the ask is. A record from turn 3 that the ask is about, at turn 40, is outside the window and is simply not there; a record from turn 39 that the
// ask has nothing to do with is there anyway. The store is never truncated (fold.js P1) — only the PROJECTION is, and the projection is where this archon works.
//
//   NEED     what the ask leans on, read from the ask and the store alone: its content terms (function words come from the engine's UD priors, never a typed list; a term in at
//            least half of the pooled units tells them apart not at all — the same rule as fold-chat-assemble.js ASSEMBLE.commonShare), the referents it names (fold-chat-mind.js
//            `activated`), and whether it LEANS on the thread — the engine's own anaphora gate (fold-chat-anaphora.js, en/es/fr); where that gate has no closed-class prior (el, ru, zh,
//            ar…) it says `undecided` and Houdini falls back to robustness: an ask that bears on nothing, or has almost no content of its own, carries the thread.
//   BEAR     RECORDS bear by a greedy cover of the ask's terms that the checked records themselves attest (the thread's own phrasings — "tell me about…" — are how a person talks,
//            not what they ask about, and a record never says them): the best-carrying record leads a cluster (the terms it carries), those terms are spent, the next leads the next
//            cluster for what is still unspent. A record bears when it carries most of some cluster's weight — so every record of the topic bears, a second topic in the ask bears,
//            and a record that shares only a common noun with the leader (a decoy) does not. OLD RAW TURNS are recalled only through a unique ANCHOR: a term that occurs in at most
//            `anchorDf` exchanges and in no record — a rigid pin (Champollion's proper names: a name is found by its recurrence in the known grid, never by a wordlist).
//   VOICE    a term the thread's own user messages say in at least half of them ("the material", "say about") is how this person asks, never what they ask about: it weighs nothing, and
//            an ask in that voice is a question of its own (it is not elliptical), which is what lets a language the anaphora gate cannot decide tell a fresh ask from "Why is that?".
//   CLASS    a term that stands beside several different words across the records ("Aqueduct" after "Quilton", after "Branthorn") is the kind of thing, not a name: when the ask puts a word
//            the thread has never said directly beside it ("Zanthor Aqueduct") it names a NEW one, and the old ones bear only by coincidence, so the class term stops bearing.
//   ORDER    across the topics an ask covers: every pinned record first, then the topics in the order the ask MENTIONS them, each topic's records newest first, a record's turn counted
//            against its topic's whole recency list (pinned included), so a cut under budget takes a little from every topic and never one topic whole.
//   PIN      a bearing record that carries an `unsupported` or an `open` line rides BEFORE any other record and is the LAST thing shed: the model "must not contradict a line here
//            without saying so" (fold.js), and a record the model cannot see it cannot refrain from contradicting. But the window does not grow (the fold's founding claim), so pins
//            live inside the budget: when they alone exceed it the oldest, lowest-scoring are shed and the count is a typed gap (`pinned_unshown`) and in "Not shown".
//   RAW      the previous exchange always rides (the declared robustness floor); an ask that leans on the thread carries two; an ask whose words live in a recent raw turn reaches back to it, never
//            past the baseline window. Pairs, never split.
//   RECALL   a turn the store has no record for (nothing was checked) but whose own words the ask bears on is recalled verbatim — only when no record bears (S2 over raw).
//   BUDGET   the projection never exceeds what the positional fold would have sent for the same inputs (or `budget.chars`): the window does not grow, it is re-spent.
//   SAY      what is not shown is counted in the record block ("Not shown: N …"), and every unit has a typed reason in `plan`. Nothing is dropped silently.
//
// What it must not do: rewrite a record (the block is fold.js's own rendering, over the chosen subset); mix a paraphrase into the record block (two facts that differ must not
// read alike); mutate its inputs; call a model; read a capital letter; pretend a lexical match is a reading (an injected `reader` organ may add semantic bearing; without one the
// gap is the typed `no-reader` in the plan whenever the ask bears on nothing and does not lean on the thread).
//
// DECLARED, not measured (Constitution II.11). Giver: the user's brief of 2026-10-13 ("folding all of the context into precisely the shape that is needed at the moment it is
// needed"); every number below is a declaration the eval/houdini battery reports on, and none was fitted to its held-out seeds.
import {
  RECENCY_WINDOW, RECORDS_IN_PROMPT, ENTITIES_MAX,
  buildSummarySystemMessage, buildRecordSystemMessage, buildTurnMessages, charCount,
} from "./vendor/the-fold/fold.js";
import { segments, scriptOf, fold, mentions, activated } from "./fold-chat-mind.js";
import { FUNCTION_WORDS } from "./fold-chat-function-words.js";
import { detectLang } from "./fold-chat-lang.js";
import { anaphoraOf } from "./fold-chat-anaphora.js";
import { hintsFor } from "./fold-chat-hints.js";

// the kinds fold-chat-flow.js planTurn gives an ask that is ABOUT the earlier conversation (Terry Gross's reading; "standalone" is the one that names a topic of its own)
const THREAD_KINDS = new Set(["move", "meta", "elliptical", "carried", "conversation-ref", "retry", "source-ask"]);

export const HOUDINI = Object.freeze({
  giver: "the user's brief of 2026-10-13; declared, not measured (II.11)",
  minPool: 6,             // below this many pooled units the commonness rule is not applied (too few to say a term is common)
  commonShare: 0.5,       // a term in at least this share of the pooled units has weight 0 (fold-chat-assemble.js uses the same)
  novelWeight: 0.25,      // a content word no record attests weighs this x log(records+1): a weak witness of newness, never a witness of bearing
  novelCap: 3,            // …and the ask's novel words weigh at most this many of them together (a script that makes many terms per ask must not drown its one attested name)
  anchorDf: 2,            // a term in at most this many exchanges (and no record) can anchor the recall of an old raw turn…
  anchorShare: 0.2,       // …and in at most this share of them (rare in THIS thread, not merely in a short one)
  bearFloor: 0.3,         // the share an injected reader's reading must reach for a unit to bear. The lexical path has NO share-of-the-ask floor: a record carrying a term the ask attests bears
                          // (the floor that stood here starved multi-topic asks, and what it guarded against is the CLASS rule's job)
  relFloor: 0.7,          // a record joins a cluster of the ask's terms when it carries at least this fraction of that cluster's weight (decoy rejection)
  repairChance: 0.05,     // a misspelling is repaired only when the expected number of chance neighbours in the records' vocabulary is below this (the usual significance level)
  maxClusters: 4,         // distinct referents/topics one ask may bear on
  thinTerms: 2,           // FALLBACK only, for a language the anaphora gate cannot decide: an ask with at most this many content terms leans on the thread
  floorExchanges: 1,      // the fewest raw exchanges an ask that stands alone is cut down to under budget pressure (the last few ride otherwise)
  maxRecords: RECORDS_IN_PROMPT,
  maxRecalled: 1,         // old raw exchanges recalled verbatim, at most
});

// ── terms ────────────────────────────────────────────────────────────────────
// Spaced scripts: the engine's own script-aware segmenter. Unspaced scripts (Han, kana, Thai): overlapping character bigrams, because a segmenter's cut of a name can differ
// between the ask and the record and a bigram cannot. Memoised per object (WeakMap): pure, and a 600-turn history is segmented once, not once per ask.
const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]+/gu;
// Clitic scripts: Arabic and Hebrew fuse a one-letter function word onto the next word ("and the bridge" is one token). A token that begins with one of the language's own
// single-letter function words (the engine's UD prior, never a typed list) ALSO indexes the remainder, so "و" + a name still finds the name.
const CLITICS = {};
for (const [script, lang] of [["Arabic", "ar"], ["Hebrew", "he"]]) CLITICS[script] = new Set((FUNCTION_WORDS[lang] || []).filter((w) => [...w].length === 1).map(fold));
// pure ASCII is Latin (or no letters, which segments the same way): the full script reading is only for text that is not
const scriptFast = (s) => (/^[\x00-\x7f]*$/.test(s) ? "Latin" : scriptOf(s));
const CLITIC_START = /^[\p{Script=Arabic}\p{Script=Hebrew}]/u;
const memo = new WeakMap();
function termsOfText(text) {
  const s = String(text ?? ""), out = new Set();
  const spaced = s.replace(UNSPACED, (run) => {
    const cs = [...run];
    if (cs.length === 1) out.add(fold(cs[0])); else for (let i = 0; i + 1 < cs.length; i++) out.add(fold(cs[i] + cs[i + 1]));
    return " ";
  });
  for (const g of segments(spaced, scriptFast(spaced))) {
    const t = fold(g.text).replace(/^['’\-.]+|['’\-.]+$/g, "");
    if (t.length >= 2) out.add(t);
    if (t.length < 4 || !CLITIC_START.test(t)) continue;   // cheap first-character test before the (costly) script reading
    const cl = CLITICS[scriptOf(t)];
    if (cl && [...t].length >= 4 && cl.has([...t][0])) out.add(t.slice([...t][0].length));
  }
  return out;
}
function termsOf(x, text) {
  if (x && typeof x === "object") { let t = memo.get(x); if (!t) { t = termsOfText(text); memo.set(x, t); } return t; }
  return termsOfText(text);
}
/** The spaced-script tokens of a text IN ORDER (the same segmenter and folding as termsOfText; unspaced runs are cut out, they have no word boundary to be adjacent across). */
function orderedTokens(text) {
  const out = [];
  const spaced = String(text ?? "").replace(UNSPACED, " ");
  for (const g of segments(spaced, scriptFast(spaced))) { const t = fold(g.text).replace(/^['’\-.]+|['’\-.]+$/g, ""); out.push(t.length >= 2 ? t : "\u0000"); }   // a one-letter token ("1" in "Voyager 1") is kept as a barrier so the words either side of it are not read as neighbours
  return out;
}
/** The ONE attested word a misspelled word is a single edit away from (insert, delete, substitute or swap two neighbours), or null when there is none or more than one. Spaced scripts only. */
function oneEdit(a, b) {
  const x = [...a], y = [...b], dl = x.length - y.length;
  if (Math.abs(dl) > 1) return false;
  if (dl === 0) {
    let i = 0; while (i < x.length && x[i] === y[i]) i++;
    if (i === x.length) return false;
    if (x.slice(i + 1).join("") === y.slice(i + 1).join("")) return true;                                   // substitution
    return i + 1 < x.length && x[i] === y[i + 1] && x[i + 1] === y[i] && x.slice(i + 2).join("") === y.slice(i + 2).join("");   // swap
  }
  const [l, sh] = dl > 0 ? [x, y] : [y, x];
  let i = 0; while (i < sh.length && l[i] === sh[i]) i++;
  if (i === 0 || i >= l.length - 1) return false;   // an extra letter at either END is inflection or a clitic (history/history-his), not a slip of the finger
  return l.slice(i + 1).join("") === sh.slice(i).join("");                                                   // insert / delete, interior
}
function nearOne(t, df) {
  if ([...t].length < 4 || UNSPACED_TEST.test(t)) return null;
  let found = null;
  for (const w of df.keys()) { if (w === t || UNSPACED_TEST.test(w) || Math.abs([...w].length - [...t].length) > 1) continue; if (oneEdit(t, w)) { if (found) return null; found = w; } }
  return found;
}
const UNSPACED_TEST = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u;
const orderMemo = new WeakMap();
const orderedTokensOf = (r) => { let o = orderMemo.get(r); if (!o) { o = orderedTokens(recordText(r)); orderMemo.set(r, o); } return o; };
const recordText = (r) => [r?.gist, ...(r?.open || []), ...(r?.unsupported || [])].filter(Boolean).join(" ");
const msgText = (m) => String(m?.content ?? "");
const isPinned = (r) => (r?.unsupported || []).length > 0 || (r?.open || []).length > 0;
const fwCache = new Map();
function functionWordsFor(question, prior) {
  let lang = "unknown";
  try { lang = detectLang(question, { prior: prior || null }).lang; } catch { /* an aid, never a reason to lose a turn */ }
  if (!fwCache.has(lang)) fwCache.set(lang, new Set((FUNCTION_WORDS[lang] || []).map(fold)));
  return fwCache.get(lang);
}

/** user→assistant pairs of a history, in order; an unanswered trailing user message is a pair with `a: null`. */
function exchangesOf(history) {
  const out = []; let u = null;
  for (let i = 0; i < (history || []).length; i++) {
    const m = history[i];
    if (m?.role === "user") { if (u) out.push({ u: u.m, a: null, at: u.i }); u = { m, i }; }
    else if (m?.role === "assistant") { if (u) { out.push({ u: u.m, a: m, at: u.i }); u = null; } else out.push({ u: null, a: m, at: i }); }
  }
  if (u) out.push({ u: u.m, a: null, at: u.i });
  return out;
}
const exTerms = (ex) => { const t = new Set(); for (const m of [ex.u, ex.a]) if (m) for (const x of termsOf(m, msgText(m))) t.add(x); return t; };
const exText = (ex) => msgText(ex.u) + " " + msgText(ex.a);

/**
 * houdini(parts, opts) → { messages, plan }
 *   parts: the same as fold.js buildTurnMessages — { basePrompt, summary, history, question, sourceBlock, recencyWindow } — plus
 *          referents (the chat's referent record, optional), budget ({ chars } optional; default: what the positional projection would send).
 *   opts:  { config }  override HOUDINI fields (the eval's mutants use it; the app never does)
 *          { reader }  an injected organ (askText, unitText) → share in [0,1]; a unit also bears when it reads at least bearFloor — the seam for a semantic reading (eoreader7), never typed here
 */
export function houdini(parts = {}, opts = {}) {
  const cfg = { ...HOUDINI, ...(opts.config || {}) };
  const { basePrompt = "", summary = null, history = [], question = "", sourceBlock = null, referents = null, turn = null } = parts;
  const store = summary?.records ?? [];
  const baselineMsgs = buildTurnMessages({ basePrompt, summary, history, question, sourceBlock, recencyWindow: parts.recencyWindow });
  const baseline = charCount(baselineMsgs);
  const cap = Number.isFinite(parts.budget?.chars) ? parts.budget.chars : baseline;

  // the corpora: the checked records (what the ask can be ABOUT) and the raw exchanges (what was said)
  const exs = exchangesOf(history);
  const rTerms = store.map((r) => termsOf(r, recordText(r)));
  const exPool = exs.map((e) => ({ e, ut: exTerms(e), text: exText(e) }));
  const R = store.length, rdf = new Map(), xdf = new Map();
  for (const u of rTerms) for (const t of u) rdf.set(t, (rdf.get(t) || 0) + 1);
  for (const x of exPool) for (const t of x.ut) xdf.set(t, (xdf.get(t) || 0) + 1);
  // the thread's own asking VOICE: terms in at least half of the user's messages ("the material", "say about"). They are how this person asks, never what they ask about.
  const userTs = exs.filter((e) => e.u).map((e) => termsOf(e.u, msgText(e.u))), udf = new Map();
  for (const u of userTs) for (const t of u) udf.set(t, (udf.get(t) || 0) + 1);
  const inVoice = (t) => userTs.length >= cfg.minPool && (udf.get(t) || 0) / userTs.length >= cfg.commonShare;
  const pooled = R + exPool.length, pdf = (t) => (rdf.get(t) || 0) + (xdf.get(t) || 0);
  const commonR = (t) => R >= cfg.minPool && (rdf.get(t) || 0) / R >= cfg.commonShare;
  const commonP = (t) => pooled >= cfg.minPool && pdf(t) / pooled >= cfg.commonShare;
  // SPREAD: a word that belongs to a topic comes in a burst (the turns the person stayed on it); a word of the asking frame ("tell", "how", "tall", "built") is scattered evenly through the
  // whole thread, one per topic. Against the null of n turns placed uniformly at random among the R records (median gap = ln2 x R/(n+1)), a term whose median gap is at least that is spread,
  // and what is spread, and keeps no steady companion, names no topic. Judged only from three records up: with fewer there is no gap to read. The LOWER median is used, so a topic revisited once long after its burst stays a topic.
  const spreadMemo = new Map();
  const isSpread = (t) => {
    if (spreadMemo.has(t)) return spreadMemo.get(t);
    const at = []; for (let k = 0; k < R; k++) if (rTerms[k].has(t)) at.push(k);
    let out = false;
    if (at.length >= 3 && !UNSPACED_TEST.test(t)) {   // an unspaced script has no word boundary to read a companion across: not judged
      const gaps = []; for (let k = 1; k < at.length; k++) gaps.push(at[k] - at[k - 1]); gaps.sort((a, b) => a - b);
      const med = gaps[(gaps.length - 1) >> 1], expected = Math.LN2 * R / (at.length + 1);
      if (med >= expected) {
        // …unless it TRAVELS: a name keeps the same companion in at least half of its records ("kesmere" with "foundry"); a frame word has a different one every time
        const co = new Map();   // the word standing directly beside it, record by record (a name's companion is adjacent; boilerplate that merely shares a record is not)
        for (const k of at) { const toks = orderedTokensOf(store[k]), j = toks.indexOf(t), seen = new Set(); for (const u of [toks[j - 1], toks[j + 1]]) if (u && u !== "\u0000" && !fw.has(u) && !seen.has(u)) { seen.add(u); co.set(u, (co.get(u) || 0) + 1); } }
        const travels = [...co.values()].some((c) => c / at.length >= cfg.commonShare);
        out = !travels;
      }

    }
    spreadMemo.set(t, out); return out;
  };
  const novelW = cfg.novelWeight * Math.log(R + 1);
  // the null behind the repair of a misspelled name: how many words of the records' vocabulary would sit one edit from a word this long BY CHANCE (V words of an alphabet of A letters, a
  // neighbourhood of about 2·L·A strings out of A^L). A 4-letter word has a neighbour by chance more often than not ("wall"/"tall"); a 7-letter name almost never does.
  const alphabet = (() => { const a = new Set(); for (const w of rdf.keys()) for (const ch of w) a.add(ch); return Math.max(2, a.size); })();
  const chanceNeighbours = (t) => { const L = [...t].length; return rdf.size * 2 * L * alphabet / Math.pow(alphabet, L); };

  // the ask's content terms: function words (the engine's UD priors) and words the pooled thread says half the time weigh nothing; a term a record attests weighs its idf over the
  // records; any other content word is NOVEL and weighs a discounted constant, at most `novelCap` of them
  const fw = functionWordsFor(question, summary?.language);
  // (the fold's referent record can admit a sentence-initial "The": an entity made only of function words names nothing, and must not make every record that says "the" bear)
  const usable = (e) => [e.surface, ...(e.forms || [])].some((f) => [...termsOfText(f)].some((u) => !fw.has(u)));   // (a thread dominated by one topic says that topic's name in most of its units: common, and still the topic)
  const att = new Map(), anchors = [];   // attested content term → weight over the records
  let novelN = 0, content = 0, idiom = 0;   // idiom: words the thread itself says in at least half its units that are not function words ("the material", "say about"): the ask is in the thread's own asking voice
  const askTs = termsOf(null, question), collapsed = new Set();
  for (const u of askTs) {   // a clitic-stripped variant and its full token are ONE word: keep the one a record attests (else the full token), so a name is never weighed twice
    const cl = CLITICS[scriptOf(u)], first = [...u][0];
    if (!cl || [...u].length < 4 || !cl.has(first)) continue;
    const v = u.slice(first.length);
    if (askTs.has(v)) collapsed.add((rdf.get(u) || 0) > 0 || !(rdf.get(v) || 0) ? v : u);
  }
  const repaired = [];
  for (const t0 of askTs) {
    if (collapsed.has(t0) || fw.has(t0)) continue;
    if (inVoice(t0)) { idiom++; continue; }
    if (commonP(t0)) continue;
    // a word the thread has never said that sits ONE EDIT from exactly one word its records attest is that word, misspelled; with two candidates it is left alone (no guess)
    let t = t0;
    if (!(rdf.get(t0) || 0) && !(xdf.get(t0) || 0) && chanceNeighbours(t0) < cfg.repairChance) { const w = nearOne(t0, rdf); if (w && !commonR(w) && !askTs.has(w)) { t = w; repaired.push([t0, w]); } }
    content++;
    const d = rdf.get(t) || 0;
    if (d > 0) { if (!commonR(t) && !isSpread(t)) att.set(t, Math.log((R + 1) / (d + 0.5))); }
    else { novelN++; const x = xdf.get(t) || 0; if (x > 0 && x <= cfg.anchorDf && x / Math.max(1, exPool.length) <= cfg.anchorShare) anchors.push(t); }
  }
  // CLASS TERMS: a term that sits beside several DIFFERENT words across the checked records ("Aqueduct" after "Quilton", after "Branthorn") is the kind of thing, not the name of one:
  // it cannot identify. When the ask puts a word the thread has never said directly beside it ("Zanthor Aqueduct") it names a NEW one, and the old ones bear on it only by coincidence,
  // so the class term stops bearing. Read from the records alone; an ask that names an old referent by that term keeps bearing by identity.
  if (att.size) {
    const order = orderedTokens(question), nm = new Set(activated(question, referents).filter(usable).flatMap((e) => [...termsOfText([e.surface, ...(e.forms || [])].join(" "))]));
    for (const t of [...att.keys()]) {
      const i = order.indexOf(t);
      if (i < 0 || nm.has(t)) continue;
      const beside = [order[i - 1], order[i + 1]].filter((u) => u && u !== "\u0000" && !fw.has(u) && !inVoice(u) && !commonP(u) && !(rdf.get(u) || 0) && !collapsed.has(u));
      if (!beside.length) continue;
      const nb = new Set();
      for (let k = 0; k < store.length && nb.size < 2; k++) {
        if (!rTerms[k].has(t)) continue;
        const toks = orderedTokensOf(store[k]), j = toks.indexOf(t);
        for (const u of [toks[j - 1], toks[j + 1]]) if (u && u !== "\u0000" && !fw.has(u)) nb.add(u);
      }
      if (nb.size >= 2) att.delete(t);
    }
    // the same rule in an unspaced script, where there are no word boundaries: a Han run the ask attaches directly to a word of its own ("Ilmora档案馆"): the JUNCTION is a pair the records
    // never have, and the run's leading attested bigrams are a class term when several different characters stand before them across the records
    const q = fold(String(question ?? ""));
    for (const m of q.matchAll(UNSPACED)) {
      const run = [...m[0]], prev = [...q.slice(0, m.index)].pop();
      if (!prev || !/[\p{L}\p{N}]/u.test(prev) || fw.has(prev) || run.length < 2) continue;
      const chain = [];
      for (let k = 0; k + 1 < run.length && att.has(run[k] + run[k + 1]); k++) chain.push(run[k] + run[k + 1]);
      if (!chain.length || (rdf.get(prev + run[0]) || 0) > 0) continue;
      const before = new Set();
      for (let k = 0; k < store.length && before.size < 2; k++) { const tx = fold(recordText(store[k])), i = tx.indexOf(chain[0]); if (i > 0) before.add([...tx.slice(0, i)].slice(-2).join("")); }
      if (before.size >= 2) for (const c of chain) att.delete(c);
    }
  }
  // CARRY: Terry Gross read this turn as ABOUT the earlier conversation ("are you sure?", "and its history?") and it names nothing the store can match: it bears on what the last
  // exchange was about, the terms of the last thing the person asked, exactly as a person hearing it would.
  let carried = false;
  const carriedTerms = new Set();
  if (turn && THREAD_KINDS.has(turn.kind) && !activated(question, referents).filter(usable).length) {
    const last = exs.length ? exs[exs.length - 1] : null, top = att.size ? Math.max(...att.values()) : 0;
    for (const t of last?.u ? termsOf(last.u, msgText(last.u)) : []) {
      if (fw.has(t) || inVoice(t) || commonR(t) || isSpread(t)) continue;
      const d = rdf.get(t) || 0;
      if (d > 0) { att.set(t, Math.max(top, Math.log((R + 1) / (d + 0.5)))); carriedTerms.add(t); carried = true; }   // never outvoted by one incidental word of the ask ("tall"): the thread's topic leads
    }
  }
  const total = novelW * Math.min(novelN, cfg.novelCap) + [...att.values()].reduce((a, b) => a + b, 0);
  const wsum = (terms, ut) => { let s = 0; for (const t of terms) if (ut.has(t)) s += att.get(t) || 0; return s; };

  // referents the ask names: a record that mentions one of their forms bears by identity (an alias is the same being)
  const entities = activated(question, referents).filter(usable);
  const named = entities.flatMap((e) => [e.surface, ...(e.forms || [])]);
  const byIdentity = (text) => named.find((f) => mentions(text, f)) ?? null;

  // the greedy cover over the RECORDS: clusters of ask terms, each led by the record that carries the most of what is still unspent
  const clusters = [];
  const left = new Set(att.keys());
  while (clusters.length < cfg.maxClusters && left.size && total > 0) {
    let lead = null, best = 0;
    for (const u of rTerms) { const w = wsum(left, u); if (w > best) { best = w; lead = u; } }
    if (!lead || !(best > 0)) break;   // no share-of-the-ask floor: a record that carries a term the ask attests (and the thread does not say half the time) bears; class terms were removed above
    const C = [...left].filter((t) => lead.has(t));
    clusters.push(C);
    for (const t of C) left.delete(t);
  }
  // does the ask lean on the thread? the engine's own anaphora gate (with the language's pronoun prior where it has one); where the gate cannot decide, robustness
  let gate = { carry: false, decided: true, kind: null };
  try { let hints = null; try { hints = hintsFor(detectLang(question, { prior: summary?.language || null }).lang); } catch { /* none */ } gate = anaphoraOf(question, { lang: null, hints }); } catch { /* an aid, never a reason to lose a turn */ }
  // where the gate cannot decide: robustness (carry the thread) — unless the ask speaks in the thread's own asking voice, which a fragment of ellipsis does not ("Why is that?"), and so
  // introduces its own subject: a fresh question needs the floor exchange, not two
  const leans = gate.carry === true || (gate.decided === false && idiom === 0 && (content <= cfg.thinTerms || (!clusters.length && !anchors.length)));
  const clusterWeight = (C) => C.reduce((a, t) => a + (att.get(t) || 0), 0);
  const groupOf = (ut) => { let bi = -1, bw = 0; clusters.forEach((C, k) => { const w = wsum(C, ut); if (w > bw) { bw = w; bi = k; } }); return bi; };
  const bearsLex = (ut) => clusters.some((C) => wsum(C, ut) >= cfg.relFloor * clusterWeight(C));
  const read = (text) => (typeof opts.reader === "function" ? Number(opts.reader(question, text)) || 0 : 0);
  const score = (ut) => (total > 0 ? wsum(att.keys(), ut) / total : 0);

  // records: who bears, grouped by the cluster (or the named referent) each belongs to
  const rs = store.map((r, i) => {
    const text = recordText(r), id = byIdentity(text), rd = read(text) >= cfg.bearFloor;
    const g = id != null ? "id:" + fold(id) : bearsLex(rTerms[i]) ? "c" + groupOf(rTerms[i]) : rd ? "reader" : null;
    return { i, r, s: id != null ? 1 : score(rTerms[i]), pinned: isPinned(r), bears: g != null, g };
  });
  // PRIORITY across the ask's topics, in two tiers: every pinned record outranks every unpinned one; within a tier the topics are taken round-robin (the heaviest first, each topic
  // most-recent first) — so a cap or a budget cuts every topic a little rather than one topic entirely, and never an unsupported/open line before a plain one
  const groups = new Map();
  for (const x of rs) if (x.bears) { if (!groups.has(x.g)) groups.set(x.g, []); groups.get(x.g).push(x); }
  // the topics are taken in the ORDER THE ASK MENTIONS THEM: the person's own ordering is the only priority the ask carries between two topics it covers equally
  const q0 = fold(String(question ?? ""));
  const at = (forms) => Math.min(...forms.map((f) => { const i = q0.indexOf(fold(String(f))); return i < 0 ? Infinity : i; }));
  const gw = (key) => (key.startsWith("c") ? ((clusters[Number(key.slice(1))] || []).length && (clusters[Number(key.slice(1))] || []).every((t) => carriedTerms.has(t)) ? -1 : at(clusters[Number(key.slice(1))] || [])) : key.startsWith("id:") ? at([key.slice(3)]) : Infinity);
  const lists = [...groups.entries()].sort((a, b) => (gw(a[0]) === gw(b[0]) ? 0 : gw(a[0]) < gw(b[0]) ? -1 : 1) || a[0].localeCompare(b[0])).map(([, xs]) => xs.sort((a, b) => b.i - a.i));
  // a record's rank is its place in its topic's whole recency list (pinned records count), so a topic whose latest records are all pinned has used its turn already
  lists.forEach((l) => l.forEach((x, k) => { x.rank = k; }));
  const tier = (pinned) => { if (!pinned) return lists.flat().filter((x) => !x.pinned).sort((a, b) => a.rank - b.rank || lists.findIndex((l) => l.includes(a)) - lists.findIndex((l) => l.includes(b)) || b.i - a.i); const ls = lists.map((l) => l.filter((x) => x.pinned)), out = []; for (let k = 0; ls.some((l) => k < l.length); k++) for (const l of ls) if (k < l.length) out.push(l[k]); return out; };
  const order = [...tier(true), ...tier(false)];
  let chosen = order.slice(0, cfg.maxRecords);   // the window does not grow: the cap is strict; chronological order is restored when rendered
  const pinnedCapped = order.slice(cfg.maxRecords).filter((x) => x.pinned).length;   // pinned records the cap alone left out: counted as a typed gap below, never silent

  // raw suffix, in exchanges: the LAST FEW always ride (the person's brief of 2026-10-13: "it should likely get the last few in general") — as many exchanges as the positional fold's own
  // window. Terry Gross's reading of the turn (fold-chat-flow.js planTurn: `turn.kind`) decides what may be given up under budget pressure: an ask that is ABOUT the thread (a push-back,
  // a follow-up, an elliptical or carried ask, a reference to an earlier answer) keeps every one of them; an ask that stands alone with a topic of its own keeps only the last, and the
  // records it bears on take the room.
  const baseEx = Math.max(1, Math.floor((Number.isFinite(parts.recencyWindow) && parts.recencyWindow > 0 ? Math.floor(parts.recencyWindow) : RECENCY_WINDOW) / 2));
  const tail = exPool.slice(-baseEx);
  const rawEx = Math.min(tail.length, baseEx);
  // two witnesses: Terry's reading of the speech act (English detectors: in a language she cannot read she says "standalone" for "Why so?") and Houdini's own (the anaphora gate, and the
  // thread's own asking voice where the gate is undecided). Either one saying the ask is about the thread keeps the last few; only both saying it stands alone lets them be cut.
  const terryThread = !!(turn && turn.kind && (THREAD_KINDS.has(turn.kind) || turn.mode === "thread"));
  const dependsOnThread = terryThread || leans;
  const minRaw = Math.min(tail.length, dependsOnThread ? baseEx : cfg.floorExchanges);
  const rawSet = () => new Set(exPool.slice(exPool.length - rawEx).map((x) => x.e.at));

  // recalled old exchange (a turn nothing was recorded for): only when no record bears, and only through a unique anchor
  let recalled = [];
  if (!chosen.length && cfg.maxRecalled > 0 && anchors.length) {
    const inRaw = rawSet();
    recalled = exPool.filter((x) => !inRaw.has(x.e.at)).map((x) => ({ e: x.e, s: anchors.filter((t) => x.ut.has(t)).length })).filter((x) => x.s > 0)
      .sort((a, b) => (b.s - a.s) || (b.e.at - a.e.at)).slice(0, cfg.maxRecalled);
  }

  // render ------------------------------------------------------------------
  const view = { chosen, rawEx, recalled, dropCtx: false, dropFlow: false };
  const rendered = () => {
    const sel = [...view.chosen].sort((a, b) => a.i - b.i).map((x) => x.r);
    const shownText = sel.map(recordText).join(" ");
    const n = store.length - sel.length;
    const note = n > 0 ? `Not shown: ${n} other checked ${n === 1 ? "turn" : "turns"} on record (they stay addressed and can be re-opened).` : "";
    let rec = sel.length ? buildRecordSystemMessage({ records: sel }, { window: sel.length }) : null;
    if (rec && note) rec += "\n\n" + note;
    else if (!rec && note) rec = "ON RECORD — " + note.replace(/\.$/, "") + "; none bears on this ask.";
    let sm = summary ? { ...summary } : null;
    if (sm) {
      if (view.dropCtx) sm.context = null;
      if (view.dropFlow) sm.flow = null;
      const ents = sm.entities || [], front = (e) => mentions(question, e) || mentions(shownText, e);
      sm.entities = [...ents.filter(front), ...ents.filter((e) => !front(e))].slice(0, ENTITIES_MAX);
    }
    const sys = [basePrompt, buildSummarySystemMessage(sm), rec, sourceBlock].filter(Boolean).join("\n\n");
    const keep = new Set([...view.recalled.map((x) => x.e.at), ...exPool.slice(exPool.length - view.rawEx).map((x) => x.e.at)]);
    const msgs = sys ? [{ role: "system", content: sys }] : [];
    for (const x of exPool) if (keep.has(x.e.at)) for (const m of [x.e.u, x.e.a]) if (m) msgs.push({ role: m.role, content: m.content });
    msgs.push({ role: "user", content: question });
    return msgs;
  };

  // budget: shed in a fixed order; pinned records are never shed
  let messages = rendered();
  const gaps = [];
  let pinnedShed = 0;
  const shed = [
    () => { const c = order.filter((x) => view.chosen.includes(x) && !x.pinned).pop(); if (!c) return false; view.chosen = view.chosen.filter((x) => x !== c); return true; },
    () => { if (!view.recalled.length) return false; view.recalled = []; return true; },
    () => { if (view.rawEx <= minRaw) return false; view.rawEx -= 1; return true; },
    () => { if (view.dropCtx || !summary?.context) return false; view.dropCtx = true; return true; },
    () => { if (view.dropFlow || !summary?.flow) return false; view.dropFlow = true; return true; },
    () => { const c = order.filter((x) => view.chosen.includes(x)).pop(); if (!c) return false; view.chosen = view.chosen.filter((x) => x !== c); pinnedShed++; return true; },   // last: the pins themselves, from the bottom of the priority
  ];
  while (charCount(messages) > cap) {
    let did = false;
    for (const step of shed) if (step()) { did = true; break; }
    if (!did) { gaps.push({ kind: "over_budget", chars: charCount(messages), budget: cap, why: "the floor alone exceeds the budget" }); break; }
    messages = rendered();
  }
  if (pinnedCapped) gaps.push({ kind: "pinned_unshown", n: pinnedCapped, why: "more pinned records bear on this ask than the record cap holds; the oldest were left out and counted in \"Not shown\"" });
  if (pinnedShed) gaps.push({ kind: "pinned_unshown", n: pinnedShed, why: "the pinned records bearing on this ask exceed the budget; the oldest, lowest-scoring were left out and counted in \"Not shown\"" });
  const finalChosen = new Set(view.chosen.map((x) => x.i));
  if (!leans && !rs.some((x) => x.bears) && !recalled.length && typeof opts.reader !== "function") gaps.push({ kind: "no-reader", why: "the ask bears on nothing in the store by its words or referents; a semantic reading is not injected" });

  const plan = {
    schema: "HoudiniPlan@1",
    need: { leans, carried, repaired, turn: turn ? { kind: turn.kind || null, act: turn.act || null } : null, anaphora: gate.kind || (gate.decided === false ? "undecided" : null), terms: [...att.keys()], named, askWeight: Number(total.toFixed(3)), clusters: clusters.length },
    records: rs.map((x) => ({ turn: x.r.turn, score: Number(x.s.toFixed(3)), pinned: x.pinned, included: finalChosen.has(x.i), why: finalChosen.has(x.i) ? (x.pinned ? "bears+pinned" : "bears") : x.bears ? "shed:budget-or-cap" : x.s > 0 ? "below-cluster-or-decoy" : "no-overlap" })),
    raw: { exchanges: view.rawEx, why: turn && turn.kind ? `last-few (terry: ${turn.kind}${terryThread ? ", about the thread" : leans ? ", stands alone, but the ask leans on the thread" : ", stands alone"})` : leans ? "last-few (leans on the thread)" : "last-few" },
    recalled: view.recalled.map((x) => ({ at: x.e.at, anchors: x.s, why: "unique-anchor" })),
    chars: { total: charCount(messages), cap, baseline },
    gaps,
  };
  return { messages, plan };
}

/** Drop-in for buildTurnMessages. */
export function houdiniTurnMessages(parts, opts) { return houdini(parts, opts).messages; }
