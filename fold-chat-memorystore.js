// fold-chat-memorystore.js — the VISIBLE, TIERED memory of the fold. Pure; node-testable.
//
// Four tiers, one store:
//   (1) memories ABOUT THE PERSON — auditable, editable. Every entry is the person's
//       OWN words (they typed it, or they stated it and the surface kept the clause
//       verbatim). The model NEVER writes here: memory is RECEIVED, never originated
//       (Constitution II.9 — a model may phrase, it may never originate a fact).
//   (2) the whole history — a browser switch, ON by default. Off means nothing is
//       retained across a reload; the surface says so, plainly, and the model is told.
//   (3) a CONTEXT-FREE chat ("incognito"): it neither reads memory nor writes to it,
//       and it is not persisted. The identity guard still stands (the model must not
//       invent a person it was not given).
//   (4) PROJECTS GROUP their data — a memory can belong to a project, and a chat in
//       that project reads the project's memories first. Grouping is by the person's
//       own filing, NEVER by what they previously accepted (Constitution III.6 — the
//       aperture test: no surface is personalized by prior acceptance).
//
// Nothing here ranks, scores, or infers. The store is a list the person owns and can
// read. `contextFor` is the only thing that turns it into model context, and it is the
// exact set of lines the person can see in the panel.

import { systemContext } from "./fold-chat-memory.js";
import { statedStatements } from "./fold-chat-lang-facts.js";

export const STORE_VERSION = 1;
export const HISTORY_KEY = "fold-chat:memory";
export const MAX_TEXT = 240;          // one memory, one clause — long enough for a preference, short enough to audit
export const MAX_ENTRIES = 200;       // bounded, so a runaway never bloats the prompt or storage

/** A fresh store: history on, nothing remembered, no locale yet. */
export function emptyStore() {
  return { version: STORE_VERSION, historyOn: true, entries: [], locale: { location: null, tz: null, locale: null, ipLookup: false } };  // OPT-IN (user, 2026-10-11): the store consents to nothing until the tick
}

/** Coerce anything read from storage into a valid store (never throws). */
export function normalizeStore(raw) {
  const base = emptyStore();
  if (!raw || typeof raw !== "object") return base;
  const out = { ...base, historyOn: raw.historyOn !== false };
  const L = raw.locale && typeof raw.locale === "object" ? raw.locale : {};
  out.locale = {
    location: L.location && typeof L.location === "object" ? L.location : (typeof L.location === "string" ? { label: L.location, source: "manual" } : null),
    tz: typeof L.tz === "string" ? L.tz : null,
    locale: typeof L.locale === "string" ? L.locale : null,
    ipLookup: L.ipLookup === true,   // OPT-IN (user, 2026-10-11): only an explicit stored true consents
    at: typeof L.at === "string" ? L.at : null,
  };
  const seen = new Set();
  for (const e of Array.isArray(raw.entries) ? raw.entries : []) {
    if (!e || typeof e.text !== "string") continue;
    const text = clean(e.text);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;                       // one entry per distinct statement
    seen.add(key);
    out.entries.push({
      id: typeof e.id === "string" && e.id ? e.id : newId(),
      text,
      source: e.source === "stated" ? "stated" : "manual",
      project: typeof e.project === "string" && e.project ? e.project : null,
      at: typeof e.at === "string" ? e.at : null,
    });
    if (out.entries.length >= MAX_ENTRIES) break;
  }
  return out;
}

