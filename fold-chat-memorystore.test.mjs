// fold-chat-memorystore.test.mjs — the four tiers: auditable user memory, the history
// switch, context-free chats, and project grouping; and the line: memory is received,
// never originated, never ranked by acceptance.
import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyStore, normalizeStore, addEntry, editEntry, removeEntry, setEntryProject, setHistory, setLocale, clearEntries,
  statedStatements, learn, isContextFree, entriesFor, groupByProject, aboutEntries, contextFor,
} from "./fold-chat-memorystore.js";

test("a fresh store: history on, nothing remembered", () => {
  const s = emptyStore();
  assert.equal(s.historyOn, true);
  assert.deepEqual(s.entries, []);
});

test("tier 1 — add, edit, remove are the person's own, deduped, bounded", () => {
  let s = addEntry(emptyStore(), { text: "I prefer short answers", at: "2026-10-10" });
  assert.equal(s.entries.length, 1);
  assert.equal(s.entries[0].source, "manual");
  s = addEntry(s, { text: "i prefer short answers" });        // duplicate (case-insensitive)
  assert.equal(s.entries.length, 1);
  const id = s.entries[0].id;
  s = editEntry(s, id, "I prefer terse answers");
  assert.equal(s.entries[0].text, "I prefer terse answers");
  s = removeEntry(s, id);
  assert.equal(s.entries.length, 0);
});

test("tier 1 — normalizeStore tolerates junk and drops duplicates", () => {
  const s = normalizeStore({ historyOn: false, entries: [{ text: "a" }, { text: "a" }, { nope: 1 }, "x", { text: "  b  " }] });
  assert.equal(s.historyOn, false);
  assert.deepEqual(s.entries.map((e) => e.text), ["a", "b"]);
});

test("learning — only what the PERSON states, verbatim; questions yield nothing", () => {
  assert.deepEqual(statedStatements("what is my name?"), []);
  assert.deepEqual(statedStatements("who is the president?"), []);
  const name = learn(emptyStore(), "my name is Michael");
  assert.equal(name.store.entries.length, 1);
  assert.equal(name.store.entries[0].text, "my name is Michael");
  assert.equal(name.store.entries[0].source, "stated");
  const loc = learn(emptyStore(), "I live in Nashville and I prefer cats to dogs.");
  assert.ok(loc.store.entries.some((e) => /live in Nashville/.test(e.text)));
  assert.ok(loc.store.entries.some((e) => /prefer cats/.test(e.text)));
  const rem = learn(emptyStore(), "remember that I'm allergic to peanuts");
  assert.ok(rem.store.entries.some((e) => /allergic to peanuts/.test(e.text)));
});

