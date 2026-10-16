// fold-chat-trail.js — THE TRAIL IN PLAIN LANGUAGE (user, 2026-10-11: "plain language and clearly tracks
// the trail from one turn to the next ... use the mechanical fold").
//
// Built ONLY from mechanically-known facts: the prior turn's record (the fold's own trace — turn number,
// its ask, its record line, its addresses, whether it held), this turn's plan (continues / new ask / cold),
// the sources carried, and the watcher's flags (when any). No model, no jargon: the feed line reads like
// the record line. The trail is the STATE of the fold, spoken plainly — what turn N did, what this one
// inherits and what it will check against.

const Q = (s) => `\u201c${String(s || "").slice(0, 60)}${String(s || "").length > 60 ? "\u2026" : ""}\u201d`;
const GROUND_WORDS = { "every sentence grounded": "every sentence grounded", "nothing unsupported": "nothing unsupported" };

/** The plain-language trail line for THIS turn, given the mechanically-known prior state.
 *  Returns null when there is nothing before this turn (the first turn needs no trail). */
export function trailOf({ now = "", prior = null, follow = {}, carriedCount = 0, flags = [] } = {}) {
  if (!prior) return null;   // the first turn — there is no trail yet
  const mode = String(follow.mode || "web");
  const rec = prior.record || {};
  const held = rec.line || "the record";
  const addresses = Number.isFinite(rec.addresses) ? rec.addresses : (rec.sources?.length ?? 0);
  const priorAsk = prior.ask || "an earlier ask";
  let text = "";
  if (mode === "thread") {
    // the fold is continuing the answered turn, carrying what it read
    const carried = carriedCount > 0 ? ` the ${carriedCount} source(s) that turn read are carried, no new search; the answer will be checked against them` : " no sources are carried, so this one searches";
    text = `Turn ${prior.turn} (${Q(priorAsk)}) was answered from ${addresses} address(es), and ${groundWords(rec)}. This turn (${Q(now)}) continues it:${carried}.`;
  } else if (mode === "cold-gap") {
    text = `This turn follows the conversation, but turn ${prior.turn} (${Q(priorAsk)}) wrote nothing to follow — a cold follow-up, so neither the model nor the sources are asked.`;
  } else {
    const after = prior.turn ? ` Turn ${prior.turn} (${Q(priorAsk)}) is not carried.` : "";
    text = `A new ask: ${Q(now)}.${after} This turn searches and reads fresh sources, answering only from what it reads.`;
  }
  if (flags && flags.length) {
    const plain = flags.map((f) => String(f).replace(/_/g, " ")).join(", ");
    text += ` One thing did not line up as expected: ${plain} — noted, not repaired.`;
  }
  return text;
}

function groundWords(rec) {
  const checks = [];
  if (rec.grounded === true) checks.push("every sentence grounded");
  if (rec.unsupported === 0) checks.push("nothing unsupported");
  return checks.length ? checks.join(" and ") : "held to the record";
}

export default { trailOf, groundWords };