---
name: Browser image failure checks
description: Chromium may reuse decoded artwork when testing failure after a successful image load.
---
Do not assume adding a network-abort route after a successful image load will cause the same image to fail later in that document.

**Why:** Chromium can reuse the decoded image from memory even when request interception disables the HTTP cache. An abort-based test can therefore miss the intended error path.

**How to apply:** Test real network failures on a fresh document before the image loads. For failure-and-recovery transitions after a successful load, dispatch the image error event and verify fallback and reset behaviour separately.

When an intercepted image is released during a Playwright test with its clock paused, await `image.decode()` before advancing the carousel timer.

**Why:** An image can report successful loading before the component's asynchronous decode-readiness state has committed, making virtual-time rotation checks fail even though the slideshow is behaving correctly.

**How to apply:** In delayed-image tests, await successful decoding after releasing the request and before moving the fake clock forward.
