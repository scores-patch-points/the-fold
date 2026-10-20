// A page with a long run of address characters and no "@" (a base64 or minified blob) must not stall the event loop: the address patterns are linear.
import test from "node:test";
import assert from "node:assert/strict";
import { contactsFromHtml } from "./fold-chat-contact.js";

const blob = (n) => "A1b2C3d4E5".repeat(n / 10);
test("a 60k run of address characters is read in well under a second", () => {
  for (const html of [`<p>${blob(60000)}</p>`, `<p>${blob(60000)} [at ${blob(2000)}</p>`, `<p>${blob(60000)}@</p>`]) {
    const t = Date.now();
    contactsFromHtml(html, "https://example.com/");
    assert.ok(Date.now() - t < 1000, `took ${Date.now() - t} ms`);
  }
});
// matching itself (plain, mailto, obfuscated) is held by fold-chat-contact.test.mjs, which passes with the lookbehinds.
