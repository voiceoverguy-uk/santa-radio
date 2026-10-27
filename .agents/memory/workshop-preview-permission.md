---
name: Workshop preview permission
description: Shared preview gate boundaries and deployment-safe verification constraints
---

Keep the workshop shared-password permission separate from adult Santa signup
and staff authentication. Treat it as an understated preview entry, not a claim
that shipped JavaScript or public recording inventories are confidential.

**Why:** The owner explicitly scoped this as a lightweight preview gate and
excluded individual accounts, public promotion and asset confidentiality.

**How to apply:** Preserve the dedicated-maker-only entry and existing workshop
behaviour. Do not turn success into signup permission or connect extended audio.
Use generated temporary server passwords in browser checks, never the owner's
real shared password in fixtures, screenshots, logs or browser storage.

Use shared persistent rate-limit storage, not a process-local counter.

**Why:** The same gate must run on Vercel, where requests can reach different
processes. Missing storage must fail closed rather than silently removing limits.

**How to apply:** Keep the gate's bucket namespace independent of name-request
allowances. Check hosting configuration separately without publishing changes.
