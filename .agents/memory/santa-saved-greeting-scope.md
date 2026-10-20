---
name: Saved greeting pilot scope
description: Approval boundary for reuse of one manually supplied complete greeting.
---

The manually supplied Arabella saved-greeting pilot is a limited exception to
on-demand rendering, not permission to pre-create or permanently cache the
whole name catalogue.

**Why:** The owner authorised only the Arabella pilot and explicitly excluded
automatic uploads, bulk generation and new paid services.

**How to apply:** Keep other names on normal generation. Broader caching or
automatic population needs a separate decision. Treat browser CORS access as
distinct from successful direct-URL playback.

Remote source replacements need coordinated version invalidation when a saved
result is approved by content revision rather than freshly reading its source.

**Why:** No client can discover an unannounced remote source replacement solely
from an unchanged filename while also avoiding a source read.

**How to apply:** Disable or reapprove a saved result when its remote ingredient
changes; do not describe a static approval manifest as live change detection.
