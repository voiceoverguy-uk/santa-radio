---
name: Local audio inspection
description: Avoid confusing automated transcription with listening; work around local decoder API incompatibility.
---

Local faster-whisper installations can fail at file decoding when their PyAV
version rejects the `metadata_errors` argument. Decode with the existing FFmpeg
to 16 kHz mono float32 and pass a NumPy array to the transcription model instead.

**Why:** A newer PyAV API rejected a keyword used by faster-whisper even though
both packages installed successfully. Supplying decoded PCM avoided changing
the application's audio dependencies.

**How to apply:** For offline inspection only, keep downloaded speech models
and generated audio in ignored generated-artifacts storage. Label all model
transcripts as automated evidence, not listening verification or authoritative
pronunciation checks. Do not send the owner's recordings to an external speech
service just to resolve a local decoder mismatch.

Do not assume an isolated MP3 filter branch rendered with FFmpeg's output
`-t` yields exactly that many decoded PCM frames.

**Why:** MP3 timestamp/encoder offsets can shorten that isolated output even
when the complete speech-led mix retains its exact duration. Resetting filter
timestamps alone did not resolve the discrepancy.

**How to apply:** For branch gain comparisons, decode extra material and compare
the required PCM frame window. Assert the full production mix's duration
separately; never pad or trim production speech to satisfy an isolated test.

Equal decoded samples do not guarantee equivalent time-based filtering. Verify
the complete raw-source and prepared-source mixes, not just their input PCM.

**Why:** Reversed audio can retain different starting timestamps after raw MP3
processing versus prepared WAV input; a time-based fade can then silence one
path even though both paths contain the same samples.

**How to apply:** Keep end-to-end waveform equivalence checks when changing
timing or envelopes. Treat timestamps as part of the processing contract, and
do not relax waveform checks merely because source PCM equivalence passes.

Shared prepared audio must be published atomically when build and validation
can run in parallel.

**Why:** A mobile render test read an invalid, partly rewritten WAV while the
website build regenerated that same shared clip. The audio recipe was correct;
isolated tests passed, but concurrent validation did not.

**How to apply:** Prepare to unique temporary paths and rename complete clips
into place. Audio tests must arrange their own prepared inputs rather than
depending on a previously running Preview or build.
