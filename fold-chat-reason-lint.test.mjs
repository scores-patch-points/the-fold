// fold-chat-reason-lint.test.mjs — the Kelsen linter, wired modelless and FALSIFIED:
// a planted cycle must be flagged; a clean chain must not; the door refuses non-claims;
// and prose with no recoverable relation is a TYPED GAP, never a fabricated claim.
import test from "node:test";
import assert from "node:assert/strict";
import { deriveClaims, lintTurn } from "./fold-chat-reason-lint.js";
import { claimFromTriple } from "./vendor/khora/native/kernel/gfp-claim.js";
import { lintGfp } from "./vendor/khora/native/organs/reasoning-lint.js";

const lintIt = (claims) => lintGfp(claims, { acyclic: ["beats", "controls", "implies"], symmetric: ["equals"], functional: ["is", "has"], strictness: "strict" });
const P = (text, ref = "s") => ({ ref, source: ref, url: `https://x/${ref}`, text });

test("FALSIFIER: a planted cycle in an acyclic relation IS flagged (begging the question does not pass)", () => {
  // FALSIFIED AND CORRECTED: cycles are per-SCOPE (Kelsen — "a holon sees its own claims and its ancestors',
  // never a sibling's"): a cycle across three DIFFERENT grounds is differently scoped, not a cycle. The
  // honest condition is a cycle WITHIN one ground — that is the begging-the-question case.
  const r = lintIt([
    claimFromTriple("Alice", "beats", "Bob", { ground: "a#1-2" }),
    claimFromTriple("Bob", "beats", "Carol", { ground: "a#1-2" }),
    claimFromTriple("Carol", "beats", "Alice", { ground: "a#1-2" }),
  ]);
  assert.ok((r.findings || []).some((f) => f.kind === "circular"),
    "a same-scope cycle must be a circular finding: " + JSON.stringify((r.findings || []).map((f) => f.note || f.detail || f.kind)));
});

test("FALSIFIER: the SAME chain across different grounds is differently scoped, not a cycle — the linter does not convict it", () => {
  const r = lintIt([
    claimFromTriple("Alice", "beats", "Bob", { ground: "a#1-2" }),
    claimFromTriple("Bob", "beats", "Carol", { ground: "a#3-4" }),
    claimFromTriple("Carol", "beats", "Alice", { ground: "a#5-6" }),
  ]);
  assert.equal((r.findings || []).filter((f) => f.kind === "circular").length, 0,
    "cross-scope relations are not a cycle (differently scoped)");
});

test("a CLEAN acyclic chain yields no ERROR findings", () => {
  const r = lintIt([
    claimFromTriple("Alice", "beats", "Bob", { ground: "a#1-2" }),
    claimFromTriple("Bob", "beats", "Carol", { ground: "a#3-4" }),
    claimFromTriple("Carol", "beats", "Dave", { ground: "a#5-6" }),
  ]);
  assert.equal((r.findings || []).filter((f) => f.severity === "error").length, 0, "no error findings on a clean acyclic chain");
});

test("the DOOR refuses a non-claim with a WARN, never a crash", () => {
  const r = lintIt([{ schema: "NotAGfpClaim", rel: "beats", roles: { ARG0: "A", ARG1: "B" } }]);
  assert.ok((r.findings || []).some((f) => /not_a_claim/.test(String(f.kind || ""))), "the door names the refused input");
});

test("prose with no recoverable relation is a TYPED GAP — no fabricated claim", () => {
  const lit = lintTurn({ passages: [P("The evening settled over the valley, and the lamps came on one by one.")] });
  assert.equal(lit.claims.length, 0);
  assert.ok(lit.lines.some((l) => /nothing to lint|no claim/.test(l.text)), "the murmur names the gap");
  assert.equal(lit.findings.length, 0, "no findings invented");
});

test("deriveClaims recovers 'A beats B' from a grounded passage, and only when both sides are names", () => {
  const claims = deriveClaims([P("In the game, Alice beats Bob every time. Charlie leads Arsenal.", "game")]);
  assert.ok(claims.some((c) => c.rel === "beats" && c.roles.ARG0 === "Alice" && c.roles.ARG1 === "Bob"));
  assert.ok(claims.some((c) => c.rel === "leads" && c.roles.ARG0 === "Charlie" && c.roles.ARG1 === "Arsenal"));
});