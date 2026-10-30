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
