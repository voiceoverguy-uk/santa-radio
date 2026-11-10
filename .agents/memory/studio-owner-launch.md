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

Readiness failures must stay diagnosable without exposing provider messages:
return only stage, Stripe type/code, HTTP status or fixed STUDIO_* codes.
**Why:** blanket false results hid a production-only Stripe failure while the
workspace live key passed identical calls.

Eligible Stripe promotion codes may discount the £6.50 base checkout without
changing the two-creation entitlement. Studio vouchers remain separate.

**Why:** The owner explicitly approved existing Stripe promotion-code support
with automated/sandbox verification only and public sales kept off.

**How to apply:** Let Stripe enforce code eligibility and use canonical
discounted payment totals, not a fixed £6.50 received-amount check. Preserve
the verified purchase allowance through email returns and old voucher state.
Do not create live charges to verify this feature or enable sales implicitly.

Do not assume that working staff sign-in in Replit Preview means the separate
Vercel deployment has working Clerk authentication.

**Why:** A live staff page attempted a direct Clerk-host script load and remained
in its loading state when Vercel lacked the managed Clerk production bindings.
The separately scoped owner diagnostic token was still configured.

**How to apply:** Verify production staff authentication and its proxy before
directing the owner to the staff UI. Use the existing private diagnostic route
when appropriate; do not export or rotate credentials to repair sign-in.

Full Vercel staff sign-in needs an external Clerk setup, not copied
Replit-managed Preview keys or an environment-variable-only repair.

**Why:** Replit's official Clerk Auth documentation confirms its managed
authentication and production proxy are tied to Replit hosting, not Vercel.

**How to apply:** Keep the existing owner-token launch checks independent.
Treat permanent Vercel staff authentication as a separately approved setup,
including its client/server wiring and production-domain configuration.
