// fold-chat-eotview.js — the work tree as the EOT log says it. The panel keeps no tree of its own: it asks the
// door for folds of the one log (khora/opencode-eot.mjs: projectTree / projectLog / editsOf) at a cursor, and
// draws them. Pure apart from `eotFetch`; no DOM, so the shaping is testable in node.

const GLYPH = { edit: "●", verify: "▲", admit: "▲", reject: "▽", exec: "○", wt: "w", mark: "◇", turn: "◇", claim: "◇", done: "◇", flag: "!", contend: "!", read: "▶", draw: "✎", hunt: "⌁", refuse: "✗", ibid: "≡", reason: "◆" };
const escHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const MODEL_STAGES = new Set(["mark", "turn", "claim", "done", "reason"]);

/** GET one fold of the log. `q` = { task | workspace }, `asOf` = event id or ms (null = now). */
export async function eotFetch(base, view, q = {}, asOf = null, extra = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...q, ...extra })) if (v != null && v !== "") p.set(k, String(v));
  if (asOf != null) p.set("asOf", String(asOf));
  const r = await fetch(`${String(base).replace(/\/$/, "")}/v1/hooks/opencode/eot/${view}?${p}`);
  if (!r.ok) throw new Error(`eot ${view} ${r.status}`);
  return r.json();
}

/** Shape a /file answer into the panel's codeChanges rows (what the Log view already renders). */
export function changesOf(fileResp) {
  return (fileResp?.changes ?? []).map((c) => ({ id: c.id, at: c.at, path: fileResp.path, op: c.op, by: c.by, label: `${c.tool || c.op} · ${c.standing}`, before: c.before ?? "", after: c.after ?? "" }));
}

/** Lanes of the spine: one per agent, in first-seen order, events as marks. */
export function lanesOf(events) {
  const lanes = new Map();
  for (const e of events) { const k = String(e.agent ?? "?"); if (!lanes.has(k)) lanes.set(k, []); lanes.get(k).push(e); }
  return [...lanes].map(([agent, evs]) => ({ agent, evs }));
}

/**
 * The spine strip: a lane per writer, a mark per event (hollow = something SAID, solid = something OBSERVED),
 * the cursor as the highlighted mark, and a Now button. Each mark carries data-evt = its event id.
 */
export function spineHtml(log, { cursor = null, esc = escHtml } = {}) {
  const events = log?.events ?? [];
  if (!events.length) return `<div class="fs-spine"><div class="fs-empty">No transformations recorded for this task yet.</div></div>`;
  const lanes = lanesOf(events);
  const rows = lanes.map(({ agent, evs }) => `<div class="fs-lane"><span class="fs-lane-n">${esc(String(agent).slice(0, 10))}</span><span class="fs-lane-m">${evs.map((e) => `<button type="button" class="fs-mk${MODEL_STAGES.has(e.stage) ? " said" : ""}${e.id === cursor ? " cur" : ""}" data-evt="${esc(e.id)}" title="${esc(`${e.stage}${e.path ? " " + e.path : e.unit ? " " + e.unit : ""} · ${e.standing}`)}">${GLYPH[e.stage] || "·"}</button>`).join("")}</span></div>`).join("");
  const at = cursor ? `at ${esc(String(cursor).slice(0, 12))}…` : "now";
  return `<div class="fs-spine"><div class="fs-spine-h"><b>EOT</b><span>${log.total} event(s) · ${at}${cursor ? ` · ${(events.findIndex((e) => e.id === cursor) + 1) || "?"} of ${events.length}` : ""}</span><span class="fs-sp"></span>${cursor ? `<button type="button" class="fs-btn" data-evt="">Now</button>` : ""}</div>${rows}</div>`;
}

/** Drift + worktrees line under the spine: what is off the record, and which worktrees the log knows. */
export function noteHtml(tree, esc = escHtml) {
  if (!tree) return "";
  const drift = (tree.drift ?? []).map((d) => `<div class="fs-err">⚠ ${esc(d.path)} · disk differs from the log (last: ${esc(d.last ?? "?")})</div>`).join("");
  const wts = (tree.worktrees ?? []).map((w) => `<span class="fs-chip">${esc(w)}</span>`).join(" ");
  return `${drift}${wts ? `<div class="fs-note">worktrees: ${wts}</div>` : ""}`;
}
