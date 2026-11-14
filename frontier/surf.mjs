// frontier/surf.mjs — ORGAN 2, Surf into the log.
// Every byte the model may see enters as a `source` event (source name, retrieval time, sha256 of the content, archive.org link when
// one exists) and is cut into `span` events by the CANONICAL reader (khora native/reading.js::readDocument, through contract.mjs —
// never a homemade splitter). A span carries {start, end, text, sha256 of the source}; `text === source.slice(start, end)` is checked
// at ingest and the span is refused otherwise. Surf is triggered by typed gaps: `surfForGap(gap)` asks the injected egress; with no
// egress it records the gap as unfilled (`surf_miss`), never opens a network path of its own.
//   makeSurf({ log, egress?, read? }) → { ingest(text, meta), ingestFile(path, meta), surfForGap(gapEvent), contentOf(sourceId) }
import { readFileSync } from "node:fs";
import { sha256 } from "./log.mjs";
import { engine } from "./contract.mjs";

export async function canonicalRead(text) {
  const readDocument = await engine("readDocument");
  // lexicon:false — the hyperlexicon door (loopback :11450) is not assumed running; the entry then carries the reader's own typed gap.
  const w = await readDocument(text, { lexicon: false, language: "eng" });
  return { sentences: w.sentences.map((s) => ({ start: s.offset, end: s.offset + s.text.length, text: s.text })), gaps: w.gaps ?? [], aliasGap: w.aliasReport?.gap ?? null };
}

export function makeSurf({ log, egress = null, read = canonicalRead, by = "surf" } = {}) {
  const contents = new Map();
  const surf = {
    async ingest(text, { source, retrievedAt = new Date(0).toISOString(), url = null, archive = null, deps = [], meta = {} } = {}) {
      if (!source) throw new TypeError("surf.ingest: a source name is required");
      const hash = sha256(text);
      const src = log.append({ kind: "source", by, deps, body: { source, url, archive, retrievedAt, sha256: hash, chars: text.length, ...meta } });
      contents.set(src.id, text);
      const r = await read(text);
      if (r.aliasGap) log.append({ kind: "gap", by: "reader", deps: [src.id], body: { gap: "reader_note", detail: r.aliasGap } });
      const spans = [];
      for (const s of r.sentences) {
        if (text.slice(s.start, s.end) !== s.text) { log.append({ kind: "refusal", by, deps: [src.id], body: { gap: "span_unaddressable", start: s.start } }); continue; }
        spans.push(log.append({ kind: "span", by: "reader:khora", deps: [src.id], body: { source, sha256: hash, start: s.start, end: s.end, text: s.text } }));
      }
      return { source: src, spans };
    },
    async ingestFile(path, meta = {}) { return surf.ingest(readFileSync(path, "utf8"), { source: meta.source ?? path, ...meta }); },
    async surfForGap(gapEvent) {
      if (!egress) { log.append({ kind: "surf_miss", by, deps: [gapEvent.id], body: { why: "no sanctioned egress injected" } }); return null; }
      const got = await egress(gapEvent.body); // { text, url, retrievedAt, archive } from the existing fetch-first egress
      if (!got?.text) { log.append({ kind: "surf_miss", by, deps: [gapEvent.id], body: { why: "egress returned nothing" } }); return null; }
      return surf.ingest(got.text, { source: got.url, url: got.url, retrievedAt: got.retrievedAt, archive: got.archive ?? null, deps: [gapEvent.id] });
    },
    contentOf: (id) => contents.get(id) ?? null,
  };
  return surf;
}

/** Trace check: does span event `id` reach a source event whose hash matches the bytes it quotes? */
export function traceSpan(log, id, contentOf) {
  const sp = log.get(id);
  if (!sp || sp.kind !== "span") return { ok: false, why: "not a span event" };
  const src = log.get(sp.deps[0]);
  if (!src || src.kind !== "source") return { ok: false, why: "span has no source event" };
  if (src.body.sha256 !== sp.body.sha256) return { ok: false, why: "hash mismatch" };
  const text = contentOf?.(src.id);
  if (text != null && (sha256(text) !== src.body.sha256 || text.slice(sp.body.start, sp.body.end) !== sp.body.text)) return { ok: false, why: "bytes do not match" };
  return { ok: true, source: src.body.source, sha256: src.body.sha256, retrievedAt: src.body.retrievedAt };
}
