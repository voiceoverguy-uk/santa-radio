---
name: Vercel sensitive binding inspection
description: Sensitive connection settings can return metadata without a value even on a successful API response.
---
Vercel's single-variable API can return HTTP 200 with metadata only for a
sensitive DATABASE_URL. The serving deployment's environment-name list confirms
presence, not the destination database. Do not treat either as binding proof.

**Why:** A secure live investigation encountered this write-only-secret
behaviour; official Vercel documentation confirms saved Secret values are not
readable. Replit production schema findings alone cannot identify Vercel's
database.

**How to apply:** Inspect the deployment actually assigned to the www domain,
not merely the latest project target, which may still be building. If the secret
is unreadable and no resource association proves the destination, use an
authorised, staff-protected read-only diagnostic inside the actual runtime.
Do not rotate, replace or expose credentials to work around the limitation,
and obtain approval before deployment or database changes.
