// frontier/budget-guard.mjs — the invariant for code that does NOT go through mouth.mjs (the-fold's existing evals).
// Preload it:  FRONTIER_B=4000 node --import ./frontier/budget-guard.mjs <any eval>
// It wraps globalThis.fetch. Any request to a loopback model endpoint (ollama /api/chat, /api/generate; OpenAI-style /v1/chat/completions,
// /v1/completions) is counted BEFORE it is sent (tokens.mjs estimator); over B it is refused with a typed 413-style error and logged;
// otherwise it is sent and the engine's own prompt count (ollama prompt_eval_count / OpenAI usage.prompt_tokens) is logged beside the
// estimate. Every model call in the process lands one line in FRONTIER_TOKEN_LOG (default frontier/runs/token-log.jsonl).
// Non-loopback model endpoints are also counted and logged (they are someone else's egress, not ours to judge here).
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { estimateTokens } from "./tokens.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const LOG_PATH = resolve(process.env.FRONTIER_TOKEN_LOG || `${HERE}/runs/token-log.jsonl`);
export const B = Number(process.env.FRONTIER_B || 4000);
const MODEL_PATH = /\/(api\/chat|api\/generate|v1\/chat\/completions|v1\/completions)$/;

export function promptTokensOf(body) {
  try {
    const j = typeof body === "string" ? JSON.parse(body) : body;
    if (Array.isArray(j?.messages)) return j.messages.reduce((n, m) => n + estimateTokens(typeof m.content === "string" ? m.content : JSON.stringify(m.content)) + 4, 0) + (j.format ? estimateTokens(JSON.stringify(j.format)) : 0);
    if (typeof j?.prompt === "string") return estimateTokens(j.prompt) + estimateTokens(j.system ?? "");
  } catch { /* not JSON: count the raw body */ }
  return estimateTokens(String(body ?? ""));
}

const write = (row) => { mkdirSync(dirname(LOG_PATH), { recursive: true }); appendFileSync(LOG_PATH, JSON.stringify(row) + "\n"); };

if (!globalThis.__frontierGuard) {
  globalThis.__frontierGuard = true;
  const inner = globalThis.fetch;
  globalThis.fetch = async function guarded(input, init = {}) {
    const url = typeof input === "string" ? input : input?.url ?? String(input);
    let path = ""; try { path = new URL(url).pathname; } catch {}
    if (!MODEL_PATH.test(path)) return inner(input, init);
    const est = promptTokensOf(init?.body);
    const row = { at: new Date().toISOString(), pid: process.pid, script: process.argv[1] ?? null, url, B, ctxEstimate: est };
    if (est > B) { write({ ...row, refused: "over_budget" }); throw Object.assign(new Error(`frontier budget guard: ${est} > B=${B}`), { gap: "over_budget" }); }
    const res = await inner(input, init);
    let engine = null;
    try { const j = await res.clone().json(); engine = j.prompt_eval_count ?? j.usage?.prompt_tokens ?? null; } catch {}
    write({ ...row, ctxEngine: engine, status: res.status, over: engine != null && engine > B });
    return res;
  };
}
