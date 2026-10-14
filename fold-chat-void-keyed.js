// fold-chat-void-keyed.js — L5: THE KEYED DOOR (eval/void/PREREG.md, Amendment 14). Pure but for the injected `getJson` (one audited fetch).
// No DOM, no model, no clock, no table of properties, no constant.
//
// A kind has specific parameters (keys): that is what makes it a kind (the user, 2026-10-14). So the anchor's KIND licenses exactly its own keys, and a
// relation is a parameter of the kind or it is nothing. The door:
//
//   keyedFill({ fields, anchor, relationWords, askWords, getJson, sameAct, lemmasOf, keyed }) →
//     { verdict: "bound"|"contested"|"unbound", answer?, value(s), property, qid, keys, void?: { declaredNoValue }, refused?, ... }
//
//   identity     anchor title → Wikipedia pageprops.wikibase_item (exact) → the item's claims
//   the kind     the item's own keys ∪ the declared keys of each of its classes (P31 → class item → P1963 "properties for this type")
//   a match      a relation word equals a key's label/alias, or shares a lemma with a token of it (sameAct over the received morphology prior;
//                EWT gold lemmas). No derivation table: a verb with no matching noun label is a typed refusal, never a guess.
//   the type     the property's OWN datatype is the admits kind (time / quantity / wikibase-item); a mismatch is refused
//   the verdict  hl.js verdictOfSupport: one value = bound; more than one for a property Wikidata marks single-valued (P2302 single-value
//                constraint) = contested; more than one otherwise = bound as the set; a declared key with no value = a typed void
// `keyed:false` is the ablation: property candidates come from Wikidata's property-LABEL search over all properties (the probe's method).
import { verdictOfSupport } from "./vendor/khora/native/interpretation/hl.js";

