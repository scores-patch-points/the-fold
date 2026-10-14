// fold-chat-wald.js — WALD'S WITNESSES (the chat's adapter onto khora's wald.js). Pure: no DOM, no IO, no model, no clock.
//
// Wald (vendor/khora/native/organs/wald.js) decides what a prompt must PULL. He reads no question himself: each witness here is an organ the
// surface ALREADY ran this turn, turned into one vote per pull ("for" / "against" / "abstain"). Nothing is recomputed and nothing is added to
// the turn's own decision: in SHADOW mode the surface's gate (`wantWeb`, fold-chat.js) decides as before and Wald's decision rides on the record
// beside it, so the two can be scored against each other (eval/wald/PREREG.md).
//
//   witnessVotes(signals) → [{ witness, pull, vote, why }]
//     signals: { kind, follow, outType, producing, lookup, recall, srcRecall, primaryAsk, activeGap, hasMaterial, urlAsk, bookask, live, lang, closedClass, want, wantSub }
//     each is exactly the value fold-chat.js computed (null when the surface did not compute it — then that witness abstains)
//   waldShadow({ signals, calibration, prices, gateNow }) → { decision, votes, gateNow, agrees, line }
//
// One witness per organ, so a disagreement is a disagreement between organs (the parliament keeps the minority report); the organ's own
// reason rides as `why`. The `live` witness is liveAsk's result passed IN (it reads the year; the clock belongs to the surface).
import { waldDecide, waldLine, PULLS, VOTE } from "./vendor/khora/native/organs/wald.js";

const FOR = VOTE.FOR, AGAINST = VOTE.AGAINST;
const v = (witness, pull, vote, why) => ({ witness, pull, vote, why });

// classifyTurn's kinds that the surface runs no search for (fold-chat-kinds.js skipsSearch), and what each pulls instead
const KIND_PULLS = Object.freeze({
  smalltalk: [[PULLS.WEB, AGAINST], [PULLS.NONE, FOR]],
  self: [[PULLS.WEB, AGAINST], [PULLS.NONE, FOR]],
  compute: [[PULLS.WEB, AGAINST], [PULLS.NONE, FOR]],
  transform: [[PULLS.WEB, AGAINST], [PULLS.LOCAL, FOR], [PULLS.THREAD, FOR]],
  code: [[PULLS.WEB, AGAINST]],
  compose: [[PULLS.WEB, AGAINST]],
  research: [[PULLS.WEB, FOR]],
  advice: [[PULLS.WEB, FOR]],
});

