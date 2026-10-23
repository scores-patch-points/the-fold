# Judge battery

`eval/judge/cases.json` is a table of claim-and-source cases for `falsifyAnswer(sentences, passages)` in `fold-chat-falsify-answer.js`. Each row says what verdict the judge should give. It is a regression table, not a benchmark: it records what the project has decided so far, and it is small.

## Row schema

`id`, `family`, `claims` (the sentences passed in), `sources` (`{ref,title,text}` passages), `expect`, `kind`, `control_of`, `origin`, `source_file`, `note`.

- `expect` is a shape `{verdict}`, `{in:[...]}` or `{not_in:[...]}`, or an array of shapes, one per claim (only the listed indexes are graded).
- Verdicts: corroborated, held, weak, contested, unsupported.
- `kind: pass` must hold; a failure fails CI. `kind: todo` is a known break: it may fail (reported as known-break); if it starts passing it is reported as unexpectedly-fixed.
- `control_of` names the row whose fix this row guards (a right answer that must stay right).

## Running

    node scripts/judge-battery.mjs [--judge PATH] [--cases PATH] [--json] [--strict-todo] [--family X]
    node --test fold-chat-judge-battery.test.mjs

Exit 1 if a pass row fails; exit 2 if the judge cannot be loaded, an argument is missing or unknown, no row matches `--family`, or the table is invalid (unknown verdict or key, duplicate id). `--strict-todo` also exits 1 on unexpectedly-fixed rows, so a fix has to flip its row to pass. The runner reads only, makes no network call and uses no model.

## Adding a row when you fix a falsify bug

Add the row in the same PR, plus its control (a nearby claim that must keep its verdict), and set `control_of`. If the bug is not yet fixed, add the row as `kind: todo` with a note. When a fix lands, flip the todo row to `pass`.

## Other repos and vendor scripts

Run the table against a pinned copy: `node scripts/judge-battery.mjs --judge vendor/fold-chat-falsify-answer.js`. The judge is imported from its own directory, so its sibling imports resolve there. The output prints the judge path and the first 12 characters of its sha256.

## Where the rows came from

Counts per `source_file`: fold-chat-falsify-*.test.mjs files in this repo (bounds 3, browser 1, copula 6, direction 3, heads 6, lists 4, nounverb 1, pairing 4, photo 5, refine 8, short 4, slot 8, subject 2, swap 6, tag 3, verbatim 5); `~/.khora/opencode-battery.mjs` 22; `~/.khora/opencode-profile.test.mjs` 3; an audit brief of measured holes 9. Rows from the khora files and the brief are transcriptions run through this judge, and some Spanish source texts for the brief are a rendering of its description.

## not_tabled

`not_tabled` lists tests that were read and left out, each with a reason. They assert something other than a falsifyAnswer verdict (string helpers, record checks, symbol resolution, holodeck internals). It is a record of scope, not a promise that those areas are covered.

## Measured on 2026-10-22 (negative controls)

A gate is worth having only if it fails a worse judge. The table run against copies consumers pin or earlier fixes:

| judge | pass | known-break | fail |
|---|---|---|---|
| the-fold main `9132efe` (`26e3e3f` judge file) | 95 | 8 | 0 |
| khora `vendor/the-fold` working tree | 95 | 8 | 0 |
| khora `vendor/the-fold` at `170e0ae` (origin/main pin) | 92 | 8 | 3 |
| khora `vendor/the-fold` at `0055d480` (committed branch pin) | 69 | 4 | 26 |
| holodeck `vendor/fold-chat` (pin `63e9309`) | 60 | 3 | 35 |

Fix walk: the parent of each judge fix commit (#18, #19, #22-#29 and `11d2848`) fails 4 to 26 rows, so every fix is covered by at least one row. Rows a worse judge passes by accident show as "unexpectedly-fixed" and are not a defect.
