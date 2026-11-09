---
name: Browser checks and generated HTML
description: Vite reloads live pages when private HTML reports are regenerated.
---

Do not regenerate HTML inspection reports while browser interaction or geometry
tests are using the same Vite development server.

**Why:** Vite watches generated HTML outside the public directory too. Updating
an owner-inspection report can trigger a full page reload and destroy a test's
execution context, even though the tested component has not changed.

**How to apply:** Finish report generation before browser checks, or run the
checks against an isolated server with generated-output watching excluded.
This also applies to clean-install Vercel packaging checks: their copied-site
builds write thousands of HTML documents beneath the workspace and can reload
the normal Preview while it is being tested.
Distinguish a navigation interruption from a failed layout assertion.
