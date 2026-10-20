---
name: Browser engine environment
description: WebKit navigation can need multimedia libraries even with mocked playback.
---

A successful Linux WebKit launch or empty-page check does not establish that it
can navigate this site. An idle audio element can exercise native multimedia
dependencies before any play call; stubbing play/pause does not remove them.

**Why:** In the Nix workspace, WebKit launched successfully but real-page
navigation crashed until the browser's multimedia plugin environment was
available. Missing host libraries were not a cookie-flow regression.

**How to apply:** Distinguish host crashes from failed UI assertions. Check
actual route navigation before spending time on engine tests, prefer a
supported consistent browser dependency environment, and never equate Linux
WebKit automation with physical Safari or audible playback verification.
