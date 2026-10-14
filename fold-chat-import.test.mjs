// fold-chat-import.test.mjs — the exports people actually have, normalized; the person's own words mined.
import test from "node:test";
import assert from "node:assert/strict";
import { detectFormat, parseExport, mineMemories } from "./fold-chat-import.js";

const CHATGPT = JSON.stringify([{
  title: "Test chat", create_time: 1700000000, current_node: "b",
  mapping: {
    a: { id: "a", parent: null, message: { author: { role: "user" }, content: { parts: ["my name is Ada"] }, create_time: 1700000000 } },
    b: { id: "b", parent: "a", message: { author: { role: "assistant" }, content: { parts: ["Hi Ada"] }, create_time: 1700000001 } },
  },
}]);

const CLAUDE = JSON.stringify([{
  uuid: "x", name: "Claude chat", created_at: "2026-01-01T00:00:00Z",
  chat_messages: [
    { sender: "human", text: "I live in Nashville", created_at: "2026-01-01T00:00:01Z" },
    { sender: "assistant", content: [{ type: "text", text: "Nice place" }], created_at: "2026-01-01T00:00:02Z" },
  ],
}]);

const OPENAI = JSON.stringify({ messages: [{ role: "user", content: "hi" }, { role: "assistant", content: [{ type: "text", text: "hello" }] }] });

const JSONL = '{"role":"user","content":"remember that I hate cilantro"}\n{"role":"assistant","content":"noted"}\n';

test("detectFormat names the known shapes", () => {
  assert.equal(detectFormat(CHATGPT), "chatgpt");
  assert.equal(detectFormat(CLAUDE), "claude");
  assert.equal(detectFormat(OPENAI), "openai");
  assert.equal(detectFormat(JSONL), "jsonl");
  assert.equal(detectFormat("just some transcript\n\nmore words"), "text");
  assert.equal(detectFormat(""), "empty");
});

test("ChatGPT mapping is linearized along the current node's parent chain", () => {
  const { format, conversations, stats } = parseExport(CHATGPT);
  assert.equal(format, "chatgpt");
  assert.equal(conversations.length, 1);
  assert.deepEqual(conversations[0].messages.map((m) => m.role), ["user", "assistant"]);
  assert.equal(conversations[0].messages[0].text, "my name is Ada");
  assert.equal(stats.messages, 2);
  assert.equal(stats.people, 1);
});

test("Claude chat_messages -> messages (text and content[] both read)", () => {
  const { format, conversations } = parseExport(CLAUDE);
  assert.equal(format, "claude");
  assert.deepEqual(conversations[0].messages.map((m) => m.text), ["I live in Nashville", "Nice place"]);
  assert.equal(conversations[0].title, "Claude chat");
});

test("OpenAI messages -> one conversation; JSONL -> one log", () => {
  const o = parseExport(OPENAI);
  assert.equal(o.format, "openai");
  assert.deepEqual(o.conversations[0].messages.map((m) => m.text), ["hi", "hello"]);
  const j = parseExport(JSONL);
  assert.equal(j.format, "jsonl");
  assert.equal(j.conversations[0].messages.length, 2);
});

test("plain text is kept whole, never guessed into roles", () => {
  const { format, conversations } = parseExport("dear diary\n\nI had a thought");
  assert.equal(format, "text");
  assert.equal(conversations.length, 1);
  assert.equal(conversations[0].messages.length, 1);
  assert.equal(conversations[0].messages[0].role, "user");
});

test("empty and unknown exports do not throw; they produce nothing", () => {
  assert.deepEqual(parseExport("").conversations, []);
  assert.equal(parseExport("").stats.messages, 0);
});

test("mineMemories reads only the person's OWN words, deduped", () => {
  const { conversations } = parseExport(CLAUDE);
  const mem = mineMemories(conversations);
  assert.ok(mem.some((m) => /I live in Nashville/.test(m.text)));
  assert.equal(mineMemories(parseExport(CHATGPT).conversations).some((m) => /my name is Ada/.test(m.text)), true);
  // the assistant's sentence is never mined
  assert.ok(!mem.some((m) => /Nice place/.test(m.text)));
});
