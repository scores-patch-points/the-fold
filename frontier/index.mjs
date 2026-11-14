// frontier/index.mjs — span retrieval for seams (an instrument: string match, never the model). BM25 over span events' own bytes.
// BM25 (Robertson/Spärck Jones; k1=1.2, b=0.75, the textbook defaults — givers: the literature, not tuned here). Incremental: spans are
// indexed as they land in the log, so the index is a projection of the log, never a second store.
const tok = (s) => String(s).toLowerCase().normalize("NFKC").match(/[\p{L}\p{N}]+/gu) ?? [];
export function makeIndex(log, { kinds = ["span"] } = {}) {
  const post = new Map(), len = new Map();
  let seen = 0, total = 0;
  const sync = () => {
    const all = log.all();
    for (; seen < all.length; seen++) {
      const e = all[seen];
      if (!kinds.includes(e.kind) || typeof e.body.text !== "string") continue;
      const ts = tok(e.body.text); len.set(e.id, ts.length); total += ts.length;
      const tf = new Map(); for (const t of ts) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const [t, n] of tf) { if (!post.has(t)) post.set(t, []); post.get(t).push([e.id, n]); }
    }
  };
  return {
    search(query, k = 8) {
      sync();
      const N = len.size || 1, avg = total / N, score = new Map();
      for (const t of new Set(tok(query))) {
        const p = post.get(t); if (!p) continue;
        const idf = Math.log(1 + (N - p.length + 0.5) / (p.length + 0.5));
        for (const [id, f] of p) score.set(id, (score.get(id) ?? 0) + idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * len.get(id) / avg)));
      }
      return [...score].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1)).slice(0, k).map(([id]) => id);
    },
    size: () => { sync(); return len.size; },
  };
}
