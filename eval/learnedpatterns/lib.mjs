// eval/learnedpatterns/lib.mjs — the pieces of PREREG.md, shared by the harvester, the learner, the runner and the tests.
// Nothing here reads Wikidata at inference: the referee is used only to LABEL training instances; the learned table is
// applied to a sentence, the question and the title door alone.
import crypto from "node:crypto";
import { askFrame, tokensOf, stemOf, caseless } from "../../fold-chat-frame.js";
import { functionWordsOf } from "../../fold-chat-snippets.js";

export const FW = functionWordsOf("en");
export const SCOPE = Object.freeze(["P50", "P170", "P86", "P61", "P19", "P36", "P37", "P38", "P35", "P6", "P169"]);
export const PRONOUNS = Object.freeze(new Set(["he", "she", "it", "they", "his", "her", "its", "their"]));   // declared closed set (training anchors only)
export const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

// ── tokens ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
const TOK = /[\p{L}\p{M}\p{N}]+(?:['’.\-][\p{L}\p{M}\p{N}]+)*|[^\s\p{L}\p{M}\p{N}]/gu;
const isWordStr = (t) => /^[\p{L}\p{M}\p{N}]/u.test(t);
/** [{t, fold, cap, word, num}] — words (internal ' . - kept), the possessive 's split off, every other mark its own token. */
export function tokenize(text) {
  const out = [];
  for (const m of String(text ?? "").normalize("NFC").matchAll(TOK)) {
    let t = m[0];
    const poss = isWordStr(t) && /^(.+)['’]s$/iu.exec(t);
    const parts = poss ? [poss[1], "'s"] : [t];
    for (const p of parts) {
      const word = isWordStr(p);
      out.push({ t: p, fold: p === "'s" ? "'s" : caseless(p).replace(/’/g, "'"), cap: /^\p{Lu}/u.test(p), word, num: /^\p{N}/u.test(p) });
    }
  }
  return out;
}
export const foldsOf = (text) => tokenize(String(text ?? "").replace(/\s*\([^)]*\)\s*$/u, "")).map((x) => x.fold);
const isFW = (tok) => FW.has(tok.fold);

// ── anchor mentions and candidate fillers (identical at training and inference) ─────────────────────────────────────────────
/** Non-overlapping token spans of any surface (longest first); `pronoun` adds a sentence-initial declared pronoun. */
export function anchorMentions(toks, surfaces, { pronoun = false } = {}) {
  const seqs = [...new Set(surfaces.map((s) => foldsOf(s).join(" ")).filter(Boolean))].map((s) => s.split(" ")).sort((a, b) => b.length - a.length);
  const taken = new Set(), out = [];
  for (const q of seqs) for (let i = 0; i + q.length <= toks.length; i++) {
    let ok = true; for (let k = 0; k < q.length && ok; k++) ok = toks[i + k].fold === q[k] && !taken.has(i + k);
    if (!ok) continue;
    for (let k = 0; k < q.length; k++) taken.add(i + k);
    out.push({ i, j: i + q.length - 1 });
  }
  if (pronoun && toks.length && PRONOUNS.has(toks[0].fold) && !taken.has(0)) out.push({ i: 0, j: 0, pronoun: true });
  return out.sort((a, b) => a.i - b.i);
}
/** Maximal capitalised runs; a function word only between two capitalised tokens; leading function words dropped; never across an anchor. */
export function candidates(toks, blocked) {
  const capOk = (k) => k < toks.length && toks[k].word && toks[k].cap && !toks[k].num && !blocked.has(k);
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    if (!capOk(i) || isFW(toks[i])) continue;
    let j = i;
    for (;;) {
      if (capOk(j + 1)) { j++; continue; }
      if (j + 2 < toks.length && toks[j + 1].word && isFW(toks[j + 1]) && !blocked.has(j + 1) && capOk(j + 2)) { j += 2; continue; }
      break;
    }
    while (j > i && isFW(toks[j])) j--;                            // a run never ends on a function word
    out.push({ i, j, text: toks.slice(i, j + 1).map((x) => x.t).join(" "), key: toks.slice(i, j + 1).map((x) => x.fold).join(" ") });
    i = j;
  }
  return out;
}

// ── the token path: candidate pattern keys ───────────────────────────────────────────────────────────────────────────────
export function middleOf(toks, a, c) {
  const dir = c.i > a.j ? "R" : "L";
  const span = dir === "R" ? toks.slice(a.j + 1, c.i) : toks.slice(c.j + 1, a.i);
  const m = [];
  for (const x of span) {
    const r = x.num ? "0" : x.word && x.cap && !isFW(x) ? "C" : x.fold;
    if (r === "C" && m[m.length - 1] === "C") continue;
    m.push(r);
  }
  return { dir, m };
}
export function keysOf(toks, a, c) {
  const { dir, m } = middleOf(toks, a, c);
  const nearC = (j) => (dir === "R" ? m.slice(m.length - j) : m.slice(0, j)).join(" ");
  const nearA = (j) => (dir === "R" ? m.slice(0, j) : m.slice(m.length - j)).join(" ");
  const skel = []; for (const r of m) { const s = /^[\p{L}\p{M}]/u.test(r) && r !== "C" && !FW.has(r) ? "*" : r; if (!(s === "*" && skel[skel.length - 1] === "*")) skel.push(s); }
  const keys = [`${dir}|f|${m.join(" ")}`, `${dir}|s|${skel.join(" ")}`];
  for (let j = 1; j <= 3 && j <= m.length; j++) keys.push(`${dir}|c${j}|${nearC(j)}`, `${dir}|a${j}|${nearA(j)}`);
  if (m.length >= 2) keys.push(`${dir}|ac|${nearA(1)} … ${nearC(1)}`);
  return [...new Set(keys)];
}

// ── the referee (training only) ──────────────────────────────────────────────────────────────────────────────────────────
/** For one entity's value surfaces: the exact/token-suffix forms that CONFIRM and the other contiguous parts that SKIP. */
export function valueForms(surfaces) {
  const confirm = new Set(), part = new Set();
  for (const s of surfaces) {
    const f = foldsOf(s); if (!f.length) continue;
    for (let i = 0; i < f.length; i++) for (let j = i + 1; j <= f.length; j++) (j === f.length ? confirm : part).add(f.slice(i, j).join(" "));
  }
  for (const c of confirm) part.delete(c);
  return { confirm, part };
}
/** +1 CONFIRMED, 0 SKIPPED, -1 REFUTED. */
export const verdictOf = (candKey, forms) => (forms.confirm.has(candKey) ? 1 : forms.part.has(candKey) ? 0 : -1);

// ── randomness: seeded, so every replicate is reproducible ───────────────────────────────────────────────────────────────
export function rng(seed) { let s = parseInt(sha(seed).slice(0, 8), 16) >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** Sattolo: a uniformly random cyclic permutation (no fixed point), a bijection of n. */
export function sattolo(n, rand) { const p = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * i); [p[i], p[j]] = [p[j], p[i]]; } return p; }
export const inValidation = (qid) => parseInt(sha("split:" + qid).slice(0, 8), 16) / 4294967296 < 0.2;

