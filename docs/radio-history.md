# Yesterday's Top Ten: code readiness and activation

## Status

The code is ready for an independently hosted collector; **production collection
has not been activated or verified**. No historical backfill is available.
No remote schema changes, deployment, paid provisioning or FTP operations were
performed. The feature is inactive unless explicitly configured.

## What is measured

The worker reads only the owner-confirmed HTTPS `Nowplaying.txt`, with the same
bounded, content-type-checked parser as now/next. It never reads Next3 or cached
web metadata. Artist-less and Santa Radio announcements are not songs, but their
successful observation clears the previous identity so a later repeat can count.
Malformed responses and failures do not change identity. Normalisation ignores
case and whitespace only, retaining versions, punctuation and artist credits.

These are **observed song transitions**, not authoritative plays or listener
popularity. Snapshots lack timestamps and play IDs: missed songs and consecutive
identical broadcasts cannot be reconstructed. The initial song, and the first
snapshot after more than 90 seconds without a successful observation, are
uncertain baselines and are not counted.

Successful adjacent observations at most 90 seconds apart create coverage
intervals. A complete day means polling intervals cover the entire UK day, not
that every broadcast was identified. Outages and partial first days are labelled
partial; today's observations are never used as yesterday's chart. Boundaries
are Europe/London midnights, including 23- and 25-hour days. Songs are ranked by
occurrences, ties by normalised identity in deterministic byte order. No filler
entries or inferred catalogue links are added.

## Prerequisites requiring owner approval

1. Confirm an **always-running process host** and its operational cost. Current
   autoscale web hosting and request-driven Vercel functions alone do not provide
   continuous collection. Daily cron and browser polling are not substitutes.
   No worker timers are launched from web handlers.
2. Confirm the intended durable PostgreSQL instance, backup/retention policy and
   connection access for both worker and web server. Do not assume the workspace
   database is the production database.
3. Approve applying `database/radio-history.sql` to that specific database.
   Startup performs read-only readiness checks and never creates tables.
4. Configure `RADIO_HISTORY_DATABASE_URL` as a secret separately in the approved
   worker and web environments. There is deliberately no `DATABASE_URL` fallback.
   Set `RADIO_HISTORY_ENABLED=true` in both only when activation is approved.
   Optional `RADIO_HISTORY_POLL_MS`: integer 5000–30000, default 15000.
5. Approve the normal website release and starting the independent process:
   `npm run radio:collect`. Use the chosen host's process supervisor to restart
   on failure. SIGINT/SIGTERM stop after the bounded current read and close storage.

The command fails explicitly while inactive or when storage/schema is missing.
The loop never overlaps its own reads. A transaction advisory lock surrounds
fetch and ingestion across all workers using the same database; the persisted
attempt time suppresses overlapping retries. Failed reads persist a failure
flag and back off up to 60 seconds. Failed database transactions roll back.
Multiple workers must share the same cadence setting and database.

## Read API and health checks

GET `/api/radio-top-ten` is read-only and no-store in Vite development/preview,
built Node and Vercel. It returns `date`, UTC `start`/`end`, `nextRefreshAt`,
`state`, `songs` (up to ten artist/title/count rows), and `coverage`. Inactive
returns an empty inactive chart without touching storage. Activated storage
failures return 503, not a fabricated empty chart. Non-GET returns 405.
No chart cache crosses midnight. The compact chart panel inside the radio player
refreshes at the next UK midnight and on visibility return. Both entry points open
this same non-modal panel; the music-page button expands the player without
starting playback. Escape/Close return focus to the opener. Other player controls
remain usable, and idle minimisation is suspended while the panel is open.

Coverage includes seconds, total day duration, complete, first/last observation
times and collectorHealthy. Health means a successful observation within 90
seconds with no subsequent feed failure, not an authoritative station health
claim. Operators should alert when the checkpoint stops advancing, reads fail
repeatedly, storage becomes unavailable or a finished day is partial.

Approved operators can inspect (read-only):

```sql
SELECT first_observed_at, observed_at, attempted_at, last_error
FROM radio_history_checkpoint WHERE id=1;
SELECT observed_at, artist, title FROM radio_history_plays
ORDER BY observed_at DESC LIMIT 20;
SELECT started_at, ended_at FROM radio_history_coverage
ORDER BY ended_at DESC LIMIT 10;
```

## No-visitors verification after approved activation

- Close website tabs and stop all synthetic website traffic for at least two
  known song transitions. Keep only the independent worker running.
- Inspect checkpoint/coverage directly: UTC times must continue advancing at
  roughly the polling cadence. Inspect actual transitions in the plays table.
- Restart the worker: the checkpoint must survive; rereading the same current
  song must not create another play. Do not reset the database.
- Start a second worker briefly: counts must not multiply. Stop the duplicate.
- Verify worker logs and database reachability after a period with no visitors.
- After a fully covered UK calendar day, inspect the API date, coverage and
  counts against saved observations, then verify both live website triggers.
- Record the approved process host, storage target (no credentials), supervision,
  and evidence before calling production collection active.

## Local verification

`npm run test:radio-history` starts a disposable local PostgreSQL cluster in the
OS temp directory, applies only its isolated schema, and stops/removes it after
tests. It also executes the actual collector command twice with a test-only
HTTPS fixture and SIGTERM, verifying checkpoint reuse and clean process exit.
It requires `initdb`/`pg_ctl` on PATH and does not use any configured
database secrets. Tests cover deduplication, concurrency, pool restarts, baseline
and outage decisions, announcement transitions, deterministic ties, empty/partial
days, midnight and both DST boundaries, API and worker backoff.

`npx playwright test tests/radio-top-ten.spec.js --project=chromium` checks the
shared UI with intercepted fixtures, not invented production history.
`npm run build` and `node --test scripts/radio-top-ten-serving.test.mjs
scripts/radio-metadata-serving.test.mjs` verify built Node and Vercel exports.
