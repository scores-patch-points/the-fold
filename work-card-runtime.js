// work-card-runtime.js — THE CARD AS THE CHAT USES IT: off by default, fail-open, never throws.  (2026-10-14)
//
// The chat already has one seam for "what the fold has already read": mindPassagesFor → mergeMind (fold-chat.js, try/catch). This
// module hands that seam passages of the SAME shape from a work's card, under three modes the person (or a deploy) sets:
//   off     (default) nothing is loaded, nothing is computed: the turn is byte-for-byte what it was
//   shadow  the packet is computed and returned for logging, but contributes NO passage: the demo can be watched before it is trusted
//   on      the card's key spans join the turn's material, each at its file byte address with its sha256
// Every path returns a value: a missing file, a malformed index, a thrown error, a question of any type, all yield "no passages".
import { indexFromSerialized, packetFor } from "./work-card.js";

export const FLAG = "fold-chat:workcard";
export const modeOf = (storage = (typeof localStorage !== "undefined" ? localStorage : null)) => { try { const v = storage?.getItem?.(FLAG); return v === "on" || v === "shadow" ? v : "off"; } catch { return "off"; } };

let loading = null;
export function ensureWorkCards({ fetchImpl = (typeof fetch === "function" ? fetch : null), url = "mind/work-cards.json" } = {}) {
  if (loading) return loading;
  loading = (async () => { try { if (!fetchImpl) return null; const r = await fetchImpl(url); if (!r || r.ok === false) return null; return indexFromSerialized(await r.json()); } catch { return null; } })();
  return loading;
}
export const resetWorkCards = () => { loading = null; };

const slug = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** question → { mode, packet, passages }. `passages` is [] unless mode is "on" and the question routes above chance. */
export function workCardPassages({ question, index, mode = "off", distance = 1 } = {}) {
  const none = { mode, packet: null, passages: [] };
  try {
    if (mode !== "on" && mode !== "shadow") return { ...none, mode: "off" };
    if (!index || typeof question !== "string" || !question.trim()) return none;
    const q = question.length > 600 ? question.slice(0, 600) : question;
    const packet = packetFor(q, index, { distance });
    if (!packet || packet.refusal || !packet.work) return { mode, packet: packet ?? null, void: packet?.void ?? null, passages: [] };
    if (mode === "shadow") return { mode, packet, passages: [] };
    const w = packet.work;
    const passages = packet.keySpans.map((s) => ({
      ref: `the fold's card — ${w.title}`, title: w.title, source: `foundation:${w.file}`, url: `workcard://${slug(w.id)}/${w.id}#${s.byteStart}-${s.byteEnd}`,
      host: "foundation", site: "the fold's card of this work", lang: w.lang, text: s.preview, via: "mind", mind: true, layer: "work-card",
      license: "as the work's own", address: { file: w.file, at: s.byteStart, end: s.byteEnd, sha256: s.sha256 }, coverage: packet.route?.k ?? 0,
    }));
    return { mode, packet, passages };
  } catch { return none; }
}