// ── instances and the max-T learner ──────────────────────────────────────────────────────────────────────────────────────
/** Every (anchor mention, candidate) pair of one entity's lead, with its keys and, per entity index, how the referee would read it. */
export function instancesOf(entity, sentences) {
  const out = [];
  for (const s of sentences) {
    const toks = tokenize(s);
    const ms = anchorMentions(toks, entity.anchors, { pronoun: true });
    if (!ms.length) continue;
    const blocked = new Set(); for (const a of ms) for (let k = a.i; k <= a.j; k++) blocked.add(k);
    for (const c of candidates(toks, blocked)) for (const a of ms) out.push({ cand: c.key, keys: keysOf(toks, a, c) });
  }
  return out;
}
/**
 * Learn one table from `byPid` = { pid: { entities:[{qid, anchors, values:[surface], sentences}] } }.
 * `labelPerm` (mutation check) replaces the real referee by a fixed permutation. Returns admitted patterns with S and the null's max.
 */
export function learn(byPid, { B = 199, seed = "learnedpatterns", labelPerm = null, onProgress = null } = {}) {
  const keyId = new Map(), keyName = [];
  const inst = [];                                           // { pid, e, kids:Int32Array, conf:Int32Array(entity idx), part:Int32Array }
  const pids = Object.keys(byPid);
  const nEnt = {};
  for (const pid of pids) {
    const ents = byPid[pid].entities; nEnt[pid] = ents.length;
    const forms = ents.map((e) => valueForms(e.values));
    const confIdx = new Map(), partIdx = new Map();
    forms.forEach((f, x) => { for (const k of f.confirm) (confIdx.get(k) || confIdx.set(k, []).get(k)).push(x); for (const k of f.part) (partIdx.get(k) || partIdx.set(k, []).get(k)).push(x); });
    ents.forEach((ent, e) => {
      for (const it of instancesOf(ent, ent.sentences)) {
        const kids = it.keys.map((k) => { const name = pid + "|" + k; let id = keyId.get(name); if (id == null) { id = keyName.length; keyId.set(name, id); keyName.push(name); } return id; });
        inst.push({ pid, e, kids: Int32Array.from(kids), conf: Int32Array.from(confIdx.get(it.cand) || []), part: Int32Array.from(partIdx.get(it.cand) || []) });
      }
    });
  }
  const verdictUnder = (x, e) => (x.conf.includes(e) ? 1 : x.part.includes(e) ? 0 : -1);
  const score = (perm) => {                                    // perm: pid -> array mapping entity -> whose values referee it
    const S = new Int32Array(keyName.length), conf = new Int32Array(keyName.length), ref = new Int32Array(keyName.length);
    for (const x of inst) {
      const v = verdictUnder(x, perm ? perm[x.pid][x.e] : x.e);
      if (v === 0) continue;
      for (const k of x.kids) { S[k] += v; if (v > 0) conf[k]++; else ref[k]++; }
    }
    return { S, conf, ref };
  };
  const realPerm = labelPerm ? Object.fromEntries(pids.map((pid) => [pid, sattolo(nEnt[pid], rng(labelPerm + pid))])) : null;
  const real = score(realPerm);
  const T = [];
  for (let b = 0; b < B; b++) {
    const r = rng(`${seed}:null:${b}`);
    const perm = Object.fromEntries(pids.map((pid) => {
      const base = sattolo(nEnt[pid], r);
      return [pid, realPerm ? base.map((x) => realPerm[pid][x]) : base];
    }));
    const { S } = score(perm); let mx = -Infinity; for (let k = 0; k < S.length; k++) if (S[k] > mx) mx = S[k];
    T.push(mx);
    if (onProgress && (b + 1) % 20 === 0) onProgress(b + 1, B);
  }
  const bar = Math.max(0, Math.max(...T));
  const admitted = [];
  for (let k = 0; k < keyName.length; k++) if (real.S[k] > bar) {
    const [pid, ...rest] = keyName[k].split("|");
    admitted.push({ pid, key: rest.join("|"), S: real.S[k], conf: real.conf[k], ref: real.ref[k] });
  }
  admitted.sort((a, b) => b.S - a.S || (a.pid + a.key < b.pid + b.key ? -1 : 1));
  return { admitted, bar, nullMax: T, instances: inst.length, patterns: keyName.length };
}
/** { pid: Map(key -> S) } */
export const tableOf = (admitted) => { const t = {}; for (const a of admitted) (t[a.pid] ||= new Map()).set(a.key, a.S); return t; };

