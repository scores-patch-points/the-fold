// frontier/mouth.mjs — ORGAN 8, the Mouth, and the budget INVARIANT at its only door.
// The model speaks only at seams. Every call: context tokens <= B, counted before (estimator) and after (engine's count), logged as a
// `call` event with both counts. A call whose estimate exceeds B is REFUSED before it is sent and logged as a `refusal` (typed gap
// `over_budget`); the caller must split the seam (assemble.mjs), never truncate, never raise B.
//   makeMouth({ log, transport, B, by }) → { ask({ system, user, schema, seam, deps }) → { value, call } , B }
//   ollamaTransport({ model, host }) — LOCAL ONLY: host must be loopback (no new network path).
//   stubTransport(fn) — deterministic stand-in for tests; fn({system,user,schema}) → value
import { estimateTokens } from "./tokens.mjs";

export const B_DEFAULT = 4000; // recorded: gemma2:2b-class start (brief, 2026-11-14)
export class OverBudget extends Error {
  constructor(info) { super(`over budget: ${info.tokens} > B=${info.B} at seam ${info.seam}`); this.name = "OverBudget"; Object.assign(this, info, { gap: "over_budget" }); }
}

export function ollamaTransport({ model, host = process.env.OLLAMA_HOST_URL || "http://127.0.0.1:11434", options = {} } = {}) {
  const u = new URL(host);
  if (!["127.0.0.1", "localhost", "[::1]", "::1"].includes(u.hostname)) throw new Error(`mouth: ${host} is not loopback — local-only operation`);
  return {
    model,
    async send({ system, user, schema, numCtx }) {
      const body = { model, stream: false, think: false, messages: [{ role: "system", content: system }, { role: "user", content: user }],
        options: { temperature: 0, seed: 7, num_ctx: numCtx, ...options } };
      if (schema) body.format = schema;
      const t0 = Date.now();
      const r = await fetch(`${host}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(`ollama ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const j = await r.json();
      let value = j.message?.content ?? "";
      if (schema) { try { value = JSON.parse(value); } catch { value = { _unparsed: value }; } }
      return { value, promptTokens: j.prompt_eval_count ?? null, outTokens: j.eval_count ?? null, ms: Date.now() - t0, engineNs: j.total_duration ?? null };
    },
  };
}

export function stubTransport(fn, model = "stub") {
  return { model, async send(req) { return { value: await fn(req), promptTokens: null, outTokens: 0, ms: 0 }; } };
}

export function makeMouth({ log, transport, B = B_DEFAULT, by = "mouth", maxOut = 512 } = {}) {
  if (!log || !transport) throw new TypeError("makeMouth: log and transport are injected");
  return {
    B,
    model: transport.model,
    async ask({ system = "", user = "", schema = null, seam = "unnamed", deps = [] }) {
      const ctx = estimateTokens(system) + estimateTokens(user) + (schema ? estimateTokens(JSON.stringify(schema)) : 0) + 8;
      if (ctx > B) {
        log.append({ kind: "refusal", by, deps, body: { gap: "over_budget", seam, tokens: ctx, B } });
        throw new OverBudget({ tokens: ctx, B, seam });
      }
      const res = await transport.send({ system, user, schema, numCtx: B + maxOut });
      const call = log.append({ kind: "call", by, deps, body: { seam, model: transport.model, B, ctxEstimate: ctx, ctxEngine: res.promptTokens, outTokens: res.outTokens, ms: res.ms, value: res.value } });
      if (res.promptTokens != null && res.promptTokens > B) {
        log.append({ kind: "refusal", by: "invariant", deps: [call.id], body: { gap: "over_budget_engine", seam, tokens: res.promptTokens, B } });
        throw new OverBudget({ tokens: res.promptTokens, B, seam, engine: true });
      }
      return { value: res.value, call };
    },
  };
}

/** The invariant as a check over a log: every call's context (estimate AND engine count) <= its B; every call has a token count. */
export function budgetAudit(log) {
  const calls = log.byKind("call");
  const over = calls.filter((c) => c.body.ctxEstimate > c.body.B || (c.body.ctxEngine != null && c.body.ctxEngine > c.body.B));
  const uncounted = calls.filter((c) => !Number.isFinite(c.body.ctxEstimate));
  const maxEst = calls.reduce((m, c) => Math.max(m, c.body.ctxEstimate), 0);
  const maxEng = calls.reduce((m, c) => Math.max(m, c.body.ctxEngine ?? 0), 0);
  return { calls: calls.length, over: over.map((c) => c.id), uncounted: uncounted.map((c) => c.id), maxEstimate: maxEst, maxEngine: maxEng, ok: !over.length && !uncounted.length };
}
