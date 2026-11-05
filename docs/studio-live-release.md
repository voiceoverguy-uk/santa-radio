# Studio live payments: controlled release checklist

## Current release state

**Public sales are disabled. No production deployment or real charge has been performed by the agent.**

The £6.50 website purchase now includes **two successful creations**, each with personalised content for one child: an MP3, Nice List certificate PDF, Santa letter PDF and Santa picture PNG. The existing product, price and payment checks remain unchanged.

**Owner clarification:** the emailed link admits a verified paying customer to Studio to **begin creating within the remaining allowance**, not to retrieve saved audio or previous downloads. The customer creates, plays and downloads during that visit. Generated MP3s and keepsakes must not be permanently stored; no recording-retrieval service or durable saved-output finalisation is authorised. Minimal allowance accounting below is the only newly authorised exception to the earlier no-count rule.

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

There are no startup/build-time migrations or permanent MP3 storage. The separate legacy storage diagnostic is not proof of live-payment readiness.

### Two-creation allowance release requirement

`database/santa-studio-creation-allowance.sql` is an additional development schema source, included in the existing development-only post-merge setup. Review it in the separately approved **managed schema-sync** process described above before releasing this code. No production schema changes have been applied by this task. Missing storage fails closed for paid and limited-voucher generation; do not enable sales until the runtime readiness check passes. Website compilation does not require this table.

The allowance stores only an opaque verified purchase key (or expiring voucher visitor key), at most two opaque successful-operation UUIDs and one temporary fenced reservation. It does not use the retired generation tables, archive audio, lock names/destinations, save choices or track gift/download history. Existing purchases begin at zero known creations, without invented historical usage. The server returns safe counts only. Verified return links and newly issued access cookies resolve to the same purchase and cannot reset its allowance.

Only the owner-selected shared voucher uses the two-creation flow, per authorised visitor session, never globally. Its current non-secret configuration marker is slot **3** (`SANTA_STUDIO_TEST_CODE_3`); the server-only optional `SANTA_STUDIO_LIMITED_VOUCHER_SLOT` overrides that marker if the owner moves it. Never put the access-code value in source, documentation, test fixtures or logs. Credential rotation within the selected slot retains its limited policy. Starting another or re-entering that code while the signed session is valid preserves its identity and original expiry. A different browser/device, or a new visitor after expiry, is a new session, not a lifetime entitlement. Other vouchers remain unlimited subject to access validity and abuse limits.

The access-code literal used during implementation has been removed before completion. No live credential was rotated. If any working source/documentation containing it was shared outside the authorised project, rotate the selected slot's secret through the secure settings flow before release; this invalidates its existing voucher sessions, so coordinate that change with the owner rather than silently replacing credentials.

A slot commits once the complete MP3 has been prepared, immediately before sending the response. Failed or cancelled preparation releases its reservation; expired reservations are fenced against late commits. After a successful operation, duplicate requests report that completion rather than re-rendering or retrieving audio. A lost connection at/after the database commit can consume a creation even if the browser never receives it: no server can prove browser receipt or a saved file. Do not promise automatic refunds of uncertain deliveries. Completed operation IDs are bounded to two per allowance.

Gift download-request flags are individual and browser-local to each completed result. Previews, failed exports and cancelled reset dialogs do not set them. “Download requested” never proves device saving. Starting the second creation preserves the first MP3 and gifts without a discard warning. Review retains up to two recordings in creation order during the visit; after the second succeeds, the 1st/2nd gift buttons select that recording’s confirmed name, choices and unchanged letter wording. The new editable second preview stays locked until its own MP3 succeeds. Exhausted allowance and temporary recording-check failures do not remove local completed outputs.

While the second message is unfinished, a separate “First message gifts” disclosure keeps all three first-result previews and downloads available. This does not unlock the editable second preview. The first gift set remains available after a failed or cancelled second preparation.

Both MP3s and gift snapshots are cleared on an explicitly confirmed destructive reset, refresh, exit or real access expiry; the email link retains only remaining allowance, never either recording. Unlimited vouchers retain at most two temporary results, not an accumulating history. Starting another fresh pair requires confirmation to discard both, and any in-flight gift export blocks switching or reset.

#### Local verification of retaining both messages — 5 November 2026

- Isolated Chromium checks cover two distinct recorded recipients and confirmed written spellings, separate choices and letter wording, first-result playback/download during second composition, cancellation, failure/retry, successful second append, mutual playback exclusion and creation-order MP3 downloads.
- Actual certificate/letter PDFs and Santa-picture PNGs are exported for both gift selections. PDF text is checked against the matching recipient and preview wording; request indicators remain individual. Keyboard selectors and 320px/desktop layouts are covered.
- The existing allowance/browser regressions cover paid and limited-voucher exhaustion, lost responses, pending/failed access checks, real expiry, pending/failed exports and unlimited-voucher destructive confirmation. No customer allowance, live payment, production database or deployment is used.
- Preview screenshots cannot enter a real customer’s private Studio. Protected journey checks use authorised isolated browser fixtures with service-compatible selection headers. Real iPhone Safari and screen-reader behaviour remain unverified here.

After the separately approved production schema sync/release, verify a real canonical paid entitlement across an emailed return and cookie replacement, with two completions total and no third route. Confirm the selected voucher's same-session persistence and separate-browser independence without extending expiry. Production schema sync, deployment, live Stripe changes and real-money charges are outside this task.

#### Local verification of the two-creation change

- `npm run test:studio-audio`: **36 passed**, including the new disposable-PostgreSQL allowance tests. Fixtures cover concurrency, failure/cancellation release, stale fences, completed-operation retries, lost responses, expiry, non-secret slot selection, safe status and no recovery/archive.
- `node --test scripts/studio-creation-allowance.test.mjs scripts/santa-workshop-access.test.mjs scripts/studio-live.test.mjs scripts/studio-live-setup.test.mjs`: **55 passed**. The return-email fixture redeems fresh links into replacement credentials and verifies that remaining purchase allowance stays consumed.
- Existing live setup and workshop-access server suites passed using isolated fixtures; no live Stripe/API resources or production database were used.
- `npx playwright test --config playwright.workshop.config.js tests/santa-workshop-allowance.spec.js --project=chromium`: **12 passed** at desktop/mobile sizes. Includes a committed-but-lost response followed by an idempotent retry and deliberate fresh second creation, paid refresh, voucher flow, no/partial/all gifts, failed/pending export, keyboard focus loop, Escape/cancel/continue, MP3 warning, second-result exhaustion, READY and repeat downloads.
- `npm run build` and `node --test scripts/studio-promotion-production.test.mjs`: passed (all four production-style promotion/access checks).
- Broader pre-existing browser checks were also attempted: 25 gift/allowance cases passed before stopping at four older gift assertions (44px controls versus expected 56/58px; expectations that gifts survive expired access). Older READY cases likewise expect audio to remain after access expiry, contrary to the current retention requirement. The access suite additionally has old name-search/document expectations. These are not passing coverage for the new flow and were not used to weaken access expiry or alter unrelated layouts.
- `scripts/check-studio-release.test.mjs` has an unrelated exact build-command assertion that omits the existing private names-demo preparation step; the real complete website build passes. Function-layout checks passed.

Firefox/WebKit are not installed in this environment. The ordinary unsigned
Preview screenshot verifies the access gate, not a real purchaser's private
Studio. The protected flow was verified with isolated Chromium fixtures, not
a live purchase, real iPhone Safari, VoiceOver or a production schema change.

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
