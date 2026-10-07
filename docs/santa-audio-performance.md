# Santa message rendering investigation

## Status

Local optimisation and verification are complete. On 7 October 2026 the owner
confirmed: “It is working on the live site.”

This is owner-confirmed live functionality, not an independently measured
Vercel load test. The existing Vercel connection returned HTTP 403 for project
and team access, preventing inspection of deployment settings, runtime logs
and cold/warm live timings. The exact cause of the historical live 90-second
incident therefore remains unverified.

The agent did not deploy to production. The remaining Vercel investigation
and busy-period checks are recorded separately from the delivered optimisation.

## Findings

- The original renderer repeated silence handling, reversal and dynamic
  loudness normalisation for the same intro and minute-long outro on every
  request. Its buffer-heavy filters reached approximately 651 MB peak resident
  memory in an isolated local run.
- The previous API timed out a Node wrapper around synchronous FFmpeg.
  A deliberately shortened timeout reproduced the orphan: FFmpeg was still
  running after the wrapper died. Those workers can compete with subsequent
  requests. This is a proven lifecycle defect, not proof of the specific live
  90-second incident.
- A single local request completed in about 4.5–5 seconds, rather than 90
  seconds. CPU contention and memory pressure on Vercel remain possible
  contributors that require its actual runtime evidence.

## Changes

- Build-time preparation applies the **same** editorial voice filter to only
  the shared intro and outro. The intermediate format is lossless 48 kHz stereo
  float PCM, avoiding clipping or an extra lossy encode.
- Original supplied WAVs remain untouched. Names are still processed when
  requested; bells, mixing, fades, limiting and the final 192 kbit/s 44.1 kHz
  stereo MP3 encode remain on demand.
- The supplied outro's opening silence and all existing pauses are preserved.
  There is no catalogue or database of completed greetings.
- The API runs FFmpeg directly with a hard kill on its existing 90-second
  deadline. Neither that deadline nor Vercel's configured 120-second function
  limit was increased.
- Success diagnostics contain only render duration, total duration and output
  byte count. Failure diagnostics contain bounded operational codes/signals
  and elapsed time. Never log request bodies, selected names, filenames,
  child/contact data or FFmpeg stderr.

## Local measurements

Tests ran with the packaged `ffmpeg-static` binary. CPU-constrained runs used
Linux affinity to one CPU core, including two competing renders on that core.

| Measurement | Full voice processing | Prepared shared clips |
| --- | ---: | ---: |
| Single render, one CPU core | 4.96 s | 2.97 s |
| FFmpeg peak resident memory | 651 MB | 145 MB |
| Two simultaneous renders, one core | 9.12–9.16 s | 6.26–6.32 s |

The real HTTP handler additionally passed both streamed local requests and
Vercel-style parsed requests. On one core, two simultaneous requests completed
in 6.25–6.38 seconds; a third received 429 rather than being queued. A proxied
preview request returned a completely decodable MP3 in 2.76 seconds.

These measurements have substantial headroom against the configured
120-second request budget, **locally**. They do not model Vercel's CPU quota,
instance sharing or account configuration.

An additional `prlimit --as` experiment at 512/1024 MiB failed for both render
paths. This caps **virtual address space**, not resident memory, so it is not
an accurate simulation of Vercel's memory allocation and is not used as hosting
verification.

## Reproduce

```sh
npm run test:santa-audio
taskset -c 0 node --test scripts/santa-message-api.test.mjs
node scripts/profile-santa-render.mjs unprepared single 0
node scripts/profile-santa-render.mjs prepared single 0
node scripts/profile-santa-render.mjs prepared parallel 0
npm run build
```

The profiler samples process memory without logging recording paths or names.
Preparation runs on every development start and production build, so updated
shared recordings cannot retain stale prepared clips.

Regression checks verify:

- Real MP3 output and complete decoding for both request-body formats.
- Identical sample count/duration and mixer waveform difference below −100 dB
  relative to the original, allowing only floating-point rounding.
- Unchanged MP3 sample rate, stereo channels, bitrate and peak protection.
- Direct worker termination at a deadline.
- End-to-end request completion within 15 seconds in this local test runtime.

Encoded MP3 hashes can differ because tiny float-rounding differences change
lossy encoder quantisation decisions. The quality test compares the mixer PCM
before encoding, alongside complete MP3 decoding and output-format checks.

## Remaining Vercel investigation and busy-period checks

Once connection permissions are repaired:

1. Inspect the project's actual function memory, request duration and runtime
   logs around the failed render. Correlate timeout and memory/CPU evidence
   without exporting personal data.
2. With owner approval, deploy the updated build to a Vercel preview (not a
   silent production release). Confirm generated shared clips and the
   packaged Linux binary are included in the function.
3. Run real cold, warm and two-simultaneous MP3 requests. Record safe numeric
   timings and validate all outputs decode fully and fit the actual request
   budget.
4. Establish the live timeout cause or explicitly record what the available
   runtime evidence can and cannot prove. Owner-confirmed functionality must
   not be presented as evidence of capacity under heavy traffic.