test("FALSIFIER — learning a place never invents a name (the copula form is gated)", () => {
  const learned = learn(emptyStore(), "I'm from Paris and I'm tired");
  const texts = learned.store.entries.map((e) => e.text);
  assert.ok(!texts.some((t) => /my name is/i.test(t)), JSON.stringify(texts));   // never "my name is From"
  assert.ok(texts.some((t) => /I'm from Paris/.test(t)), JSON.stringify(texts)); // the place is still read
});

test("learning never duplicates an entry already held", () => {
  const s = learn(emptyStore(), "my name is Michael").store;
  const again = learn(s, "my name is Michael");
  assert.equal(again.store.entries.length, 1);
  assert.equal(again.learned.length, 0);
});

test("tier 2 — the history switch is a store field, off only when explicitly off", () => {
  assert.equal(setHistory(emptyStore(), false).historyOn, false);
  assert.equal(normalizeStore({ historyOn: undefined }).historyOn, true);
  assert.equal(normalizeStore({ historyOn: 0 }).historyOn, true);   // only `false` turns it off
});

test("tier 3 — isContextFree reads the per-chat flag", () => {
  assert.equal(isContextFree({ contextFree: true }), true);
  assert.equal(isContextFree({}), false);
  assert.equal(isContextFree(null), false);
});

test("tier 4 — a project's memories are read first, general memories after, never ranked", () => {
  let s = addEntry(emptyStore(), { text: "general one" });
  s = addEntry(s, { text: "proj one", project: "P" });
  s = addEntry(s, { text: "proj two", project: "P" });
  const { project, general } = entriesFor(s, "P");
  assert.deepEqual(project.map((e) => e.text), ["proj two", "proj one"]);
  assert.deepEqual(general.map((e) => e.text), ["general one"]);
  const groups = groupByProject(s, { P: { name: "Surgery" } });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, "Surgery");
  assert.deepEqual(aboutEntries(s).map((e) => e.text), ["general one"]);
});

test("contextFor — the person's memories ride the context; the guard still stands", () => {
  let s = addEntry(emptyStore(), { text: "I prefer terse answers" });
  s = addEntry(s, { text: "the client is Acme", project: "P" });
  const withProject = contextFor(s, { readerName: "Michael", project: "P" });
  assert.match(withProject, /is Michael/);
  assert.match(withProject, /Remembered for this project: the client is Acme/);
  assert.match(withProject, /Remembered about the person: I prefer terse answers/);
  assert.match(withProject, /Never state, guess, or attribute/);   // NO_INVENT still carried
});

test("contextFor — a context-free chat reads NO memory, but is still told it has no name", () => {
  const s = addEntry(emptyStore(), { text: "I live in Nashville" });
  const ctx = contextFor(s, { readerName: "Michael", facts: { name: "Michael" }, contextFree: true });
  assert.doesNotMatch(ctx, /Nashville/);
  assert.doesNotMatch(ctx, /is Michael/);
  assert.match(ctx, /do not know the person's name/i);
  assert.match(ctx, /Never state, guess, or attribute/);
});

test("contextFor — history off is stated to the model as a fact, not an instruction", () => {
  const s = setHistory(emptyStore(), false);
  assert.match(contextFor(s, {}), /History is off in this browser/);
  assert.doesNotMatch(contextFor(emptyStore(), {}), /History is off/);
});

test("locale rides the store, is correctable, and reaches the context only when not context-free", () => {
  const withLocale = setLocale(emptyStore(), { tz: "America/Chicago", location: { city: "Nashville", country: "US", source: "ip" } });
  const kept = normalizeStore(JSON.parse(JSON.stringify(withLocale)));
  assert.equal(kept.locale.tz, "America/Chicago");
  assert.equal(kept.locale.location.city, "Nashville");
  assert.equal(kept.locale.ipLookup, true);
  assert.match(contextFor(withLocale, { localeLine: "Their local time is noon." }), /local time is noon/);
  assert.doesNotMatch(contextFor(withLocale, { contextFree: true, localeLine: "Their local time is noon." }), /local time is noon/);
  // the IP switch is a store field, off only when explicitly off
  assert.equal(normalizeStore({ locale: { ipLookup: false } }).locale.ipLookup, false);
});

test("FALSIFIER — the store has no score, no count-of-use, no acceptance: only what the person filed", () => {
  const s = addEntry(emptyStore(), { text: "I drive a truck" });
  const e = s.entries[0];
  assert.deepEqual(Object.keys(e).sort(), ["at", "id", "project", "source", "text"]);
  assert.equal(e.source, "manual");         // provenance is who filed it, not how often it was accepted
});

test("immutability — every operation returns a new store", () => {
  const a = emptyStore();
  const b = addEntry(a, { text: "x" });
  assert.equal(a.entries.length, 0);
  assert.equal(b.entries.length, 1);
  const c = clearEntries(b);
  assert.equal(c.entries.length, 0);
  assert.equal(b.entries.length, 1);
  const d = setEntryProject(b, b.entries[0].id, "P");
  assert.equal(b.entries[0].project, null);
  assert.equal(d.entries[0].project, "P");
});