/** Every witness's votes for this turn. A signal the surface did not compute is an abstention (no vote), never a guess. */
export function witnessVotes(sig = {}) {
  const out = [];
  // kind — classifyTurn (fold-chat-discourse.js)
  for (const [pull, vote] of KIND_PULLS[sig.kind] || []) out.push(v("kind", pull, vote, `kind ${sig.kind}`));
  // plan — planTurn's mode (fold-chat-flow.js)
  const mode = sig.follow?.mode;
  if (mode === "web") out.push(v("plan", PULLS.WEB, FOR, `planned standalone (${sig.follow.kind || "ask"})`));
  else if (mode === "thread") { out.push(v("plan", PULLS.THREAD, FOR, "a move on the last turn")); out.push(v("plan", PULLS.WEB, AGAINST, "a move on the last turn")); }
  else if (mode === "cold-gap" || mode === "clarify") { out.push(v("plan", PULLS.NONE, FOR, mode)); out.push(v("plan", PULLS.WEB, AGAINST, mode)); }
  // output — describeOutput (fold-chat-outputtype.js): what is asked to be produced, and whether it grounds in sources
  if (sig.producing && sig.outType) {
    if (sig.outType.needsSources) out.push(v("output", PULLS.WEB, FOR, `a ${sig.outType.type} that grounds in sources`));
    else out.push(v("output", PULLS.WEB, AGAINST, `a ${sig.outType.type} that needs no sources`));
    if (sig.outType.material === "thread-answer") out.push(v("output", PULLS.THREAD, FOR, "its material is the last answer"));
  }
  // gap — a typed gap already holds (no topic, no material, unsupported type): nothing is pulled
  if (sig.activeGap) { out.push(v("gap", PULLS.NONE, FOR, "a typed gap holds")); out.push(v("gap", PULLS.WEB, AGAINST, "a typed gap holds")); }
  // lookup — lookupWarranted (fold-chat-self.js): does the ask name anything to look up
  if (sig.lookup && sig.lookup.measured !== false) {
    if (sig.lookup.warranted) out.push(v("lookup", PULLS.WEB, FOR, sig.lookup.why));
    else { out.push(v("lookup", PULLS.WEB, AGAINST, sig.lookup.why)); out.push(v("lookup", PULLS.NONE, FOR, sig.lookup.why)); }
  }
  // recall — recallOf (fold-chat-recall.js): the fold's own words, read back from the record
  if (sig.recall) { out.push(v("recall", PULLS.LOCAL, FOR, `the record holds it at ${sig.recall.address ?? "an address"}`)); out.push(v("recall", PULLS.WEB, AGAINST, "the record holds it")); }
  // source — the read-backs (sourceRecall, the watcher's batonReply / inspectReply / challengeReply) and the primary-source finder
  if (sig.srcRecall) {
    const path = sig.srcRecall.inspect ? "inspect" : sig.srcRecall.challenge ? "challenge" : sig.srcRecall.fromBaton ? "baton" : "sourceRecall";
    out.push(v("source", PULLS.LOCAL, FOR, `read back from the record (${path})`)); out.push(v("source", PULLS.WEB, AGAINST, `read back, not searched (${path})`));
  }
  if (sig.primaryAsk) out.push(v("source", PULLS.WEB, FOR, "a primary source must be found for the last claim"));
  // …and when no read-back fired, the watcher's PRE still read the ask as ABOUT THE LAST TURN (where its answer came from, what it did, is it sure):
  // the cold-gap shape of PREREG Amendment 2 — the record is what is asked about, whatever it holds. A source/new ask is not this.
  else if (!sig.srcRecall && (sig.want === "inspect" || sig.want === "challenge" || (sig.want === "source" && sig.wantSub === "recall"))) {
    out.push(v("source", PULLS.LOCAL, FOR, "the ask is about the last turn's own record")); out.push(v("source", PULLS.WEB, AGAINST, "the ask is about the last turn's own record"));
  }
  // material — an attachment or pasted document is in hand
  if (sig.hasMaterial) out.push(v("material", PULLS.LOCAL, FOR, "material is attached"));
  // url — a URL ask is the page itself
  if (sig.urlAsk) out.push(v("url", PULLS.WEB, FOR, "the ask is a URL"));
  // shelf — a book the fold holds whole
  if (sig.bookask) out.push(v("shelf", PULLS.LOCAL, FOR, "a book on the shelf"));
  // live — liveAsk (fold-chat-gaps.js): weather, a price, today's news can only come from a live source
  if (sig.live) out.push(v("live", PULLS.WEB, FOR, `a live ask (${sig.live.what})`));
  // lang — detectLang (fold-chat-lang.js) and the language's closed class (functionWordsOf): an ask in a named language that no
  // closed-class reader reads is one observation of its own (PREREG Amendment 1). Its weight is measured on the gold, never declared.
  if (sig.lang && sig.lang !== "unknown" && sig.closedClass === false) out.push(v("lang", PULLS.WEB, FOR, `an ask in ${sig.lang} that no closed-class reader reads`));
  return out;
}

/** The shadow decision: Wald's verdict beside the gate the surface actually ran. Changes nothing. */
export function waldShadow({ signals = {}, calibration = {}, prices = {}, gateNow = null } = {}) {
  const votes = witnessVotes(signals);
  const decision = waldDecide({ votes, calibration, prices });
  const waldWeb = decision.recommend.includes(PULLS.WEB);
  const web = decision.pulls[PULLS.WEB];
  const agrees = typeof gateNow === "boolean" && web.verdict !== "uncalibrated" ? waldWeb === gateNow : null;
  return { mode: "shadow", decision, votes, gateNow, waldWeb, agrees, line: waldLine(decision) };
}

export default { witnessVotes, waldShadow };
