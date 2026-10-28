# Stripe sandbox payment preparation

## Verified on 28 October 2026

- The **Stripe API** connector is connected; this is not Stripe MCP.
- Both Agent's API call and the workspace connectors SDK returned `livemode: false` from `/v1/balance`.
- A separate test-mode “Santa Message Maker” product and active one-off **650 pence GBP** price exist:
  - Product: `prod_VWhiGsEihT5KxY`
  - Price: `price_1UVeIcEt5PrD6a7CdGtAEuM1`
- Running preparation twice returned the same product and price. No checkout sessions or payments were created.
- Nothing was published. No live Stripe resource was read or changed.
- The homepage Purchase button, free greetings, voucher access and Studio audio remain unchanged.

## Workspace commands

```sh
node --test scripts/stripe-sandbox.test.mjs
node scripts/prepare-stripe-sandbox.mjs
```

Preparation uses `@replit/connectors-sdk` rather than raw credentials. It refuses deployment/non-workspace execution, verifies explicit test mode before writes, uses tagged sandbox products and idempotency keys, and rejects ambiguous offers. Do not mount this preparation script as a public endpoint.

## Managed-sync compatibility blocker

The documented managed credential endpoint
`/api/v2/connection?include_secrets=true&connector_names=stripe`
responded successfully but did **not** provide `settings.secret_key`. The template check returned `STRIPE_MANAGED_SECRET_MISSING`.

The connected integration's own instructions instead specify the credential-free connectors SDK proxy. That works for API requests, including sandbox product and price creation. However, installed `stripe-replit-sync` requires a raw `stripeSecretKey` and does not expose a proxy/client injection option in its public configuration.

Do not invent credentials, feed placeholder keys to the sync engine, request secrets in chat, switch to live Stripe Marketplace setup, or claim webhooks are ready. Managed webhook setup, sync migrations and backfill have not run.

If the platform continues to provide only proxy authentication, the owner can ask Replit support how this native sandbox connector is intended to supply authentication to `stripe-replit-sync`. Provide the exact missing-setting error above; no credentials need to be shared. Keep the working sandbox API connection intact.

## Not yet implemented

- The Purchase button is not wired to checkout.
- Durable, idempotent purchase entitlements and server-verified paid-session handling are not implemented.
- No payment outcome grants access.
- A transactional email sender still needs connecting for secure guest return links.
- The separate extended audio-stitching demo is not connected to Studio selections; the family bundle outputs are not delivered.

Preserve the £6.50 live product, free greeting and tester-code path. Paid access must not inherit tester expiry rules or invented generation limits. Successful payment must be verified server-side, and cancelled, failed or pending payments must not grant access.
