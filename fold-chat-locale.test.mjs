// fold-chat-locale.test.mjs — local time + coarse location as CONTEXT, never a verdict.
import test from "node:test";
import assert from "node:assert/strict";
import { localTime, utcOffsetMinutes, parseTz, regionFromLocale, normalizeIp, locationLabel, localeContext } from "./fold-chat-locale.js";

test("localTime renders the person's own clock, in their zone", () => {
  const s = localTime("2026-10-11T19:32:00Z", "America/Chicago");
  assert.match(s, /14:32/);            // CDT = UTC-5 in October
  assert.match(s, /2026/);
  assert.match(s, /Sunday/);           // 2026-10-11 is a Sunday
});

test("utcOffsetMinutes reads the real offset for the date", () => {
  assert.equal(utcOffsetMinutes("2026-10-11T19:32:00Z", "America/Chicago"), -300);
  assert.equal(utcOffsetMinutes("2026-10-11T19:32:00Z", "UTC"), 0);
});

test("parseTz splits the IANA id coarsely", () => {
  assert.deepEqual(parseTz("America/Argentina/Buenos_Aires"), { area: "America", city: "Buenos Aires" });
  assert.deepEqual(parseTz("Europe/Paris"), { area: "Europe", city: "Paris" });
  assert.deepEqual(parseTz("UTC"), { area: "UTC", city: null });
});

test("regionFromLocale reads the region subtag", () => {
  assert.equal(regionFromLocale("en-US"), "US");
  assert.equal(regionFromLocale("fr-CA"), "CA");
  assert.equal(regionFromLocale("en"), null);
});

test("normalizeIp tolerates the three shapes seen in the wild (and rejects junk)", () => {
  const a = normalizeIp({ city: "Nashville", region: "Tennessee", country_name: "United States", country_code: "us", timezone: "America/Chicago" });
  assert.deepEqual([a.city, a.region, a.country, a.countryCode, a.timezone], ["Nashville", "Tennessee", "United States", "US", "America/Chicago"]);
  const b = normalizeIp({ city: "Paris", country: "France", country_code: "FR", timezone: { id: "Europe/Paris" } });
  assert.equal(b.timezone, "Europe/Paris");
  const c = normalizeIp({ city: "Rome", region: "Lazio", country: "IT", timezone: "Europe/Rome" });
  assert.equal(c.country, "IT");
  assert.equal(normalizeIp({}), null);
  assert.equal(normalizeIp(null), null);
});

test("locationLabel is short and human", () => {
  assert.equal(locationLabel({ city: "Nashville", region: "Tennessee", country: "United States" }), "Nashville, Tennessee, United States");
  assert.equal(locationLabel({ country: "France" }), "France");
  assert.equal(locationLabel(null), null);
});

test("localeContext composes what is KNOWN, and says the IP location is correctable", () => {
  const loc = { city: "Nashville", region: "Tennessee", country: "United States", countryCode: "US", timezone: "America/Chicago", source: "ip" };
  const line = localeContext({ location: loc, tz: "America/Chicago", locale: "en-US", now: "2026-10-11T19:32:00Z" });
  assert.match(line, /appears to be in Nashville, Tennessee, United States/);
  assert.match(line, /inferred from their IP/);
  assert.match(line, /local time is/);
});

test("localeContext with no IP still gives time + a rough zone, and never invents a city", () => {
  const line = localeContext({ tz: "Europe/Paris", locale: "fr-FR", now: "2026-10-11T19:32:00Z" });
  assert.match(line, /Europe\/Paris/);
  assert.match(line, /local time is/);
  assert.doesNotMatch(line, /Nashville/);
  assert.equal(localeContext({}), null);
});

// ── THE CONSENT GATE (folded from the "multiple affordances" review, 2026-10-11) ──
import { mayLookupIp } from "./fold-chat-locale.js";

test("FALSIFIER: force NEVER bypasses consent — the old button's force:true could, and no longer can", () => {
  const r = mayLookupIp({ locale: { ipLookup: false, location: { label: "Chicago" } }, force: true });
  assert.equal(r.ok, false);
  assert.equal(r.why, "consent-not-given");
});

test("consent on + no place → first-detect; consent on + place + force → re-detect", () => {
  assert.deepEqual(mayLookupIp({ locale: { ipLookup: true }, force: false }), { ok: true, why: "first-detect" });
  assert.deepEqual(mayLookupIp({ locale: { ipLookup: true, location: { label: "Chicago" } }, force: true }), { ok: true, why: "re-detect" });
});

test("consent on + place + no force → already-have-place (a passive call never re-hits the IP service)", () => {
  const r = mayLookupIp({ locale: { ipLookup: true, location: { label: "Chicago" } }, force: false });
  assert.equal(r.ok, false);
  assert.equal(r.why, "already-have-place");
});

test("consent is OPT-IN (user, 2026-10-11): an untouched store consents to NOTHING — boot makes no outbound call", () => {
  assert.equal(mayLookupIp({ locale: null }).ok, false);
  assert.equal(mayLookupIp({ locale: null }).why, "consent-not-given");
  assert.equal(mayLookupIp({ locale: {} }).ok, false);
  assert.equal(mayLookupIp({ locale: { location: { label: "Chicago" } } }).ok, false, "a stored place does not imply consent to call out again");
  assert.equal(mayLookupIp({ locale: { ipLookup: true } }).ok, true, "only the explicit tick turns it on");
});
