# Missing-name request operations

## Staff access
The intended live staff URL is **https://www.santaradio.co.uk/request-names**.
Do not use `/free-santa-message/request-names`: that is not an alias.

In the website version being tested, open `/request-names`, choose **Sign in to view requests**, then sign in at `/sign-in`. If this is the first visit, choose **Create an account** at `/sign-up`, use **admin@santaradio.co.uk**, and complete the email-verification step. That verified address must be the account’s primary email. Successful sign-in returns to `/request-names`.

The server independently checks this primary address for list reads, TXT downloads and Recorded actions. Other accounts and unverified addresses are denied. Visitor submissions do not require a Clerk login. Development and production Clerk accounts/settings may differ; do not assume a Preview account also exists in production.

## List operations
- Outstanding names sort by cumulative request count descending, then latest request.
- **Download TXT** downloads every matching entry in the selected Outstanding/Completed list, not just the current page. Unicode is preserved; download dates are UTC, screen dates are UK time.
- **Recorded** moves the name out of Outstanding and creates a completion snapshot with its request totals and dates. It does not upload or create a recording.
- A later genuinely new visitor request reopens that name, preserving its cumulative count and all earlier completion snapshots. Duplicate retries neither increase counts nor reopen it.
- There are no FTP, external-server or text-file uploads.

## Saving and retry
The normal missing-name state is **Request this name**. **Request saved** is shown only after a committed database save is acknowledged. A failure or unconfirmed reply offers **Retry name request**, never a false success. A stable session request identifier protects a retry even if the first committed response and its visitor cookie were lost. When browser storage is blocked, an in-page retry remains safe; the page warns not to refresh because it cannot remember the identifier across refresh.

## Development and publishing
Schema setup is an additive, explicitly development-only operation:
`node scripts/setup-name-requests.mjs --development`
It also runs through the post-merge setup. The application never creates or alters production tables at startup or request time. Replit-managed production schema changes require an approved Publish and reviewed database diff. Never choose an overwrite-data option merely to publish code. External database targets require their own approved migration/configuration process.

Preview verification does not publish anything. The www site is served by Vercel,
separately from the Replit deployment (`https://santa-radio.replit.app`). Publishing
the Replit deployment alone does not establish that www has changed.

Previously, every request-service exception produced the same message and attempted runtime DDL. Errors now log only a safe stage and code, never names, bodies, cookies or connection strings. Examples: `visitor-signing / SIGNING_NOT_CONFIGURED`, `save / DATABASE_NOT_CONFIGURED`, or database codes such as `42P01` (missing table), `42703` (missing column), and `42501` (permissions). Check the actual failing host’s diagnostics before asserting a cause.

## Staff document repair and evidence

Read-only live checks during this repair found:
- Vercel returned HTTP 500 / `FUNCTION_INVOCATION_FAILED` for `/request-names`,
  `/sign-in` and `/sign-up`.
- `/free-santa-message/request-names` returned 404, as intended.
- Anonymous `/api/name-requests` returned 401 with `noindex, nofollow`.
- `/api/__clerk/v1/environment` returned an HTML 404, not Clerk environment JSON.
  This is a separate unresolved live sign-in prerequisite.
- Vercel's connected API returned 403 for project inspection. Consequently its
  runtime logs, deployment inventory, environment-variable metadata and database
  target could not be inspected. Reconnecting is not offered by this connection;
  an authorised Vercel project administrator must check project/team access.
- Replit reports managed Clerk and a healthy public Replit deployment. Secret
  existence checks report the Clerk key names, session-signing key and database
  URL present, with neither proxy URL name present. This is **not** verification
  of Vercel's configuration, key pairing, production account or database.
- The managed production schema query was denied because the task context lacks
  authenticated production-database access. No production schema or data was changed.

The unmodified local production build reproduced `ENOENT` for the missing staff
HTML files, including `/sign-in/sso-callback`. The builder omitted the staff entry
pages while the document resolver accepted them. This confirms the local packaged
delivery defect, **not the internal cause of the live 500** without runtime logs.

The repair packages the three real React entry documents separately from public
canonical pages. Auth subpaths reuse their sign-in/sign-up entry document; no
callback-specific file is read. `/request-names` has no arbitrary subpages.
Vercel routes staff requests through the document handler before its filesystem
stage so direct refreshes consistently receive noindex and private/no-store
headers. Only the sign-in/loading shell is pre-rendered; no ledger data is built
into HTML. Server-side approval and database operations are unchanged.

## Minimum live handover — approval required

