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

Do not count `Range.getClientRects()` as visual lines when a heading contains nested inline text.

**Why:** Chromium returned multiple text-fragment rectangles for a heading that visibly occupied one line, causing a strict line-count assertion to fail.

**How to apply:** To check a single-line heading, compare its element height with its computed line height; use range rectangles for fragment containment only after checking how nested text nodes are represented.

Find the element responsible for a page-wide enlarged-text overflow before attributing it to the component being changed.

**Why:** A new promotion fit its own bounds, while an unrelated existing page heading caused the full document to overflow at 200% text. Nested grid minimum sizing also needed a separate local check.

**How to apply:** Check the changed content and its layout parent, not only each child's scrollWidth. Keep ordinary page-width checks; label any deliberately scoped enlarged-text check rather than claiming the entire page passes.
