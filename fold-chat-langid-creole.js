// fold-chat-langid-creole.js — the creole recognition tier of fold-chat-langid.js. Pure: no DOM, no IO, no model, no network.
//
// WHY: the base detector has treebank priors for 40 languages and none for a creole, so a Haitian sentence is confidently Maltese
// and a Tok Pisin one Indonesian (eval/creole/BASELINE.md: 41% of held-out creole sentences confidently wrong). The UDHR fallback
// tier cannot help: it only runs when the core abstains, and the core does not abstain on these.
//
// WHAT: a tier ABOVE the base. It scores the creole priors TOGETHER with the base core Latin priors in one group (the base's own
// feature accounting: a feature only a creole lists costs the core languages their floor) and reads one statistic,
//     T_c = s_c − max over core languages s_i          (nats; the creole's lead over the best base language)
// A text is creole c only if T_c exceeds TAU[c] at its length: the largest T_c any NON-creole text of no more tokens reached (the
// null; scripts/build-creole-priors.mjs). A table of steps [[tokens, nats], …]: T grows with length, so is its null maximum.
// Which creole: the lead of the best creole over the runner-up must exceed MU[best|runner] at that length (the largest lead a
// wrong creole had in cross-validation); inside one lexifier family a lead below it returns the FAMILY (cpf/cpe/cpp/crp, ISO 639-2), across families
// `unknown`. Nothing below the cutoff changes anything: the tier returns null and identify() is exactly what it was.
// No weight, margin or length is typed in here: every cutoff is a table the builder derived.
import { PRIORS as CREOLE_PRIORS, META, TAU, MU, SUPERSEDES } from "./fold-chat-creole-priors.js";

// ISO 639-2 collective codes for a lexifier family: the label returned when the tier cannot separate its members.
export const FAMILY_CODE = Object.freeze({ French: "cpf", English: "cpe", Portuguese: "cpp", Spanish: "crp" });
export const FAMILY_NAME = Object.freeze({ cpf: "French-based creole", cpe: "English-based creole or pidgin", cpp: "Portuguese-based creole", crp: "creole" });

// A declared reading of leetspeak (a fact about how people type, not a threshold): a token that mixes a letter and one of these
// digits/symbols is also read with them replaced. "1" is read as i; fold-chat-typing.js declares the same table per language.
const LEET = Object.freeze({ "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s" });
/** The leet-decoded reading of a text, or null when no token mixes letters with a leet symbol (then there is no second reading). */
export function leetReading(text) {
  let changed = false;
  const out = String(text ?? "").split(/(\s+)/).map((t) => {
    if (!/\p{L}/u.test(t) || ![...t].some((c) => LEET[c])) return t;
    const r = [...t].map((c) => LEET[c] || c).join("");
    if (r !== t) changed = true;
    return r;
  }).join("");
  return changed ? out : null;
}

/** The value of a derived staircase [[tokens, nats], …] (ascending) at a text of `n` tokens: its last step at or below n. */
export function stairAt(steps, n) {
  if (!steps || !steps.length) return null;
  let v = steps[0][1];
  for (const [k, x] of steps) { if (k <= n) v = x; else break; }
  return v;
}
/** items [[tokens, value], …] → the staircase of running maxima (a step only where the maximum rises). */
export function stairOf(items) {
  const by = new Map();
  for (const [n, v] of items) if (!by.has(n) || v > by.get(n)) by.set(n, v);
  const out = []; let run = -Infinity;
  // rounded UP: the table is never below the null maximum it was derived from
  for (const n of [...by.keys()].sort((a, b) => a - b)) if (by.get(n) > run) { run = by.get(n); out.push([n, Math.ceil(run * 100) / 100]); }
  return out;
}

/** A scorer over (core Latin priors + competitor priors + creole priors). `ctx` is what fold-chat-langid.js hands over:
 *  { decodeGroup(entries), scoreGroup(g, tokens, P, prior), coreEntries(), udhrEntries(exclude), tokenize(text) }.
 *  `competitors`: [[key, prior], …] the non-core languages a creole must also beat (default: the base's UDHR priors that are
 *  not superseded; the builder passes cross-fitted ones). `screen` (the runtime): a cutoff table; a text that no creole leads
 *  the CORE by more than its cutoff is dropped before the rivals are ever decoded — exact, not a heuristic, because adding rivals
 *  can only lower a creole's lead (every non-core prior is charged the largest core floor, so its extra floor charges are never
 *  smaller than a core language's). */
