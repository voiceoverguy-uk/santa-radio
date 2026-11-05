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

Synchronise the start of a rotation interval before asserting its exact boundary.

**Why:** Navigation, image loading and the first automatic recipient change can
consume part of the next interval. A shorter heading exposed this assumption in
phone checks even though the production rotation duration had not changed.

**How to apply:** After the first change settles, use the existing hover pause
and resume interaction to start a fresh reading interval before advancing the
virtual clock. Do not change production timing to satisfy an unanchored test.

Network-triggered timers may begin partway through a virtual-clock advance.

**Why:** A retry succeeded during a clock advance, so a subsequent 4,999 ms
advance crossed the count-up boundary despite looking just below five seconds.

**How to apply:** Use margin for recovery checks unless the timer's start is
explicitly synchronised. Test exact interval boundaries separately from network
recovery, starting from a paused clock after the initial response has settled.

Use `fastForward` for long waiting intervals on pages with unrelated ambient RAF
work, and sample the target CSS animation separately at controlled times.

**Why:** Advancing every frame through several seconds of homepage timers made
otherwise-correct jump checks excessively slow because the page also runs
unrelated decorative work.

**How to apply:** Do not skip interval ticks when those ticks are the behaviour
under test. For a one-shot delay, skip the waiting time, verify its boundaries,
and then inspect the actual animation path and landing independently.
