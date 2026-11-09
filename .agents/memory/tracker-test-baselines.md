---
name: Tracker verification baselines
description: Distinguish current Santa Tracker layout regressions from stale full-suite expectations.
---
When Santa Tracker tests fail outside the specific behavior being changed, compare their hard-coded host, wording and destination counts with the live route before treating the result as a regression. Verify structured metadata from the direct server response and use focused browser assertions for the rendered layout.

**Why:** The broad tracker suite can retain old canonical-host, punctuation, introduction-copy or itinerary-size expectations even when the current route and focused seasonal behavior are correct.

**How to apply:** Validate the requested seasonal state and visible layout in focused browser checks; parse `BreadcrumbList` from server-rendered HTML independently. Keep unrelated stale assertions visible for follow-up rather than changing working behavior to satisfy them.
