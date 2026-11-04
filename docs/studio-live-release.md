# Studio live payments: controlled release checklist

## Current release state

**Public sales are disabled. No production deployment or real charge has been performed by the agent.**

The owner approved changing the £6.50 offer from the previously proposed family bundle to **personalised content for one child**: an MP3, Nice List certificate PDF, Santa letter PDF and Santa picture PNG.

**Owner clarification:** the emailed link admits a verified paying customer to Studio to **begin creating**, not to retrieve saved audio or previous downloads. The customer creates, plays and downloads during that visit. Generated MP3s and keepsakes must not be permanently stored; no recording-retrieval service or durable saved-output finalisation is authorised. Earlier conflicting project notes have been corrected.

Keep the temporary browser recording available for playback and repeated download attempts during the visit, then clear it when the visitor leaves or their access expires. Server working files are deleted after rendering; generated keepsakes are browser-local. Paid entitlement records and email-access tokens are separate from generated output and do not constitute an audio archive. Preserve independent voucher access unchanged. Production commissioning and delivery checks below still block sales; this clarification does not authorise deployment or activation.

Read-only verification on 4 November 2026 confirmed the existing live account, active product and active one-time GBP price below. The existing product description does not promise multiple children. Nothing in Stripe's live catalogue was created or changed. Recheck immediately before release.

The approved Resend sender is **Santa Radio <santa@santaradio.co.uk>**. The root domain is already verified; no new subdomain is needed. A separate sending-only key supplied by the owner was accepted for a simulated test and a separately authorised plain-text inbox test. The owner confirmed inbox arrival and supplied a screenshot. This establishes delivery to that inbox, **not** successful production paid-return delivery. The workspace's managed Resend connection belongs to another account; do not use it for Studio or replace unrelated integrations.

## Vercel production configuration

Use Vercel's encrypted/sensitive environment settings, **Production target only**. Workspace secrets do not configure Vercel. Never put credentials into git, public variables, source, browser bundles, task descriptions, command output or screenshots. Keep Preview and Development without live credentials or sales approval. Do not replace sandbox integration credentials.

Non-secret configuration:

| Variable | Required value |
| --- | --- |
| `STUDIO_LIVE_ORIGIN` | `https://www.santaradio.co.uk` |
| `STUDIO_LIVE_ACCOUNT_ID` | `acct_1SSOVl8OzIo5fGDT` |
| `STUDIO_LIVE_PRODUCT_ID` | `prod_VWf75hpXU4wuRq` |
| `STUDIO_LIVE_PRICE_ID` | `price_1UVbmo8OzIo5fGDTEfPyRcBq` |
| `STUDIO_LIVE_SALES_ENABLED` | `false` during setup; `true` only for the approved release |
| `STUDIO_LIVE_DELIVERY_APPROVED` | `santa-message-maker-one-child-v1` only after checking all four outputs |
| `STUDIO_LIVE_WEBHOOK_ID` | The production endpoint's `we_…` identifier |
| `STUDIO_EMAIL_FROM` | `santa@santaradio.co.uk` |
| `STUDIO_EMAIL_SENDER_APPROVED` | `true` after verifying sender/key and real-inbox delivery |
| `STUDIO_EMAIL_RETRY_APPROVED` | `true` for approved worker commissioning with sales off; recurring successful heartbeats must then be verified |

Secret configuration:

- `STRIPE_LIVE_SECRET_KEY`: owner's live key for the verified account, able to read account/balance/product/price/events/webhook endpoint, create/retrieve Checkout Sessions and retrieve expanded PaymentIntents. Test keys fail closed.
- `DATABASE_URL`: the **confirmed production** durable PostgreSQL database, never inferred from a workspace environment label.
- `STUDIO_RETURN_SECRET`: independent cryptographically random secret of at least 32 characters. Generate securely; retain and back it up. It binds checkout claims, email lookup hashes and return tokens. Do not casually rotate it: rotation requires a planned migration/recovery of existing purchases and outstanding emails.
- `STUDIO_LIVE_WEBHOOK_SECRET`: the signing secret of the exact live endpoint below, not the sandbox secret.
- `RESEND_API_KEY`: a sending key for the verified `santaradio.co.uk` domain in the owner's correct Resend account.
- `CRON_SECRET`: independent cryptographically random secret of at least 32 characters for the authenticated retry worker.

