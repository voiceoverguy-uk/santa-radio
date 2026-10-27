---
name: Screenshots with virtual browser clocks
description: Virtual timer tests can capture partly transparent CSS entrance animations.
---

When using Playwright's virtual clock for a delayed interface, finish or disable finite CSS animations before saving visual evidence.

**Why:** Advancing the timer enough to open a dialog did not reliably finish its nested entrance animation; a screenshot showed translucent fields over the background despite the settled interface rendering correctly.

**How to apply:** Use `animations: 'disabled'` on screenshots taken in virtual-clock tests, or explicitly verify all relevant animations have settled. Keep separate reduced-motion checks rather than treating that setting as the default visitor experience.

Prefer a separate real-clock visual capture when the virtual timer is testing something unrelated to the screen’s appearance.

**Why:** Timer-driven checks have passed while their screenshots still showed a timed offer covering the underlying controls. Functional state assertions alone are not sufficient visual evidence.

**How to apply:** Keep timeout/error assertions under the virtual clock, and capture the normal finished interface in its real-clock journey instead.
