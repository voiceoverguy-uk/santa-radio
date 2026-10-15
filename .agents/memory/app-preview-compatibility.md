---
name: App Preview compatibility
description: Strict App Store Connect encoding requirements and limits of local validation.
---

For App Store Connect previews, validate the complete current Apple specification, not just the accepted dimensions. Use conservative encoding within the published H.264 profile/level and target bitrate, and include a compatible stereo AAC track; for silent recordings, explain any added silent track.

**Why:** The owner reported an unexplained upload failure after an export passed local size, duration, frame-rate and decoding checks. Research found Apple's published maximum was High Profile Level 4.0 and target bitrate 10–12 Mbps, while the failed export used Level 4.2 and a much lower bitrate. Developer reports also identify missing audio tracks as a cause of silent processing failures. The exact cause was not established by an Apple error.

The owner subsequently confirmed that the revised export worked in App Store Connect and asked to remember it for future short videos. Its successful compatibility settings were H.264 High Profile Level 4.0 at approximately 11 Mbps, constant 30 fps, yuv420p, square pixels, BT.709, faststart MP4 and silent stereo AAC-LC at 48 kHz with a 256 kbps encoder target. The portrait preview was 886 × 1920 and exactly 30 seconds. This confirms the combination worked, not which individual change resolved the earlier failure.

**How to apply:** Reuse the confirmed compatibility settings for similar App Store previews, while rechecking https://developer.apple.com/help/app-store-connect/reference/app-preview-specifications for the destination device slot. Treat local decoding and metadata checks as necessary but not proof of acceptance for future files. Keep revised exports separate from the original source.
