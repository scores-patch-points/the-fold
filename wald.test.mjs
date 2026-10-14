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
