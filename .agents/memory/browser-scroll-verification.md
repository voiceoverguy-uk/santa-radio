---
name: Browser scroll verification
description: Scroll completion and fixed-player occlusion affect screenshot and layout checks.
---
Before capturing an interaction state or measuring its viewport position, ensure scrolling has settled and account for fixed headers and the radio dock.

**Why:** A mobile artwork screenshot initially hid its caption behind the fixed dock. Centring the card also produced a misleading immediate geometry failure because the site's smooth scroll had not finished.

**How to apply:** Use instant scrolling for capture-only positioning, or wait for the intended position before measuring. An element inside the viewport can still be obscured by fixed controls; verify the relevant caption or button against those controls rather than only the viewport bounds.
