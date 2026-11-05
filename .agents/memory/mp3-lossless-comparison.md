---
name: MP3 lossless comparison
description: Decoder identity matters when verifying packaged speech against hosted MP3.
---

Verify a lossless speech conversion against the same MP3 decoder the renderer
uses, and record the decoder in provenance. Do not silently compare a FLAC
created from fixed-point `mp3` with FFmpeg's default `mp3float` output.

**Why:** The decoders have different sample precision. Even requesting 32-bit
FLAC does not make a quantised conversion identical to an arbitrary floating
decode. A different-decoder mismatch is not proof of a different recording.

**How to apply:** Select the existing render decoder explicitly for source
comparison and conversion, compare every sample at native rate/channel count,
and distinguish decode equivalence from restoring the original lossy encoding.
