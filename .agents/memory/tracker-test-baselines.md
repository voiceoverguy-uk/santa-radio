---
name: Tracker verification baselines
description: Distinguish current Santa Tracker layout regressions from stale full-suite expectations.
---
When Santa Tracker browser tests fail outside the specific behavior being changed, compare their hard-coded host, copy and selectors with the live route before treating the result as a regression. Verify structured metadata from the direct server response and use focused browser assertions for the rendered layout.

**Why:** The full tracker suite contains expectations that can diverge from the current route's canonical host and wording, while focused map-order checks still exercise the requested UI.

**How to apply:** Validate visible layout in the browser and parse `BreadcrumbList` from server-rendered HTML independently. Keep unrelated failures visible for follow-up rather than weakening the requested checks.
