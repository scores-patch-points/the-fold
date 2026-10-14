// eval/agent/webllm-shim.mjs — served by drive.mjs IN PLACE OF the pinned web-llm ESM (WEBLLM_ESM_URL) when the harness runs headless
// (no WebGPU). It speaks the slice of web-llm's API that fold-chat-webllm.js uses (CreateWebWorkerMLCEngine / CreateMLCEngine,
// prebuiltAppConfig, hasModelInCache, engine.chat.completions.create streaming, interruptGenerate) and answers every generation
// from the computer's counterpart of the in-tab model (OLLAMA_TAG in fold-chat-webllm.js: gemma-2-2b-it → gemma2:2b) through the
// harness's /__harness/chat route. The app's engine, client, prompts, temperature and token limits are untouched; only the runtime
// under the engine is the computer's instead of the tab's.
const IDS = ["gemma-2-2b-it-q4f16_1-MLC", "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", "Qwen3-1.7B-q4f16_1-MLC", "SmolLM2-360M-Instruct-q4f16_1-MLC", "SmolLM2-1.7B-Instruct-q4f16_1-MLC", "Llama-3.2-1B-Instruct-q4f16_1-MLC", "Llama-3.2-3B-Instruct-q4f16_1-MLC", "Qwen3-4B-q4f16_1-MLC"];
export const prebuiltAppConfig = { model_list: IDS.flatMap((id) => [{ model_id: id }, { model_id: id.replace("q4f16_1", "q4f32_1") }]) };
export async function hasModelInCache() { return true; }
export class WebWorkerMLCEngineHandler { onmessage() {} }
function engineFor(build, cfg) {
  let stop = false;
  try { cfg?.initProgressCallback?.({ progress: 1, text: "harness runtime ready", timeElapsed: 0 }); } catch {}
  return {
    interruptGenerate() { stop = true; },
    async unload() {}, async resetChat() {},
    chat: { completions: { async create(req) {
      stop = false;
      const r = await fetch("/__harness/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ build, messages: req.messages, temperature: req.temperature, max_tokens: req.max_tokens, top_p: req.top_p }) });
      if (!r.ok) throw new Error("harness runtime answered " + r.status);
      const j = await r.json();
      const text = String(j.content || "");
      return (async function* () {
        for (let i = 0; i < text.length && !stop; i += 24) yield { choices: [{ delta: { content: text.slice(i, i + 24) }, finish_reason: null }] };
        yield { choices: [{ delta: {}, finish_reason: stop ? "abort" : (j.finish || "stop") }], usage: { completion_tokens: j.tokens || 0 } };
      })();
    } } },
  };
}
export async function CreateWebWorkerMLCEngine(_worker, build, cfg) { return engineFor(build, cfg); }
export async function CreateMLCEngine(build, cfg) { return engineFor(build, cfg); }
