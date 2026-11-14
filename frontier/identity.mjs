// frontier/identity.mjs — ORGAN 5, Identity. Sameness is revisable and bylined: `same` events ({a, b}) and `cannot_link` events ({a, b}).
// A pair with both is CONTESTED and its class stays PLURAL (never merged by vote). Appearance (string likeness) may nominate a `same`
// but never decides one (Constitution II.7) — nothing here computes likeness.
//   identityAt(log, upToSeq?) → { classOf(name) → { members, plural, contested } }
export function identityAt(log, upToSeq = Infinity) {
  const parent = new Map();
  const find = (x) => { if (!parent.has(x)) parent.set(x, x); while (parent.get(x) !== x) x = parent.get(x); return x; };
  const key = (a, b) => [a, b].sort().join("\u0000");
  const cannot = new Set(), sames = [];
  for (const e of log.all()) {
    if (e.seq > upToSeq) break;
    if (e.kind === "cannot_link") cannot.add(key(e.body.a, e.body.b));
    if (e.kind === "same") sames.push(e);
    if (e.kind === "unsame") sames.splice(sames.findIndex((s) => key(s.body.a, s.body.b) === key(e.body.a, e.body.b)) >>> 0, 1);
  }
  const contested = [];
  for (const s of sames) {
    if (cannot.has(key(s.body.a, s.body.b))) { contested.push({ a: s.body.a, b: s.body.b, same: s.id }); continue; }
    parent.set(find(s.body.a), find(s.body.b));
  }
  return {
    classOf(name) {
      const r = find(name);
      const members = [...parent.keys()].filter((k) => find(k) === r);
      if (!members.includes(name)) members.push(name);
      const c = contested.filter((p) => members.includes(p.a) || members.includes(p.b));
      return { members, plural: c.length > 0, contested: c };
    },
    contested,
  };
}