Retain all existing voucher settings, free-message settings and Studio recording/assets configuration unchanged.

## Database migration — explicit approval required

1. Confirm the database destination privately with the owner. A workspace labelled “production” is not evidence that it is the Vercel production database. The owner previously confirmed that Vercel uses the Replit-managed production database; reverify if that binding changes.
2. `database/santa-studio-live.sql` is the **development schema source**, not a custom production migration. The existing post-merge development setup runs `scripts/setup-studio-live.mjs --development` after merge. The script refuses actual Vercel/Replit deployment runtimes and production Node mode. It creates only dedicated tables and preserves existing records and sales settings on repeated runs.
3. Back up the approved destination through its supported process. For this Replit-managed production database, use the supported, separately approved production schema-sync/publish flow after reviewing the **whole** pending schema diff. Do not run this SQL file, a custom DDL script, startup migrations or build hooks against production, even though the website itself is hosted on Vercel. Do not select overwrite-data or approve unrelated destructive changes. If the supported flow is unavailable, keep sales disabled and resolve that hosting/setup blocker rather than bypassing it.
4. Schema synchronisation does not copy development rows into production. An authorised operator must initialise the production sales switch **off** using the following data-only statement through approved production administration: `INSERT INTO public.santa_studio_live_sales_settings(key, enabled) VALUES ('public', false) ON CONFLICT (key) DO NOTHING;`. This does not overwrite an existing switch or copy test purchases. Turning it on is a separate, final release action.
5. The new schema does not alter vouchers, sandbox receipts, native purchases, free access or audio retention. Run readiness against the serving environment: it checks expected columns, primary/unique/foreign-key constraints, all required privileges and read-write connection mode. Never silently substitute memory for these tables.

There are no startup/build-time migrations, generated-message counters or permanent MP3 storage. The separate legacy storage diagnostic is not proof of live-payment readiness.

## Webhook setup — sales still off

After the code is merged and a deployment is separately approved, configure the existing live Stripe account to deliver to:

`https://www.santaradio.co.uk/api/stripe/webhook`

