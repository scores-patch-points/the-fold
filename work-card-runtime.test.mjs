// node work-card-runtime.test.mjs — the card cannot break a turn.
import fs from "node:fs";
import { modeOf, ensureWorkCards, resetWorkCards, workCardPassages } from "./work-card-runtime.js";
// a clean checkout has not built the card file (scripts/build-work-cards.mjs, local corpus): skip, loudly
if (!fs.existsSync(new URL("./mind/work-cards.json", import.meta.url))) { console.log("SKIP: mind/work-cards.json not built (node scripts/build-work-cards.mjs needs the local corpus)"); process.exit(0); }
let fail = 0; const claim = (n, ok, d = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) fail += 1; };
const raw = fs.readFileSync(new URL("./mind/work-cards.json", import.meta.url), "utf8");
const okFetch = async () => ({ ok: true, json: async () => JSON.parse(raw) });
resetWorkCards(); const index = await ensureWorkCards({ fetchImpl: okFetch });
claim("loads the serialised index", !!index && index.cards.length > 0, `${index?.cards.length} cards`);
// off by default: the turn is exactly what it was
claim("mode defaults to off", modeOf({ getItem: () => null }) === "off" && modeOf(null) === "off" && modeOf({ getItem: () => { throw new Error("blocked"); } }) === "off");
const q = "so what's the deal with the Republic?";
const off = workCardPassages({ question: q, index, mode: "off" });
claim("off: no passage, no packet", off.passages.length === 0 && off.packet === null);
const sh = workCardPassages({ question: q, index, mode: "shadow" });
claim("shadow: a packet to log, no passage into the turn", sh.passages.length === 0 && !!sh.packet, `routes to ${sh.packet?.work?.title ?? sh.packet?.refusal}`);
const on = workCardPassages({ question: q, index, mode: "on" });
claim("on: passages at byte addresses with hashes, in the mind's shape", on.passages.length > 0 && on.passages.every((p) => p.url && p.text && p.title && p.via === "mind" && p.address?.sha256 && p.address.end > p.address.at), `${on.passages.length} passages from ${on.packet?.work?.title}; ms ${on.packet?.ms?.toFixed(2)}`);
// fail-open: nothing below may throw or add a passage
resetWorkCards(); const bad1 = await ensureWorkCards({ fetchImpl: async () => { throw new Error("network down"); } }); claim("a thrown fetch → no index", bad1 === null);
resetWorkCards(); const bad2 = await ensureWorkCards({ fetchImpl: async () => ({ ok: true, json: async () => ({ schema: "nope" }) }) }); claim("a malformed index → no index", bad2 === null);
resetWorkCards(); const bad3 = await ensureWorkCards({ fetchImpl: async () => ({ ok: false }) }); claim("a 404 → no index", bad3 === null);
const weird = [undefined, null, 42, {}, "", "   ", "x".repeat(100000), "😀".repeat(500), "<script>alert(1)</script>", "\u0000\u0001"];
let threw = 0, added = 0; for (const w of weird) { for (const m of ["on", "shadow", "off", "bogus"]) { try { const r = workCardPassages({ question: w, index, mode: m }); if (r.passages.length && (typeof w !== "string" || !w.trim())) added += 1; } catch { threw += 1; } } }
claim("odd questions and modes never throw and never add a passage for a non-question", threw === 0 && added === 0, `${weird.length * 4} calls`);
claim("a null index never throws", (() => { try { return workCardPassages({ question: q, index: null, mode: "on" }).passages.length === 0; } catch { return false; } })());
// a question about nothing the cards hold is refused, not forced
const none = workCardPassages({ question: "zxqv blorp wibble", index, mode: "on" });
claim("a question no card holds adds nothing", none.passages.length === 0, none.packet?.refusal ?? "");
const lat = []; for (let i = 0; i < 300; i++) { const t = process.hrtime.bigint(); workCardPassages({ question: q, index, mode: "on" }); lat.push(Number(process.hrtime.bigint() - t) / 1e6); } lat.sort((a, b) => a - b);
claim("the whole path < 5 ms at p95", lat[285] < 5, `p50 ${lat[150].toFixed(2)} · p95 ${lat[285].toFixed(2)} ms`);
console.log(fail ? `\n${fail} FAILED` : "\nall held"); process.exit(fail ? 1 : 0);
