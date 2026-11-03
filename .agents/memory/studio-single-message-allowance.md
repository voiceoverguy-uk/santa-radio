---
name: Studio single-message allowance
description: Owner-approved correction limit and identity locks, separate from future family-bundle policy.
---

The current authorised single-message Studio allows one initial successful
generation plus one successful correction. The exact spoken name variant and
full destination (category, place and optional county/state) lock after the
first success. Other audio choices can change through explicit correction;
written spelling never changes the spoken identity. Failures do not spend the
successful-generation allowance, and ordinary navigation must not discard the
current downloadable recording.

During voucher-code testing, testers may deliberately start another test
message, including after exhausting both successes, and choose a different
recorded name and destination. This is a temporary exception for authenticated
voucher testers only, not paid/sandbox purchase access or the free maker.

Show the authenticated user's own voucher and explain that voucher testing
allows unlimited messages. Keep that entitlement distinct from a temporary
recording-service failure; do not describe such a failure as running out of
messages or bypass server-side generation checks.

**Why:** The owner requested explicit voucher-aware unlimited-message wording
after a generic allowance warning obscured the tester entitlement.

**How to apply:** Resolve the voucher through verified access, never a URL or
browser-entered claim. Reveal only the current user's voucher, not other codes.
Do not store code values in source, fixtures or project memory.

**Why:** The owner said “While we are testing, allow anyone using a voucher code
to generate another.”

**How to apply:** Keep the ordinary per-message accounting and paid limits
intact. Starting another voucher test must not extend the voucher's expiry or
bypass request/concurrency limits. Preserve the previous local downloads until
replacement succeeds and advise downloading them before starting another test.

**Why:** The owner explicitly chose this deliberate completion flow, superseding
the earlier unagreed regeneration policy only for this single-message scope.

**How to apply:** Keep server-authoritative locks and allowance stable for the
same existing authorised access across tabs, refresh and restarts. Do not apply
this policy to the free short maker or infer future multi-child/purchase-wide
family policy, new access expiry or a prohibition on obtaining new access.
