// fold-chat-provenanceview.js — THE FACING PAGE'S VISIBLE SPREAD, ported into the chat app: every
// sentence of a reply tagged by what it rests on, the APP-authored provenance line beside it, and the
// turn's record. Pure: no DOM, no IO, no model. Every content string is escaped and rendered as text,
// so neither a source's nor a model's own words can ever become markup (the repo's rule, as in
// fold-chat-eotview.js and fold-chat-strandview.js).
//
// It re-derives nothing. The pieces already exist:
//   fold-chat-provenance.js  narrate()  → { parts:[{ kind:"app"|"quote", text, host, … }] } — provenance is APP-authored
//   fold-chat-ground.js      attribute/coverage · unsupportedClaims · turnRecord — a sentence's standing
//   fold-chat-strandview.js  the SOURCES-ONLY spread — the sibling answer mode
//
// STANDING IS NEVER TRUTH — it is what the record carries: [S# ref] grounded (the bytes exist at an
// address), [S# ref·asserted] what an agent or a model SAID, [M] the mouth's own. A flag is a
// VERIFIABLE failure and names the cube cell it is owed to (SIG·Figure for a path resolving to no
// referent; EVA·Figure for a check nothing can trigger) — so the spread says not just that a claim
// failed to stand, but where.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** The chip a sentence carries: grounded → `S#` (with its address), asserted → `S#·asserted`, else `M`. */
export function sentenceChip(s, n) {
  const ref = s?.ref ? ` ${s.ref}` : "";
  if (s?.type === "grounded") return `S${n}${ref}`;
  if (s?.type === "asserted") return `S${n}${ref}·asserted`;
  return "M";
}

export function sentenceClass(type) {
  return type === "grounded" ? "pv-s" : type === "asserted" ? "pv-s pv-a" : "pv-m";
}

/** sentencesHtml — the reply's sentences, each with its standing chip, in the reply's own order. */
export function sentencesHtml(sentences = []) {
  return (sentences || [])
    .map((s, i) => `<div class="${sentenceClass(s?.type)}"><span class="pv-chip" aria-hidden="true">[${esc(sentenceChip(s, i + 1))}]</span><span class="pv-t">${esc(s?.text)}</span></div>`)
    .join("");
}

/** narrationHtml — the provenance line. app parts are the app's own words; quote parts are VERBATIM slices, drawn as a <q>. */
export function narrationHtml(narr) {
  const parts = narr?.parts ?? [];
  if (!parts.length) return "";
  return `<div class="pv-line">${parts
    .map((p) =>
      p?.kind === "quote"
        ? `<q class="pv-quote"${p.host ? ` title="${esc(p.host)}"` : ""}>${esc(p.text)}</q>`
        : `<span class="pv-app">${esc(p.text)}</span>`,
    )
    .join(" ")}</div>`;
}

/** The record line: what the turn carried. A zero is PRINTED, never silence (silence must not read as clean). */
export function recordLine(summary, flags = []) {
  const s = summary ?? {};
  const flagged = flags?.length || s.flagged || 0;
  return `${s.grounded ?? 0} grounded · ${s.asserted ?? 0} asserted · ${s.selfModel ?? 0} self-model · ${flagged} flagged`;
}

/** Where the reply's claim stands — the standing cube's cell — and the nulls the reading watched for.
 *  Plain text (no markup), so a DOM consumer that renders via textContent can use it verbatim. */
export function standingText(standing) {
  if (!standing?.cell) return "";
  const watched = Array.isArray(standing.watched) && standing.watched.length ? ` — watched ${standing.watched.join(", ")}` : "";
  return `standing · ${standing.cell}${watched}`;
}

/** One verifiable failure, plain text, naming the cell it is owed to. */
export function flagText(f) {
  return `⚠ ${f?.kind ?? "flag"}${f?.cell ? ` → ${f.cell}` : ""}${f?.detail ? ` — ${f.detail}` : ""}`;
}

/** Where the reply's claim stands — the standing cube's cell — and the nulls the reading watched for. */
export function standingHtml(standing) {
  const text = standingText(standing);
  return text ? `<div class="pv-stand">${esc(text)}</div>` : "";
}

/** The verifiable failures, each naming the cell it is owed to. */
export function flagsHtml(flags = []) {
  return (flags || []).map((f) => `<div class="pv-flag" role="note">${esc(flagText(f))}</div>`).join("");
}

/** The whole spread. Returns "" when there is nothing to say (no sentences and no flags). */
export function provenanceHtml({ sentences = [], narration = null, summary = null, flags = [], standing = null } = {}) {
  const body = [sentencesHtml(sentences), narrationHtml(narration)].filter(Boolean).join("");
  if (!body && !(flags || []).length) return "";
  return [
    `<div class="provenance-spread">`,
    body,
    `<div class="pv-foot"><span class="pv-rec">${esc(recordLine(summary, flags))}</span>${standingHtml(standing)}</div>`,
    flagsHtml(flags),
    `</div>`,
  ].join("");
}
