// fold-chat-void-born.js — L2′: the void filled inside the referent's universe, by WITNESSES weighed with the BORN RULE against a per-ask
// BORN NULL, every binding checked against the LOGOS dependency order, every verdict on NAGARJUNA's four corners (eval/void/PREREG.md,
// Amendments 4–7). Pure: no DOM, no IO, no model, no clock. Every organ is injected.
//
//   bornFill({ fields, anchor, relationWords, passages, organs, draws, seed }) →
//     { verdict, answer?, candidates:[{ value, key, mass, p, probable, witnesses }], nullTopMax, bindings, orderViolations, gaps }
//
// THE WITNESSES (a parliament; Amendment 4):
//   clause  one clause of a page that fills, in the chain's order, SIG (reaches the anchor: its name, a description by one of its witnessed
//           kinds, a pronoun the khora binder puts on it, or the elided subject of a sentence-initial participle in a sentence naming it),
//           INS (a filler the admitted kind's reader finds), CON (a token that is the relation: sameAct, or a shared gold lemma in EWT; for a
//           measure, the quantity's dimension IS the relation) — and SEG when the void declared an extent.
//   engine  one edge of the khora's rich relation reader whose one end co-refers with the anchor (namesCorefer) and whose connector holds a
//           relation token: its other end is the candidate (names), or the dates/quantities in connector+end are (dates, measures).
//
// THE BORN RULE (Amendments 5, 7): a witness that supports c with weight n (a clause's unit split over its k candidates, 1/k each) gives
// amplitude √n; amplitudes from DIFFERENT witnesses add; the coherent mass M_c = (Σ_w √n_{w,c})². PROBABLE iff M_c exceeds the null's top
// M in EVERY draw. The null: the same universe with each witness's candidate lists shuffled among its own slots. Draws and seed are the only
// declared quantities (the result's resolution is 1/draws); a null with fewer than 2 slots is a typed gap and licenses nothing.
//
// THE LOGOS ORDER (Amendment 6): khora OPERATOR_CHAIN. A binding must fill every DECLARED operator up to the highest it fills; a slot that
// fills a later operator while missing an earlier declared one is an `order_violation` naming the first missing operator.
//
// THE FOUR CORNERS (Amendment 7): hl.js verdictOfSupport(for = a probable candidate, against = a second probable OR every candidate refused).
import { splitSentences } from "./vendor/khora/native/adapters/text/spans.js";
import { extractSurfaces, namesCorefer } from "./vendor/khora/native/adapters/text/surfaces.js";
import { OPERATOR_CHAIN } from "./vendor/khora/native/kernel/cube.js";
import { verdictOfSupport } from "./vendor/khora/native/interpretation/hl.js";
import { terrainEvidence } from "./vendor/khora/native/kernel/terrain-induction.js";
import { clausesOf, datesIn, quantitiesIn } from "./fold-chat-answerspan.js";
import { stemOf } from "./fold-chat-frame.js";
import { abbreviationsOf } from "./fold-chat-cut.js";

const fold = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const QUANT_DIM = Object.freeze({ length: "len", mass: "mass", temperature: "temp" });
const DATE_ADMITS = new Set(["date", "era", "year", "century", "decade"]);
const OP_OF_FIELD = Object.freeze({ slot: "NUL", anchor: "SIG", admits: "INS", extent: "SEG", relation: "CON" });

function sentencesOf(text) {
  const out = []; let from = 0;
  for (const s of splitSentences(String(text ?? ""), { abbreviations: abbreviationsOf(String(text ?? "")) })) {
    const t = typeof s === "string" ? s : s.text ?? String(s);
    const at = text.indexOf(t, from);
    if (at < 0) continue;
    out.push({ start: at, end: at + t.length, text: t, order: out.length, offset: at });
    from = at + t.length;
  }
  return out;
}
const aliasesFor = (a) => [...new Set([a.title, a.surface, String(a.title || "").replace(/\s*\([^)]*\)\s*$/u, ""), ...(a.aliases || [])].filter((x) => x && String(x).trim().length > 1))].sort((x, y) => y.length - x.length);
const surfacesIn = (text) => { try { return extractSurfaces([text]).map((x) => x.surface); } catch { return []; } };

