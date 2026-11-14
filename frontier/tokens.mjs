// frontier/tokens.mjs — token counting for the budget invariant.
// The PRE-call count is a declared upper-bound estimator (never measured on the test sets): ceil(utf8 bytes / 3).
// Sentencepiece/BPE tokenizers for gemma/qwen average ~4 bytes per token on English; /3 is deliberately pessimistic so the
// pre-call check errs toward refusing. The POST-call count is the engine's own (ollama prompt_eval_count) and is logged beside it;
// the invariant test fails the build if EITHER exceeds B. Giver of the /3 bound: this build (declared 2026-11-14), checked by
// tests/stage2-budget.test.mjs against real ollama counts where a model is present.
export const BYTES_PER_TOKEN_BOUND = 3;
export const estimateTokens = (s) => Math.ceil(Buffer.byteLength(String(s ?? ""), "utf8") / BYTES_PER_TOKEN_BOUND);
export const messagesTokens = (msgs) => msgs.reduce((n, m) => n + estimateTokens(m.content) + 4, 0);
