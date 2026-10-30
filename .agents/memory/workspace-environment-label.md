---
name: Workspace environment label
description: The environment label alone does not identify the database or a published runtime.
---
Do not infer a production database target solely from `REPLIT_ENVIRONMENT`.

**Why:** In this workspace that label was `production` while the configured Preview workflow ran in development, development tables were accessible, and the production database callback reported no production database.

**How to apply:** Use database callbacks with an explicit development/production environment to identify the target. Keep development setup explicitly opt-in and out of app startup, and reject actual deployment execution. Do not reintroduce a label-only guard that blocks legitimate post-merge development setup.

Before any production purchase or write, identify the existing database target and collect read-only schema evidence. A generic `DATABASE_URL` and the absence of a linked marketplace database do not identify the provider or prove the target is missing.

**Why:** The owner requires the existing target and schema to be verified before any purchase or production write.

**How to apply:** Check non-secret provider/connection metadata and read-only schema/catalogue state first. Never display credentials, provision a replacement, or write production data as part of this verification.