/** The candidates a span offers for `admits` (the admitted kind's reader), with offsets in the span. */
function fillersIn(text, admits, isAnchorName) {
  if (DATE_ADMITS.has(admits)) return datesIn(text).map((d) => ({ value: d.text, start: d.start, type: "date" }));
  if (QUANT_DIM[admits]) return quantitiesIn(text).filter((q) => q.dim === QUANT_DIM[admits]).map((q) => ({ value: q.text, start: q.start, type: "quantity", v: q.v, unit: q.unit }));
  if (admits === "count" || admits === "amount") return quantitiesIn(text).map((q) => ({ value: q.text, start: q.start, type: "quantity", v: q.v, unit: q.unit }));
  const names = surfacesIn(text);
  const longest = names.filter((n) => !names.some((o) => o !== n && o.includes(n)));
  return longest.filter((n) => !isAnchorName(n)).map((n) => ({ value: n, start: text.indexOf(n), type: "name" })).filter((x) => x.start >= 0);
}
const keyOf = (f) => {
  if (f.type === "date") { const y = String(f.value).match(/\b(\d{3,4})\b/); return y ? y[1] : fold(f.value); }
  if (f.type === "quantity" && Number.isFinite(f.v)) return `${Math.round(f.v)}${f.unit || ""}`;
  if (f.type === "name") { const w = fold(f.value).split(" "); return w[w.length - 1]; }
  return fold(f.value);
};
const yearIn = (f) => { const y = String(f.value).match(/\b(\d{3,4})\b/); return y ? Number(y[1]) : null; };

