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

// THE VOID IS POSITIVE: a work the fold does not hold is asserted, with its terms; the nearest card is never the answer
{
  const v1 = workCardPassages({ question: "zxqv blorp wibble", index, mode: "on" });
  claim("a question about nothing the fold holds is a POSITIVE void, not a silence", v1.void?.kind === "WorkVoid@1" && v1.void.asserted === true && v1.void.absence.reason === "no_known_terms" && v1.passages.length === 0, JSON.stringify(v1.void?.absence?.reason));
  claim("the void names what it asked and what no card holds", v1.void.asked.length === 3 && v1.void.unheld.includes("zxqv") && v1.void.named.includes("zxqv") && /zxqv/.test(v1.void.fill));
  const v2 = workCardPassages({ question: "tell me about The Adventures of Tom Sawyer", index, mode: "on" });
  claim("a work with no card that shares a word with one is a void, and the nearest card says it is NOT the answer", !!v2.void && v2.passages.length === 0 && (v2.void.nearest === null || v2.void.nearest.isTheAnswer === false), v2.void ? `${v2.void.absence.reason}; nearest ${v2.void.nearest?.title}` : "was routed: " + v2.packet?.work?.title);
  claim("named things the fold does not hold are listed (tom, sawyer)", !!v2.void && v2.void.named.includes("sawyer"));
  const h = workCardPassages({ question: "so what's the deal with the Republic?", index, mode: "on" });
  claim("a card's own name carries the question: held, with spans, no void", !h.void && h.passages.length > 0 && h.packet.route.viaPin === true, `${h.packet?.work?.title}`);
}

// a question about nothing the cards hold is refused, not forced
const none = workCardPassages({ question: "zxqv blorp wibble", index, mode: "on" });
claim("a question no card holds adds nothing", none.passages.length === 0, none.packet?.refusal ?? "");
const lat = []; for (let i = 0; i < 300; i++) { const t = process.hrtime.bigint(); workCardPassages({ question: q, index, mode: "on" }); lat.push(Number(process.hrtime.bigint() - t) / 1e6); } lat.sort((a, b) => a - b);
claim("the whole path < 5 ms at the median", lat[150] < 5, `p50 ${lat[150].toFixed(2)} · p95 ${lat[285].toFixed(2)} ms (informational)`);
console.log(fail ? `\n${fail} FAILED` : "\nall held"); process.exit(fail ? 1 : 0);
