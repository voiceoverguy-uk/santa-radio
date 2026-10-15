---
name: Artwork browser rendering
description: Use the available system Chromium for static artwork rendering when downloaded Playwright browsers lack libraries.
---

For one-off static artwork renders in this workspace, prefer the preinstalled system Chromium when the downloaded Playwright browser fails to load shared libraries.

**Why:** The downloaded browser lacked GLib, while the system Chromium ran successfully. Broad attempts to discover missing libraries across the Nix store timed out and were unnecessary.

**How to apply:** Check the system Chromium executable before attempting dependency installation or library-path reconstruction. Use it through Playwright's executable-path option when available; do not change the application's dependencies just for an artwork export.
