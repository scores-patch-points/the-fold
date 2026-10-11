// fold-chat-import.js — bring another chat system's export INTO the fold. Pure; node-testable.
//
// "give an ability to import their data from any other chat system (figure out the normal format
// of that)" (user, 2026-10-11). The exports people actually have are a small, well-known set:
//
//   chatgpt  conversations.json — an array of { title, create_time, mapping, current_node }; the
//            `mapping` is a node graph, and the live thread is the path from `current_node` up to
//            the root (parts are under message.content.parts).
//   claude   conversations.json — an array of { uuid, name, created_at, chat_messages:[{ sender,
//            text, content:[{type,text}] }] }.
//   openai   a { messages:[{ role, content }] } object, an array of them, or { conversation }.
//   jsonl    one JSON object per line — the API log form ({ role, content } or { message:{…} }).
//   text     a plain transcript (no structure to trust) — kept whole, as one conversation.
//
// Everything is normalized to the fold's own shape: { title, createdAt, messages:[{ role, text, at }] }
// with roles user|assistant|system. Nothing is invented; a message with no text is dropped, not guessed.
//
// The person's OWN messages are then mined for memories ABOUT THEM (memorystore.statedStatements):
// an import becomes both the history and the start of the visible memory.

import { statedStatements } from "./fold-chat-memorystore.js";

const MAX_CONVOS = 2000;
const MAX_MESSAGES = 5000;
const MAX_TEXT = 200000;

const roleOf = (r) => { const s = String(r ?? "").toLowerCase(); return s === "human" || s === "user" ? "user" : s.includes("assistant") || s === "gpt" || s === "bot" || s === "ai" ? "assistant" : s === "system" ? "system" : "user"; };
const asText = (c) => {
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((p) => (typeof p === "string" ? p : (p && (p.text || p.content)) || "")).filter(Boolean).join("\n");
  if (c && typeof c === "object") return typeof c.text === "string" ? c.text : "";
  return "";
};
const cleanText = (t) => { const s = String(t ?? ""); return s.length > MAX_TEXT ? s.slice(0, MAX_TEXT) : s; };
const msToIso = (t) => (typeof t === "number" && Number.isFinite(t) ? new Date(t * 1000).toISOString() : (typeof t === "string" ? t : null));

function tryJson(text) {
  const t = String(text ?? "").trim();
  if (!t) return null;
  try { return JSON.parse(t); } catch { return undefined; }
}

/** Which known export shape is this text? */
export function detectFormat(text) {
  const t = String(text ?? "").trim();
  if (!t) return "empty";
  const j = tryJson(t);
  if (j === undefined) {
    // not a single JSON document — maybe JSONL, else plain text
    const lines = t.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length && lines.every((l) => { try { const o = JSON.parse(l); return o && typeof o === "object"; } catch { return false; } })) return "jsonl";
    return "text";
  }
  if (!j) return "unknown";
  const arr = Array.isArray(j) ? j : (j.conversations || j.messages ? (j.conversations || [j]) : null);
  if (j && Array.isArray(j.messages)) return "openai";
  if (Array.isArray(j) && j.length && j[0] && j[0].mapping) return "chatgpt";
  if (Array.isArray(j) && j.length && j[0] && Array.isArray(j[0].chat_messages)) return "claude";
  if (arr && arr.length && arr[0] && Array.isArray(arr[0].messages)) return "openai";
  if (Array.isArray(j) && j.length && j[0] && typeof j[0].role === "string") return "openai";   // a bare message list
  return "unknown";
}

/** ChatGPT: linearize the node graph along the current node's parent chain (fallback: by time). */
function chatgptMessages(convo) {
  const map = convo?.mapping || {};
  const nodes = Object.values(map).filter((n) => n && n.message);
  let path = [];
  if (convo?.current_node && map[convo.current_node]) {
    let cur = map[convo.current_node];
    const seen = new Set();
    while (cur && !seen.has(cur.id)) { seen.add(cur.id); path.push(cur); cur = cur.parent ? map[cur.parent] : null; }
    path.reverse();
  } else {
    path = [...nodes].sort((a, b) => (a.message?.create_time || 0) - (b.message?.create_time || 0));
  }
  const out = [];
  for (const n of path) {
    const m = n.message; if (!m) continue;
    const role = roleOf(m.author?.role);
    const text = asText(m.content?.parts ?? m.content?.text ?? "").trim();
    if (!text) continue;                                  // a tool/empty node is dropped, never guessed
    out.push({ role, text: cleanText(text), at: msToIso(m.create_time) });
    if (out.length >= MAX_MESSAGES) break;
  }
  return out;
}

