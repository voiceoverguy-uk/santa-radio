# Studio source refresh — 5 November 2026

Private repository evidence only; no public recording index or audio export.

## Comparison

The owner's screenshot `Screenshot_2026-11-05_at_00.05.06_1793837134681.png`
shows fixed recordings at the established personalised-message root, including
the exact hyphenated `sleigh-bells.mp3`. All nine exact source URLs responded
HTTP 200 and fully decoded. An initial local-style `sleighbells.mp3` probe
returned HTTP 500; it was not used as a source or a substitute for the
screenshot's confirmed filename.

The actual UTC comparison timestamp, original-byte hashes, old/new packaged
hashes, native properties, decoded sample counts and PCM hashes are recorded in
`server/santa-audio/studio/sources.json`. Direct downloads requested no-cache,
used no-store, and did not follow redirects. This is a point-in-time verification,
not proof that hosting cannot change later.

| Source | Decoded comparison | Action | Native format |
| --- | --- | --- | --- |
| free-intro.mp3 | Changed | Replace intro.flac | 44,100 Hz stereo MP3 |
| 1st.wav | Changed | Replace 1st.flac | 44,100 Hz stereo 16-bit PCM |
| 1-5.wav | Changed | Replace optional Talent FLAC | 44,100 Hz stereo 16-bit PCM |
| 2nd.wav | Changed | Replace 2nd.flac | 44,100 Hz stereo 16-bit PCM |
| 3rd.wav | Changed | Replace 3rd.flac | 44,100 Hz stereo 16-bit PCM |
| 4th.wav | Changed | Replace 4th.flac | 44,100 Hz stereo 16-bit PCM |
| 5th.wav | Changed | Replace 5th.flac | 44,100 Hz stereo 16-bit PCM |
| 6th.wav | Changed | Replace 6th.flac | 44,100 Hz stereo 16-bit PCM |
| sleigh-bells.mp3 | Changed | Add Studio-only byte-identical MP3 | 44,100 Hz mono MP3 |

None of these elements was unchanged or unavailable. The separate free maker's
shared bells and speech files remain byte-for-byte unchanged. No category
folders were mirrored and no private name inventory was refreshed.

Every speech conversion preserves the native sample rate, channel count, frame
count and every decoded signed 32-bit PCM sample before existing render
processing. For MP3 the comparison explicitly uses the existing renderer's
fixed-point `mp3` decoder rather than FFmpeg's default `mp3float`. The intro
FLAC preserves that complete decode, not an unquantised floating-point decode
from a different decoder. No resampling, gain, trimming or padding was applied
during packaging. The bells file is copied without re-encoding.

## Generation and hosted choices

The recipe and processing are unchanged: one-second lead-in, constant speech
gain, established bells loudness and +2 dB gain, pauses, looping, fades and
limiter. No reverb was added. Existing source format conversion to 48 kHz stereo
still occurs only in the renderer.

The unchanged generation handler resolves category recordings from the current
catalogue and downloads the selected sources for each new render with no-store.
Hosted names still use the existing name library download path; local fallback
names are unaffected. No name index request or import was needed for this work.
The catalogue retains its five-minute TTL, coalesced requests and explicit
failure behaviour. Open builders need reloading/retrying to load a new catalogue.

Fresh HTTPS discovery returned 63 ages, 172 activities, 38 achievements,
96 treats, 140 destinations, 50 sports and 26 funny recordings. One real clip
per group downloaded and fully decoded. Two offline renders used those actual
hosted required choices with a synthetic tone in place of a child's name:

- Talent skipped: 83.131146 seconds, 1,996,843 MP3 bytes.
- Sports Talent selected: 94.145917 seconds, 2,261,411 MP3 bytes.

All temporary hosted downloads, synthetic-name fixtures and outputs from these
checks were removed in `finally`. No access, purchase, voucher or customer
allowance endpoint was called.

## Verification and release

Automated checks cover packaged hashes and decoded-sample hashes, native audio
properties, free-maker bells isolation, complete MP3 rendering/decoding with
Talent selected and skipped, expected duration, finite samples and non-clipping
peaks. Existing Studio tests cover exact stitching order, repeated names,
constant gain, lead-in, source validation, cleanup and allowances. Catalogue
tests cover expiry and fresh fetches without stale/sample fallback.

Passed locally on 5 November 2026:

- `npm run test:studio-audio`: 40 tests.
- `node --test scripts/workshop-https-catalogue.test.mjs`: 16 tests.
- `npm run test:function-layout`: 5 tests.
- `npm run check:vercel-packaging`: isolated production-style install, website
  build and packaging/runtime checks passed for all 23 functions. The Studio
  function smoke check explicitly requires all eight FLACs and its dedicated
  bells file; its emitted package was valid at approximately 92 MiB.

The public homepage also rendered after restarting the development workflow,
without application errors in its browser log. Signed-in Studio UI was not
verified; generation was checked directly without bypassing access controls.

**These are automated local checks, not actual listening verification.** The
new Talent wording and shorter looping bells have not been approved by ear.
No release, production deployment or real purchase has been made. Merge and
release the updated assets before expecting live generation to change.
Existing MP3s remain unchanged and require recreation.
