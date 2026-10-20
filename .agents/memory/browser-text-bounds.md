---
name: Browser text bounds
description: Avoid false cropping failures caused by fractional inline-text measurements.
---
Allow a small subpixel tolerance when comparing inline-text ranges against their paragraph's bounds.

**Why:** Chromium reported a text range extending 1/64 of a pixel past a paragraph during mobile message checks, despite the complete text fitting visibly. Strict inequalities falsely flagged cropping.

**How to apply:** Use a half-pixel tolerance for measured text containment while still checking every long message and horizontal page overflow. Do not weaken checks for meaningful clipping.

Text range height and scrollHeight can exceed a heading's line box without clipping when overflow is visible.

**Why:** Cinzel's font metrics produced vertical overflow in enlarged headings even when the text rendered fully. Treating that alone as clipping caused false failures.

**How to apply:** For horizontal reflow checks, measure horizontal line bounds and container widths. For vertical clipping, check clipping ancestors rather than assuming every line-box overhang is hidden.