function claudeMessages(convo) {
  const out = [];
  for (const m of Array.isArray(convo?.chat_messages) ? convo.chat_messages : []) {
    const text = (typeof m?.text === "string" && m.text) || asText(m?.content);
    const t = String(text || "").trim();
    if (!t) continue;
    out.push({ role: roleOf(m?.sender), text: cleanText(t), at: m?.created_at || null });
    if (out.length >= MAX_MESSAGES) break;
  }
  return out;
}

function openaiMessages(convo) {
  const list = Array.isArray(convo) ? convo : (Array.isArray(convo?.messages) ? convo.messages : []);
  const out = [];
  for (const m of list) {
    const text = asText(m?.content ?? m?.message?.content ?? "").trim();
    if (!text) continue;
    out.push({ role: roleOf(m?.role ?? m?.message?.role), text: cleanText(text), at: msToIso(m?.created_at) });
    if (out.length >= MAX_MESSAGES) break;
  }
  return out;
}

/**
 * Parse an export into the fold's shape.
 * @returns { format, conversations:[{ title, createdAt, messages:[{role,text,at}] }], stats:{conversations,messages,people} }
 */
export function parseExport(text) {
  const format = detectFormat(text);
  let conversations = [];
  if (format === "chatgpt") {
    const arr = Array.isArray(tryJson(text)) ? tryJson(text) : [];
    conversations = arr.map((c) => ({ title: c.title || "Imported chat", createdAt: msToIso(c.create_time), messages: chatgptMessages(c) }));
  } else if (format === "claude") {
    const j = tryJson(text); const arr = Array.isArray(j) ? j : (j?.conversations || []);
    conversations = arr.map((c) => ({ title: c.name || "Imported chat", createdAt: c.created_at || null, messages: claudeMessages(c) }));
  } else if (format === "openai") {
    const j = tryJson(text);
    const list = Array.isArray(j) ? j : (Array.isArray(j?.conversations) ? j.conversations : [j]);
    conversations = list.map((c, i) => ({ title: c?.title || c?.name || (list.length > 1 ? `Imported chat ${i + 1}` : "Imported chat"), createdAt: c?.created_at || null, messages: openaiMessages(c) }));
  } else if (format === "jsonl") {
    const msgs = [];
    for (const line of String(text).split(/\r?\n/)) {
      const o = tryJson(line); if (!o) continue;
      const text2 = asText(o.content ?? o.message?.content ?? "").trim();
      if (!text2) continue;
      msgs.push({ role: roleOf(o.role ?? o.message?.role ?? o.author?.role), text: cleanText(text2), at: msToIso(o.created_at) });
    }
    conversations = [{ title: "Imported log", createdAt: null, messages: msgs.slice(0, MAX_MESSAGES) }];
  } else if (format === "text") {
    conversations = [{ title: "Imported text", createdAt: null, messages: [{ role: "user", text: cleanText(String(text).trim()) }] }];
  }
  conversations = conversations.filter((c) => c.messages.length).slice(0, MAX_CONVOS);
  const messages = conversations.reduce((n, c) => n + c.messages.length, 0);
  const people = conversations.reduce((n, c) => n + c.messages.filter((m) => m.role === "user").length, 0);
  return { format, conversations, stats: { conversations: conversations.length, messages, people } };
}

/** The memories about the person that their OWN messages state — deduped, bounded. */
export function mineMemories(conversations, { max = 100 } = {}) {
  const out = []; const seen = new Set();
  for (const c of conversations || []) {
    for (const m of c.messages || []) {
      if (m.role !== "user") continue;                    // only the person's own words
      for (const s of statedStatements(m.text)) {
        const k = s.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k); out.push({ text: s, at: m.at || null });
        if (out.length >= max) return out;
      }
    }
  }
  return out;
}
