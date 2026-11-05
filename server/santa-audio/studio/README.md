# Studio fixed speech

These private lossless FLACs are the extended recipe's fixed recordings, not
the short free maker's shared clips. They are shipped with the function;
no request-time ZIP extraction, Python or demonstration output is required.
FLAC conversion changes neither sample rate nor channel count and removes
metadata only. MP3 intro decoding is captured losslessly in FLAC.

## Verified source refresh — 5 November 2026 (UTC)

Fresh HTTPS GETs from the established personalised-message root verified all
eight speech sources and the screenshot's exact `sleigh-bells.mp3` filename.
All nine have different decoded content from their previous packaged
counterparts. No comparison is blocked and no unchanged speech was rewritten.
The screenshot identifies filenames only; the downloaded bytes establish changes.

Private [`sources.json`](sources.json) records the actual comparison timestamp,
exact source URLs, original-byte SHA-256 hashes, previous/current packaged hashes,
native audio properties, decoded frame counts and full decoded PCM hashes.
This is server-only provenance, not a public catalogue.

All sources are 44,100 Hz. Speech is stereo (the seven WAVs are 16-bit PCM);
the new bells are mono. Conversion uses no trimming, resampling, channel
conversion, padding or gain. Every converted speech file matches every native
decoded signed 32-bit PCM sample of its hosted source. For the intro MP3,
this explicitly uses the renderer's existing fixed-point `mp3` decoder, not
FFmpeg's default `mp3float` decoder. FLAC is lossless relative to that decode;
it does not restore information lost in the original MP3 encoding.

Studio now uses its own byte-identical `studio/sleigh-bells.mp3` copy, with
2.204240 seconds of decoded audio, looped by the existing mixer. The separate
free maker's `sleighbells.mp3` and other sources are untouched. Mixing,
processing and the recipe are unchanged. No continuous synchronisation or
request-time fixed-source fetch has been added.

Sequence: intro, name, 1st, age, **[1-5, one sports/funny recording]**, 2nd, activity, achievement, 3rd, treat,
4th, destination, 5th, **same name**, 6th.
The bracketed pair is omitted only for explicit Talent skip. Hosted connector
names never follow visible step numbering. Talent adds no letter prose.

The refreshed `1-5.flac` matches the current hosted Talent connector
sample-for-sample. The previous revision's automated transcription is not
evidence of this revision's wording. No listening verification has been performed.
The on-screen Talent preview also includes “In particular...” followed by the
current recording's display label. That display-only wording does not change
this packaged connector, the hosted recording or the stitching sequence. See
`docs/workshop-https-inventory.md` for the exact helper, upload instructions and
live-index status. Never claim display copy changes recorded speech.

Each recording is decoded to 48 kHz stereo float PCM, measured, then receives
constant gain towards −18 LUFS capped at −3 dBTP. Whole PCM clips concatenate
without trimming, padding, voice fades, crossfades or overlap. Bells match the
free maker's −34 LUFS / −9 dBTP / LRA 7 target, with the established Studio-only
+2 dB gain, loop with a 1s fade-in and
full-mix 1s fade-out. The 0.89 limiter compensates lookahead latency.

Operational limits: two concurrent renders per process; separate shared Studio
request-rate buckets (not free allowances or lifetime paid regeneration caps);
1 KiB JSON; 20 MiB per category download, 10s per download, forced audio
demuxers, 30s variable / 60s fixed decode limits, 175s total speech, 110s request
deadline, 20s per FFmpeg process, 4.4 MB response. Oversize material is rejected,
never silently truncated. The MP3 budget stays below Vercel's buffered response
limit. All temporary files are private per request and removed in `finally`.

The assets require an updated release before live generation changes. No live
deployment or customer purchase was made. Previously generated MP3s cannot
change and must be recreated. Automated decoding/render checks are not listening
approval; see `docs/studio-source-refresh.md` for verification and release status.
