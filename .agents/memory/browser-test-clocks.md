---
name: Screenshots with virtual browser clocks
description: Virtual timer tests can capture partly transparent CSS entrance animations.
---

When using Playwright's virtual clock for a delayed interface, finish or disable finite CSS animations before saving visual evidence.

**Why:** Advancing the timer enough to open a dialog did not reliably finish its nested entrance animation; a screenshot showed translucent fields over the background despite the settled interface rendering correctly.

**How to apply:** Use `animations: 'disabled'` on screenshots taken in virtual-clock tests, or explicitly verify all relevant animations have settled. Keep separate reduced-motion checks rather than treating that setting as the default visitor experience.
