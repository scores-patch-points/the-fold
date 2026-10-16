# tools/ — WildChat runners: which results are valid

## INVALID: every follow-up row written by `wildchat-run.mjs` before the pairing fix (nesting audit F, 2026-10-14)

`wildchat-run.mjs` chose the first ask `asks[(i*17) % n]` and the "follow-up" `followups[(i*11) % m]` by two independent
strides, and never read `followups[].prev`. The follow-up it sent was therefore a follow-up of some OTHER conversation's
ask (a "Add another chapter to the story." after an unrelated question). **Every result row with `cls: "follow-up"`
(`mode: "chat+"` / `"agent+"`) in `wildchat-results.jsonl`, and any number derived from them, tested nothing about
follow-up binding. Treat them as invalid.** Nothing here was deleted or rewritten: the files stand as recorded.

What this covers (not tracked by git at the time of writing; all gitignored): `wildchat-results.jsonl` (rows with
`cls: "follow-up"`). First-turn rows (`mode: "chat"` / `"agent"`) are single cold asks and are unaffected, except that they
were drawn from `asks`, which also contains the 330 follow-up texts asked cold (see below).

Also affected, by the same cause, in a different way: `wildchat-supervised.mjs` draws `asks[(i*19) % n]` and `asks` includes
the follow-up texts (`isFollowUp: true`), asked cold with no earlier turn. A failure it files under the "follow-up"
mechanism in `wildchat-lessons.jsonl` / `wildchat-proposals.jsonl` is a follow-up text with nothing to follow, not a
follow-up binding failure. Those files are likewise left as they are.

Valid from the fix on: `wildchat-run.mjs` draws the pair with `wildchat-pick.mjs` (`pickPair`): the follow-up is the battery
turn whose `prev` is the first ask and which came right after it in its conversation, and rows carry `id` / `prev`.
`wildchat-pick.test.mjs` pins it against the real battery. A row without `id`/`prev` was written by the old runner.
