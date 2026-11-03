# Workshop tester access

This friends-only Studio gate is separate from free Santa signup and staff
authentication. It is not paid voucher redemption, and does not make shipped
JavaScript bundles or public recordings confidential.

## Server configuration — each hosting environment separately

Preserve the owner's five intended, distinct codes in server-only secret slots:
`SANTA_STUDIO_TEST_CODE_1`, `SANTA_STUDIO_TEST_CODE_2`,
`SANTA_STUDIO_TEST_CODE_3`, `SANTA_STUDIO_TEST_CODE_4`,
`SANTA_STUDIO_TEST_CODE_5`. Each active code must be 1–80 characters after
trimming; matching is case-sensitive and trims surrounding whitespace.

The additional shared school voucher belongs only in the previously unused
server secret `SANTA_STUDIO_TEST_CODE_6`. Preserve slots 1–5. Slot 6 is valid
from 3 November 2026 at 00:00 UK time until **11 November 2026 at 00:00 UK
time, exclusive** (`2026-11-11T00:00:00Z`). Its dates are fixed in server
configuration, not calculated from redemption. No voucher value belongs in
source, documentation, fixtures or logs. Each parent's session has its own
message allowance; the shared voucher is not consumed by another parent.
The private usage report monitors every active configured code in slots 1–6.
Use the existing five configured codes in slots 1–5 rather than creating extra
slots or overwriting them.

Set the non-secret `SANTA_STUDIO_TEST_EXPIRES_AT` to
`2026-11-30T23:59:59Z` (end of 30 November 2026, UK time). The handler requires a
parseable expiry. Do not extend the approved deadline to resolve a closed test.
`SESSION_SECRET` must be at least 32 characters; preserve the existing signing
secret if valid. Never prefix these settings with `VITE_`.

`SANTA_WORKSHOP_PASSWORD` is retired and ignored. Do not copy it into a numbered
slot or replace the owner's codes with newly generated ones as a recovery step.
Use secure Secrets tools/settings only, never chat, source, shell arguments,
screenshots or logs. Do not export or print the environment.

Workspace Secrets and shared variables **do not configure Vercel**. Identify the
Vercel project serving `www.santaradio.co.uk` by its assigned domain, not just its
name. In that project's Settings → Environment Variables, check Production
scope, including any applicable custom-environment overrides. Preview and
Development are independent targets. Check presence first; inspect validity
only in a trusted server-side process that emits boolean results, never through
browser automation or by dumping decrypted API responses.

Vercel environment updates apply to new deployments, not the already-serving
deployment. Obtain separate owner approval for production environment changes
and a production redeployment. Never silently deploy, reset codes, or assume a
current project setting proves what a previous deployment received.

## Persistent attempt-limit storage

### Read-only release readiness

Run `npm run workshop:preflight -- --database` to check the current workspace
binding. The report explicitly labels this `workspace`; it is **not** evidence
that the live Vercel website is ready.

The check now covers the persistent attempt limiter, both Studio generation
tables (including the recording timestamp column), and the voucher-usage table.
It checks required columns without reading records, application-role permissions,
unique keys and row-security assumptions. Each subsystem uses a separate
read-only transaction and rolls it back, including on failure.

`entryReady` describes the mandatory security limiter; `recordingReady` also
requires recording storage; `reportingReady` requires generation and usage
storage. A reporting failure does not mean valid vouchers must be denied.
The overall `ready` flag requires all three subsystems, so the release check
exits unsuccessfully when any is missing. These are schema/permission checks,
not proof of a successful voucher redemption or MP3 render.

Before checking the live site, an authorised operator must confirm the actual
serving Vercel deployment's existing database resource/binding. Replit's published
copy and its production SQL callback are not proof of the Vercel binding.
In a trusted runner already securely bound to that verified Vercel Production
environment, use:

```
npm run workshop:preflight -- --database --target=vercel-production --expected-host=CONFIRMED_HOST --expected-database=CONFIRMED_DATABASE
```

Only non-secret host/database identifiers belong in these arguments; never put
a connection string or password there. The check compares them internally with
the bound connection and requires Vercel Production runtime markers. A mismatch
stops the check before querying storage. These markers are not independent
proof of the binding: never set them in Preview just to make the check pass.
`liveStorageReadinessVerified` stays false for workspace-only or incomplete checks.
No database credentials, connection addresses, records or raw exceptions are
printed. This check never provisions a database, migrates production or publishes.
For Replit-managed schema changes use the supported Publish schema-sync flow;
publishing that copy does not deploy the www website's Vercel code.

`DATABASE_URL` must point to the existing application PostgreSQL database.
`santa_name_request_limits` needs `bucket_key` (unique/primary key), `attempts`
(integer, default 1), and `expires_at` (timestamptz). The application role needs
SELECT, INSERT, UPDATE and DELETE permissions. See
`database/santa-name-requests.sql`. Do not create/alter tables at request time or
run that development schema against production as a recovery shortcut.