Required event types:
- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`

Store that endpoint's ID and signing secret in the production settings. Do not reuse the workspace-managed sandbox webhook or its secret. The handler requires the raw signed request body, a live event, and retrieval of the canonical event through the verified live account.

**Bootstrap signed delivery before enabling sales:** resend an existing genuine live event from this account to the endpoint using Stripe's dashboard/operator tooling. A previously paid unrelated Checkout event can establish transport health but cannot grant Studio access without our durable claim and exact offer. Alternatively temporarily subscribe an existing historical non-payment live event type and resend that event; remove the temporary subscription afterwards. Do not invent a payment or change the live product to manufacture an event. A sandbox “test event” cannot establish live readiness.

Check a successful HTTP response and the durable webhook-health row. The health proof is bound to the signing-secret fingerprint; changing the secret requires a new genuine signed delivery. The readiness check also checks that the deployed live webhook handler is reachable. Never seed health rows manually to bypass delivery.

## Resend and retry worker — sales still off

1. In the correct Resend account confirm `santaradio.co.uk` is verified and sending is enabled. Receiving can stay disabled.
2. Keep these security emails **plain text only**, without HTML, provider templates, contacts/audiences or third-party link wrappers. [Resend documents](https://resend.com/docs/dashboard/domains/tracking) click rewriting for HTML emails and states that plain-text-only emails cannot contain its open-tracking pixel. Changing domain-wide tracking settings is therefore **not required** for the current sender. Do not add/verify a tracking subdomain just to alter checkboxes in its setup window. If HTML/template email is introduced later, verify tracking is disabled before releasing it; the plain-text payload is protected by an automated test.
3. `vercel.json` prepares Vercel Cron to call `GET /api/santa-studio-email-retry` **every five minutes**. The owner confirmed Pro or Enterprise hosting; no plan upgrade is authorised or needed on that report. The native scheduler must send `Authorization: Bearer <CRON_SECRET>` using the configured production secret. The schedule does not run until the code is merged and a deployment is separately approved. Reconfirm plan compatibility if the project/account changes; Hobby's daily schedule is insufficient.
4. During separately approved worker commissioning, leave **both sales switches off**, set `STUDIO_EMAIL_RETRY_APPROVED=true`, and run the worker once after the database and webhook configuration are ready. This flag permits the worker to start; it is not proof the schedule works. With no queued customer email, the worker sends a simulated Resend recipient probe and records sender health. This does not email customers or generate an access link.
5. Confirm recurring executions. New sales require a successful retry-worker heartbeat in the previous 15 minutes and accepted sender delivery within 48 hours. A stopped worker shuts off new sales once its heartbeat becomes stale. Existing access, voucher access and redemption of previously issued valid links remain independent.
6. Validate real-inbox delivery using an owner-approved address in sandbox/release verification. No customer messages or real payment should be initiated by the agent.

The outbox queues only confirmed purchases. Tokens/emails are never persisted in plaintext: email addresses are keyed hashes, bearer tokens are hashed, and an HMAC over a random nonce allows retry without a plaintext token archive. The sender retrieves the original Checkout email through the verified Stripe account. Concurrent delivery uses a row lock and stable provider idempotency key. Failed delivery remains retryable with backoff; it does not undo entitlement.

Private links carry the token in a URL **fragment**, not a query parameter. Studio removes it from the address bar immediately. Only the visitor's explicit POST consumes it, atomically once, and sets an HttpOnly Secure host-only cookie permitting entry to begin creation. It never restores old recordings or downloads. A 24-hour link expiry does not expire the purchase. A purchaser can request a fresh entry link without an account. Someone with an unused forwarded link can redeem it first: this is a bearer-link system, not proof of identity or an account login.

## Verification before release

- `npm run test:studio-live` — actual isolated disposable PostgreSQL cluster, never the project database; requires the configured PostgreSQL binaries.
- Existing Stripe sandbox, checkout and paid-access unit tests.
- Existing workshop/voucher and temporary Studio audio tests.
- `npm run build` — production browser, SSR and generated public pages.
- `npm run test:studio-promotion-production` — both promotional placements, wrong-mode rejection, runtime live availability, mobile control bounds, preserved voucher controls and safe checkout refusal.
- `npm run test:function-layout` and `npm run test:dependency-portability`.
- Existing Studio offer/gift browser tests, including MP3, certificate PDF, Santa letter PDF and Santa picture PNG.
- `node scripts/verify-studio-sandbox-isolated.mjs --run-sandbox-payments` uses genuine hosted **test-mode** Checkout and a disposable database. Existing unit/browser checks cover cancelled/unpaid/forged returns, reuse and the same Studio journey. Do not run a real-money payment from automation.
- Verify direct production SSR **and** client-side navigation; no sandbox instructions, test cards, stale countdown, family claim or “coming soon” lockout in public paid copy.
- Verify invalid voucher feedback, valid voucher entry and Studio use with Stripe absent, unavailable and sales switched off. Existing voucher users must never be sent to Checkout.
- Verify email redemption, reused/expired/forged tokens, fresh link request without account enumeration, original purchase browser access, closed-tab webhook reconciliation, email retry and new-sales shutdown.
- Run `npm run check:studio-live-readiness` in the **configured serving runtime**, not as a website build prerequisite. Do not fake `VERCEL_ENV` in previews to make it pass. It fails with safe reason codes while any release requirement is missing.

## Controlled activation

All above items and an explicit fresh deployment approval are required. Merge does not authorise deployment. Keep sales `false` for setup/verification deployments. Only on the separately approved release set the environment switch `true` and apply that production environment through the approved deployment process. The dedicated database switch must also be explicitly enabled by the authorised operator (`UPDATE public.santa_studio_live_sales_settings SET enabled=true WHERE key='public';`). Both switches must allow sales. Recheck server readiness on both promotions before announcing availability.

The **owner**, not the agent, then performs the real £6.50 purchase. Confirm amount/currency/product, successful live session and PaymentIntent, webhook event, one durable entitlement, immediate Studio opening, all advertised downloads, actual backup email and secure return after closing the original browser. Retain a concise pass/fail checklist without private tokens, session cookies, email addresses or credentials.

## Stop sales / rollback

- Set `STUDIO_LIVE_SALES_ENABLED=false` on Vercel and apply it through the approved configuration/deployment process. Vercel environment changes are not an instant runtime kill switch on an already-built deployment.
- Existing paid cookies/return links and vouchers do not consult this sales switch. Do not remove their database, secret or routes.
- For an **immediate** server-side sales stop without redeploying, an authorised operator sets the dedicated durable switch off:
  `UPDATE public.santa_studio_live_sales_settings SET enabled=false WHERE key='public';`
  Its migration default is off. Starting checkout holds a shared lock on this row, so after the disabling update commits no new session can be created. Existing paid access and vouchers never read this flag.
- Previously opened Stripe Checkout Sessions may still be payable; an authorised operator should expire outstanding **open Studio sessions only** if an emergency requires stopping those too. Never expire unrelated checkouts or submit refunds automatically.
- Do not roll back to old sandbox-only production handlers after accepting live payments: that would lock out paid guests. Prefer disabling new sales while retaining live access/return/webhook processing.
- Do not drop live purchase/outbox tables or rotate stable secrets as a rollback. Audio remains temporary throughout.

## Outstanding operator-only release gates

Production-only standby settings have been prepared in the verified Vercel project for the approved origin/account/offer and sender. `STUDIO_LIVE_SALES_ENABLED=false` and `STUDIO_EMAIL_RETRY_APPROVED=false`; delivery approval has not been enabled. Independent return-link and scheduler secrets were generated directly into Vercel's sensitive-variable storage, without exposing their values or copying sandbox credentials. Preserve these stable secrets; arrange any required secure escrow before taking payments, because sensitive values cannot simply be read back later.

Existing production Stripe, Resend and database settings were preserved. Their presence was checked, not their decrypted values or successful operation in the deployed live flow. No production database schema change, live endpoint creation, running scheduler, deployment or real payment was performed. Read-only checks found no live-purchase tables in development or production; development setup is wired to the existing post-merge script. The owner confirmed Pro or Enterprise hosting after the connection could not read billing; the five-minute schedule is prepared in source but its execution still needs deployed verification. Until the remaining release gates are satisfied, public checkout stays disabled and voucher access remains independent.

## Implementation verification record — 4 November 2026

- Passed 24 live-payment/security/database/setup checks against disposable PostgreSQL instances, including voucher entry and access with Stripe absent, unavailable and shut off, plus development-only setup guards and idempotence.
- Passed the existing 80 sandbox/checkout/voucher/temporary-audio checks.
- Passed Vercel function-layout checks, including the five-minute retry schedule, and eight dependency-portability checks.
- Production browser/SSR/generated-pages build passed.
- Passed four production-browser checks for both promotion placements, exact runtime live availability, mobile purchase control bounds, explicit fragment redemption into live Studio, and valid/invalid voucher use during payment outage.
- Passed six Studio promotion layout checks and four isolated Studio gift-export checks on mobile/desktop. The gift checks exercise the actual PDF/PNG exports with controlled MP3 responses; they are not a production paid-generation/inbox test.
- A genuine hosted Stripe **sandbox** test payment of £6.50 GBP passed using a disposable entitlement database, with concurrent-session reuse, unpaid/wrong-claim rejection and idempotent verified access. No live key or project database was used by that test.
- The approved Resend sender accepted a simulated-delivery test and a separately authorised plain-text delivery test. The owner confirmed that the latter arrived in their inbox and supplied a confirming screenshot. This verifies delivery to that inbox, not the production paid-access/return-link flow or every customer's inbox placement. Domain tracking settings do not block the current plain-text-only sender.
- Running live readiness in this development workspace correctly failed with `STUDIO_LIVE_PRODUCTION_ONLY`; it was not bypassed by changing the workspace to pretend to be production.

Production payment, production database migration/credentials, genuine live webhook bootstrap, scheduled retry heartbeat, the production paid-access email/return flow and the owner's final real purchase remain **unverified** until the controlled setup/release steps above are performed.
