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
