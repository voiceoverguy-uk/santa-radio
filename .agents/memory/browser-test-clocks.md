---
name: Screenshots with virtual browser clocks
description: Virtual timer tests can capture partly transparent CSS entrance animations.
---

When using Playwright's virtual clock for a delayed interface, finish or disable finite CSS animations before saving visual evidence, including before/after raster comparisons.

**Why:** Advancing the timer enough to open a dialog did not reliably finish its nested entrance animation; a screenshot showed translucent fields over the background despite the settled interface rendering correctly. Unsettled decorative motion can also produce pixel differences when the text clipping itself is unchanged.

**How to apply:** Use `animations: 'disabled'` on screenshots taken in virtual-clock tests, or explicitly verify all relevant animations have settled. Keep separate reduced-motion checks rather than treating that setting as the default visitor experience.

Prefer a separate real-clock visual capture when the virtual timer is testing something unrelated to the screen’s appearance.

**Why:** Timer-driven checks have passed while their screenshots still showed a timed offer covering the underlying controls. Functional state assertions alone are not sufficient visual evidence.

**How to apply:** Keep timeout/error assertions under the virtual clock, and capture the normal finished interface in its real-clock journey instead.

Pause calendar-boundary test clocks before navigating; installing a clock alone still lets wall time advance during page setup.

**Why:** Navigation and consent handling can consume the remaining time before midnight, making an initial “previous day” assertion race against the date transition.

**How to apply:** Pause at the intended starting date before loading the route, then advance time explicitly for midnight assertions. Keep ordinary visual captures on the real clock.
