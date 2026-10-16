# Frozen test sets

Each row is a set frozen with `node eval/sets/freeze.mjs freeze <draft.json>`: the md5 is of the exact bytes of
`frozen/<lang>.json`, and `node eval/sets/freeze.mjs verify` fails if any file no longer matches. A frozen set is
never edited; a change after a failed run is a dated amendment in a new file and the failed run stays on the record.

| lang | frozen | md5 | counts | labeled by |
|---|---|---|---|---|
