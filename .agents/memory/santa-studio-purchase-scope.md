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

The owner reports a working MMS generator. Locate and trace that actual flow before changing it; the free short-message generator is not evidence that the full paid family bundle is delivered.

**Why:** The owner challenged the audit's design-preview description and requested investigation before any generation changes or delivery claims.

**How to apply:** Distinguish the current workshop UI, the free generator and any separately hosted or supplied MMS generator. Ask for its route or source when it cannot be located rather than replacing it.
