---
name: Artwork browser rendering
description: Use the available system Chromium for static artwork rendering when downloaded Playwright browsers lack libraries.
---

For one-off static artwork renders in this workspace, prefer the preinstalled system Chromium when the downloaded Playwright browser fails to load shared libraries.

**Why:** The downloaded browser lacked GLib, while the system Chromium ran successfully. Broad attempts to discover missing libraries across the Nix store timed out and were unnecessary.

**How to apply:** Check the system Chromium executable before attempting dependency installation or library-path reconstruction. Use it through Playwright's executable-path option when available; do not change the application's dependencies just for an artwork export.

For tall browser-rendered artwork, verify the exported PNG dimensions rather than assuming a screenshot clip captures beyond the viewport.

**Why:** A clip taller than the viewport silently produced a viewport-height PNG, cutting off the surrounding page context.

**How to apply:** Freeze any viewport-dependent composition dimensions first, then increase the capture viewport to the full intended export height, or use a full-page capture. Check the resulting image dimensions and inspect the bottom of each export.
