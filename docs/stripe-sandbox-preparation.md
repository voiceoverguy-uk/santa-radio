# Stripe sandbox payment preparation

## Verified on 28 October 2026

- The **Stripe API** connector is connected; this is not Stripe MCP.
- Both Agent's API call and the workspace connectors SDK returned `livemode: false` from `/v1/balance`.
- A separate test-mode “Santa Message Maker” product and active one-off **650 pence GBP** price exist:
  - Product: `prod_VWhiGsEihT5KxY`
  - Price: `price_1UVeIcEt5PrD6a7CdGtAEuM1`
- Running preparation twice returned the same product and price.
- The native server credential reader and standard managed webhook sync now work. The initial missing-key diagnosis was a response-field mismatch, not a proxy-only authentication restriction.
- One actual £6.50 sandbox Checkout payment was completed using Stripe's standard test card, and a separate unpaid checkout was expired. These were integration checks, not purchases through the website's Purchase button.
- Nothing was published. No live Stripe resource was read or changed.
- The homepage Purchase button now opens sandbox Checkout. A server-confirmed test payment opens the Studio UI and its protected choices. Free greetings, voucher access and Studio audio generation are unchanged.

## Workspace commands

```sh
node --test scripts/stripe-sandbox.test.mjs
node scripts/prepare-stripe-sandbox.mjs
node --test scripts/stripe-payments.test.mjs
node scripts/setup-stripe-sandbox.mjs
node scripts/verify-stripe-sandbox.mjs --run-sandbox-payments
node --test scripts/stripe-checkout.test.mjs
node scripts/verify-studio-purchase.mjs --run-sandbox-payments
```

Product preparation uses `@replit/connectors-sdk`. It refuses deployment/non-workspace execution, verifies explicit test mode before writes, uses tagged sandbox products and idempotency keys, and rejects ambiguous offers. Do not mount this preparation script as a public endpoint.

The setup script uses the standard `stripe-replit-sync` sequence: verify sandbox, migrate its schema, register/reuse the managed webhook, then backfill. Run setup explicitly in the development workspace; it is not a published-startup migration. The verification script requires its flag because it creates actual test sessions and completes a test-mode payment.

## Authentication correction

Read-only inspection of response **field names**, without printing values, found that
`/api/v2/connection?include_secrets=true&connector_names=stripe`
returns `settings.secret` and `settings.publishable`, not the template's `settings.secret_key`.

The server now accepts the current `secret` field and legacy `secret_key` name. It refuses missing/ambiguous connections, deployment execution and live keys, and separately verifies the Stripe balance response has `livemode: false`. Credentials are fetched fresh, used only server-side and never printed, persisted to application files or sent to the browser. This allows the unmodified package to use its normal supported authentication and managed signature verification. No package upgrade, proxy adaptation, reconnection, custom MCP server or owner action was necessary.

The installed sync package is the current npm version (1.0.0). Its documented 2020-08-27 API version is pinned for compatibility; Stripe emits an outdated-version notice. Actual sync and payment checks passed with that version. This is not a claim of compatibility with a newer API version.

## Notification and access checks

The raw-body `/api/stripe/webhook` delegates signature verification and processing to `sync.processWebhook()`. It rejects live-mode bodies, malformed input and missing signatures without granting any entitlement.

`/api/santa-studio-access` requires both a private 256-bit bearer claim and a fresh server-side retrieval of a completed, paid Checkout session. It verifies the exact existing test price/product, quantity, £6.50 GBP totals, one-off mode and successful PaymentIntent. It never trusts success query parameters, cookies alone, notification bodies or a stored entitlement alone. The application access table uses unique Checkout and PaymentIntent IDs; it does not duplicate the Stripe catalogue. No paid-access expiry or generation limit has been added.

Verified against the actual sandbox and PostgreSQL:

- Hosted Checkout completed a test-card payment for the existing price.
- The genuine Stripe-delivered notification automatically populated the synced paid Checkout session.
- Actual unpaid and expired sessions were denied.
- Forged and tampered requests to the real webhook route returned 400.
- Three concurrent, correctly signed replays of the genuine paid event returned 200 and left one synced Checkout record.
- The paid notification alone created no bearer entitlement.
- Four concurrent server-verified access claims created one entitlement.
- HTTP access required the correct private claim; a wrong claim or success query string granted no access.

Automated fixture/unit checks cover pending, failed, cancelled, live-mode, wrong-price, wrong-product, wrong-currency, wrong-amount, subscription, extra-item and missing-proof cases, plus stale signatures, ambiguous credential selection and fail-closed Stripe errors. These simulated cases are not reported as additional real sandbox transactions.

The original 35 Stripe automated checks and 15 free-message/voucher regression checks passed.

## Connected browser purchase flow

- Readiness creates an HttpOnly, Secure, signed random checkout claim. POST requires the configured development origin, rejects cross-site requests and accepts no client price or redirect override.
- PostgreSQL limits checkout attempts and serialises starts for each private claim. Existing open checkouts are reused, including concurrent clicks. Stripe idempotency keys protect retries if a database commit fails. Expired checkout sessions can be replaced; this does not limit paid access or regeneration.
- Before redirect, the server sets a separate HttpOnly Secure payment cookie. It is not payment proof: both the Studio gate and catalogue require the existing verified-payment check. Stripe returns to the fixed Studio URL; the private claim is never put in that URL.
- The tester-code path is checked first and retains its existing rules. Paid access does not inherit the tester expiry.
- Cancellation displays an explicit notice and grants no new access. Pending/unconfirmed returns stay locked with a retry check.
- The UI clearly says sandbox only, provides Stripe's standard test-card details and explains that this unlocks choices, not the unconnected bundle outputs or email delivery.
- Cookies are browser sessions; no paid entitlement expiry is introduced. Until secure return emails are implemented, use the same browser session to return.

The actual homepage button was tested through hosted Checkout, cancellation, retry, a successful test payment, automatic return to Studio, access to the protected catalogue, reload and repeat purchase clicks. Concurrent starts reused one session; the final entitlement count was one. A fresh browser with forged success parameters remained locked and received 403 from the catalogue.

All 64 current automated checks (Stripe, checkout, catalogue, vouchers and free MP3 generation) passed, as did the actual browser purchase journey and full browser/SSR build. The paid Studio UI was verified using browser automation.

## Not yet implemented

- A transactional email sender still needs connecting for secure guest return links.
- The separate extended audio-stitching demo is not connected to Studio selections; the family bundle outputs are not delivered.

Preserve the £6.50 live product, free greeting and tester-code path. Paid access must not inherit tester expiry rules or invented generation limits. Successful payment must be verified server-side, and cancelled, failed or pending payments must not grant access.
