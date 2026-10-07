---
name: YouTube availability verification
description: Distinguish catalogue metadata checks from actual embedded playback and local screenshot artefacts.
---
Do not label all successful YouTube oEmbed responses as working playback, or all failed responses as deleted videos. Preserve a review category for access restrictions.

**Why:** A replacement returned valid metadata and rendered its player title in the proxied development preview, while the local screenshot browser showed “video unavailable” and a distorted player. These environments can disagree.

**How to apply:** Verify embedded players through the real proxied development URL when local screenshots are suspicious. Report metadata availability separately from playback checks; regional, account and embedding restrictions can still apply.
