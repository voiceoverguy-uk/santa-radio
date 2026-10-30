# Existing Production vote-storage check

The form and per-reload shuffle are finished. Voting remains disabled.
Production `DATABASE_URL` and `SESSION_SECRET` exist; their existence alone does
not establish the provider, schema, permissions, valid signing or durable counting.

## Exact minimal procedure

1. Identify the existing Vercel project's **Production** variable binding/resource
   metadata. Do not create/buy/link a different database. Existing connector access
   has not established the target. Replit's database pane/production SQL callback
   is not evidence about an external Vercel database.
2. In a trusted runner **already securely bound to that existing Production
   environment**, run:
   ```
   node scripts/contenders-storage-readonly.mjs --identify
   ```
   This makes no database connection. It reports only host/database identifiers,
   an unverified provider hint and whether signing meets the application's minimum.
   Match the identifiers to the existing provider/project resource; do not infer
   Production from a workspace environment label. Do not paste secrets into chat,
   command arguments, or downloaded environment files.
3. Once that target is matched, in the same securely bound runner run:
   ```
   node scripts/contenders-storage-readonly.mjs --read-only
   ```
   This uses a PostgreSQL-enforced read-only transaction, short timeouts and
   `ROLLBACK`. It checks the effective database/schema, five required tables,
   role permissions and the single competition settings row. Missing tables or
   settings are reported without attempting setup. It does not read ballots,
   contacts or frozen marketing-consent records, send mail, invoke application
   handlers, migrate or write data. Do not use the public API as a strictly
   read-only database probe: its existing rate limiter writes rows.
   A missing table means it is not resolvable on the application's search path;
   check schema visibility/permissions before assuming it needs creating.

Do not run this against the workspace binding and call its results Production.
The prepared probe has not been run against Production. If no trusted runner or
provider-console access to the existing resource is available, obtaining that
access—not another service or purchase—is the next dependency.

## Separate blockers

- **Storage:** actual target/provider and required schema/settings are unverified.
  A clean read-only result still does not prove the durable write/count path.
  Keep voting off; seek separate approval for any necessary production writes
  and a bounded durable-counting check after reviewing this report.
- **Email-only Brevo routing:** the existing SONG form requires names. The public
  email-only ballot does not call it or invent names. Compatible routing remains
  unresolved independently of storage. No verification emails are added.

## Minimal existing-API diagnostic logging

The API now emits only this fixed-shape runtime event on an unexpected failure:

```json
{"event":"christmas_contenders_unavailable","stage":"rate_limit_storage","category":"missing_schema"}
```

This is an **example**, not a Production finding. The category is one of
`signing_configuration`, `db_connectivity`, `missing_schema`, `permissions`,
`competition_settings` or `unclassified`. The stage identifies the fixed
operation, such as `request_signing`, `rate_limit_storage`, `competition_state`
or `ballot_restore`. `competition_settings` identifies a missing settings row;
schema/permission failures are distinguished by PostgreSQL's error code.
Unknown errors stay `unclassified` rather than guessing a cause.

There are no raw exceptions, messages, stacks, SQL/error details, connection
strings, secrets, addresses, cookies or voter data in these events. No extra
database queries, mutations or public endpoint were added; the existing API
response, rate limiter, fallback catalogue and disabled voting are unchanged.

After the normal GitHub → Vercel deployment is Ready:

1. Select that **new Production deployment** in the signed-in Vercel dashboard.
2. Open its runtime Logs and filter for `/api/christmas-contenders` and the
   current time window.
3. Load the public contender page once, then inspect its GET request's function
   output for `christmas_contenders_unavailable`. Read `stage` and `category`,
   not the separate pg SSL-mode deprecation warning.

Older deployment logs cannot gain these events retroactively. No Production
request was made as part of the source-only checks for this improvement.

## Simplest email-only Brevo path from existing source

No compatible email-only voting destination is configured in the existing
source. `songSubmission.js` requires `FIRSTNAME`, `LASTNAME`, `EMAIL` and
`SONG_REQUEST`; its General/Sponsorship routes are not voting substitutes.
`santaMessageAccess.js` also requires first name, surname and email and belongs
to Santa-message access, not votes.

The smallest compatible route is a separate email-only copy of the existing
SONG hosted form in the current Brevo account: require `EMAIL` and
`SONG_REQUEST`, with neither name required. It can reuse the existing supported
multipart/honeypot/locale approach and the bounded vote-reference/artist/title/
updates-YES-or-NO message. Confirm the station's notification and optional-consent
handling; a NO vote must not enrol the visitor in marketing. Keep the original
SONG, General and Santa-access forms unchanged. This is a required form contract,
not a discovered or configured new URL. No provider POST or message was sent.