Missing storage fails closed on POST; there is no in-memory fallback. GET checks
configuration and cookies only: a healthy GET does **not** establish database
readiness. Check the database associated with the actual deployment, read-only;
the workspace database is not proof of Vercel database readiness.

### Connecting the existing production database to Vercel

When Vercel has no `DATABASE_URL`, first confirm which existing production
database should serve this site and check its limiter table read-only. Do not
provision a replacement or copy a development connection as a shortcut.

The task view can hide production database controls and instead display
"Production database unavailable" with a "Switch to main" button. In that case,
switch to main first; this restriction is not evidence that the database itself
is down. Read-only production queries can still succeed from the task.

For this project's Replit production database, the owner can open the main view's
Tools → Database → Production Database → Settings and copy the existing
production connection string directly into Vercel's secret `DATABASE_URL`,
scoped to Production. Preserve the complete connection string, including its
SSL parameters. Do not reveal it in chat/screenshots or regenerate credentials.
Replit's production connection supports external PostgreSQL clients; its current
development connection is app-scoped and is not an external-hosting substitute.
See the official [connection details](https://docs.replit.com/features/data-and-storage/connection-details).

Review all required access settings and database prerequisites together before
requesting a redeployment. Saving a connection string alone does not update the
serving Vercel deployment; use the separately approved redeployment, then check
status read-only and ask the owner to test a real code privately.

## Safe preflight

Run `npm run workshop:preflight` in a trusted process with the **target server's**
environment already injected. It prints only fixed check names, slot numbers and
booleans. It checks active-code bounds, duplicate IDs/codes, expiry parsing,
signing-secret requirements, the approved deadline and whether the test is open.
An inactive slot can represent deliberate revocation; confirm it with the owner.
At least one active code is needed; normally all five intended codes are active.

`npm run workshop:preflight -- --database` additionally performs a read-only
transaction: column presence, unique conflict key, default attempts and role
privileges, without reading records or consuming attempts. It conservatively
flags row-level security for manual policy review. It never prints database
credentials or raw errors. A nonzero exit means a requirement needs attention;
configuration and storage results are separate. Do not enable command tracing
or use environment-dump/debug modes when running it.

Do not expose preflight diagnostics as a public API. The public status endpoint
intentionally does not reveal which secret is missing or which code slot matches.

## HTTP contract and failure diagnosis

- `GET /api/santa-workshop-access` returns `{ "authorized": false }` for a
  configured, open test without a valid session, or `authorized: true` with
  `expiresAt` for a valid signed cookie. It never consumes an attempt.
- `POST` accepts same-origin JSON containing exactly one field: `code` (string,
  up to 80 characters after trimming). The former `password` payload is rejected.
- Success sets a signed HttpOnly, SameSite=Strict session cookie, Secure on HTTPS.
  It has no persistent expiry attribute. Signatures expire after 12 hours or the
   applicable code deadline or global test deadline, whichever comes first.
   Slot 6's earlier deadline is enforced on every session check, generation and
   request to start another test message; it does not shorten slots 1–5.
   Browser restoration may retain the cookie
  but cannot extend this limit.
- Removing or replacing one numbered code revokes only that slot's existing
  sessions once the new environment is running. Remaining codes stay usable.
  Rotating `SESSION_SECRET` revokes all sessions. Removing every code fails closed.
- 400: malformed/bounded request; 403: origin protection; 401: invalid code;
  410: configured test has closed; 429: persistent attempt limit reached.
- 503 with “Tester access is not configured yet. Please try again later.”:
  invalid/missing server configuration, **before code comparison or database use**.
- 503 with “Workshop access is temporarily unavailable. Please try again.” on
  POST: storage/service failure, not evidence the code is wrong. Do not bypass
  the limiter. The form uses a generic 503 message and stays locked.
- PostgreSQL limits all well-formed submissions to 10 per client address and
  150 globally per 15-minute window, atomically across instances/restarts.
  Vercel's platform-controlled address header is used there; other servers use
  the socket address, conservatively grouping proxied clients.
- API/workshop documents are no-store and noindex. SSR/static output is locked;
  the builder mounts only after client verification. Vite development, preview,
  built Node and Vercel use the same access handler.

## Recovery acceptance

After an approved production configuration update and redeployment, perform a
read-only GET on the www status endpoint: expect 200 with `authorized: false`
in a fresh session while the approved test is open. Separately confirm storage
readiness. Have the owner enter their real code privately on the homepage,
confirm the workshop opens, then refresh and confirm session persistence.
 Never enter real codes in recordings, screenshots or logs. For a private
 target-environment entry check, use a trusted server-side process that submits
 the injected secret directly and emits only success/expiry checks, with no
 request tracing, cookie output or response-body logging.
Record when production checks remain blocked by permissions or approval;
local success alone does not mean live access has been restored.

## Focused automated checks

`npm run test:workshop-access` covers configuration failures, safe preflight,
cookies, request protection and fail-closed responses. The concurrent persistent
limiter check runs only when a development database is available; it writes and
cleans temporary buckets. **Never run this test suite against production.**

`npm run test:workshop -- tests/santa-workshop-access.spec.js` starts an isolated
Vite server with generated ephemeral codes and signing secret, never owner codes.
It uses the real code endpoint, not an authentication bypass, and needs a
development attempt-limit database. Do not enable traces or request-body logging.

After `npm run build`, the same browser suite can run serially in other modes:

```sh
WORKSHOP_SERVING_MODE=node npx playwright test --config playwright.workshop.config.js tests/santa-workshop-access.spec.js
WORKSHOP_SERVING_MODE=preview npx playwright test --config playwright.workshop.config.js tests/santa-workshop-access.spec.js
```

Each uses port 5001.

## School tester entry and readiness

In the configured environment, invited parents can open
`/santa-message-workshop`, enter their privately supplied voucher, press
**Create your bespoke message**, choose the seven message details (Talent can
be skipped), review, confirm **Create message**, and use **Download MP3**.
No checkout, staff login or adult free-greeting signup is required for this
voucher path. Save the MP3 before starting another test. Saved files remain
playable after testing closes.

On 3 November 2026 the **Replit workspace preview** was configured with the
sixth secret using the secure Secrets form. A private server-side check
submitted the injected voucher to the actual preview access endpoint, verified
the signed session, bounded expiry, catalogue access and fresh two-success
allowance, and confirmed two redemptions issue different sessions. This check
can be repeated with `node scripts/verify-school-voucher.mjs`; it emits only
fixed environment/check labels and booleans, never voucher or cookie values.

Separately, the isolated browser suite used an ephemeral school-slot voucher
through the real form and hosted long-form generation endpoint, decoded and
played the resulting audio, saved the MP3, and verified a second parent's
allowance was unspent. Real school browser tests run only within the fixed
window; deterministic server tests always cover before/at/after the deadline.

**Vercel production was not configured, deployed or verified for this change.**
After owner approval, add the same privately held voucher as server-only
`SANTA_STUDIO_TEST_CODE_6` in the correct Vercel project's Production scope,
preserve the existing five codes, signing secret, database and global deadline,
and deploy the merged code with separate approval. Then verify actual private
voucher entry and MP3 generation there before inviting live-site testers.

## Private school voucher usage report

Open **`/request-names`**, sign in with the existing approved staff account,
and scroll to **Voucher usage** (or bookmark
`/request-names#school-voucher-usage`). Select **Refresh totals** for current
figures. The report shows a separate breakdown and configured code for each
active voucher slot. It uses the same verified-admin permission as the name-request
ledger. A tester voucher or an unapproved signed-in account cannot read its API.

- **Voucher entries**: successful new voucher logins, not unique parents.
  Refreshing/checking an existing session is not another entry.
- **First recordings**: successful initial MP3s for tracked message sessions.
- **Corrections**: successful second recordings, counted separately.
- **Total recordings**: first recordings plus corrections.
- **Another test started**: deliberate new test sessions, not extra voucher entries.

Counts for slots 1–5 begin when multi-code tracking is enabled; pre-existing
sessions and their earlier usage are not backfilled. Previously tracked school
voucher sessions and their successful recordings are retained. Failed
generations, idempotent replays, repeat downloads and playback do not increase
recording counts. Preview totals can include automated verification traffic;
they are not live parent counts. The report remains available after a voucher
closes.

Usage storage contains only an opaque session key, slot number, event kind and
timestamp. It stores no voucher values, cookies, IPs, emails or children's
details. The approved-admin-only usage response includes each active configured
voucher code so the owner can copy it from the private report. The codes remain in
server-only secret configuration; it is not in frontend source or public APIs.
Recording totals are aggregated from existing successfully committed results,
so they cannot be inflated by failed rendering or HTTP retries.

Development setup: `node scripts/setup-workshop-usage.mjs --development`.
Post-merge setup runs this idempotently. The new table in
`database/santa-workshop-usage.sql` must also be applied to the existing live
database through a separately approved production migration before deploying
this feature to Vercel. It adds recording timestamps used to exclude
pre-tracking generations when an old session deliberately starts another test.
Usage reporting is not an authentication prerequisite. A usage-storage failure
emits a private, sanitised `voucher_usage_unavailable` event and valid voucher
entry continues. Code validation, expiry, origin checks and the shared persistent
security limiter still fail closed. Usage totals can be incomplete during a
reporting outage; do not present them as a complete historical count.

Tests: `npm run test:workshop-usage` (persistent counters test uses only the
development database and rolls its fixture records back).
