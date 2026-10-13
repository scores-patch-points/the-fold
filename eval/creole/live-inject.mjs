// eval/creole/live-inject.mjs — the six creole asks through the modules a running Fold SERVES, with the language injected through the
// existing thread-language parameter (murmurOf's `prior`). The language-ID layer is another owner's; this isolates the salience layer.
//   FOLD_URL=http://127.0.0.1:8821/ node eval/creole/live-inject.mjs
import { chromium } from "playwright";
const URL_ = process.env.FOLD_URL || "http://127.0.0.1:8814/";
const ASKS = [["Ki kapital Ayiti?", "hat"], ["Ki kapital Moris?", "hat"], ["Wanem em kapital bilong Papua Niugini?", null], ["Weh a di capital a Jamaica?", null], ["Ki moun ki ekri Les Misérables?", "hat"], ["Wetin be di capital of Nigeria?", "pcm"]];
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL_, { waitUntil: "domcontentloaded" });
const rows = await p.evaluate(async (asks) => {
  const { murmurOf } = await import("/fold-chat-murmur.js");
  return asks.map(([q, prior]) => { const m = murmurOf({ question: q, prior }); return { q, prior, lang: m.lang, names: m.names, content: m.content, unknown: m.unknown, low: m.low }; });
}, ASKS);
for (const r of rows) console.log(JSON.stringify(r));
await b.close();