// ── inference ────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The scored candidates of one sentence: [{text, key, score, via}] best first (no door). */
export function scoredCandidates(sentence, { pids, anchors, pronoun = false }, table) {
  const toks = tokenize(sentence);
  const ms = anchorMentions(toks, anchors, { pronoun });
  if (!ms.length) return { mentions: 0, cands: [] };
  const blocked = new Set(); for (const a of ms) for (let k = a.i; k <= a.j; k++) blocked.add(k);
  const best = new Map();
  for (const c of candidates(toks, blocked)) for (const a of ms) for (const k of keysOf(toks, a, c)) for (const pid of pids) {
    const S = table[pid] && table[pid].get(k);
    if (S == null) continue;
    const cur = best.get(c.key);
    if (!cur || S > cur.score) best.set(c.key, { text: c.text, key: c.key, score: S, via: `${pid}|${k}` });
  }
  return { mentions: ms.length, cands: [...best.values()].sort((a, b) => b.score - a.score || (a.key < b.key ? -1 : 1)) };
}
/** Arm P: the best-scoring candidate the title door resolves; a tie between distinct candidates at that score → silent. */
export async function answerOf(sentence, reading, table, door) {
  const { cands, mentions } = scoredCandidates(sentence, reading, table);
  if (!cands.length) return { ans: null, why: mentions ? "no admitted pattern fired" : "no anchor mention" };
  const res = await door(cands.map((c) => c.text));
  const ok = cands.filter((c) => { const r = res.get(c.text); return r && typeof r.title === "string" && r.title && !r.disambiguation; });
  if (!ok.length) return { ans: null, why: "title door resolved no fired candidate", fired: cands.length };
  if (ok.length > 1 && ok[1].score === ok[0].score && ok[1].key !== ok[0].key) return { ans: null, why: "tie", fired: cands.length };
  return { ans: ok[0].text, via: ok[0].via, score: ok[0].score, fired: cands.length };
}

