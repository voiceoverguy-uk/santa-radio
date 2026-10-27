---
name: YouTube availability verification
description: Distinguish catalogue metadata checks from actual embedded playback and local screenshot artefacts.
---
Do not label all successful YouTube oEmbed responses as working playback, or all failed responses as deleted videos. Preserve a review category for access restrictions.

**Why:** A replacement returned valid metadata and rendered its player title in the proxied development preview, while the local screenshot browser showed “video unavailable” and a distorted player. These environments can disagree.

**How to apply:** Verify embedded players through the real proxied development URL when local screenshots are suspicious. Report metadata availability separately from playback checks; regional, account and embedding restrictions can still apply.

YouTube's `fs=0` documents fullscreen-button visibility, not suppression of all
internal fullscreen capability checks. Never describe it as proof that a Safari
Permissions-Policy warning is resolved based only on Chromium or mocked tests.

**Why:** The owner reproduced a YouTube-origin fullscreen warning on the direct
public homepage with extensions disabled, while real-provider Chromium did not
reproduce it. Extension-related warnings were separate.

**How to apply:** Preserve the homepage's lack of fullscreen delegation; compare
the actual provider in Safari before claiming diagnostic removal, and distinguish
the public served build from unshipped preview changes.
