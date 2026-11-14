// frontier/instruments.mjs — ORGAN 6, deterministic instruments. Counting, arithmetic, dates, comparisons, aggregates, string match.
// Never the model (Constitution II.9: a model must never author a value). Arithmetic REUSES the-fold's fold-chat-compute.js
// evalExpression (a parser, no eval()). Each instrument result is written to the log as an `instrument` event citing its inputs.
import { evalExpression } from "../fold-chat-compute.js";

const num = (v) => (typeof v === "number" ? v : Number(String(v).replace(/[,$\s]/g, "")));
const day = (v) => { const t = Date.parse(String(v)); return Number.isFinite(t) ? Math.floor(t / 86400000) : NaN; };

export const INSTRUMENTS = Object.freeze({
  count: (xs) => xs.length,
  sum: (xs) => xs.map(num).reduce((a, b) => a + b, 0),
  min: (xs) => Math.min(...xs.map(num)),
  max: (xs) => Math.max(...xs.map(num)),
  mean: (xs) => xs.map(num).reduce((a, b) => a + b, 0) / xs.length,
  diff: ([a, b]) => num(a) - num(b),
  ratio: ([a, b]) => num(a) / num(b),
  daysBetween: ([a, b]) => Math.abs(day(a) - day(b)),
  before: ([a, b]) => day(a) < day(b),
  greater: ([a, b]) => num(a) > num(b),
  equalText: ([a, b]) => String(a).normalize("NFKC").trim().toLowerCase() === String(b).normalize("NFKC").trim().toLowerCase(),
  arith: ([expr]) => { const r = evalExpression(expr); if (!r.ok) throw new Error(`arith: ${r.why}`); return r.value; },
});

export function runInstrument(log, name, inputs, { deps = [], by = "instrument" } = {}) {
  const f = INSTRUMENTS[name];
  if (!f) { log.append({ kind: "gap", by, deps, body: { gap: "no_instrument", name } }); return { ok: false, gap: "no_instrument" }; }
  try {
    const value = f(inputs);
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("not finite");
    const ev = log.append({ kind: "instrument", by: `${by}:${name}`, deps, body: { name, inputs, value } });
    return { ok: true, value, event: ev };
  } catch (e) {
    log.append({ kind: "gap", by, deps, body: { gap: "instrument_failed", name, why: String(e.message) } });
    return { ok: false, gap: "instrument_failed" };
  }
}
