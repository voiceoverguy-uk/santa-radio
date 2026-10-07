---
name: Preview UI test timeout diagnosis
description: Distinguish a total test deadline from an actual player state regression.
---
A whole-test timeout can leave a matcher reporting an empty received string even when the failure snapshot already shows the expected player state. Inspect the total deadline and snapshot before changing player behaviour.

**Why:** A long clock-driven radio lifecycle test on the proxied preview exceeded its overall budget; increasing that budget verified the existing behaviour without any player changes.

**How to apply:** When a final assertion's reported value conflicts with the captured UI, check whether the whole test expired before the assertion could run. Avoid treating that as proof of an application regression.

Browser checks can also time out during clock setup or screenshot capture, before the changed interaction is exercised. A longer deadline does not always resolve this.

**Why:** Browser and capture checks have stalled before any relevant UI assertion, even after simplifying their setup and increasing deadlines.

**How to apply:** Distinguish infrastructure timeouts from failed behaviour assertions. After a few different approaches, stop repeating the checks, use cheaper build or source checks where available, and clearly report that browser verification did not complete.

Installed testing guidance can describe a tester configuration that the current callback rejects.

**Why:** The documented testing configuration was rejected as an unknown kind in this workspace.

**How to apply:** When that happens, use the repository's configured Playwright suite directly rather than repeatedly trying undocumented helper configurations.
