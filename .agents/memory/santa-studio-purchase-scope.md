---
name: Santa Studio paid purchase
description: One-child purchase, success-only finalisation, reusable guest return and preserved Stripe/voucher boundaries.
---

The current website purchase is £6.50 for one child's message, including the certificate, letter and Santa picture. This supersedes the earlier up-to-three-child family offer.

**Why:** The owner explicitly defined this offer.

**How to apply:** Keep this entitlement separate from the free short greeting and independent tester-voucher access. Preserve the existing Stripe product and price. Do not claim delivery until the exact completed recording and all included keepsakes can be retrieved.

Purchasers should not need a customer account or login. Verified successful payment opens the paid workshop immediately without requiring an email first. Provide a private emailed return link that can be used repeatedly to resume the same unfinished purchase and, after completion, retrieve the same completed downloads. Failed, cancelled and pending payments must not grant access; repeated payment notifications must not duplicate a purchase.

**Why:** The owner explicitly specified guest purchasing and payment-confirmation behaviour.

**How to apply:** Use server-verified payment state and durable, idempotent purchase authorization rather than trusting a browser success redirect or reusing tester codes as proof of purchase.

The owner reports an existing live Stripe product named “Santa Message Maker” at £6.50. Preserve that product; sandbox payment preparation must use separate test resources.

**Why:** The owner explicitly said the live product already exists and must not be changed.

**How to apply:** Verify test/sandbox mode before creating or using payment resources. Do not infer permission for live charges, live changes or publishing from approval to test.

Only successful MP3 generation AND durable saving finalises a paid purchase. Afterwards prevent all further new message creation and editing under that purchase; retain download access to that same completed recording and included certificate, letter and Santa picture. Explain this clearly before final generation. Do not consume the purchase on a click or technical failure; permit retry and prevent duplicate messages from repeated clicks or simultaneous tabs.

**Why:** The owner explicitly clarified the paid purchase rule.

**How to apply:** Enforce paid finalisation server-side and preserve completed-output recovery after response loss. Keep voucher testing independent and unchanged. No paid entitlement, return-link or download expiry has been agreed; do not import voucher session timing into paid access.

Brevo is not approved for purchase-access email. Inspect delivery setup and identify the provider/sender/credential decisions still required; do not assume Resend or another provider is approved.

**Why:** The owner explicitly corrected the earlier Brevo suggestion.

**How to apply:** Do not publish or enable live sales until the payment/access flow is validated and outstanding email configuration is resolved. Confirm the verified sender and supply credentials securely only after the provider decision.

Sandbox Purchase controls and development-only explanations must never appear on public/published sites. Keep clearly labelled test checkout in development. The owner has separately approved building public live payments, but retain the closed-sales promotion and independent voucher access until the payment/access flow is validated, email is configured and publication is explicitly approved.

The owner requested removal of the “Studio A” and “Studio B” references from public wording; keep the free greeting and bespoke bundle distinct without those labels.

**Why:** The owner wanted fewer words and simpler recording indicators.

**How to apply:** Retain generic Studio branding, but do not reintroduce lettered Studio labels in public copy.

The Studio promotion must show a neutral £6.50 price. There is no Black Friday deal yet; do not advertise £4.50, savings or a scheduled future offer.

**Why:** The owner explicitly corrected the earlier seasonal-offer direction.

**How to apply:** Keep both shared promotional placements consistent without changing Stripe products, payment amounts, launch timing or development-only checkout.

The owner set the Studio A launch date to 6 November 2026 and requested an opening countdown beneath the red bespoke-message button.

**Why:** The owner said, “We'll make this live Nov 6th.”

**How to apply:** Treat this as a fixed launch date, not an annual countdown. The countdown is promotional presentation, not permission to activate live payments or remove access controls automatically.

**Why:** The owner supplied this distinction and timing in the public introduction copy.

**How to apply:** Keep the Nice List certificate, letter and Santa picture associated with the bespoke paid offer, not the free short greeting. Promotional wording is not authorization to activate paid purchasing.

**Why:** The owner reported the published homepage displaying a disabled test Purchase button and explicitly required the entire sandbox control to be hidden.

**How to apply:** Check both production server/browser rendering and development rendering. Preserve endpoint sandbox protections. The owner is separately claiming the existing Santa Radio Sandbox; do not create or replace it.

