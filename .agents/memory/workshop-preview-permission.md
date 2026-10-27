---
name: Workshop preview permission
description: Shared preview gate boundaries and deployment-safe verification constraints
---

Keep the workshop shared-password permission separate from adult Santa signup
and staff authentication. Treat it as an understated preview entry, not a claim
that shipped JavaScript or public recording inventories are confidential.

**Why:** The owner originally scoped this as a lightweight private preview gate,
excluding individual accounts and asset confidentiality. They subsequently
requested public homepage promotion and a voucher-code option while payments
remain undecided.

**How to apply:** The dedicated-maker-only entry restriction is superseded by the
request for homepage promotion. The owner initially chose optional voucher entry
before creation, then explicitly changed the scope to **Coming soon, with Studio
access limited to friends testing with a code for a couple of weeks**. This
supersedes public exploration without a code. Keep the tester-code entry in the
homepage Studio advert, separate from free-greeting signup. Do not connect
extended audio or treat testing access as paid voucher redemption.

Use five different tester codes, independently controllable rather than one shared code.

**Why:** The owner said, “i will send out 5 different codes so we can control them.”

**How to apply:** Keep each code separately revocable and keep actual values exclusively in Secrets, never this memory or source files.

Use generated temporary server passwords in browser checks, never the owner's
real shared password in fixtures, screenshots, logs or browser storage.

Use shared persistent rate-limit storage, not a process-local counter.

**Why:** The same gate must run on Vercel, where requests can reach different
processes. Missing storage must fail closed rather than silently removing limits.

**How to apply:** Keep the gate's bucket namespace independent of name-request
allowances. Check hosting configuration separately without publishing changes.

Review the complete hosting requirements together when the owner supplies the
environment-variable list, before giving recovery steps or requesting a redeploy.

**Why:** The owner objected to missing requirements being identified one at a
time after they had already supplied screenshots of the complete settings list.

**How to apply:** Reconcile all access prerequisites and persistent storage in
one pass. Distinguish a passing status check from a successful code submission;
do not describe live access as restored until the private entry journey works.

When guiding production database access, account for the task-view restriction:
the Database pane can show “Production database unavailable” and “Switch to main”
instead of the usual controls.

**Why:** The owner encountered this while following connection-copy instructions,
even though read-only production database queries succeeded.

**How to apply:** Direct the owner to “Switch to main” before looking for
production connection settings. Do not interpret that task-specific screen as a
database outage, and never substitute the development connection string.
