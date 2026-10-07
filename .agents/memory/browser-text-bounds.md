---
name: Browser text bounds
description: Avoid false cropping failures caused by fractional inline-text measurements.
---
Allow a small subpixel tolerance when comparing inline-text ranges against their paragraph's bounds.

**Why:** Chromium reported a text range extending 1/64 of a pixel past a paragraph during mobile message checks, despite the complete text fitting visibly. Strict inequalities falsely flagged cropping.

**How to apply:** Use a half-pixel tolerance for measured text containment while still checking every long message and horizontal page overflow. Do not weaken checks for meaningful clipping.