const WD = "https://www.wikidata.org/w/api.php";
const WP_OF = (edition) => `https://${edition}.wikipedia.org/w/api.php`;   // the question's own edition identifies the anchor (the identity witness is that edition's wikibase_item)
const SINGLE_VALUE_CONSTRAINT = "Q19474404";
const fold = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const toksOf = (s) => fold(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const chunk = (xs, n) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const qs = (o) => new URLSearchParams({ format: "json", origin: "*", ...o }).toString();

// datatype ← the void's admits (the property's own value type is the kind of thing that may stand there)
const DATATYPE_OF_ADMITS = Object.freeze({ date: "time", era: "time", year: "time", century: "time", decade: "time", length: "quantity", mass: "quantity", temperature: "quantity", count: "quantity", amount: "quantity", person: "wikibase-item", place: "wikibase-item", city: "wikibase-item", country: "wikibase-item", language: "wikibase-item", currency: "wikibase-item", thing: "wikibase-item" });
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ── THE OUT-GRAMMAR (the user's principle, 2026-10-14: any grammar in → EOT → any grammar out; English is one target, never the pivot) ──
// The door's result is an EOT claim, language-free; the line a person reads is a REALIZATION of it for a language. Dates and numbers are CLDR
// (`Intl`) for that language; labels come from Wikidata in that language. DECLARED (not measured): the date-order locale for "en" is en-GB
// (day month year, as the battery's gold shows) and the sentence-final / colon forms for the CJK scripts; every other language uses its own
// Intl locale and the ASCII forms. A language with no Intl locale falls to English with a typed `realized_in`.
const CJK = new Set(["ja", "zh", "ko"]);
const LOCALE_OF = (lang) => (lang === "en" ? "en-GB" : lang);
/** A Wikidata time value, for a language, at its own recorded precision (11 day, 10 month, 9 year). BC years and centuries keep the English form. */
export function renderTimeFor(v, lang = "en") {
  const m = String(v.time || "").match(/^\+(\d{4,})-(\d{2})-(\d{2})/);
  if (!m || v.precision < 9) return renderTime(v);
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  try {
    const when = new Date(Date.UTC(y, Math.max(0, mo - 1), Math.max(1, d)));
    if (v.precision >= 11 && mo && d) return new Intl.DateTimeFormat(LOCALE_OF(lang), { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(when);
    if (v.precision === 10 && mo) return new Intl.DateTimeFormat(LOCALE_OF(lang), { timeZone: "UTC", month: "long", year: "numeric" }).format(when);
    return new Intl.DateTimeFormat(LOCALE_OF(lang), { timeZone: "UTC", year: "numeric" }).format(when);
  } catch { return renderTime(v); }
}
/** The claim, for a language: `<anchor> — <property>: <values>.` with the colon and full stop of the language's script. */
export function realizeClaim(claim, { lang = "en", labels = {} } = {}) {
  const a = labels.anchor || claim.anchor.title, p = labels.property || claim.relation.label;
  const vals = claim.values.map((v) => (v.kind === "time" ? renderTimeFor(v, lang) : v.kind === "quantity" ? new Intl.NumberFormat(LOCALE_OF(lang)).format(Number(v.amount)) : (labels.items && labels.items[v.qid]) || v.text || v.qid));
  const colon = CJK.has(lang) ? "：" : ":", stop = CJK.has(lang) ? "。" : ".", sep = CJK.has(lang) ? "、" : "; ";
  return `${a} — ${p}${colon} ${vals.join(sep)}${stop}`;
}

/** A Wikidata time value rendered at its own recorded precision (11 day, 10 month, 9 year, ≤8 coarser). English. */
export function renderTime(v) {
  const m = String(v.time || "").match(/^([+-])(\d{4,})-(\d{2})-(\d{2})/);
  if (!m) return String(v.time);
  const y = Number(m[2]) * (m[1] === "-" ? -1 : 1), mo = Number(m[3]), d = Number(m[4]);
  const yy = y < 0 ? `${-y} BC` : String(y);
  if (v.precision >= 11 && mo && d) return `${d} ${MONTHS[mo - 1]} ${yy}`;
  if (v.precision === 10 && mo) return `${MONTHS[mo - 1]} ${yy}`;
  if (v.precision === 8) return `the ${Math.floor(Math.abs(y) / 10) * 10}s${y < 0 ? " BC" : ""}`;
  if (v.precision <= 7) return `the ${Math.ceil(Math.abs(y) / 100)}${["th", "st", "nd", "rd"][((Math.ceil(Math.abs(y) / 100) % 100) - 20) % 10] || ["th", "st", "nd", "rd"][Math.ceil(Math.abs(y) / 100) % 10] || "th"} century${y < 0 ? " BC" : ""}`;
  return yy;
}

export async function keyedFill({ fields, anchor, relationWords = [], askWords = [], getJson, sameAct = null, lemmasOf = null, dominantOf = null, keyed = true, skipWords = null, lang = "en", edition = null, slotFree = false, rankByCoverage = false, suffixes = false } = {}) {
  const res = (verdict, extra = {}) => ({ verdict, ...extra });
  if (!fields || (!fields.admits && !slotFree)) return res("unbound", { refused: "admits_undeclared" });   // slotFree: no slot reader for this language; the property's own datatype stands
  if (!anchor || !anchor.title) return res("unbound", { refused: "no_anchor" });
  const wantType = slotFree ? null : DATATYPE_OF_ADMITS[fields.admits] || (fields.admits ? "wikibase-item" : null);
  // 1. identity: the encyclopedia's own wikibase_item for the exact title
  const pp = await getJson(`${WP_OF(edition || lang)}?${qs({ action: "query", prop: "pageprops", ppprop: "wikibase_item", titles: anchor.title, redirects: "1" })}`);
  const page = Object.values(pp?.query?.pages || {})[0];
  const qid = page?.pageprops?.wikibase_item;
  if (!qid) return res("unbound", { refused: "no_identity", title: anchor.title });
  const LANGS = lang === "en" ? "en" : `${lang}|en`;   // labels in the asker's language, English as fallback
  const pick = (e) => (e?.labels?.[lang]?.value) || (e?.labels?.en?.value) || null;
  const ent = await getJson(`${WD}?${qs({ action: "wbgetentities", ids: qid, props: "claims|labels", languages: LANGS })}`);
  const claims = ent?.entities?.[qid]?.claims || {};
  const itemKeys = Object.keys(claims);
  // 2. the kind's parameters: own keys ∪ the classes' declared keys (P31 → class → P1963)
  const classIds = (claims.P31 || []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
  let declared = new Set();
  if (classIds.length) {
    const ce = await getJson(`${WD}?${qs({ action: "wbgetentities", ids: classIds.join("|"), props: "claims", languages: "en" })}`);
    for (const id of classIds) for (const c of ce?.entities?.[id]?.claims?.P1963 || []) { const p = c.mainsnak?.datavalue?.value?.id; if (p) declared.add(p); }
  }
  // Clarification 14.1: only OPEN-CLASS words may name a key; a modifier (ADJ/NUM) is dropped when a NOUN/VERB relation word is present
  const OPEN = new Set(["NOUN", "PROPN", "VERB", "ADJ", "ADV", "NUM"]);
  const upos = (w) => { const d = dominantOf ? dominantOf(w) : null; return d ? d.upos : null; };
  let words = [...new Set([...relationWords, ...askWords].map(fold).filter(Boolean))].filter((w) => !(skipWords && skipWords.has(w))).filter((w) => { const u = upos(w); return u == null || OPEN.has(u); });
  const heads = words.filter((w) => { const u = upos(w); return u === "NOUN" || u === "PROPN" || u === "VERB"; });
  if (heads.length) words = words.filter((w) => { const u = upos(w); return !(u === "ADJ" || u === "NUM"); });
  let keySet;
  if (keyed) keySet = [...new Set([...itemKeys, ...declared])];
  else {
    // the ablation: property-LABEL search over all of Wikidata, kept only where the entity has the property (the probe's method)
    const cand = new Set();
    for (const w of words) { const s = await getJson(`${WD}?${qs({ action: "wbsearchentities", search: w, language: "en", type: "property", limit: "5" })}`); for (const x of s?.search || []) if (claims[x.id]) cand.add(x.id); }
    keySet = [...cand];
  }
  if (!keySet.length) return res("unbound", { qid, refused: "no_keys" });
  // 3. labels, aliases, datatypes of the keys
  const props = new Map();
  for (const ids of chunk(keySet, 50)) {
    const pe = await getJson(`${WD}?${qs({ action: "wbgetentities", ids: ids.join("|"), props: "labels|aliases|datatype", languages: LANGS })}`);
    for (const [id, e] of Object.entries(pe?.entities || {})) props.set(id, { id, label: pick(e) || id, aliases: [...(e.aliases?.[lang] || []), ...(lang === "en" ? [] : (e.aliases?.en || []))].map((a) => a.value), datatype: e.datatype });
  }
  // open-class tokens only, and the DOMINANT lemma of each (EWT's whole lemma sets bridge closed-class words: where -> be, of -> have)
  const sameWord = (a, b) => {
    if (a === b) return true;
    if (suffixes && b.length >= 2 && a.length > b.length && a.startsWith(b)) return true;   // Clarification 16.1: agglutinative — the label token is the witness
    const da = dominantOf ? dominantOf(a) : null, db = dominantOf ? dominantOf(b) : null;
    if (da && db) { if (!OPEN.has(da.upos) || !OPEN.has(db.upos)) return false; if (da.lemma && da.lemma === db.lemma) return true; }
    if (sameAct) { try { if (sameAct(a, b)) return true; } catch { /* unknown form */ } }
    return false;
  };
  const matches = [];
  for (const p of props.values()) {
    const names = [p.label, ...p.aliases];
    let how = null;
    for (const w of words) {
      if (names.some((n) => fold(n) === w)) { how = `label/alias = "${w}"`; break; }
      if (names.some((n) => toksOf(n).some((t) => sameWord(w, t)))) { how = `shares a lemma with "${w}"`; break; }
    }
    if (how) {
      // label coverage (Clarification 16.1): the share of the label's open-class tokens an ask word equals; the best over label and aliases
      let cov = 0, hits = 0;
      for (const n of names) {
        const ts = toksOf(n).filter((t) => { const u = upos(t); return u == null || OPEN.has(u); });
        if (!ts.length) continue;
        const m = ts.filter((t) => words.some((w) => sameWord(w, t))).length;
        const c = m / ts.length;
        if (c > cov || (c === cov && m > hits)) { cov = c; hits = m; }
      }
      matches.push({ ...p, how, cov, hits });
    }
  }
  if (!matches.length) {
    const open = [...props.values()].filter((p) => !wantType || p.datatype === wantType).map((p) => p.label);
    return res("unbound", { qid, refused: "no_matching_key", openVoid: open.slice(0, 12), nKeys: props.size, words });
  }
  // 4. the property's own value type is the admits kind
  const typed = matches.filter((p) => !wantType || p.datatype === wantType);
  if (!typed.length) return res("unbound", { qid, refused: "datatype_mismatch", matched: matches.map((p) => `${p.label}:${p.datatype}`), wantType });
  // 5. values, with the single-value constraint for the verdict
  const hit = [];
  const need = typed.filter((p) => claims[p.id]);
  const declaredNoValue = typed.filter((p) => !claims[p.id]).map((p) => p.label);
  if (!need.length) return res("unbound", { qid, void: { declaredNoValue }, refused: "kind_has_key_no_value", matched: typed.map((p) => p.label) });
  const pent = await getJson(`${WD}?${qs({ action: "wbgetentities", ids: need.map((p) => p.id).join("|"), props: "claims", languages: "en" })}`);
  const refIds = [];
  for (const p of need) {
    const single = (pent?.entities?.[p.id]?.claims?.P2302 || []).some((c) => c.mainsnak?.datavalue?.value?.id === SINGLE_VALUE_CONSTRAINT);
    const vals = [];
    for (const c of claims[p.id]) {
      if (c.rank === "deprecated") continue;
      const dv = c.mainsnak?.datavalue; if (!dv) continue;
      if (dv.type === "wikibase-entityid") { vals.push({ id: dv.value.id, kind: "item", rank: c.rank }); refIds.push(dv.value.id); }
      else if (dv.type === "time") vals.push({ kind: "time", time: dv.value.time, precision: dv.value.precision, text: renderTimeFor(dv.value, lang), rank: c.rank, raw: dv.value.time });
      else if (dv.type === "quantity") vals.push({ kind: "quantity", amount: dv.value.amount, text: String(Number(dv.value.amount)), rank: c.rank, unit: dv.value.unit });
      else if (dv.type === "string") vals.push({ kind: "string", text: dv.value, rank: c.rank });
    }
    // preferred rank wins when any value is preferred (Wikidata's own statement)
    const pref = vals.filter((v) => v.rank === "preferred");
    hit.push({ prop: p, single, vals: pref.length ? pref : vals });
  }
  const labelOf = new Map();
  for (const ids of chunk([...new Set(refIds)], 50)) {
    const le = await getJson(`${WD}?${qs({ action: "wbgetentities", ids: ids.join("|"), props: "labels", languages: LANGS })}`);
    for (const [id, e] of Object.entries(le?.entities || {})) labelOf.set(id, pick(e) || id);
  }
  for (const h of hit) for (const v of h.vals) if (v.id) v.text = labelOf.get(v.id) || v.id;
  let best = hit.find((h) => h.vals.length) || null;
  let propertyTie = false;
  if (rankByCoverage) {
    const withVals = hit.filter((h) => h.vals.length).sort((a, b) => (b.prop.cov - a.prop.cov) || (b.prop.hits - a.prop.hits));
    if (withVals.length) {
      best = withVals[0];
      const tied = withVals.filter((h) => h.prop.cov === best.prop.cov && h.prop.hits === best.prop.hits);
      const sig = (h) => h.vals.map((v) => v.text || v.id).sort().join("|");
      propertyTie = tied.length > 1 && new Set(tied.map(sig)).size > 1;   // equal coverage, different values: a contest between properties
    }
  }
  if (!best) return res("unbound", { qid, refused: "no_value", matched: typed.map((p) => p.label) });
  const values = [...new Set(best.vals.map((v) => v.text))];
  const verdict = verdictOfSupport(true, (values.length > 1 && best.single) || propertyTie);   // against = a second value for a single-valued property, or a tie between properties
  // the EOT claim (language-free) and its realization for `lang`
  const claim = { schema: "EOClaim@1", anchor: { qid, title: anchor.title }, relation: { property: best.prop.id, label: best.prop.label, datatype: best.prop.datatype },
    values: best.vals.map((v) => (v.kind === "item" ? { kind: "item", qid: v.id, text: v.text } : v.kind === "time" ? { kind: "time", time: v.time, precision: v.precision } : v.kind === "quantity" ? { kind: "quantity", amount: v.amount, unit: v.unit } : { kind: "string", text: v.text })),
    grounds: `${qid}#${best.prop.id}` };
  const items = {}; for (const v of best.vals) if (v.id) items[v.id] = v.text;
  const anchorLabel = lang === "en" ? null : pick(ent?.entities?.[qid]);
  const text = realizeClaim(claim, { lang, labels: { anchor: anchorLabel, property: best.prop.label, items } });
  return res(verdict, {
    qid, property: { id: best.prop.id, label: best.prop.label, how: best.prop.how, datatype: best.prop.datatype, single: best.single },
    values, claim, lang, answer: verdict === "bound" ? { text, grounds: `${qid}#${best.prop.id}` } : null,
    alternatives: hit.filter((h) => h !== best && h.vals.length).map((h) => `${h.prop.label}=${h.vals.map((v) => v.text).join("; ")}`),
    nKeys: props.size, declaredNoValue,
  });
}

export default { keyedFill, renderTime };
