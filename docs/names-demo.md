# Isolated private name-search demonstration

Open `/names` in the existing website Preview. No homepage, Studio, recording or
payment behaviour is changed. This page has no radio player or other upstream
features.

## Data and authorisation

The owner authorised acquisition of the existing Stag Communications PHP
name-index source. The operator import reuses the existing name-library
configuration, fixed HTTPS index, optional configured authenticated gateway,
strict response size/encoding/schema/filename validation and redirect refusal.
No credentials are guessed, printed or requested in chat.

The initial source contained 9,774 valid recording entries. Deduplicating display
names case-insensitively (with Unicode normalization and apostrophe equivalence)
produced 9,773 names. Multiple recordings with the same name need only one
suggestion in this name-only demo. Source filenames, audio locations and
credentials are not retained in the demo snapshot.

`server/names-demo/snapshot.json` is **private server deployment data**, not a
public asset. Retain it with the source so it is available to builds. Vercel's
function configuration explicitly includes it and the page HTML in the isolated
function; it is not copied into `public` or `dist` or imported by browser code.
Instances read the packaged file once and prepare an in-memory prefix index.
They never write runtime files, download a catalogue, refresh on expiry, use the
shared catalogue database or fall back to Stag. A missing/bad file returns 503.
The existing shared request-rate limiter is retained, so the existing database
is still needed for abuse protection, **not catalogue storage**. No new table,
migration, Blob or service is introduced.

Only POSTed queries with at least two letters are accepted; at most ten names
are returned, with no IDs, audio URLs or per-name metadata. Bulk/URL searches
are refused, and responses have private/no-store and noindex headers. In Vite,
explicit guards also deny direct and `@fs`/raw access to the private folder.

## Manual owner update after adding recordings

Ask the agent to “update the /names demo snapshot”, or run in the authorised
workspace:

```sh
node scripts/import-names-demo.mjs --confirm-update
node --test scripts/names-demo.test.mjs
```

This is the **only** origin-refresh operation. It fetches the configured source,
validates and deduplicates all names, then atomically replaces the saved file.
Failed acquisition, empty results, invalid data or a failed write leave the old
valid snapshot unchanged. It does not alter the existing homepage/Studio
catalogue. There is deliberately no public refresh endpoint or scheduled job.

Restart the website workflow to load the new snapshot in Preview. For a future
Vercel release, include the updated snapshot in the normal owner-approved code
release; an already deployed immutable instance cannot receive a changed file
without a new deployment. No publication or payment activation is part of this
demo.

## Verification

`node --test scripts/names-demo.test.mjs` validates the real imported snapshot,
bounded API contract, rate-limit enforcement, failure retention, raw-source
denial and explicit function packaging configuration. It launches two fresh
Node processes with all `fetch` calls forbidden and origin configuration removed
and measures first and 1,000 repeated lookups. This establishes fresh-instance
search independence from Stag rather than relying on an already-warm cache.
`Server-Timing: snapshot-search` reports snapshot lookup time; end-to-end HTTP
time also includes the existing database-backed limiter and request overhead.
