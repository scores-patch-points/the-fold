// tools/wildchat-pick.mjs — which two asks one WildChat run puts into one chat. Pure; the runner (wildchat-run.mjs) and its test import it.
//
// A follow-up is only a follow-up of the ask it actually followed. The battery records that: `followups[].prev` is the id of the ask the
// follow-up came after in its own conversation (and that follow-up's id is the next one). The first version of the runner picked the first
// ask and the "follow-up" by two independent strides, so the follow-up ("Add another chapter to the story.") followed an unrelated ask and
// `prev` was never read: every follow-up row it wrote tested nothing about follow-up binding (nesting audit F, 2026-10-14).
//
//   pickPair(i, battery) -> { first, follow }   the i-th follow-up (stride 11, as before) and the ask that PRECEDED it
const FOLLOW_STRIDE = 11;

export function pickPair(i, battery) {
  const asks = Array.isArray(battery?.asks) ? battery.asks : [];
  const follows = Array.isArray(battery?.followups) ? battery.followups : [];
  if (!follows.length) throw new Error("the battery has no followups");
  const f = follows[(i * FOLLOW_STRIDE) % follows.length];
  const prev = asks.find((a) => a && a.id === f.prev);
  if (!prev) throw new Error(`follow-up ${f.id} names prev ${f.prev}, which is not in the battery's asks`);
  return {
    first: { id: prev.id, text: prev.text, cls: prev.cls, lang: "en" },
    follow: { id: f.id, prev: f.prev, text: f.text, cls: "follow-up", lang: "en" },
  };
}
