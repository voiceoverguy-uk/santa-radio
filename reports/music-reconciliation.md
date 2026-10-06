# Music catalogue reconciliation

## Result

- 455 existing catalogue entries preserved, with no songs added or removed.
- 454 entries verified against the 454 records in the supplied SQL export.
- All 454 verified entries have source artist information and lyrics.
- All 433 original catalogue URLs remain resolvable.
- No unused database records remain in the current catalogue.
- One older unmatched entry remains unchanged: `/christmas-artist/422-r-kelly-world-christmas`.

The workspace already contained the full database catalogue before this task was
assigned. This work preserves that earlier inclusion rather than reverting it
to the original 433 entries or importing additional songs.

## Evidence and safeguards

`music-import.json` retains the original migration evidence, including corrected
display names, numeric placeholders and the historical Michael Buble route
whose old ID 134 maps to source record 328. `music-reconciliation.json` accounts
for every current record, matched source ID, ambiguous/unmatched records and
database-only entries.

Current imports verify artist/title or route evidence; an ID alone cannot assign
a biography or lyrics. IDs, slugs, aliases and artwork are preserved. Corrupted
Windows-1252/UTF-8 punctuation is repaired only when lossless decoding succeeds.
Lyrics retain source line breaks. Source website URLs stay separate from route
slugs. The SQL file is parsed as text and is never executed.

## Remaining review

- Confirm the identity and correct song for “R Kelly World – Christmas” before
  attaching any artist information or lyrics.
- The supplied Andy Williams video currently reports unavailable on YouTube.
  Lyrics and artist information remain usable; no replacement video was guessed.

## Reproduction

Dry run:

    node scripts/import-music-catalogue.js attached_assets/cl57-thesongs_1791303552293.sql

Apply verified source content and regenerate the current reconciliation report:

    node scripts/import-music-catalogue.js attached_assets/cl57-thesongs_1791303552293.sql --write

Validation:

    npx playwright test tests/music-catalogue.spec.js
    npm run build
