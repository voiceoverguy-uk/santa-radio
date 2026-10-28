---
name: Santa Studio paid bundle
description: Owner-defined family bundle, live Stripe product preservation, guest access and unresolved usage policies.
---

The paid Santa Message Maker family bundle is a one-off £6.50 GBP purchase: one combined audio message for up to three children, up to three individual certificates, one shared PDF Santa letter and one shared Santa Nice List image displaying their names.

**Why:** The owner explicitly defined this offer.

**How to apply:** Keep this entitlement separate from the free short greeting, which must remain free, and from existing tester-voucher access. Do not claim bundle delivery until each output is connected and verified.

Purchasers should not need a customer account or login. Confirmed successful payment should unlock MMS immediately, with a secure email return link. Failed, cancelled and pending payments must not grant access; repeated payment notifications must not duplicate a purchase or access.

**Why:** The owner explicitly specified guest purchasing and payment-confirmation behaviour.

**How to apply:** Use server-verified payment state and durable, idempotent purchase authorization rather than trusting a browser success redirect or reusing tester codes as proof of purchase.

The owner reports an existing live Stripe product named “Santa Message Maker” at £6.50. Preserve that product; sandbox payment preparation must use separate test resources.

**Why:** The owner explicitly said the live product already exists and must not be changed.

**How to apply:** Verify test/sandbox mode before creating or using payment resources. Do not infer permission for live charges, live changes or publishing from approval to test.

No regeneration limits or paid-access expiry have been agreed.

**Why:** The owner explicitly stated these decisions remain unagreed.

**How to apply:** Do not introduce a regeneration cap or access expiry, and do not carry the private tester session's timing rules into paid access.

Sandbox Purchase controls and development-only explanations must never appear on public/published sites. Keep clearly labelled test checkout in development, and retain the public Coming soon promotion and voucher access.

**Why:** The owner reported the published homepage displaying a disabled test Purchase button and explicitly required the entire sandbox control to be hidden.

**How to apply:** Check both production server/browser rendering and development rendering. Preserve endpoint sandbox protections. The owner is separately claiming the existing Santa Radio Sandbox; do not create or replace it.

The extended audio-stitching demo exists but has not been connected to Studio selections. This does not block sandbox payment setup; it is not evidence that the full paid family bundle is delivered.

**Why:** The owner resolved the generator discrepancy and explicitly authorised sandbox setup to continue independently.

**How to apply:** Preserve the separate demo and free generator. Do not claim complete bundle delivery until Studio selections and all bundle outputs are connected and verified.
