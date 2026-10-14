// fold-chat-hosts.test.mjs — C8: with the public fallback off (the default), a page read never reaches a public
// proxy or text reader, even when the relay is down; with it on, they are tried only after the relay fails.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readText, CORS_PROXIES, TEXT_READERS } from "./fold-chat-web.js";
import { hostClass, publicFallbackOn, FALLBACK_HOSTS, RELAY_HOST, PUBLIC_FALLBACK_KEY } from "./fold-chat-hosts.js";

const resp = (body, { ok = true, status = 200 } = {}) => ({ ok, status, json: async () => body, text: async () => String(body) });
const hostOf = (u) => new URL(u).host;
const PAGE = "<title>A page</title><p>" + "plain words of the page ".repeat(20) + "</p>";

test("the fallback list names exactly the hosts the web module's public services use", () => {
  const used = [...CORS_PROXIES.slice(1), ...TEXT_READERS].map((p) => hostOf(p("https://x.example/a")));
  assert.deepEqual([...used].sort(), [...FALLBACK_HOSTS].sort());
  assert.equal(hostOf(CORS_PROXIES[0]("https://x.example/a")), RELAY_HOST, "index 0 is the relay");
});

test("the switch is off unless set to exactly 'on'", () => {
  const st = (v) => ({ getItem: (k) => (k === PUBLIC_FALLBACK_KEY ? v : null) });
  assert.equal(publicFallbackOn(null), false);
  assert.equal(publicFallbackOn(st(null)), false);
  assert.equal(publicFallbackOn(st("yes")), false);
  assert.equal(publicFallbackOn(st("on")), true);
  assert.equal(publicFallbackOn({ getItem: () => { throw new Error("blocked"); } }), false);
});

test("FALSIFIER: fallback off + relay down — no public service is contacted, the read is an honest unreachable", async () => {
  const seen = [];
  const f = async (url) => {
    seen.push(hostOf(url));
    if (/^https:\/\/refusing\.example/.test(url)) return resp("", { ok: false, status: 403 });
    if (hostOf(url) === RELAY_HOST) throw new Error("relay down");
    return resp(PAGE);   // a public service WOULD have answered: the test fails if it is ever asked
  };
  const rd = await readText("https://refusing.example/a", { fetchImpl: f, publicFallback: false });
  assert.equal(rd.ok, false);
  assert.equal(rd.publicFallback, "off");
  assert.deepEqual(seen.filter((h) => hostClass(h) === "fallback"), [], "no fallback host reached");
  assert.ok(seen.includes(RELAY_HOST), "the relay was tried");
});

test("fallback off + relay up — the relay reads the page and nothing else is asked", async () => {
  const seen = [];
  const f = async (url) => { seen.push(hostOf(url)); if (/^https:\/\/refusing\.example/.test(url)) return resp("", { ok: false, status: 403 }); return resp(PAGE); };
  const rd = await readText("https://refusing.example/b", { fetchImpl: f, publicFallback: false });
  assert.equal(rd.ok, true);
  assert.match(rd.via, /relay/);
  assert.deepEqual(seen.filter((h) => hostClass(h) === "fallback"), []);
});

test("fallback on — public services are asked only AFTER the relay failed", async () => {
  const order = [];
  const f = async (url) => {
    const h = hostOf(url); order.push(h);
    if (/^https:\/\/refusing\.example/.test(url)) return resp("", { ok: false, status: 403 });
    if (h === RELAY_HOST) { await new Promise((r) => setTimeout(r, 20)); throw new Error("relay down"); }
    return resp(PAGE);
  };
  const rd = await readText("https://refusing.example/c", { fetchImpl: f, publicFallback: true });
  assert.equal(rd.ok, true);
  const iRelay = order.indexOf(RELAY_HOST), iFirstPublic = order.findIndex((h) => hostClass(h) === "fallback");
  assert.ok(iRelay >= 0 && iFirstPublic > iRelay, "relay first, public only after: " + order.join(", "));
});

test("hostClass: local, declared, fallback, result", () => {
  assert.equal(hostClass("127.0.0.1:8814"), "local");
  assert.equal(hostClass("en.wikipedia.org"), "declared");
  assert.equal(hostClass("zh.wikipedia.org"), "declared");
  assert.equal(hostClass(RELAY_HOST), "declared");
  assert.equal(hostClass("corsproxy.io"), "fallback");
  assert.equal(hostClass("www.britannica.com"), "result");
  assert.equal(hostClass("evil-wikipedia.org"), "result", "a suffix match needs the dot");
});
