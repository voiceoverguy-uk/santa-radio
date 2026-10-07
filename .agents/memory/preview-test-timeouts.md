---
name: Preview UI test timeout diagnosis
description: Distinguish a total test deadline from an actual player state regression.
---
A whole-test timeout can leave a matcher reporting an empty received string even when the failure snapshot already shows the expected player state. Inspect the total deadline and snapshot before changing player behaviour.

**Why:** A long clock-driven radio lifecycle test on the proxied preview exceeded its overall budget; increasing that budget verified the existing behaviour without any player changes.

**How to apply:** When a final assertion's reported value conflicts with the captured UI, check whether the whole test expired before the assertion could run. Avoid treating that as proof of an application regression.