1. **Review and merge the code first. Do not publish or migrate without owner
   approval.** In the existing Vercel project serving www, confirm the linked
   repository/branch includes this repair, Build Command is `npm run build`,
   Output Directory is `dist`, and the committed `vercel.json` is used.
2. **Check existing authentication, without copying Preview credentials.**
   This project uses Replit-managed Clerk; retain the current Preview setup.
   An authorised operator must verify that the Vercel build receives the intended
   production `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_CLERK_PROXY_URL`, and that the
   function runtime receives the matching `CLERK_PUBLISHABLE_KEY` and
   `CLERK_SECRET_KEY`. Confirm the www domain is recognised by the intended live
   tenant. The code already uses host-derived keys and passes the proxy URL
   unconditionally. Replit-managed publishing injects production configuration
   for its own deployment; do not assume it configures a separate Vercel project.
   Resolve the observed proxy 404 by checking that
   `api/__clerk/[...path].js` is packaged and the `/api/__clerk/(.*)` rewrite reaches
   it. Check `/api/__clerk/v1/environment` returns Clerk JSON, not the site's 404.
   Do not rotate keys, change DNS, hardcode a proxy or create a replacement tenant
   as a guess.
3. **Verify the existing production database target.** An authorised operator
   must confirm Vercel's runtime `DATABASE_URL` targets the intended existing
   ledger database, not Preview. Do not print the connection string. Use read-only
   schema inspection, not setup scripts, to compare the target against
   `database/santa-name-requests.sql`: all five tables, columns, primary/foreign
   keys, defaults and history identity are required. `recorded_at` and history
   `recording_suggestions` must exist. Confirm the application database role has
   the existing SELECT/INSERT/UPDATE/DELETE and history identity-sequence
   privileges needed by the store. A safe column inventory is:

   ```sql
   SELECT table_name, column_name, data_type, column_default, is_nullable,
          is_identity
   FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name IN (
       'santa_name_requests', 'santa_name_request_history',
       'santa_name_recording_suggestions', 'santa_name_request_submissions',
       'santa_name_request_limits')
   ORDER BY table_name, ordinal_position;
   ```

   Review constraints and role grants through the database's read-only metadata
   tools too. Do not select child names just to check readiness. The server also
   needs its existing `SESSION_SECRET` for visitor submissions. Missing schema
   requires a separately approved additive migration against that exact target;
   no database replacement, Preview-data copy, overwrite or automatic migration.
4. **Rebuild only after configuration is verified and publishing is approved.**
   Frontend variables are baked in at build time, so a function restart alone
   cannot update them. Run `npm run build`, `npm run test:staff-production` and
   `node --test scripts/seo-serving.test.mjs scripts/santa-name-requests.test.mjs`.
   The existing broad `seo-serving.test.mjs` run currently has an unrelated
   outdated assertion that both the homepage and gallery render the removed
   Mugshots badge. Do not restore the badge to satisfy it. The isolated package,
   catalogue document, development SSR and Vercel document checks pass; the
   dedicated staff command also runs the isolated package check.
   Publish that reviewed build through the existing Vercel release process.
5. **Verify live separately after release.** Directly open and refresh
   `/request-names`, `/sign-in`, `/sign-up` and supported Clerk subpaths such as
   `/sign-in/sso-callback` and `/sign-up/verify-email-address`; expect 200 HTML,
   noindex and private/no-store. Callback completion itself needs a real sign-in
   flow. Check the sitemap omits staff URLs and anonymous reads/downloads/PATCH
   still return 401 without entries. In a private browser sign in to the live
   tenant as **admin@santaradio.co.uk**, complete verification and ensure that
   address is primary. Check Outstanding, Completed and each TXT download. Test
   Recorded only on an owner-approved real entry or explicitly approved test
   record, since that changes live data. A different or unverified primary
   address must receive 403 for all private operations.

Local isolated-document and controlled API fixtures do not prove live
authentication or database readiness. Live release verification, verified owner
sign-in, live TXT downloads and an approved Recorded action remain outstanding
until the above access/configuration checks and release are authorised.

Verification of this repair: `npm run build` passed; the staff/API unit and
controlled HTTP checks passed, including unverified and secondary-email denial;
the deployment-style package check passed without runtime UI dependencies; the
focused public-document checks passed; and the anonymous staff browser check in
`tests/santa-name-requests.spec.js` passed in Chromium. The Preview screenshot
showed the anonymous staff entry, not a signed-in ledger. Signed-in UI and live
owner access have not been verified.