/** L2′. */
export function bornFill({ fields, anchor, relationWords = [], passages = [], organs = {}, draws = 200, seed = 20261014, strictCorefer = false, perCandidateNull = false, orderOn = true, nullMode = "filler", roleGate = null, engineOn = true } = {}) {
  const gaps = [];
  const out = (verdict, extra = {}) => ({ verdict, candidates: [], nullTopMax: null, bindings: 0, orderViolations: [], gaps, ...extra });
  if (!fields || !fields.slot) return out("unbound", { gaps: [{ kind: "no_void" }] });
  if (!anchor || !anchor.title) return out("unbound", { gaps: [{ kind: "no_anchor" }] });
  if (!fields.admits) return out("unbound", { gaps: [{ kind: "admits_undeclared" }] });
  if (["reason", "manner", "position", "proposition"].includes(fields.admits)) return out("unbound", { gaps: [{ kind: "admits_unbound", admits: fields.admits }] });
  const { sameAct = null, lemmasOf = null, ewtEntry = null, resolvePronouns = null, engineEdges = null } = organs;
  const aliases = aliasesFor(anchor);
  const isAnchorName = (s) => aliases.some((a) => { try { return namesCorefer(a, s); } catch { return fold(a) === fold(s); } }) || aliases.some((a) => fold(s).includes(fold(a)));
  // Amendment 9 (2): an engine end is the anchor only if it holds EVERY content token of one alias (no bare single-token subset)
  const contentToks = (x) => fold(x).split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 2);
  const fullAlias = (s) => { const have = new Set(contentToks(s)); return aliases.some((a) => { const need = contentToks(a); return need.length > 0 && need.every((t) => have.has(t)); }); };
  const engineIsAnchor = (s) => (strictCorefer ? fullAlias(s) : isAnchorName(s));
  const own = (p) => fold(p.title) === fold(anchor.title);
  const isMeasure = !!QUANT_DIM[fields.admits] || fields.admits === "count" || fields.admits === "amount";
  const rel = relationWords.map(fold).filter(Boolean);
  const relLemmas = new Set(rel.flatMap((r) => [r, ...(lemmasOf ? [...lemmasOf(r)] : [])]));
  const isRel = (tok) => {
    const t = fold(tok);
    if (!t) return false;
    if (rel.includes(t)) return true;
    if (sameAct && rel.some((r) => { try { return sameAct(r, t); } catch { return false; } })) return true;
    if (lemmasOf && [...lemmasOf(t)].some((l) => relLemmas.has(l))) return true;
    return false;
  };
  // ── the anchor's kinds (Kanada / terrainInduction): its own page's copula sentences, and the engine's copula edges — two witnesses
  const kinds = [];
  for (const p of passages.filter(own)) for (const s of sentencesOf(p.text)) {
    if (!isAnchorName(s.text.slice(0, Math.max(60, s.text.length / 3)))) continue;
    const m = fold(s.text).match(/\b(?:is|was|are|were|became)\s+(?:(?:widely|often|commonly|also)\s+)*(?:regarded as\s+)?(?:a|an|one of the|one of)\s+(.+?)(?:[,.;:]|$)/u);
    if (!m) continue;
    const np = []; for (const w of m[1].split(/\s+/)) { if (["in", "on", "at", "of", "for", "from", "to", "by", "with", "that", "which", "who", "and", "located", "where"].includes(w) && np.length) break; if (!["a", "an", "the"].includes(w)) np.push(w.replace(/[^\p{L}\p{N}-]/gu, "")); }
    const head = np.filter(Boolean).pop();
    if (head) kinds.push(terrainEvidence({ id: `kind:sentence:${p.ref}#${s.start}`, entityRef: anchor.title, evidenceType: "explicit_classification", kindKey: stemOf(head, "en"), kindSurface: np.join(" ") }));
  }
  for (const e of engineEdges || []) {
    if (!(engineIsAnchor(e.end1)) || !/^(?:is|was|are|were|became)\b.*\b(?:a|an|one of the)\b/u.test(fold(e.label))) continue;
    const head = fold(e.end2).split(" ").pop();
    if (head) kinds.push(terrainEvidence({ id: `kind:engine:${e.end1}|${e.label}|${e.end2}`, entityRef: anchor.title, evidenceType: "explicit_classification", kindKey: stemOf(head, "en"), kindSurface: fold(e.end2) }));
  }
  const kindKeys = new Set(kinds.map((k) => k.kindKey));
  // ── declared operators (Amendment 6): only fields the void declared take part in the order check
  const declared = new Set(Object.entries(OP_OF_FIELD).filter(([f]) => fields[f] != null && !(f === "relation" && isMeasure && !fields.relation)).map(([, op]) => op));
  if (isMeasure) declared.add("CON");   // the measure's dimension is the relation
  const chain = OPERATOR_CHAIN.filter((op) => declared.has(op));
  const orderCheck = (filled) => {
    const highest = chain.reduce((h, op, i) => (filled.has(op) ? i : h), -1);
    for (let i = 0; i <= highest; i++) if (!filled.has(chain[i])) return { ok: false, missing: chain[i] };
    return { ok: true, complete: chain.every((op) => filled.has(op)) };
  };
  // ── the clause witness's slots (every clause holding an admitted-kind candidate), with what each fills except INS's content
  const slots = [];   // { witness, instance (independence key), reach, relation, seg, cands }
  for (const p of passages) {
    const sents = sentencesOf(p.text);
    let pronounAt = new Set();
    if (own(p) && typeof resolvePronouns === "function") {
      try {
        const surfaces = surfacesIn(p.text);
        const map = new Map(surfaces.map((s) => [s, isAnchorName(s) ? "ANCHOR" : s]));
        for (const a of aliases) map.set(a, "ANCHOR");
        const r = resolvePronouns(sents, map, { minActivation: 0, minMargin: 0 });   // gates OPEN (Amendment 5): the binder's own top choice, no constant
        for (const b of r.bindings || []) if (b.referentId === "ANCHOR") pronounAt.add(b.offset);
      } catch (e) { gaps.push({ kind: "pronouns_failed", why: String(e?.message || e).slice(0, 120) }); }
    }
    for (const s of sents) {
      const sentNames = isAnchorName(s.text);
      const cls = clausesOf(s.text);
      cls.forEach((c, ci) => {
        const text = s.text.slice(c.start, c.end);
        const absStart = s.start + c.start, absEnd = s.start + c.end;
        let reach = null;
        if (isAnchorName(text)) reach = "name";
        else if (own(p) && [...fold(text).matchAll(/\b(?:the|this)\s+([\p{L}-]+)/gu)].some((m) => kindKeys.has(stemOf(m[1], "en")))) reach = "kind";
        else if ([...pronounAt].some((o) => o >= absStart && o < absEnd)) reach = "pronoun";
        else if (ci === 0 && sentNames && ewtEntry) {
          const first = (text.match(/^\s*([\p{L}'’-]+)/u) || [])[1];
          const e = first ? ewtEntry(first) : null;
          if (e && e.part > 0 && (e.upos.VERB || 0) >= Math.max(...Object.values(e.upos))) reach = "participial";
        }
        const toks = [...text.matchAll(/[\p{L}\p{N}'’-]+/gu)].map((m) => m[0]);
        const cands = fillersIn(text, fields.admits, isAnchorName);
        if (!cands.length) return;
        const relation = isMeasure ? true : toks.some(isRel);
        const seg = fields.extent ? cands.some((f) => { const y = yearIn(f); return y != null && y >= fields.extent.from && y <= fields.extent.to; }) : null;
        // Clarification 12.1: the predicate is the first ACCEPTED relation token whose EWT gold UPOS is majority VERB/AUX; none -> typed
        const verbal = (t) => { const e = ewtEntry ? ewtEntry(t) : null; if (!e) return false; const best = Math.max(...Object.values(e.upos)); return ((e.upos.VERB || 0) >= best && best > 0) || ((e.upos.AUX || 0) >= best && best > 0); };
        const relTok = isMeasure ? null : toks.find((t) => isRel(t) && verbal(t)) || null;
        slots.push({ witness: "clause", instance: `${fold(s.text)}`, ref: p.ref, start: absStart, end: absEnd, text, reach, relation, seg, cands, toks, allQ: isMeasure ? quantitiesIn(text) : null, sent: s.text, inSent: c.start, relTok });
      });
    }
  }
  // ── the engine witness's slots
  for (const e of engineEdges || []) {
    const ends = [[e.end1, e.end2], [e.end2, e.end1]];
    for (const [a, other] of ends) {
      const span = `${e.label} ${other}`;
      if (strictCorefer && !engineIsAnchor(a)) continue;
      const cands = DATE_ADMITS.has(fields.admits) || isMeasure ? fillersIn(span, fields.admits, engineIsAnchor) : (engineIsAnchor(other) ? [] : [{ value: other, start: 0, type: "name" }]);
      if (!cands.length) continue;
      const toks = [...String(e.label).matchAll(/[\p{L}\p{N}'’-]+/gu)].map((m) => m[0]);
      const sentKey = strictCorefer ? `engine-sentence:${e.refs ? [...e.refs].join(",") : ""}|${e.sentence ?? e.offset ?? e.at ?? `${fold(e.end1)}|${fold(e.label)}|${fold(e.end2)}`}` : `engine:${fold(e.end1)}|${fold(e.label)}|${fold(e.end2)}`;
      slots.push({ witness: "engine", instance: sentKey, ref: e.refs ? [...e.refs][0] : "engine", text: `${e.end1} —${e.label}→ ${e.end2}`, reach: engineIsAnchor(a) ? "name" : null, relation: isMeasure ? true : toks.some(isRel), seg: null, cands, toks, allQ: null });
    }
  }
  // ── Amendment 12: the role witness is a GATE on clause slots (never a second amplitude): a candidate is kept only if it is a CO-ARGUMENT
  //    of the relation's predicate with the anchor (readClause's subj / obj / obls spans). `roleGate(slot, aliases)` is injected; it returns
  //    { ok:true|false, refused?:reason }. soft: remove only on a successful parse that says "not a co-argument"; strict: a refusal removes too.
  const roleStats = { passed: 0, removed: 0, refused: 0, refusals: {}, implied: 0 };
  if (typeof roleGate === "function") {
    for (const sl of slots) {
      if (sl.witness !== "clause" || !sl.cands.length || isMeasure || !sl.relation) continue;   // only slots the relation test accepted can bind, so only they are gated   // a measure's predicate is adjectival (the dimension is the relation): ungated, declared
      const kept = [];
      for (const f of sl.cands) {
        let r; try { r = roleGate(sl, f, aliases); } catch (e) { r = { ok: null, refused: "gate_error" }; }
        if (r.refused) { roleStats.refused++; roleStats.refusals[r.refused] = (roleStats.refusals[r.refused] || 0) + 1; if (!r.strictOnly) kept.push(f); else if (r.keepOnRefuse) kept.push(f); }
        else if (r.ok) { roleStats.passed++; if (r.implied) roleStats.implied++; kept.push(f); }
        else roleStats.removed++;
      }
      sl.cands = kept;
    }
    for (let i = slots.length - 1; i >= 0; i--) if (!slots[i].cands.length) slots.splice(i, 1);
  }
  if (!engineOn) for (let i = slots.length - 1; i >= 0; i--) if (slots[i].witness === "engine") slots.splice(i, 1);
  // ── score a placement: bindings → n_{w,c} (one unit per independent instance, split over its candidates) → Born mass
  const orderViolations = [];
  const score = (placement, record = false) => {
    const n = new Map();   // key → Map(witness → n)
    const seenInstance = new Set();
    const values = new Map();
    let bindings = 0;
    placement.forEach((sl, i) => {
      const cands = sl.cands;
      const filled = new Set(["NUL"]);
      if (sl.reach) filled.add("SIG");
      if (cands.length) filled.add("INS");
      if (sl.seg) filled.add("SEG");
      if (sl.relation) filled.add("CON");
      const oc = orderOn ? orderCheck(filled) : { ok: true, complete: chain.every((op) => filled.has(op)) };
      if (!oc.ok) { if (record && filled.has("CON")) orderViolations.push({ witness: sl.witness, missing: oc.missing, text: String(sl.text).slice(0, 100) }); return; }
      if (!oc.complete) return;
      const inst = `${sl.witness}|${sl.instance}`;
      if (seenInstance.has(inst)) return;   // one witness instance (Amendment 7: the same sentence counts once)
      seenInstance.add(inst);
      bindings++;
      const uniq = new Map(); for (const f of cands) if (!uniq.has(keyOf(f))) uniq.set(keyOf(f), f);
      for (const [k, f] of uniq) {
        if (!n.has(k)) n.set(k, new Map());
        n.get(k).set(sl.witness, (n.get(k).get(sl.witness) || 0) + 1 / uniq.size);
        if (record && !values.has(k)) values.set(k, { f, sl });
      }
    });
    const mass = new Map([...n].map(([k, byW]) => [k, [...byW.values()].reduce((a, x) => a + Math.sqrt(x), 0) ** 2]));
    return { mass, n, values, bindings };
  };
  const real = score(slots, true);
  // ── the Born null: each witness's candidate lists shuffled among its own slots
  const byWitness = (w) => slots.map((s, i) => [s, i]).filter(([s]) => s.witness === w);
  const shuffleable = ["clause", "engine"].filter((w) => byWitness(w).length >= 2);
  let nullTopMax = null;
  const nullOwnMax = new Map();   // Amendment 9 (3): each candidate's own maximum mass across the null's draws
  if (nullMode === "relation") {
    // Amendment 11: fillers FIXED; the relation replaced by one of the universe's own attested verbs (EWT gold UPOS majority VERB), drawn
    // uniformly; for a measure, the admitted dimension replaced by another dimension the page's quantities carry. Per-candidate: c is
    // probable iff its real mass exceeds its own counterfactual mass in every draw.
    const ownToks = new Set();
    for (const p of passages.filter(own)) for (const m of String(p.text).matchAll(/[\p{L}'’-]+/gu)) ownToks.add(fold(m[0]));
    const verbs = [...ownToks].filter((t) => { const e = ewtEntry ? ewtEntry(t) : null; if (!e) return false; const v = e.upos.VERB || 0; return v > 0 && v >= Math.max(...Object.values(e.upos)) && !isRel(t); });
    const dims = isMeasure ? [...new Set(slots.flatMap((sl) => (sl.allQ || []).map((q) => q.dim)).filter((d) => d && d !== QUANT_DIM[fields.admits]))] : [];
    const pool = isMeasure ? dims : verbs;
    if (pool.length < 2) gaps.push({ kind: "null_unbuildable", why: isMeasure ? "fewer than 2 other dimensions" : "fewer than 2 attested verbs" });
    else {
      let st = seed >>> 0; const rnd = () => ((st = (st * 1664525 + 1013904223) >>> 0) / 2 ** 32);
      nullTopMax = 0;
      for (let d = 0; d < draws; d++) {
        const pick = pool[Math.floor(rnd() * pool.length)];
        const placement = slots.map((sl) => {
          if (isMeasure) {
            const cands = (sl.allQ || []).filter((q) => q.dim === pick).map((q) => ({ value: q.text, start: q.start, type: "quantity", v: q.v, unit: q.unit }));
            return { ...sl, cands };
          }
          const lem = new Set([pick, ...(lemmasOf ? [...lemmasOf(pick)] : [])]);
          const rel2 = (sl.toks || []).some((t) => { const f = fold(t); if (f === pick) return true; if (sameAct) { try { if (sameAct(pick, f)) return true; } catch {} } return lemmasOf ? [...lemmasOf(f)].some((l) => lem.has(l)) : false; });
          return { ...sl, relation: rel2 };
        }).filter((sl) => sl.cands.length);
        const sc = score(placement);
        const top = Math.max(0, ...sc.mass.values());
        if (top > nullTopMax) nullTopMax = top;
        for (const [k, M] of sc.mass) if (M > (nullOwnMax.get(k) || 0)) nullOwnMax.set(k, M);
      }
      gaps.push({ kind: "null_mode", mode: "relation", pool: pool.length });
    }
  } else if (!shuffleable.length) gaps.push({ kind: "null_unbuildable", why: "fewer than 2 slots for every witness" });
  else {
    let st = seed >>> 0; const rnd = () => ((st = (st * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    nullTopMax = 0;
    for (let d = 0; d < draws; d++) {
      const placement = slots.map((s) => ({ ...s }));
      for (const w of shuffleable) {
        const idx = byWitness(w).map(([, i]) => i);
        const lists = idx.map((i) => slots[i].cands);
        for (let i = lists.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [lists[i], lists[j]] = [lists[j], lists[i]]; }
        idx.forEach((i, k) => { placement[i].cands = lists[k]; });
      }
      const sc = score(placement);
      const top = Math.max(0, ...sc.mass.values());
      if (top > nullTopMax) nullTopMax = top;
      for (const [k, M] of sc.mass) if (M > (nullOwnMax.get(k) || 0)) nullOwnMax.set(k, M);
    }
  }
  const total = [...real.mass.values()].reduce((a, x) => a + x, 0) || 1;
  const candidates = [...real.mass].map(([key, M]) => ({
    key, value: real.values.get(key)?.f.value, mass: +M.toFixed(4), p: +(M / total).toFixed(4),
    probable: nullTopMax != null && (perCandidateNull ? M > (nullOwnMax.get(key) || 0) : M > nullTopMax),
    nullOwn: +(nullOwnMax.get(key) || 0).toFixed(4),
    witnesses: Object.fromEntries([...real.n.get(key)].map(([w, x]) => [w, +x.toFixed(3)])),
    at: real.values.get(key)?.sl,
  })).sort((a, b) => b.mass - a.mass);
  const probable = candidates.filter((c) => c.probable);
  const allRefused = candidates.length === 0 && orderViolations.length > 0;
  const verdict = verdictOfSupport(probable.length >= 1, probable.length >= 2 || allRefused);
  const res = { verdict, candidates: candidates.map(({ at, ...c }) => c), nullTopMax: nullTopMax == null ? null : +nullTopMax.toFixed(4), bindings: real.bindings, orderViolations, gaps, kinds: [...kindKeys], role: roleStats };
  if (verdict === "bound") {
    // the SNIP is source bytes: the clause slot that holds the bound candidate (an engine edge's text is not the source's own words)
    const top = candidates[0];
    const clause = slots.find((sl) => sl.witness === "clause" && sl.reach && sl.relation && sl.cands.some((f) => keyOf(f) === top.key));
    res.answer = clause
      ? { text: clause.text, value: top.value, ref: clause.ref, at: `${clause.ref}#${clause.start}-${clause.end}`, witness: "clause" }
      : { text: null, value: top.value, ref: null, at: null, witness: "engine", gap: "no clause holds the bound value: no verbatim snip" };
  }
  return res;
}

export default { bornFill };
