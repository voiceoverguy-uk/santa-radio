---
name: Studio owner launch boundary
description: Owner-approved private production diagnostics and unpaid canary; public sales remain separately guarded.
---
Run production checks where the existing secrets live; do not rotate or export
CRON_SECRET or STUDIO_RETURN_SECRET to obtain diagnostic access.

**Why:** The owner confirmed Vercel is their only copy and authorised a private
runtime diagnostic plus an owner-paid £6.50 canary, not public bypasses.

**How to apply:** Prefer approved staff authentication. If unavailable, the
separate owner token must be scoped only to diagnostics/canary operations.
Keep all public payment checks and the two-creation policy. Never manufacture
webhook health, replay old customer events or pay automatically. Changes reach
production through Replit Sync Changes, with the owner making payment.
