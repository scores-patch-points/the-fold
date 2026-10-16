// fold-chat-provenanceview.css.js — the provenance spread's look (see fold-chat-provenanceview.js),
// injected once as <style id="fold-provenance-style">. Everything is under `.provenance-spread`, so it
// cannot collide with the page's rules. Colours are the app's own variables (index.html :root, light AND
// dark) with a calm fallback for a bare page. Nothing is conveyed by colour alone: a chip carries a WORD
// (S# / M), a flag carries the word "⚠" and a kind, and the standing cell is named in text.
export const PROVENANCEVIEW_STYLE_ID = "fold-provenance-style";
export const PROVENANCEVIEW_CSS = `
.provenance-spread { display: flex; flex-direction: column; gap: 6px; min-width: 0; max-width: 100%; margin: 6px 0 8px; color: var(--ink, #141416); }
.provenance-spread .pv-s, .provenance-spread .pv-m { display: flex; gap: 8px; min-width: 0; align-items: baseline; }
.provenance-spread .pv-chip { flex: 0 0 auto; font: 600 11px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--ag, #0d7a70); }
.provenance-spread .pv-m .pv-chip { color: var(--mut, #5f5f6b); }
.provenance-spread .pv-t { min-width: 0; overflow-wrap: anywhere; }
.provenance-spread .pv-line { font-size: var(--fs-sm, 13.5px); line-height: 1.55; color: var(--ink2, #44444e); overflow-wrap: anywhere; }
.provenance-spread .pv-quote { color: var(--ink, #141416); }
.provenance-spread .pv-foot { display: flex; flex-wrap: wrap; gap: 2px 10px; font-size: var(--fs-xs, 12px); color: var(--mut, #5f5f6b); }
.provenance-spread .pv-stand { color: var(--ink2, #44444e); }
.provenance-spread .pv-flag { font-size: var(--fs-xs, 12px); color: var(--warn, #a04a07); overflow-wrap: anywhere; }
`;