function newId() { return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function clean(text) {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  return t.length > MAX_TEXT ? t.slice(0, MAX_TEXT - 1).trimEnd() + "…" : t;
}

/** Does an entry with this text (case-insensitive) already exist? */
function hasText(store, text) {
  const key = clean(text).toLowerCase();
  return (store.entries || []).some((e) => e.text.toLowerCase() === key);
}

/* ---------------- tier 1: the person's own memories (add / edit / remove) ---------------- */

/** Add one memory the person owns. Returns a NEW store (immutable). */
export function addEntry(store, { text, source = "manual", project = null, at = null, id = null } = {}) {
  const t = clean(text);
  if (!t) return store;
  if (hasText(store, t)) return store;                 // never a duplicate
  const entry = { id: id || newId(), text: t, source: source === "stated" ? "stated" : "manual", project: project || null, at };
  const entries = [entry, ...(store.entries || [])].slice(0, MAX_ENTRIES);
  return { ...store, entries };
}

/** Rewrite one memory's text. Returns a NEW store. */
export function editEntry(store, id, text, { at = null } = {}) {
  const t = clean(text);
  const entries = (store.entries || []).map((e) => (e.id === id ? { ...e, text: t, source: "manual", at: at ?? e.at } : e));
  return { ...store, entries };
}

/** Forget one memory. Returns a NEW store. */
export function removeEntry(store, id) {
  return { ...store, entries: (store.entries || []).filter((e) => e.id !== id) };
}

/** Move a memory into a project (or out of one). Returns a NEW store. */
export function setEntryProject(store, id, project) {
  const entries = (store.entries || []).map((e) => (e.id === id ? { ...e, project: project || null } : e));
  return { ...store, entries };
}

/** Forget everything. Returns a NEW store. */
export function clearEntries(store) { return { ...store, entries: [] }; }

/** The history switch (tier 2). Returns a NEW store. */
export function setHistory(store, on) { return { ...store, historyOn: on !== false }; }

/** Patch the locale (tz from the browser; a coarse, correctable location; the IP switch). Returns a NEW store. */
export function setLocale(store, patch = {}) {
  return { ...store, locale: { ...(store.locale || {}), ...patch } };
}

/* ---------------- learning: only what the PERSON states ---------------- */

// The clauses the store learns are read in the person's own language by
// fold-chat-lang-facts.js (one declared table, shared with the identity pipeline).
export { statedStatements };

/** Learn what the person just stated. Returns `{ store, learned: [entryId...] }`.
 *  A context-free chat must not call this — the caller owns that gate. */
export function learn(store, text, { at = null, project = null, idOf = null } = {}) {
  const learned = [];
  let next = store;
  for (const s of statedStatements(text)) {
    if (hasText(next, s)) continue;
    const id = idOf ? idOf() : newId();
    next = addEntry(next, { text: s, source: "stated", project, at, id });
    learned.push(id);
  }
  return { store: next, learned };
}

/* ---------------- tiers 3 & 4: reading the store back ---------------- */

/** Tier 3: is this chat context-free (incognito)? */
export function isContextFree(session) { return !!session?.contextFree; }

/** Tier 4: the entries a chat reads, grouped — the project's own filing first,
 *  then the person's general memories. Grouping only; nothing is ranked. */
export function entriesFor(store, projectId) {
  const all = (store.entries || []);
  const scoped = projectId ? all.filter((e) => e.project === projectId) : [];
  const general = all.filter((e) => !e.project);
  return { project: scoped, general };
}

/** The panel's groups: "About you" (general) plus one group per project that has
 *  memories, in the projects' own order. Projects with no memories are omitted. */
export function groupByProject(store, projects = {}) {
  const groups = [];
  const order = Object.keys(projects || {});
  const byProject = new Map();
  for (const e of store.entries || []) {
    if (!e.project) continue;
    if (!byProject.has(e.project)) byProject.set(e.project, []);
    byProject.get(e.project).push(e);
  }
  for (const id of order) if (byProject.has(id)) groups.push({ project: id, name: projects[id]?.name || id, entries: byProject.get(id) });
  for (const [id, entries] of byProject) if (!(id in (projects || {}))) groups.push({ project: id, name: id, entries });
  return groups;
}

/** The general ("About you") entries. */
export function aboutEntries(store) { return (store.entries || []).filter((e) => !e.project); }

/* ---------------- the model context (the exact lines the panel shows) ---------------- */

/**
 * The system context for one turn.
 *   contextFree  tier 3 — no memory at all, but the identity guard still stands
 *                (the model must not invent a person, and must say it has none).
 *   historyOn    tier 2 — when off, the model is told history is not retained.
 *   project      tier 4 — a project's own memories ride first.
 * The name/facts still come from fold-chat-memory.systemContext, so the standing
 * NO_INVENT rule and the existing identity behavior are unchanged.
 */
export function contextFor(store, { readerName = null, facts = {}, project = null, contextFree = false, localeLine = null } = {}) {
  if (contextFree) return systemContext({ readerName: null, facts: {} });
  const parts = [systemContext({ readerName, facts })];
  const { project: scoped, general } = entriesFor(store, project);
  for (const e of scoped) parts.push(`Remembered for this project: ${e.text}.`);
  for (const e of general) parts.push(`Remembered about the person: ${e.text}.`);
  if (localeLine) parts.push(localeLine);   // local time + coarse place, as context (never an answer)
  if (store?.historyOn === false) parts.push("History is off in this browser: earlier conversations are not available to you — do not imply you remember them.");
  return parts.join(" ");
}
