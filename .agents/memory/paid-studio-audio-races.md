---
name: Paid Studio audio races
description: Prevent stale media play promises from restoring sample identity after end or load failure.
---

When paid Studio audio ends or errors, invalidate the pending play request. A delayed `play()` completion can otherwise set playback back to active and disclose the selected recipient after the media has ended.

**Why:** A browser test that ended a recording while its play promise was still settling exposed a stale state update after the end event.

**How to apply:** Keep the request-generation guard in both end and media-error handlers; retain the check that the audio is neither paused nor ended before accepting a successful play completion.
