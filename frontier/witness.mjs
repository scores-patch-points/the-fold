// frontier/witness.mjs — ORGAN 9, Witnesses. Each output is checked against the spans it cites: supported | contradicted | unknown.
// Mechanical first pass (no model): the answer's value must occur in a cited span's own bytes (normalized), and every cited id must be a
// traced span or a log-native record. A cited span that states the same slot with a DIFFERENT value of the same type (a number where a
// number was answered, a year where a year was answered) contradicts. Anything else is `unknown` — never upgraded to supported by
// fluency. A regression gate compares with the previous answer to the same shape key: a changed answer without a new supporting event
// is flagged `regression`. Disagreements are kept as events, never voted away.
const norm = (s) => String(s ?? "").normalize("NFKC").toLowerCase().replace(/[\s,]+/g, " ").trim();
const numbersIn = (s) => [...String(s).matchAll(/-?\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0].replace(/,/g, ""));

export function witness(log, { value, cites = [], shapeKey = null, answerId = null, by = "witness:mechanical" }) {
  const spans = cites.map((id) => log.get(id)).filter(Boolean);
  const texts = spans.map((e) => e.body.text ?? JSON.stringify(e.body.value ?? e.body));
  let verdict = "unknown", why = "no cited span carries the value";
  if (!cites.length) why = "no citation";
  else if (spans.length < cites.length) { verdict = "contradicted"; why = "cites an id that is not in the log"; }
  else {
    const v = norm(typeof value === "object" ? JSON.stringify(value) : value);
    if (v && texts.some((t) => norm(t).includes(v))) { verdict = "supported"; why = "value occurs in a cited span"; }
    else if (/^-?\d/.test(v)) {
      const others = texts.flatMap(numbersIn).filter((n) => n !== v.replace(/ /g, ""));
      if (others.length && !texts.flatMap(numbersIn).includes(v.replace(/ /g, ""))) { verdict = "contradicted"; why = `cited spans give ${[...new Set(others)].slice(0, 3).join(", ")}`; }
    }
  }
  const ev = log.append({ kind: "verdict", by, deps: [...cites.filter((id) => log.has(id)), ...(answerId ? [answerId] : [])], body: { verdict, why, value, shapeKey } });
  return { verdict, why, event: ev };
}

export function regressionGate(log, { shapeKey, value, answerId }) {
  const prev = log.byKind("answer").filter((a) => a.body.shapeKey === shapeKey && a.id !== answerId).at(-1);
  if (!prev || JSON.stringify(prev.body.value) === JSON.stringify(value)) return { regression: false };
  const newer = log.all().some((e) => e.seq > prev.seq && (e.kind === "fact" || e.kind === "span" || e.kind === "retract"));
  if (newer) return { regression: false, changed: true };
  log.append({ kind: "verdict", by: "witness:regression", deps: [prev.id, answerId].filter(Boolean), body: { verdict: "regression", was: prev.body.value, now: value } });
  return { regression: true, was: prev.body.value };
}
