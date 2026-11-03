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

No family-bundle regeneration limits or paid-access expiry have been agreed.

**Why:** The owner explicitly stated these decisions remain unagreed.

**How to apply:** Do not introduce a family-bundle regeneration cap or access expiry, and do not carry the private tester session's timing rules into paid access. The owner separately approved one initial generation plus one correction for the current single-message Studio flow, including tester and sandbox access. That scoped choice does not set future multi-child or purchase-wide family policy.

Sandbox Purchase controls and development-only explanations must never appear on public/published sites. Keep clearly labelled test checkout in development, and retain the public Coming soon promotion and voucher access.

The owner requested removal of the “Studio A” and “Studio B” references from public wording; keep the free greeting and bespoke bundle distinct without those labels.

**Why:** The owner wanted fewer words and simpler recording indicators.

**How to apply:** Retain generic Studio branding, but do not reintroduce lettered Studio labels in public copy.

The owner requested a “Black Friday Deal — Only £4.50” promotion. This is a seasonal promotional price, not permission to change the preserved live Stripe product or enable live purchasing.

**Why:** The owner requested an offer on the existing promotional card; checkout was still sandbox-only.

**How to apply:** Reconcile the advertised seasonal price with the payment setup before enabling real purchases. Do not infer an expiry, claimed saving or permanent base-price change.

The owner set the Studio A launch date to 6 November 2026 and requested an opening countdown beneath the red bespoke-message button.

**Why:** The owner said, “We'll make this live Nov 6th.”

**How to apply:** Treat this as a fixed launch date, not an annual countdown. The countdown is promotional presentation, not permission to activate live payments or remove access controls automatically.

**Why:** The owner supplied this distinction and timing in the public introduction copy.

**How to apply:** Keep the Nice List certificate, letter and Santa picture associated with the bespoke paid offer, not the free short greeting. Promotional wording is not authorization to activate paid purchasing.

**Why:** The owner reported the published homepage displaying a disabled test Purchase button and explicitly required the entire sandbox control to be hidden.

**How to apply:** Check both production server/browser rendering and development rendering. Preserve endpoint sandbox protections. The owner is separately claiming the existing Santa Radio Sandbox; do not create or replace it.

The extended audio-stitching demo exists but has not been connected to Studio selections. This does not block sandbox payment setup; it is not evidence that the full paid family bundle is delivered.

**Why:** The owner resolved the generator discrepancy and explicitly authorised sandbox setup to continue independently.

**How to apply:** Preserve the separate demo and free generator. Do not claim complete bundle delivery until Studio selections and all bundle outputs are connected and verified.
