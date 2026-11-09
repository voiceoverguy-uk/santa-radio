---
name: Tracker artwork sizing tests
description: How to assert enlarged marker artwork dimensions without assuming raster proportions match its display box.
---
Santa marker artwork uses logical display dimensions that can differ from the PNG's intrinsic pixel ratio. Browser sizing checks should compare the rendered bounds with computed CSS dimensions, and separately assert the CSS caps fit the viewport.

**Why:** Deriving the expected rendered bounds from the PNG's natural aspect ratio can make browser checks fail even when the CSS correctly applies the intended display size.

**How to apply:** When testing the enlarged tracker artwork, read its computed width, height, max-width and max-height. Check actual bounds against computed dimensions and verify the caps stay within the target viewport fractions.
