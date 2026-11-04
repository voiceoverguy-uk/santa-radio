# Private recorded-name index

## What changes

The homepage and paid Studio still use the same bounded private POST search:
two-character minimum, 200 ms typing delay, at most ten results, current language
validation, signed five-minute capabilities, no browser catalogue, no original
audio locations in responses, and private/no-store response headers.

The full validated source inventory now lives in the existing private PostgreSQL
database. A new function instance reads this snapshot instead of downloading the
origin inventory. Normalised prefix terms, label counts and recording resolution
maps are built once per loaded version. Audio stays on the existing host.

The atomic limiter is a single PostgreSQL function call instead of five sequential
network commands. It retains the same HMAC identities, per-address/global limits,
scope separation, expiry, all-or-nothing rejection and fail-closed behaviour.
Its response includes only internal snapshot freshness metadata, never inventory
data. Warm searches use that metadata without a separate freshness query. This
metadata is not included in the browser response. Expired-bucket cleanup is
indexed, bounded and periodically performed inside the same call.

## Refresh rules

- Regular successful origin refreshes are separated by 24 hours across all
  function instances, not once per instance or visitor.
- The first eligible request after expiry performs an awaited, bounded refresh.
  This is daily revalidation on use, not a promise of a midnight scheduled job.
  A site with no visitors need not fetch the inventory.
- A trusted operator can refresh immediately after a recording batch. Explicit
  refreshes are additional to the daily fallback.
- A database lease coordinates fetches. Publication is atomic and fenced by
  owner and lease expiry. A slow or crashed older publisher cannot replace a
  newer snapshot.
- Failed or malformed refreshes preserve the previous valid index, with a shared
  60-second retry backoff. Status records generic error codes, not source bodies,
  original paths, tokens or child-name queries.
- During a concurrent refresh, other requests can use the previous validated
  snapshot. Without any initial snapshot they wait at most two seconds for its
  publication, then use the existing explicit unavailable/local-recordings
  fallback. The separate aggregate counter fails rather than inventing a total.
- Prime the index before enabling a release. The bootstrap request must fetch,
  validate, store and index the inventory and is not the optimised warm case.

Every subsequent search receives the current version through its limiter call.
Warm instances reload changed snapshots on the next request; an in-flight request
may finish on the previous version. Preview and message resolution independently
check snapshot metadata so removed recordings cannot remain resolvable solely
through an old memory cache. Existing names, aliases, Unicode spellings, recording
variants and local-recording overrides retain their identities and matching.
The signed capabilities are still checked for their original scope and expiry.

## Trusted operator workflow

There is deliberately no public refresh endpoint. Run these commands only in a
trusted terminal/server environment with the **explicitly verified intended
database** and existing private-origin configuration. Database access is the
operator authorisation boundary; no credentials are sent to the browser.

```sh
npm run names:index:status
# Only after confirming the target and completing the recording batch:
npm run names:index:refresh
```

Status prints only availability, aggregate count, refresh/retry timestamps,
refresh-in-progress status and a generic last error. Refresh requires an explicit
confirmation flag (supplied by the named npm script), and reports whether it
published. Exit 2 means another refresh owns the lease; it is not publication
success. Neither command prints the catalogue, record filenames or credentials.
Use the existing secrets tooling to supply configuration; never put credentials
in command arguments, source files or logs.

The existing authenticated HTTPS origin gateway is used when configured. The
legacy compatibility source remains as before; this change does not revoke
previously disclosed origin URLs or prove that origin-host restrictions are
correct. Keep the existing origin restrictions in place.

## Database and release boundary

The reviewed SQL is in `database/santa-name-catalogue.sql`, alongside the existing
name-request schema. It adds a private snapshot table, an expiry index and the
atomic limiter function. There is **no** startup, build, public-request or
production auto-migration. Runtime never installs schema or bypasses missing
storage; missing schema fails closed.

The development database was identified by an explicit development-database
callback and matched against the app connection using a non-secret server-side
fingerprint before development setup. Only that development target was prepared
and primed. No production schema, production index, live deployment, origin-host
configuration or audio storage was changed.

Before production rollout, obtain separate approval, identify the actual Vercel
database/provider, and apply the reviewed schema/function using that target's
normal process **before** deploying code that expects them. Do not assume Replit
Publish migrates an external Vercel database. Keep the function while rolling back
application code; the old limiter can coexist with the new schema.
Prime the approved target, confirm safe status, then perform the normal approved
deployment and a few bounded name searches in both flows.

The index schema and source format must remain server-only. No public Blob,
static export, browser installer or full-catalogue API is part of this change.
Bounded result disclosure cannot prevent every determined copier; it preserves
the existing barriers against bulk harvesting rather than promising impossibility.

## Verification

```sh
npm run test:private-name-search
npx playwright test tests/private-name-index.spec.js --project=chromium
npm run benchmark:private-name-search -- --baseline
npm run benchmark:private-name-search
npm run build
```

The database tests and benchmarks initialise disposable PostgreSQL clusters on
private local Unix sockets, never `DATABASE_URL`. They require existing
`initdb`/`pg_ctl` binaries and remove their data at exit. Browser checks send the
real search handler to this isolated storage with synthetic recordings, while
only Studio access/category setup is fixture-controlled. They do not grant live
access or modify live allowances.

The baseline benchmark imports the pre-change server implementation from its
recorded Git revision. Retain that revision locally to reproduce it. Timings
exclude the unchanged 200 ms debounce and use 9,700 synthetic records and local
PostgreSQL. They do not simulate an origin network delay, Vercel startup or a
remote production database. Reports are ignored under
`generated-artifacts/private-name-search/`; no real inventory is written there.

See the recorded results below. Local success is not a production speed claim.

### Recorded local result — 4 November 2026

| Measurement | Before | After |
| --- | ---: | ---: |
| Warm median, limiter + search | 17.95 ms | 2.07 ms |
| Warm p95, limiter + search | 33.52 ms | 10.59 ms |
| Warm median, limiter stage | 5.82 ms | 1.24 ms |
| Warm median, search stage | 10.84 ms | 0.81 ms |
| First request / bootstrap | 104.65 ms | 135.49 ms |
| Database commands for 16 requests, including bootstrap | 80 | 20 |

Both runs used the same 9,700-record synthetic dataset and disposable local
PostgreSQL, 16 requests each, and no simulated origin/network delay. The first
request is excluded from the warm statistics. The initial new bootstrap is
slower because it validates/publishes the snapshot and prepares the search
index; it should be performed before release rather than hidden in warm results.
The after run's new library/store instance reused the existing snapshot in
74.88 ms, with two database commands and **zero** additional origin downloads.
This is not a fresh Node process or a measured Vercel cold start.

Forty-nine server/database/security tests passed, including real concurrent
PostgreSQL limits and refresh fencing. The browser integration passed both
pickers at 1440 px and 390 px using the real indexed handler and isolated storage.
The production client/SSR/prerender build and twelve packaging/portability
regressions also passed. No production after measurement was attempted.
