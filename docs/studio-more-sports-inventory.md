# Private More Sports inventory and verification

Read-only check: 5 November 2026. No external files or services were changed.
This repository note is not a public inventory endpoint or release asset.

## Exact membership and current discrepancies

The current hosted index supplies 172 activity records, including 52 non-empty
recordings matching the owner's 56 exact approved paths. The other 120 stay in
Trying hard at. Only explicit approved members enter More Sports; Gaming and
Farting are intentionally included.

Four exact approved filenames are currently absent from the index:

- `Trying Hard at/Paddleboarding.mp3`
- `Trying Hard at/Rugbyu.mp3`
- `Trying Hard at/Untitled 1Judo.mp3`
- `Trying Hard at/archery.mp3`

The host currently lists `Paddle Boarding.mp3` and `Archery.mp3`, plus capitalised
`Fishing.mp3`, `Taekwondo.mp3` and `Trampolining.mp3`. These are not silently
substituted for approved paths or automatically added to More Sports. The exact
approved lowercase fishing/taekwondo/trampolining files also remain available.
The index differs from the planning snapshot; changing membership needs owner
approval, not an inferred alias.

`Rugbyu.mp3` and `Untitled 1Judo.mp3` are preserved in the explicit membership
even though currently absent. They may be misspellings or duplicate takes;
neither their speech nor equivalence to Rugby/Judo has been verified. No
display correction, removal, deduplication or recording rename is proposed
without owner review.

## Real audio check

Run `node scripts/studio-more-sports-hosted-check.mjs` to repeat a read-only
check using current authorised-catalogue choices, the packaged fixed connectors
and Arabella sample. Temporary PCM/downloads are removed; evidence outputs
remain only in ignored `generated-artifacts/more-sports/`, never product storage.

All six complete MP3s rendered and passed strict FFmpeg decoding:

| Talent | Activity | Duration including lead-in | Bytes |
| --- | --- | ---: | ---: |
| Tennis | Swimming | 96.145s | 2,309,058 |
| Tennis | Farting | 96.137s | 2,309,058 |
| Stealing the remote control | Art (original) | 96.664s | 2,321,597 |
| Stealing the remote control | Tennis | 96.943s | 2,328,493 |
| Skipped | Tennis | 85.582s | 2,055,775 |
| Skipped | Art (original) | 85.302s | 2,048,879 |

The renderer decoded each hosted source before stitching. The evidence JSON
contains sample-derived slot start/end times. Source buffers and their pauses
were concatenated whole, without trimming, overlap, new effects or another
connector. The optional talent follows age and its existing introduction;
activity follows `2nd.flac`, followed by achievement. Each is present once.

**No real listening was performed.** Successful decoding and frame-boundary
timing do not prove spoken content, natural joins, subjective sound quality or
speech/preview agreement. An owner listening check remains appropriate.

## Verification scope

Focused browser regressions exercise required selection, clearing and search
reset, no restored old choice, keyboard controls, truthful wording, independent
Review edits and request IDs at 320px and desktop, plus 200% text containment.
Catalogue/server tests cover exact membership, missing/empty records, future
MP3s, unchanged IDs, one activity slot, sports/funny/skipped talent, invalid
cross-category IDs and stable neutral letters.

The unauthenticated Preview screenshot shows the preserved access gate. The
protected builder was exercised separately using isolated test sessions and
synthetic browser fixtures, not by bypassing application authentication.

Website client/SSR compilation and static-page generation passed without
requiring external storage. The catalogue/message/letter Node checks passed
(39 tests); supplementary letter, identity, search and generation checks passed
26 tests, with the PHP-index execution test skipped because PHP CLI is absent.

The talent browser file passed 10 of 11 checks, including all three new
More Sports checks. Its existing desktop footer-coordinate assertion fails by
6px; no Talent button styling was changed here. Broader existing checks are
not green: older journey helpers assume Tab moves directly from name selection
to Continue (there is also a name-preview control); message checks expect READY
or retained playback after access failure/pagehide, contrary to current cleanup;
the top Return to review line-fit assertion also fails. A broad regional/search
run was stopped after an initial timeout rather than repeatedly running all
125 cases. These failures are disclosed, not counted as successful verification.
No unrelated access, retention or layout behaviour was changed to satisfy them.
