// wald.test.mjs — Wald, the watcher of the pull (vendor/khora/native/organs/wald.js) and his witnesses (fold-chat-wald.js).
// Each test pins one rule of the organ's header; each would fail if that rule were removed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { thresholdsOf, measureRatios, waldDecide, waldLine, PULLS, VOTE, VERDICT, COST_ORDER } from "./vendor/khora/native/organs/wald.js";
import { witnessVotes, waldShadow } from "./fold-chat-wald.js";

test("the bars are Wald's §3.3 formulas, derived from alpha and beta", () => {
  const t = thresholdsOf({ alpha: 0.05, beta: 0.1 });
  assert.equal(t.ok, true);
  assert.ok(Math.abs(t.A - 0.9 / 0.05) < 1e-12);
  assert.ok(Math.abs(t.B - 0.1 / 0.95) < 1e-12);
  assert.ok(t.logB < 0 && 0 < t.logA);
});

test("rates that cannot separate are refused, never patched", () => {
  for (const bad of [{ alpha: 0, beta: 0.1 }, { alpha: 0.5, beta: 0.5 }, { alpha: 0.1 }, {}]) assert.equal(thresholdsOf(bad).ok, false);
});

test("POSSIBLE is structural: no vote for a pull means it is never pulled, whatever the calibration", () => {
  const cal = { web: { lr: { kind: { for: 100, against: 100, abstain: 100 } }, alpha: 0.1, beta: 0.1 } };
  const d = waldDecide({ votes: [{ witness: "kind", pull: "web", vote: "against" }], calibration: cal });
  assert.equal(d.pulls.web.possible, false);
  assert.equal(d.pulls.web.verdict, VERDICT.IMPOSSIBLE);
  assert.ok(!d.recommend.includes("web"));
});

test("a possible pull with no measured ratios is a typed gap, not a decision", () => {
  const d = waldDecide({ votes: [{ witness: "url", pull: "web", vote: "for" }] });
  assert.equal(d.pulls.web.verdict, VERDICT.UNCALIBRATED);
  assert.ok(d.gaps.some((g) => g.pull === "web"));
  assert.ok(!d.recommend.includes("web"));
});

const rows = [
  ...Array.from({ length: 20 }, () => ({ votes: [{ witness: "a", pull: "web", vote: "for" }], label: { web: true } })),
  ...Array.from({ length: 20 }, () => ({ votes: [{ witness: "a", pull: "web", vote: "against" }], label: { web: false } })),
];

test("ratios are measured with Laplace's rule: a vote never seen under a label is improbable there, never impossible", () => {
  const m = measureRatios(rows, "web");
  assert.equal(m.needed, 20); assert.equal(m.notNeeded, 20);
  assert.ok(m.lr.a.for > 1 && m.lr.a.against < 1);
  assert.ok(Number.isFinite(m.lr.a.for) && m.lr.a.for > 0);
  assert.ok(Math.abs(m.lr.a.for - (21 / 23) / (1 / 23)) < 1e-9);
});

test("probable past log A, refused past log B, continue between with the §3.8 sign rule", () => {
  const m = measureRatios(rows, "web");
  const cal = { web: { lr: m.lr, alpha: 0.05, beta: 0.05 } };   // log A = log 19 ≈ 2.94; one 'for' vote = log 21 ≈ 3.04
  const yes = waldDecide({ votes: [{ witness: "a", pull: "web", vote: "for" }], calibration: cal });
  assert.equal(yes.pulls.web.verdict, VERDICT.PROBABLE);
  assert.deepEqual(yes.recommend, ["web"]);
  const strict = { web: { lr: m.lr, alpha: 0.01, beta: 0.01 } }; // log A = log 99 ≈ 4.6: one vote is not enough
  const mid = waldDecide({ votes: [{ witness: "a", pull: "web", vote: "for" }, { witness: "t", pull: "thread", vote: "for" }], calibration: strict });
  assert.equal(mid.pulls.web.verdict, VERDICT.CONTINUE);
  assert.equal(mid.pulls.web.truncated, "pull");
  assert.equal(mid.probe.web, "thread", "the cheapest further pull is the cheaper possible one");
});

test("the record carries the minority report: every possible pull not taken says why", () => {
  const d = waldDecide({ votes: [{ witness: "x", pull: "web", vote: "for" }, { witness: "y", pull: "web", vote: "against" }] });
  assert.deepEqual(d.disagreements, [{ pull: "web", for: ["x"], against: ["y"] }]);
  assert.ok(d.skipped.some((s) => s.pull === "web" && /gap/.test(s.why)));
  assert.match(waldLine(d), /possible web/);
});

test("prices are recorded as handed and never invented", () => {
  const d = waldDecide({ votes: [{ witness: "x", pull: "web", vote: "for" }], prices: { web: 1800 } });
  assert.equal(d.pulls.web.price, 1800);
  assert.equal(d.pulls.thread.price, null);
});

