// organs/fold-note.mjs — THE MECHANICAL FOLD: a session's turns folded to a bounded note that every surface using
// the fold suite can share. Pure, deterministic, no model, no sibling checkout.
//
//   foldNote(turns, ask, { budget, threads }) → string
//
//   DISCOURSE   `about:` — the beings the current ask SHARES with the folded turns (from the words, never drawn)
//   THREADS     each turn is grouped by its rarest content term not already in the ask (the Kind rung), and each
//               thread is ONE line — a mechanical paraphrase, never a list
//   DERIVATION  a turn that DEFINES a value in terms of earlier ones (`NAME = expr`) is a link; arithmetic chains
//               are COMPOSED (BOX computes) so the note carries the result, not the links
//   BOUNDED     by THREADS (threads) and by a HARD char budget (budget); the oldest threads become a count
//
// The same capacity the opencode doorway's `surf` uses; a surface that holds turns and an ask can fold them here.

const WORD = /[\p{L}\p{N}_]{4,}/gu;
const termsOf = (t) => new Set(String(t ?? "").toLowerCase().match(WORD) ?? []);
const clip = (s, n = 200) => {
  const v = String(s ?? "").replace(/\s+/g, " ").trim();
  return v.length > n ? `${v.slice(0, n - 1)}…` : v;
};

const DEF_RE = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*=\s*([^.\n]+?)\s*\.?\s*$/;

/** Safe arithmetic over numbers, + - * / ( ) and names resolved through `lookup`. Returns null if not computable. */
export function evalArith(expr, lookup) {
  const s = String(expr);
  let i = 0;
  const ws = () => {
    while (i < s.length && /\s/.test(s[i])) i++;
  };
  function primary() {
    ws();
    if (s[i] === "(") {
      i++;
      const v = add();
      ws();
      if (s[i] === ")") i++;
      return v;
    }
    const ns = i;
    while (i < s.length && /[0-9.]/.test(s[i])) i++;
    if (i > ns) return Number(s.slice(ns, i));
    const is = i;
    while (i < s.length && /[A-Za-z0-9_]/.test(s[i])) i++;
    if (i > is) return lookup(s.slice(is, i));
    return null;
  }
  function mul() {
    let v = primary();
    if (v === null) return null;
    for (;;) {
      ws();
      const op = s[i];
      if (op !== "*" && op !== "/") return v;
      i++;
      const r = primary();
      if (r === null) return null;
      v = op === "*" ? v * r : v / r;
    }
  }
  function add() {
    let v = mul();
    if (v === null) return null;
    for (;;) {
      ws();
      const op = s[i];
      if (op !== "+" && op !== "-") return v;
      i++;
      const r = mul();
      if (r === null) return null;
      v = op === "+" ? v + r : v - r;
    }
  }
  const v = add();
  ws();
  return i === s.length ? v : null;
}

/** Every `NAME = expression` turn resolved to its value where the chain is arithmetic. */
export function derivationFor(turns = []) {
  const defs = new Map();
  for (const t of turns) {
    const m = DEF_RE.exec(String(t?.answer ?? "").trim());
    if (m) defs.set(m[1], m[2]);
  }
  const val = new Map();
  const resolve = (n, seen) => {
    if (val.has(n)) return val.get(n) ?? null;
    if (!defs.has(n) || seen.has(n)) return null;
    seen.add(n);
    const v = evalArith(defs.get(n) ?? "", (x) => resolve(x, seen));
    if (typeof v === "number" && Number.isFinite(v)) val.set(n, v);
    return val.has(n) ? (val.get(n) ?? null) : null;
  };
  for (const n of defs.keys()) resolve(n, new Set());
  return val;
}

/**
 * The bounded, mechanical note for `turns` against `ask`. `turns` are `{ n, ask, answer }` (oldest first).
 * Returns a string; deterministic; never throws on a weird turn.
 */
export function foldNote(turns = [], ask = "", { budget = 2000, threads = 6 } = {}) {
  // last-wins per ask (the DMD): a repeated ask folds to its latest outcome, once
  const byAsk = new Map();
  for (const t of turns) byAsk.set(clip(t?.ask ?? "", 300), t);
  const kept = [...byAsk.values()];
  const askW = termsOf(ask);
  const about = [...new Set(kept.flatMap((t) => [...termsOf(`${t?.ask ?? ""} ${t?.answer ?? ""}`)].filter((w) => askW.has(w))))].slice(0, 6);
  const derived = [...derivationFor(kept)].slice(-12);
  const derivedLine = derived.map(([n, v]) => `${n}=${Number.isInteger(v) ? v : v.toFixed(2)}`).join(", ");
  // group each turn by its rarest content term not already in the ask — its THREAD (the Kind rung, mechanically)
  const docs = kept.map((t) => [...termsOf(`${t?.ask ?? ""} ${t?.answer ?? ""}`)]);
  const df = new Map();
  for (const d of docs) for (const w of d) df.set(w, (df.get(w) ?? 0) + 1);
  const groups = new Map();
  docs.forEach((d, i) => {
    const sig = d.filter((w) => !askW.has(w)).sort((a, b) => (df.get(a) ?? 0) - (df.get(b) ?? 0) || (a < b ? -1 : 1))[0] ?? `~${i}`;
    const g = groups.get(sig) ?? [];
    g.push(i);
    groups.set(sig, g);
  });
  const ordered = [...groups.entries()].map(([sig, idx]) => ({ sig, idx, newest: idx[idx.length - 1] })).sort((a, b) => b.newest - a.newest);
  const lineOf = (t) => {
    const last = kept[t.idx[t.idx.length - 1]];
    return `- [${t.sig}] ${t.idx.length} ask(s) — latest: ${clip(last?.ask, 160)} → ${last?.answer ? `settled: ${clip(last.answer, 220)}` : "(open, no reply)"}`;
  };
  const build = (list, ext) =>
    [
      `[fold: the thread — ${kept.length} earlier ask(s) settled (of ${turns.length} turns) across ${ordered.length} thread(s); the full history remains in the session]`,
      ...(about.length ? [`about: ${about.join(", ")}`] : []),
      ...(derived.length ? [`derived (the machine composed the chain): ${derivedLine}`] : []),
      ...(ext > 0 ? [`- (+${ext} older ask(s) folded)`] : []),
      ...list.map(lineOf),
    ].join("\n");
  let list = ordered.slice(0, threads);
  let ext = kept.length - list.reduce((n, t) => n + t.idx.length, 0);
  let note = build(list, ext);
  while (note.length > budget && list.length > 1) {
    ext += list[list.length - 1].idx.length;
    list = list.slice(0, -1);
    note = build(list, ext);
  }
  return note.length > budget ? `${note.slice(0, budget - 1)}…` : note;
}
