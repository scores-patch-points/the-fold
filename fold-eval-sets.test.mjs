// fold-eval-sets.test.mjs — the exit criteria's test-set scaffolding: shape check, the split nobody picks, the freeze ledger.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkSet, splitOf, frozenBytes, skeleton, md5Of, SHAPE, HOLDOUT, RELABEL } from "./eval/sets/lib.mjs";
import { freeze, verify } from "./eval/sets/freeze.mjs";

// a filled set built from the skeleton, with every field a real item needs
const filled = (lang, { en = null } = {}) => {
  const sk = skeleton(lang, { enIds: (en?.items || []).filter((i) => i.part === "factual").map((i) => i.id) });
  for (const it of sk.items) {
    it.ask = `question ${it.id}?`; it.gold.source = { title: `Page ${it.id}`, quote: `quoted span of ${it.id}` };
    if (it.part === "trap") it.gold.flag = it.id.endsWith("1") ? "multiple" : "false-premise"; else it.gold.answers = [`answer ${it.id}`];
    if (it.part === "entity") it.gold.keep = [`name ${it.id}`];
  }
  sk.labeledBy = "tester";
  return sk;
};
const EN = filled("en");

test("a skeleton has the spec's shape but is not a finished set: every blank field is named", () => {
  const sk = skeleton("en");
  assert.equal(sk.items.length, 60);
  for (const [p, n] of Object.entries(SHAPE)) assert.equal(sk.items.filter((i) => i.part === p).length, n);
  const bad = checkSet(sk);
  assert.ok(bad.some((b) => /no question/.test(b)) && bad.some((b) => /no gold source/.test(b)) && bad.some((b) => /no gold answer/.test(b)), bad.slice(0, 3).join(" | "));
});

test("a filled English set passes; a missing part, a repeated id and a trap with no flag are each refused", () => {
  assert.deepEqual(checkSet(EN), []);
  const short = { ...EN, items: EN.items.filter((i) => !(i.part === "entity" && i.id.endsWith("10"))) };
  assert.ok(checkSet(short).some((b) => /entity: 9 items/.test(b)));
  const dup = { ...EN, items: EN.items.map((i, k) => (k === 1 ? { ...i, id: EN.items[0].id } : i)) };
  assert.ok(checkSet(dup).some((b) => /used twice/.test(b)));
  const noFlag = { ...EN, items: EN.items.map((i) => (i.part === "trap" && i.id.endsWith("05") ? { ...i, gold: { ...i.gold, flag: "" } } : i)) };
  assert.ok(checkSet(noFlag).some((b) => /needs gold\.flag/.test(b)));
});

test("a non-English set needs 20 parallels that really are English items, and is checked against the English set", () => {
  const es = filled("es", { en: EN });
  assert.deepEqual(checkSet(es, { en: EN }), []);
  assert.ok(checkSet(es).some((b) => /checked against the English set/.test(b)));
  const fewer = { ...es, items: es.items.map((i) => (i.parallelOf && i.id.endsWith("20") ? { ...i, parallelOf: undefined } : i)) };
  assert.ok(checkSet(fewer, { en: EN }).some((b) => /parallel items: 19/.test(b)));
  const stray = { ...es, items: es.items.map((i) => (i.parallelOf && i.id.endsWith("01") ? { ...i, parallelOf: "en-factual-99" } : i)) };
  assert.ok(checkSet(stray, { en: EN }).some((b) => /not an English item/.test(b)));
});

test("the split is by hash within each part: holdout is ceil(30%) and relabel ceil(20%) per stratum, and order does not matter", () => {
  const a = splitOf(EN.items), b = splitOf([...EN.items].reverse());
  assert.deepEqual([...a.holdout].sort(), [...b.holdout].sort());
  assert.deepEqual([...a.relabel].sort(), [...b.relabel].sort());
  for (const [part, n] of Object.entries(SHAPE)) {
    const ids = EN.items.filter((i) => i.part === part).map((i) => i.id);
    assert.equal(ids.filter((id) => a.holdout.has(id)).length, Math.ceil(n * HOLDOUT), part);
    assert.equal(ids.filter((id) => a.relabel.has(id)).length, Math.ceil(n * RELABEL), part);
  }
});

test("FALSIFIER: the split cannot be steered by an item's content — only its id places it", () => {
  const changed = { ...EN, items: EN.items.map((i) => ({ ...i, ask: "a different question entirely" })) };
  assert.deepEqual([...splitOf(changed.items).holdout].sort(), [...splitOf(EN.items).holdout].sort());
});

test("freeze writes the set and a ledger row; verify passes; a changed byte, a missing file and an unledgered file each fail", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "fold-sets-"));
  try {
    const draft = path.join(base, "en-draft.json");
    fs.writeFileSync(draft, JSON.stringify(EN));
    const r = freeze(draft, { base });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.md5, md5Of(fs.readFileSync(r.out)));
    assert.match(fs.readFileSync(path.join(base, "FROZEN.md"), "utf8"), new RegExp(`\\| en \\|[^|]+\\| ${r.md5} \\|`));
    assert.deepEqual(verify({ base }), []);
    const again = freeze(draft, { base });
    assert.equal(again.ok, false);
    assert.match(again.bad[0], /already frozen/);
    fs.appendFileSync(r.out, " ");
    assert.ok(verify({ base }).some((b) => /no longer match/.test(b)));
    fs.rmSync(r.out);
    assert.ok(verify({ base }).some((b) => /missing/.test(b)));
    fs.writeFileSync(path.join(base, "frozen", "xx.json"), "{}");
    assert.ok(verify({ base }).some((b) => /not in the ledger/.test(b)));
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test("freeze refuses an unfinished set and writes nothing", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "fold-sets-"));
  try {
    const draft = path.join(base, "d.json");
    fs.writeFileSync(draft, JSON.stringify(skeleton("en")));
    const r = freeze(draft, { base });
    assert.equal(r.ok, false);
    assert.ok(r.bad.length > 10);
    assert.equal(fs.existsSync(path.join(base, "frozen")), false);
    assert.equal(fs.existsSync(path.join(base, "FROZEN.md")), false);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test("frozenBytes marks each item's side and is byte-stable across calls", () => {
  const one = frozenBytes(EN), two = frozenBytes(EN);
  assert.equal(one, two);
  const items = JSON.parse(one).items;
  assert.equal(items.filter((i) => i.side === "holdout").length, [...splitOf(EN.items).holdout].length);
  assert.ok(items.every((i) => i.side === "holdout" || i.side === "dev"));
});
