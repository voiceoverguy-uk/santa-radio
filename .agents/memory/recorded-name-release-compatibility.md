---
name: Recorded-name release compatibility
description: Why a code-only recovery supports older private-name database setup and still requires separate hosted confirmation.
---

Keep a production-name repair deliverable separate from claims of live recovery.
The owner requested a completed code handover for their Vercel release and live
testing rather than waiting for production database access.

**Why:** Preview worked while the www host returned a generic service failure.
The session could not obtain authenticated production database evidence, so a
missing optimisation dependency remained a hypothesis, not a confirmed cause.
The temporary compatibility decision trades the optimised coordinated refresh
schedule for the previously working private loader when setup is absent; it does
not authorise weaker limits, public catalogues or production schema changes.

**How to apply:** Preserve the database-backed atomic limiter and source privacy.
Treat compatibility as a migration/rollout bridge, not permission to mask generic
database failures or corrupt source data. Verify the actual hosted deployment
after release before claiming restoration, and obtain separate target-specific
approval before preparing the production index.