// ── the question side: which properties, which anchor ────────────────────────────────────────────────────────────────────
/** Cue stems per property from Wikidata's own English label and aliases (content tokens, `stemOf`). */
export function cueStemsOf(props) {
  const out = {};
  for (const pid of SCOPE) {
    const p = props[pid]; if (!p) continue;
    const names = [p.labels?.en?.value, ...((p.aliases?.en || []).map((a) => a.value))].filter(Boolean);
    out[pid] = [...new Set(names.flatMap((n) => tokensOf(n, "en").map((t) => t.fold).filter((f) => !FW.has(f)).map((f) => stemOf(f, "en"))))].sort();
  }
  return out;
}
const surfacesOfRef = (r) => [...new Set([r.surface, r.title, String(r.title || "").replace(/\s*\([^)]*\)\s*$/u, ""), ...(r.aliases || [])].filter((s) => typeof s === "string" && s.trim()))];
/** { pids, anchors, referents, note } for an ask; `door` is the shared cached title door; frame failures are reported, never guessed. */
export async function readAsk(ask, { cue, door, tries = 5, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  let f = null;
  for (let k = 0; k < tries; k++) {
    try { f = await askFrame(ask, { fw: FW, lang: "en", resolveTitles: door }); } catch { f = null; }
    if (f && f.ok && (f.referents || []).length) break;
    if (f && f.slot === null) break;
    if (k < tries - 1) await sleep(2000 * 2 ** k);
  }
  if (!f || !f.ok || !(f.referents || []).length) return { pids: [], anchors: [], referents: [], note: `frame: ${f && f.gap ? f.gap.kind : "not read"}` };
  const allCue = new Set(Object.values(cue).flat());
  const askToks = tokensOf(ask, "en");
  const anchorFolds = new Set(), referents = [];
  for (const r of f.referents) {
    const rt = tokensOf(r.surface, "en");
    let cut = -1; rt.forEach((t, k) => { if (allCue.has(stemOf(t.fold, "en"))) cut = k; });
    let rest = cut >= 0 ? rt.slice(cut + 1) : [];
    while (rest.length && FW.has(rest[0].fold)) rest = rest.slice(1);
    if (cut >= 0 && rest.length) {                              // the declared repair: "capital of Egypt" → "Egypt"
      const surface = r.surface.slice(rest[0].start, rest[rest.length - 1].end);
      const res = (await door([surface])).get(surface);
      if (!res || !res.title || res.disambiguation) continue;
      const rr = { surface, title: res.title, aliases: [res.redirectedFrom].filter(Boolean), repairedFrom: r.surface };
      referents.push(rr); for (const t of rest) anchorFolds.add(t.fold);
    } else { referents.push(r); for (const t of rt) anchorFolds.add(t.fold); }
  }
  const relStems = new Set(askToks.filter((t) => !FW.has(t.fold) && !anchorFolds.has(t.fold)).map((t) => stemOf(t.fold, "en")));
  const pids = SCOPE.filter((pid) => (cue[pid] || []).some((s) => relStems.has(s)));
  return { pids, anchors: [...new Set(referents.flatMap(surfacesOfRef))], referents: referents.map((r) => ({ surface: r.surface, title: r.title, repairedFrom: r.repairedFrom || null })), note: f.slot };
}
