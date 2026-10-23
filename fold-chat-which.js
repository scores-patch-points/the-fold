// fold-chat-which.js — WHICH sense did the person mean? (the layer fold-chat-senses.js lacked)
//
// fold-chat-senses.js says THAT a bare word names several things and lists them. It never chooses: it has no odds, no use of what the
// conversation was already about, and no way to say which question would settle it. This module adds exactly that, and nothing else:
// it hands the senses (their titles and the search snippets already in hand) and what the person has said so far (this ask and the
// thread) to janus's identity organ (vendor/janus/identity/resolve.mjs, a frozen copy) and returns its decision.
//
//   assert   one sense is at least `assertAt` likely given the company the ask and the thread keep: it is named first, with its odds
//   ask      no sense clears that: the senses come back ordered by how well each fits, so the question's options lead with the likelier
//   gap      nothing in the ask or the thread says anything about any sense (a fresh chat, a bare term): the senses are returned in the
//            order the encyclopedia gave them — exactly what the surface did before this module existed
//
// It never edits a sense, never calls a model and never fetches: the evidence is what is already in hand. A wrong silent choice answers
// about the wrong thing, so `assertAt` is the surface's stated willingness to be wrong (DECLARED here, one number, change it here).
// The cap (`max`) bounds what is WEIGHED, not what is shown: every sense the encyclopedia returned is evidence; the caller shows its own few.
// Scope, declared: evidence is split on letters and numbers, so scripts written with spaces are read; a script written without them (Han,
// Kana, Thai) arrives as long runs, gives the organ little to weigh and so comes back as a gap (the senses in the encyclopedia's order).
// `evidence.thinSenses` (fewer than 3 evidence words) is reported for the trace only; it never decides anything.
// Pure.
import { resolveReferent } from "./vendor/janus/identity/resolve.mjs";
import { foldText as fold } from "./fold-chat-foldtext.js";
import { disambiguationOf } from "./fold-chat-senses.js";

export const WHICH_SCHEMA = "EOWhichSense@1";
export const DECLARED_ASSERT_AT = 0.9;

const tokensOf = (s) => fold(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const uniq = (a) => [...new Set(a)];

/**
 * whichSense({ term, results, ask, context, assertAt })
 *   centered false (default) | true: weigh each sense by what it has that the OTHER senses do not (janus's centred states). On the live Mercury
 *            cases it turns an ask into an assertion on the right sense (planet 75% -> 99%, car 72% -> 95%) and keeps a vague thread an ask; in
 *            the measurements behind it (non-human prose, 3 splits) centring asserted 31-39% of mentions at precision 1.000 for about 5-9 points of
 *            top-1. Off by default: nothing changes unless a caller opts in.
 *   term     the bare term (senseTerm(question))
 *   results  the encyclopedia's search results for the term: [{ title, url, snippet }]
 *   ask      the person's ask; context the thread's earlier text (their turns and the answers they were shown)
 * Returns null when the term is not ambiguous (disambiguationOf says so), else
 *   { schema, term, decision: 'assert'|'ask'|'gap', chosen?: { label, url }, p?, options: [{ label, url, p? }], hint?, evidence }
 */
export function whichSense({ term, results, ask = "", context = "", assertAt = DECLARED_ASSERT_AT, max = 12, centered = false } = {}) {
  const d = disambiguationOf(term, results, { max });
  if (!d) return null;
  const termToks = new Set(tokensOf(term));
  const strip = (toks) => uniq(toks.filter((t) => !termToks.has(t)));
  const byTitle = new Map((results || []).map((r) => [fold(r.title), r]));
  const senses = d.senses.map((s) => ({ ...s, snippet: String(byTitle.get(fold(s.label))?.snippet ?? "") }));
  const cands = senses.map((s) => ({ id: s.label, nodes: strip(tokensOf(`${s.label} ${s.snippet}`)) }));
  const mention = strip(tokensOf(`${ask} ${context}`));
  const evidence = { mentionNodes: mention.length, senses: senses.length, thinSenses: cands.filter((c) => c.nodes.length < 3).length };
  const plain = senses.map((s) => ({ label: s.label, url: s.url ?? null }));
  const base = { schema: WHICH_SCHEMA, term: d.term, evidence };
  if (!mention.length) return { ...base, decision: "gap", options: plain, reason: "the ask and the thread say nothing beyond the term itself" };
  const r = resolveReferent({ mention: { nodes: mention }, candidates: cands.filter((c) => c.nodes.length), neighbors: () => [], lens: { name: "which-sense", giver: "fold-chat-which", assertAt }, centered });
  const order = (r.candidates || []).map((c) => ({ label: c.id, url: senses.find((s) => s.label === c.id)?.url ?? null, p: c.p }));
  const rest = plain.filter((s) => !order.some((o) => o.label === s.label));
  const options = [...order, ...rest];
  if (r.decision === "assert") return { ...base, decision: "assert", chosen: { label: r.asserted, url: options.find((o) => o.label === r.asserted)?.url ?? null }, p: order[0]?.p ?? null, options, hint: r.verification?.node ?? null };
  if (r.decision === "ask") return { ...base, decision: "ask", options, hint: r.nextQuestion?.node ?? null };
  return { ...base, decision: "gap", options: plain, reason: r.reason ?? "no sense clears the null" };
}

/** the one app-authored line for the turn's process list, or "" */
export function whichLine(w) {
  if (!w) return "";
  if (w.decision === "assert") return `likely ${w.chosen.label} (${Math.round((w.p ?? 0) * 100)}%)`;
  if (w.decision === "ask") return `closest first: ${w.options.slice(0, 3).map((o) => o.label).join(", ")}`;
  return "";
}

export default { WHICH_SCHEMA, DECLARED_ASSERT_AT, whichSense, whichLine };
