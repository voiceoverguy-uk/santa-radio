---
name: Saved greeting pilot scope
description: Approval boundary for reuse of one manually supplied complete greeting.
---

The Arabella saved-greeting pilot now permits automatic secure FTPS uploads of
on-demand results, but is not permission to pre-create or cache the whole name
catalogue.

**Why:** The owner extended the Arabella pilot to secure FTPS, while excluding
other names, bulk generation, new paid services and deployment.

**How to apply:** Keep other names on normal generation. Verify FTP login-relative
directory mapping; the account starts inside /santaradio and the destination is
greetings-cache relative to it. Do not guess an absolute FTP path, mode or port.
Never modify the existing manually uploaded file as a test.

Reliable invalidation of unannounced remote source replacements requires reading
the current source revision, even when a saved hit avoids decoding and rendering.

**Why:** No client can discover an unannounced remote source replacement solely
from an unchanged filename while also avoiding a source read.

**How to apply:** Do not restore the earlier browser-only fast path if it bypasses
source revision validation. Do not describe a static manifest as live change
detection.
