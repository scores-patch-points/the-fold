// work-card-wiring.test.mjs — the card is wired into the chat's material seam, and the default turn is untouched.
// Static checks of fold-chat.js (a re-ordered edit cannot unwire it) + a behavioural check of the merge the seam performs.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { mergeMind } from "./fold-chat-foundation.js";
import { workCardPassages } from "./work-card-runtime.js";
const src = fs.readFileSync(new URL("./fold-chat.js", import.meta.url), "utf8");

test("fold-chat.js imports the runtime and consults it at BOTH material seams (search turn, web-down fallback)", () => {
  assert.match(src, /from "\.\/work-card-runtime\.js"/);
  const calls = src.match(/withWorkCards\(/g) ?? [];
  assert.ok(calls.length >= 2, `happy path + fallback, saw ${calls.length}`);
  assert.match(src, /webPassages = await withWorkCards\(webPassages\)/);
  assert.match(src, /await withWorkCards\(\[\]\)/);
});

test("FALSIFIER: off (the default) fetches nothing — the loader is only reached when the mode is not off", () => {
  assert.match(src, /const workCardsReady = workCardsMode === "off" \? null : ensureWorkCards\(\);/);
  assert.match(src, /if \(!workCardsReady\) return list;/);
});

test("the seam is fail-open: its body is inside try/catch that returns the list unchanged", () => {
  const i = src.indexOf("const withWorkCards = async (list) => {");
  assert.ok(i > 0);
  const body = src.slice(i, i + 1400);
  assert.match(body, /try \{[\s\S]*\} catch \{ return list; \}/);
});

test("card passages merge in front of the web's, de-duplicated by url, in the mind's shape", () => {
  const web = [{ url: "https://w/1", text: "web one" }, { url: "workcard://x/y#1-2", text: "dup" }];
  const wc = { passages: [{ url: "workcard://x/y#1-2", text: "card span", mind: true }] };
  const out = mergeMind(web, wc);
  assert.equal(out[0].text, "card span");
  assert.equal(out.length, 2);
});

test("off mode contributes no passage even with an index (byte-for-byte the old turn)", () => {
  const r = workCardPassages({ question: "anything at all", index: { cards: [{}] }, mode: "off" });
  assert.equal(r.passages.length, 0);
  assert.equal(r.packet, null);
});
