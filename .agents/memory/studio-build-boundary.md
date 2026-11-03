---
name: Website build and Studio readiness boundary
description: Keep Studio runtime storage requirements out of the whole website compilation path.
---

Website compilation must not depend on Studio database availability. Keep
strict Studio readiness checks separate; missing mandatory state must still
fail closed in the visitor's generation endpoints.

**Why:** A whole-site storage gate caused repeated Vercel build failures and
prevented the safe, non-archiving renderer from replacing the older version.
The owner explicitly requested fixing those build failures without database
changes.

**How to apply:** Never report Studio as operational solely because a website
build passes. Preserve voucher and shared allowance enforcement, show actual
runtime unavailability, and require a separately approved schema resolution
and live audio verification before claiming Studio is repaired.