test("the register is cheapest first and closed", () => {
  assert.deepEqual(COST_ORDER, ["none", "thread", "local", "structured", "web"]);
  const d = waldDecide({ votes: [{ witness: "x", pull: "telepathy", vote: "for" }] });
  assert.deepEqual(d.possible, []);
});

// ── the witnesses ─────────────────────────────────────────────────────────

test("each witness is one organ, voting from what the surface already computed", () => {
  const votes = witnessVotes({ kind: "research", follow: { mode: "web", kind: "standalone" }, lookup: { warranted: true, why: "names x", measured: true } });
  assert.deepEqual(votes.filter((x) => x.pull === "web").map((x) => [x.witness, x.vote]), [["kind", "for"], ["plan", "for"], ["lookup", "for"]]);
});

test("a creative piece that needs no sources is a witness AGAINST the web", () => {
  const votes = witnessVotes({ kind: "generate", follow: { mode: "web" }, producing: true, outType: { type: "poem", needsSources: false } });
  assert.ok(votes.some((x) => x.witness === "output" && x.pull === "web" && x.vote === VOTE.AGAINST));
});

test("a signal the surface did not compute is an abstention, never a guess", () => {
  assert.deepEqual(witnessVotes({}), []);
  assert.deepEqual(witnessVotes({ lookup: { warranted: true, measured: false } }), [], "an unmeasured lookup (no closed class) does not vote");
});

test("shadow mode compares, changes nothing, and says when it cannot compare", () => {
  const s = waldShadow({ signals: { kind: "research", follow: { mode: "web" } }, gateNow: true });
  assert.equal(s.mode, "shadow");
  assert.equal(s.agrees, null, "uncalibrated: no agreement claimed");
  assert.equal(s.gateNow, true);
});

test("an ask no witness reads is a typed gap, never a silent 'take nothing' (chorus: Alexander)", () => {
  const d = waldDecide({ votes: [] });
  assert.deepEqual(d.recommend, []);
  assert.ok(d.gaps.some((g) => g.pull === null && /no witness read/.test(g.why)));
});

test("the calibration the surface ships is measured, separable, and decides (chorus: Simon/Chekhov)", async () => {
  const { WALD_CALIBRATION: c } = await import("./fold-chat-wald-calibration.js");
  assert.equal(c.schema, "WaldCalibration@1");
  assert.ok(c.gold.needed > 0 && c.gold.notNeeded > 0, "both labels present in the gold it was measured on");
  const t = thresholdsOf(c.web);
  assert.equal(t.ok, true, "alpha/beta from the gate's own rates separate");
  assert.ok(t.logB < 0 && t.logA > 0);
  for (const w of ["kind", "output"]) assert.ok(c.web.lr[w], `witness ${w} measured`);
  const s = waldShadow({ signals: { kind: "generate", follow: { mode: "web" }, producing: true, outType: { type: "poem", needsSources: false } }, calibration: c, gateNow: false });
  assert.equal(s.decision.pulls.web.verdict, VERDICT.REFUSED, "a creative piece that needs no sources is refused the web under the shipped calibration");
  assert.equal(s.agrees, true);
});

test("an ask in a language no closed-class reader reads is a vote of its own, not silence (PREREG Amendment 1)", () => {
  // the Japanese asks of the first run: lookup unmeasured, kind chat, the plan's vote near 1 — the lang witness must still speak
  const sig = { kind: "chat", follow: { mode: "web" }, lookup: { warranted: true, measured: false }, lang: "ja", closedClass: false };
  assert.deepEqual(witnessVotes(sig).filter((x) => x.witness === "lang").map((x) => [x.pull, x.vote]), [["web", "for"]]);
  assert.deepEqual(witnessVotes({ ...sig, closedClass: true }).filter((x) => x.witness === "lang"), [], "a language with a closed class is read by lookup, not this witness");
  assert.deepEqual(witnessVotes({ ...sig, lang: "unknown" }).filter((x) => x.witness === "lang"), [], "an unknown language names nothing");
  assert.deepEqual(witnessVotes({ ...sig, closedClass: undefined }).filter((x) => x.witness === "lang"), [], "not computed is an abstention");
});

// ── PREREG Amendment 2: the read-back paths ───────────────────────────────

test("an ask ABOUT THE LAST TURN votes the record, even when no read-back fired (the cold-gap shape, Amendment 2)", () => {
  const sig = { kind: "research", follow: { mode: "cold-gap", kind: "source-ask" }, want: "source", wantSub: "recall" };
  const src = (s) => witnessVotes(s).filter((x) => x.witness === "source").map((x) => [x.pull, x.vote]);
  assert.deepEqual(src(sig), [["local", "for"], ["web", "against"]]);
  assert.deepEqual(src({ ...sig, want: "inspect", wantSub: null }), [["local", "for"], ["web", "against"]]);
  assert.deepEqual(src({ ...sig, want: "challenge", wantSub: null }), [["local", "for"], ["web", "against"]]);
  assert.deepEqual(src({ ...sig, wantSub: "new" }), [], "a source/new ask with no primary finder is not about the record");
  assert.deepEqual(src({ ...sig, want: "answer", wantSub: null }), [], "an ordinary ask casts no source vote");
  assert.deepEqual(src({ ...sig, want: undefined, wantSub: undefined }), [], "not computed is an abstention");
});

