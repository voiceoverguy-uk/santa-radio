# Studio fixed speech

These private lossless FLACs are the extended recipe's fixed recordings, not
the short free maker's shared clips. They are shipped with the function;
no request-time ZIP extraction, Python or demonstration output is required.
FLAC conversion changes neither sample rate nor channel count and removes
metadata only. MP3 intro decoding is captured losslessly in FLAC.

The seven current hosted sources were compared against the supplied archive
on 2 November 2026. All match except `2nd.wav`; the hosted revision is used.

| Hosted source | SHA-256 of original bytes |
| --- | --- |
| free-intro.mp3 | 38ed43ef4e99842f48df801c073d50a41826db1b5b59b34829268275bba139dc |
| 1st.wav | f5d090568d8f18fd3270e5f2ac51c1daaf761e2326ce34d55c680b4aa95d9a19 |
| 2nd.wav | 30b65a7dbf1dec1675f3875df20f53bb881b38692fc2797f7c7c4b2ba9360130 |
| 3rd.wav | d9d2061b96c34dd10406bff9f94f72cb37e53f4c151b23dcda4314bb3724ef15 |
| 4th.wav | e15607ef5aaf868af644a59aaf2f83bd6ed22f3e006e6a7127bc2e71c146ac69 |
| 5th.wav | 99817de60295db376a656bc2eb4f6df4555b9cab8bdb201f6233b55497c8c670 |
| 6th.wav | f62557033ebef300539a1b8b6d038918d9a5d2b0b6af9162ca1004ed5e2a7125 |

Sequence: intro, name, 1st, age, 2nd, activity, achievement, 3rd, treat,
4th, destination, 5th, **same name**, 6th.

Each recording is decoded to 48 kHz stereo float PCM, measured, then receives
constant gain towards −18 LUFS capped at −3 dBTP. Whole PCM clips concatenate
without trimming, padding, voice fades, crossfades or overlap. Bells match the
free maker's −34 LUFS / −9 dBTP / LRA 7 level, loop with a 1s fade-in and
full-mix 1s fade-out. The 0.89 limiter compensates lookahead latency.

Operational limits: two concurrent renders per process; separate shared Studio
request-rate buckets (not free allowances or lifetime paid regeneration caps);
1 KiB JSON; 20 MiB per category download, 10s per download, forced audio
demuxers, 30s variable / 60s fixed decode limits, 175s total speech, 110s request
deadline, 20s per FFmpeg process, 4.4 MB response. Oversize material is rejected,
never silently truncated. The MP3 budget stays below Vercel's buffered response
limit. All temporary files are private per request and removed in `finally`.
