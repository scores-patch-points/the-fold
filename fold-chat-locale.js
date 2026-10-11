// fold-chat-locale.js — the person's LOCAL TIME and coarse LOCATION, for context. Pure (no clock, no IO).
//
// "so if i ask about the president there is context" (user, 2026-10-11): an ask like "who is the
// president?" names no country, and a fold with no sense of where the person is cannot read it. The
// locale is CONTEXT, never an answer — it disambiguates the ask; the answer is still grounded in
// sources. So the turn is told, plainly: the person's local time, and the country/city it can infer.
//
// TWO SOURCES, and each is marked:
//   timezone  the browser's own IANA zone and locale — free, local, no network, always available
//   ip        a coarse lookup of the public IP — a NETWORK call, so it is graded and disclosed by the
//             caller and the result is kept as EDITABLE memory (Constitution: inferred, never asserted)
//
// Everything is normalization and composition: no verdict about the person is invented here, and a
// missing signal stays missing (a typed gap), never guessed.

/** The local date-time in a zone, e.g. "Tuesday, 10 October 2026, 14:32". Falls back to UTC. */
export function localTime(now, tz = "UTC", locale = "en-GB") {
  const d = now ? new Date(now) : new Date();
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: tz || "UTC" }).format(d);
  } catch { return null; }
}

/** The offset (minutes east of UTC) of a zone at `now`, or null. */
export function utcOffsetMinutes(now, tz = "UTC") {
  const d = now ? new Date(now) : new Date();
  if (Number.isNaN(d.getTime())) return null;
  try {
    const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz || "UTC", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const p = Object.fromEntries(dtf.formatToParts(d).map((x) => [x.type, x.value]));
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return Math.round((asUTC - Math.floor(d.getTime() / 1000) * 1000) / 60000);
  } catch { return null; }
}

/** Split an IANA zone into its coarse parts: "America/Argentina/Buenos_Aires" -> { area, city }. */
export function parseTz(tz) {
  const s = String(tz ?? "").trim();
  if (!s || s === "UTC") return { area: s === "UTC" ? "UTC" : null, city: null };
  const parts = s.split("/").filter(Boolean);
  if (parts.length < 2) return { area: null, city: parts[0] || null };
  return { area: parts[0], city: parts[parts.length - 1].replace(/_/g, " ") };
}

/** The region subtag of a locale ("en-US" -> "US", "fr-CA" -> "CA"), or null. */
export function regionFromLocale(locale) {
  const m = String(locale ?? "").match(/[-_]([A-Za-z]{2})\b/);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Normalize what a coarse IP geolocation service returned, across the shapes seen in the wild:
 *   ipapi.co  { city, region, country_name, country_code, timezone }
 *   ipwho.is  { city, region, country, country_code, timezone: { id } }
 *   ipinfo.io { city, region, country, timezone, loc: "lat,lng" }
 * Returns { city, region, country, timezone, source: "ip" } — every field optional, never invented.
 */
export function normalizeIp(raw) {
  if (!raw || typeof raw !== "object") return null;
  const r = raw.data && typeof raw.data === "object" ? raw.data : raw;   // some services wrap in {data}
  const tz = typeof r.timezone === "string" ? r.timezone : (r.timezone && typeof r.timezone.id === "string" ? r.timezone.id : null);
  const country = r.country_name || r.country || r.countryName || null;
  const out = {
    city: typeof r.city === "string" ? r.city : null,
    region: typeof r.region === "string" ? r.region : (typeof r.region_name === "string" ? r.region_name : null),
    country: typeof country === "string" ? country : null,
    countryCode: typeof r.country_code === "string" ? r.country_code.toUpperCase() : null,
    timezone: tz,
    source: "ip",
  };
  return (out.city || out.region || out.country) ? out : null;
}

/** A short human location from an IP result: "Nashville, Tennessee, US". */
export function locationLabel(loc) {
  if (!loc) return null;
  if (typeof loc === "string") return loc.trim() || null;
  return [loc.city, loc.region, loc.country].filter(Boolean).join(", ") || (typeof loc.label === "string" ? loc.label : null);
}

/**
 * The locale line for the turn's context, composed from what is KNOWN. Returns null when nothing is
 * known. `locale` and `tz` come from the browser; `location` is the (editable) IP-or-manual result.
 */
export function localeContext({ location = null, tz = null, locale = null, now = null } = {}) {
  if (!location && !tz && !locale) return null;   // nothing is known: a typed gap, not a guessed time
  const parts = [];
  const place = locationLabel(location) || (typeof location === "string" ? location : null);
  if (place) parts.push(`The person appears to be in ${place}${location?.source === "ip" ? " (inferred from their IP, and correctable)" : ""}.`);
  else {
    const city = parseTz(tz).city;
    if (city) parts.push(`The person's timezone is ${tz} (around ${city}) — a rough locality, not a verdict.`);
  }
  const region = location?.countryCode || regionFromLocale(locale);
  if (region && !place) parts.push(`Their locale suggests country ${region}.`);
  const lt = localTime(now, tz || location?.timezone || "UTC");
  if (lt) parts.push(`Their local time is ${lt}${tz ? ` (${tz})` : ""}.`);
  return parts.length ? parts.join(" ") : null;
}

/**
 * THE CONSENT GATE for the IP lookup (user, 2026-10-11). ONE affordance owns consent: the checkbox
 * (`ipLookup === false` = never). The one-shot action may re-run a detection (`force`), but `force`
 * NEVER bypasses consent — the old button could, which made two affordances disagree about who
 * decides. Returns { ok, why }: "consent-off" · "already-have-place" · "first-detect" · "re-detect".
 */
export function mayLookupIp({ locale = null, force = false } = {}) {
  if (locale?.ipLookup === false) return { ok: false, why: "consent-off" };
  if (locale?.location && !force) return { ok: false, why: "already-have-place" };
  return { ok: true, why: locale?.location ? "re-detect" : "first-detect" };
}
