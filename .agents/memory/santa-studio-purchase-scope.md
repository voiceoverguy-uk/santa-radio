---
name: Santa Studio paid purchase
description: One-child temporary creation visit, Resend entry access and independent Stripe/voucher boundaries.
---

The current website purchase is a one-off £6.50 GBP for two successful creations,
each with one child's personalised MP3, Nice List certificate, Santa letter and
Santa picture. This is not the earlier up-to-three-child family offer.

**Why:** The owner explicitly chose “Switch to one-child content” when asked to reconcile the existing individual outputs with the earlier family offer.

**Why:** The owner subsequently chose two successful creations per website
purchase. Minimal durable allowance accounting is allowed; names/destinations
must not be locked and generated files must not be retained.

**How to apply:** Keep this entitlement separate from the free short greeting and independent tester-voucher access. Preserve the existing Stripe product and price. Do not advertise a combined family recording, shared multi-child gifts or a recording-retrieval service.

Purchasers should not need a customer account or login. Verified successful payment opens the paid workshop immediately without requiring an email first. The emailed link gives a verified paying customer access to the Message Maker Studio to BEGIN creating their message. It is not a link to saved audio or previous downloads. Failed, cancelled and pending payments must not grant access; repeated payment notifications must not duplicate a purchase.

**Why:** The owner explicitly specified guest purchasing and payment-confirmation behaviour.

**How to apply:** Use server-verified payment state and durable, idempotent purchase authorization rather than trusting a browser success redirect or reusing tester codes as proof of purchase.

The owner reports an existing live Stripe product named “Santa Message Maker” at £6.50. Preserve that product; sandbox payment preparation must use separate test resources.

**Why:** The owner explicitly said the live product already exists and must not be changed.

**How to apply:** Verify test/sandbox mode before creating or using payment resources. Do not infer permission for live charges, live changes or publishing from approval to test.

Customers create their message, play it and download it during that visit. Do not permanently store generated audio or keepsakes, and do not build a recording-retrieval service. Keep the temporary recording available long enough for playback and download retries during the visit, then clear it when the session ends or expires.

**Why:** The owner explicitly corrected the conflicting saved-recording/finalisation notes and instructed that the emailed link is for beginning creation, not retrieving previous downloads.

**How to apply:** Preserve voucher access independently. Enforce only the
approved minimal two-creation purchase allowance, not identity locks, archived
outputs or durable saved-output finalisation. Keep genuine payment authorisation
and reasonable request-abuse protection distinct from temporary generated output.

Use Resend for purchase-access email from `santa@santaradio.co.uk`, not `santa@studio.santaradio.co.uk`. Stripe continues sending payment receipts. Brevo is not approved for purchase-access email.

**Why:** The owner chose Resend, confirmed the already verified root-domain sender, and confirmed that the authorised plain-text delivery test arrived in their inbox.

**How to apply:** Preserve the approved sender rather than reopening subdomain/DNS setup. Supply credentials securely and verify the deployed paid-return flow separately; sender-test delivery is not proof that the paid delivery contract works.

Keep private Studio return emails plain text rather than requiring changes to the domain's global tracking configuration.

**Why:** Resend documents link rewriting for HTML messages, and plain-text-only emails cannot contain its open-tracking pixel. A tracking setup dialog can show checked defaults without establishing active tracking.

**How to apply:** Introducing HTML or provider templates requires revisiting tracking and capability-link privacy before release.

The owner confirmed that Santa Radio's Vercel hosting is on Pro or Enterprise, without identifying which of those two tiers.

**Why:** They confirmed the plan when choosing a five-minute email retry schedule; the existing connection can manage project settings but cannot inspect billing.

**How to apply:** Do not assume Hobby limits or purchase an upgrade on the owner's behalf. Reconfirm schedule support if the hosting account or plan changes.

The owner authorises public live website purchasing for everyone, superseding the previous sandbox-only website restriction. This does not authorise native purchasing changes, replacing the existing live product, deployment, or agent-submitted real-money charges.

**Why:** The owner explicitly requested the website's transition to public live payments, with release blockers resolved before activation.

**How to apply:** Keep sandbox isolated in development. Keep public sales disabled until the exact live offer, delivery contract, durable access, secure email return and production readiness are verified. Preserve voucher entry and access independently of Stripe configuration, errors and the new-sales switch. The one-child offer decision above resolves the earlier family-offer mismatch; do not reintroduce it as an unanswered question.

Sandbox Purchase controls and development-only explanations must never appear on public/published sites. Keep clearly labelled test checkout in development. The owner has separately approved building public live payments, but retain the closed-sales promotion and independent voucher access until the payment/access flow is validated, email is configured and publication is explicitly approved.

The owner requested removal of the “Studio A” and “Studio B” references from public wording; keep the free greeting and bespoke bundle distinct without those labels.

**Why:** The owner wanted fewer words and simpler recording indicators.

**How to apply:** Retain generic Studio branding, but do not reintroduce lettered Studio labels in public copy.

The Studio promotion must show £6.50 for two bespoke messages from Santa as a
clear, integrated offer near the creation/purchase controls, not a tiny isolated
“Price £6.50” badge at the bottom. This is the price for both messages, not each.
There is no Black Friday deal yet; do not advertise £4.50, savings or a scheduled
future offer.

**Why:** The owner corrected the earlier seasonal-offer direction, then rejected
the small price badge and asked for professional marketing presentation that
clearly explains “£6.50 to generate 2 bespoke messages from Santa”.

**How to apply:** Keep both shared promotional placements consistent without changing the live Stripe product or payment amount. Runtime readiness, not a promotional date or old sandbox-only notice, controls whether purchasing is available.

The preferred direct Studio address should show the same complete promotional heading and panel as the homepage to visitors without access, rather than only a private-code card. The private email return remains a secondary control; the creation journey remains inaccessible until server-confirmed voucher or paid access.

**Why:** The owner identified the bare gate as the wrong first impression for a direct visitor and explicitly wanted the complete current offer without undoing its approved presentation.

**How to apply:** Keep both entrances on the shared promotion, including changing examples and name counts. Do not turn promotional visibility into maker access, index the private route, or make purchase-return links redeem without an explicit action.

