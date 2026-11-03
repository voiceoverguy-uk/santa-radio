---
name: School tester voucher scope
description: Shared school invitation and fixed UK testing window, separate from existing vouchers.
---
The school invitation uses an additional shared server-only voucher. Different
parents may redeem the same voucher independently. Its authorised window is
3 November 2026 through the end of 10 November 2026 UK time, not seven days
from redemption. Existing tester vouchers retain their own deadline. The private
usage report monitors all active configured slots, not only the school voucher.

**Why:** The owner requested a shared invitation for several school parents,
with a fixed deadline, without replacing the existing invitations.

**How to apply:** Keep voucher values exclusively in secure server configuration;
only the approved-admin-protected report may return active codes to the signed-in
owner. Never put them in public APIs, page source or bundles. Do not replace the
existing five or infer that Replit workspace configuration updates Vercel, and
obtain separate approval before changing production settings or deploying.

Count school voucher entries and successful messages privately, with corrections
separate. Do not label entries as unique parents or download clicks as saved files.

**Why:** The owner approved private usage counts and asked for clear access
instructions, following the recommendation to count entries and successful
messages with corrections separate.

**How to apply:** Keep counts server-authoritative and reuse the existing
approved staff access. Do not collect children's details for usage reporting
or claim historical coverage before tracking was enabled.

Usage reporting must not become a prerequisite for accepting a valid voucher.
Keep the persistent security limiter mandatory, but report usage-storage failures
privately instead of locking invited parents out.

**Why:** A new reporting dependency can otherwise turn a missing reporting schema
on a host into an all-voucher access outage.

**How to apply:** Preserve code, origin, expiry and session checks. Log only fixed
failure categories, and treat totals during a reporting outage as incomplete.
