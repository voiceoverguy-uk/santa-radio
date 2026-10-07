# Live lyrics catalogue audit — 7 October 2026

## Scope

Checked all 455 catalogue records against the live lyrics matcher, including normalized artist/title collisions, exact duplicate records, missing/placeholder lyrics, unusually short entries, suspicious slug-like titles and existing feed aliases. Also compared the currently available live/upcoming feed entries.

The lyrics live inside the song catalogue, not in separately named lyric files. Renaming a file would not solve the underlying artist/title matching issues.

## Safe fixes

- The Carpenters — Merry Christmas Darling (records 99, 233): identical titles, artists and lyrics. The matcher now selects the lower-ID record rather than rejecting the pair.
- Bing Crosby — I Wish You A Merry Christmas (records 204, 345): same issue and resolution.
- Gladys Knight & The Pips — It's Christmas Everyday (212): contains an old “we are working on it” notice rather than lyrics. Live lyrics now reports these as unavailable.
- All catalogue entries and historical URLs remain intact.

## Needs editorial confirmation

| Entry | Finding | Next action |
| --- | --- | --- |
| Frank Sinatra — Hark The Herald Angels Sing (186, 379) | Same artist and title, but different lyric texts | Compare with the actual broadcast recording before choosing the correct text |
| Gladys Knight & The Pips — It's Christmas Everyday (212) | Placeholder, not lyrics | Supply verified lyrics |
| R Kelly World — Christmas (422) | No lyrics; artist/title split also merits checking | Confirm metadata and supply verified lyrics |
| On Ember ft Blend — on-ember (482) | Slug-like title | Confirm the actual release title; do not infer it from the lyric refrain |
| Mike Oldfield — Il Dulci Jubilo (135) | Instrumental notice, not sung lyrics; title spelling merits review | Verify the title and retain clear instrumental handling |

## Result

After the safe fixes: 451 records resolve to available text, two Sinatra records remain ambiguous, and two records have missing or placeholder lyrics. The available-text count includes the instrumental notice; it is not a certification of lyric accuracy.

The existing verified feed aliases and credit-marker handling remain in place. Different artists, version labels, credited guests and conflicting lyric texts are not automatically merged.

## Limits and repeatable check

Run `node scripts/audit-live-lyrics.mjs` to repeat the read-only audit.

No complete broadcast playlist export was found in the inspected project material. The current/next feed is only a snapshot; it cannot prove every on-air title will match. The next comparison needs an export containing the station's exact artist and title fields, preferably with recording/version identifiers. Human review against the recordings is needed to certify the lyric transcriptions.
