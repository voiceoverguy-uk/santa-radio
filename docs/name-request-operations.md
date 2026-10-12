# Missing-name request operations

## Staff access
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

Preview verification does not publish anything. The checked Replit deployment (`https://santa-radio.replit.app`) returned 404 for `/api/name-requests`, and the production database check reported no managed production database. The original screenshot did not identify its host; its exact 503 cause could not be reproduced or established from its generic message. The connected Vercel API denied deployment inspection (403), so no Vercel configuration is claimed verified.

Previously, every request-service exception produced the same message and attempted runtime DDL. Errors now log only a safe stage and code, never names, bodies, cookies or connection strings. Examples: `visitor-signing / SIGNING_NOT_CONFIGURED`, `save / DATABASE_NOT_CONFIGURED`, or database codes such as `42P01` (missing table), `42703` (missing column), and `42501` (permissions). Check the actual failing host’s diagnostics before asserting a cause.
