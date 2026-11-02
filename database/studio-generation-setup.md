# Studio single-message generation

Apply `database/santa-studio-generation.sql` to the existing application
PostgreSQL database before serving this version. This is an additive, idempotent
migration; it does not alter the name-request or free-message tables.

Development setup: `node scripts/setup-studio-generation.mjs --development`.
The existing post-merge script runs this explicitly. Production schema changes
must use the project's approved migration process; request handlers and builds
do not run DDL or silently fall back to browser-only limits.

The tables hold hashed per-access keys, opaque recorded-choice IDs, two completed
MP3s and a short preparation lease. They contain no email addresses, written name
spellings, source URLs, tester codes, cookies or Stripe claim tokens. Completed
audio is retrievable only after the existing Studio authorisation is checked.
The 150-second lease is longer than the 110-second rendering deadline; expired
workers cannot commit. No new access expiry or purchase-wide family policy is
introduced. Retention/deletion policy for these private recordings is a separate
owner decision; this migration does not delete existing recordings or counters.

Checks:
`node --test scripts/santa-studio-generation.test.mjs scripts/santa-studio-message.test.mjs`.
The database integration tests use isolated opaque keys and remove their rows.