export function makeScorer(ctx, priors = CREOLE_PRIORS, competitors = null, { screen = null } = {}) {
  const creoleCodes = Object.keys(priors);
  if (!creoleCodes.length) return null;
  // FLOORS: a prior built from a small corpus charges an unseen word or gram less (ALPHA/N is larger), so on text in a language no
  // prior fits a tiny creole prior "beats" every core language by hundreds of nats on the floors alone (measured: the null maximum
  // of T was 400-900 nats). Every non-core prior is charged the largest floor any core language has, so a smaller corpus never buys a lead.
  const core = ctx.coreEntries();
  const wfMax = Math.max(...core.map(([, p]) => p.wf)), gfMax = Math.max(...core.map(([, p]) => p.gf));
  const flat = (p) => ({ ...p, wf: Math.max(p.wf, wfMax), gf: Math.max(p.gf, gfMax) });
  const isCreole = new Set(creoleCodes);
  const mk = (rivals) => {
    const entries = [...core, ...rivals, ...creoleCodes.map((k) => [k, flat(priors[k])])];
    const g = ctx.decodeGroup(entries);
    const coreIdx = [], creIdx = [];
    g.keys.forEach((k, i) => (isCreole.has(k) && i >= entries.length - creoleCodes.length ? creIdx : coreIdx).push(i));   // coreIdx: every non-creole rival
    return (tokens, P) => {
      const { s, fwHits } = ctx.scoreGroup(g, tokens, P, null);
      let top = -Infinity, ti = -1;
      for (const i of coreIdx) if (s[i] > top) { top = s[i]; ti = i; }
      const T = {}, sc = {}, fw = {};
      for (const i of creIdx) { T[g.codes[i]] = s[i] - top; sc[g.codes[i]] = s[i]; fw[g.codes[i]] = fwHits[i]; }
      return { T, s: sc, fw, n: tokens.length, topCode: ti >= 0 ? g.codes[ti] : null, top };
    };
  };
  const rivalList = () => (competitors || ctx.udhrEntries(new Set(SUPERSEDES))).map(([k, p]) => ["u|" + k, flat(p)]);
  let FULL = null, SCREEN = null;
  const full = (tokens, P) => (FULL ||= mk(rivalList()))(tokens, P);
  const cheap = (tokens, P) => (SCREEN ||= mk([]))(tokens, P);
  /** { s, T: {code: nats}, topCode, fw: {code: n}, n } for one reading's tokens, against core + rivals */
  const scoreTokens = full;
  function readings(text, P) {
    const toks = [ctx.tokenize(text)];
    const lr = leetReading(text);
    if (lr) toks.push(ctx.tokenize(lr));
    const hows = ["typed", "leet"];
    if (screen) {
      const clears = toks.some((t) => { const r = cheap(t, P); return Object.entries(r.T).some(([c, v]) => { const cut = stairAt(screen[c], r.n); return cut !== null && v > cut; }); });
      if (!clears) return [];
    }
    return toks.map((t, i) => ({ how: hows[i], ...full(t, P) }));
  }
  return { codes: creoleCodes, scoreTokens, readings };
}

/** The decision. `rs` = scorer.readings(...). Returns null (the tier says nothing) or { lang, kind, ... }. */
export function decide(rs, { tau = TAU, mu = MU, meta = META } = {}) {
  // the reading that clears its cutoffs by the most (a leet reading must clear the same TAU as the typed one)
  let best = null;
  for (const r of rs) {
    let lead = -Infinity;
    for (const [c, t] of Object.entries(r.T)) { const cut = stairAt(tau[c], r.n); if (cut !== null && t - cut > lead) lead = t - cut; }
    if (lead > 0 && (!best || lead > best.lead)) best = { ...r, lead };
  }
  if (!best) return null;
  const cutOf = (c) => stairAt(tau[c], best.n);
  const fired = Object.keys(best.T).filter((c) => cutOf(c) !== null && best.T[c] > cutOf(c));
  fired.sort((a, b) => best.s[b] - best.s[a]);
  const b = fired[0];
  let runner = null;
  for (const c of Object.keys(best.s)) if (c !== b && (runner === null || best.s[c] > best.s[runner])) runner = c;
  const margin = runner === null ? Infinity : best.s[b] - best.s[runner];
  const need = runner === null ? -Infinity : (stairAt(mu[b + "|" + runner], best.n) ?? 0);
  const fam = (c) => (meta[c] && meta[c].lexifier ? meta[c].lexifier : null);
  const base = { creole: b, runner, T: best.T[b], tau: cutOf(b), margin, need, reading: best.how, hits: best.fw[b] || 0, second: best.topCode };
  if (margin > need) return { lang: b, kind: "specific", ...base };
  if (fam(b) && fam(b) === fam(runner)) return { lang: FAMILY_CODE[fam(b)] || "crp", kind: "family", ...base };
  return { lang: "unknown", kind: "ambiguous", ...base };
}
