---
name: Browser scroll verification
description: Scroll completion and fixed-player occlusion affect screenshot and layout checks.
---
Before capturing an interaction state or measuring its viewport position, ensure scrolling has settled and account for fixed headers and the radio dock.

**Why:** A mobile artwork screenshot initially hid its caption behind the fixed dock. Centring the card also produced a misleading immediate geometry failure because the site's smooth scroll had not finished.

**How to apply:** Use instant scrolling for capture-only positioning, or wait for the intended position before measuring. An element inside the viewport can still be obscured by fixed controls; verify the relevant caption or button against those controls rather than only the viewport bounds.

Do not treat a scroll helper's “element is not attached” error alone as proof that retained controls were lost.

**Why:** After internal navigation, Playwright’s `scrollIntoViewIfNeeded` repeatedly failed for retained greeting downloads, while instant positioning followed by actual keyboard and touch downloads passed.

**How to apply:** Re-resolve the live locator and use instant positioning when testing download interaction rather than scrolling itself. Keep the real activation and downloaded-file assertions; do not replace them with forced clicks.

For hover-style tests, disable smooth scrolling in the test page before positioning the pointer; do not change the application's scrolling behaviour to satisfy the check.

**Why:** After a homepage section move, a button briefly acquired the expected hover style, then ongoing scrolling moved it away from the stationary pointer and produced a persistent false failure.

**How to apply:** Apply a test-only `scroll-behavior: auto` override when the test concerns hover styling rather than scrolling.

Distinguish application scroll resets from the browser's native scroll anchoring.

**Why:** A cancellation check observed a small viewport adjustment even though an instrumented `scrollTo` confirmed the application had made no additional scroll call. Pixel movement alone did not prove a repeated opening scroll.

**How to apply:** For cancellation-specific tests, use a stable boundary such as the page top or instrument the scroll calls; keep separate settled-geometry assertions for the actual destination.

Focus-triggered scrolling can cancel a pointer activation if it moves a button between press and release.

**Why:** Contact-form checks intermittently left a valid form unchanged without starting a request when the focus handler repositioned the clicked Send button.

**How to apply:** Restrict keyboard visibility scrolling to keyboard/validation focus rather than pointer-focused buttons. Preserve real clicks in tests; forcing them would hide this interaction problem.

The owner chose the complete Studio B card as the mobile destination after adult signup, with its recording-studio header immediately below the navigation—not the section introduction or name input.

**Why:** The owner supplied an iPhone screenshot showing this exact landing position after entering their name and email.

**How to apply:** Keep this destination consistent for homepage and dedicated free-message signup. Dismiss the signup keyboard without automatically opening the name-entry keyboard, and stop settling when the visitor interacts.