test("one read-back is one vote per pull: a fired read-back is not counted twice, and its why names the path", () => {
  const base = { want: "source", wantSub: "recall" };
  for (const [srcRecall, path] of [[{ turn: 1 }, "sourceRecall"], [{ fromBaton: true }, "baton"], [{ fromBaton: true, inspect: true }, "inspect"], [{ fromBaton: true, challenge: true }, "challenge"]]) {
    const vs = witnessVotes({ ...base, srcRecall }).filter((x) => x.witness === "source");
    assert.deepEqual(vs.map((x) => [x.pull, x.vote]), [["local", "for"], ["web", "against"]]);
    assert.ok(vs.every((x) => x.why.includes(path)), `why names ${path}`);
  }
  assert.deepEqual(witnessVotes({ ...base, primaryAsk: { claim: "x" } }).filter((x) => x.witness === "source").map((x) => [x.pull, x.vote]), [["web", "for"]], "the primary finder votes web, and the record vote stands aside");
});

test("THE CLARIFICATION 1 TURN, on its real stored prior: the organs read it, and the shipped calibration refuses the web", async () => {
  const { signalsOf } = await import("./eval/wald/calibrate.mjs");
  const { WALD_CALIBRATION } = await import("./fold-chat-wald-calibration.js");
  const fs = await import("node:fs");
  const live = JSON.parse(fs.readFileSync(new URL("./eval/wald/multiturn-live-2026-10-14.json", import.meta.url), "utf8"));
  const prior = live.sessions.find((x) => x.id === "mv7o6ovcju1q").messages.slice(0, 2);   // the refused Great Wall turn, as stored
  const sig = signalsOf("where did you get that?", prior);
  assert.equal(sig.follow.mode, "cold-gap", "the path that fired live: the planner's cold gap, no read-back helper");
  assert.equal(sig.srcRecall, null);
  const s = waldShadow({ signals: sig, calibration: WALD_CALIBRATION, gateNow: false });
  assert.ok(s.votes.some((x) => x.witness === "source" && x.pull === "web" && x.vote === "against"), "a witness now reads it");
  assert.equal(s.decision.pulls.web.verdict, VERDICT.REFUSED);
  assert.equal(s.waldWeb, false);
  assert.equal(s.agrees, true);
});

test("'where did you get that?' after an answer with nothing verified (real g2 prior): read from the record, not searched", async () => {
  const { signalsOf } = await import("./eval/wald/calibrate.mjs");
  const { WALD_CALIBRATION } = await import("./fold-chat-wald-calibration.js");
  const fs = await import("node:fs");
  const t = JSON.parse(fs.readFileSync(new URL("./eval/ants/g2/repro-control-1791355297096.json", import.meta.url), "utf8")).turns[0];
  const prior = [{ role: "user", content: t.ask }, { role: "assistant", content: t.spoken, provenance: t.provenance }];
  const s = waldShadow({ signals: signalsOf("where did you get that?", prior), calibration: WALD_CALIBRATION, gateNow: true });
  assert.equal(s.waldWeb, false, "the gate searches here (no source line, no baton); Wald does not");
});

test("the surface passes the watcher's reading into the shadow (fold-chat.js wiring)", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("./fold-chat.js", import.meta.url), "utf8");
  const hook = src.split("\n").find((l) => l.includes("waldRec = waldShadow("));
  assert.ok(hook, "the shadow hook exists");
  assert.match(hook, /want: watcherPre\?\.want/);
  assert.match(hook, /wantSub: watcherPre\?\.sub/);
});

test("the gold's signals compute the read-backs as the surface does: a verified primary line on the record is read back (sourceRecall)", async () => {
  const { signalsOf } = await import("./eval/wald/calibrate.mjs");
  const fs = await import("node:fs");
  const turns = JSON.parse(fs.readFileSync(new URL("./eval/ants/watch-fixture-before-fix.json", import.meta.url), "utf8")).turns.slice(0, 2);
  const prior = turns.flatMap((t) => [{ role: "user", content: t.ask }, { role: "assistant", content: t.spoken, provenance: t.provenance }]);
  const sig = signalsOf("where did you get that?", prior);
  assert.ok(sig.srcRecall && sig.srcRecall.provenance && !sig.srcRecall.fromBaton, "sourceRecall fired on the stored bbc.com line");
  assert.ok(witnessVotes(sig).some((x) => x.witness === "source" && x.why.includes("sourceRecall")));
});
