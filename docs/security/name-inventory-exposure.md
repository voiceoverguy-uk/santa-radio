# Name inventory exposure response

## Status

Workspace protection is implemented and tested. **The live incident is not
resolved until the production releases, origin restrictions and cache invalidation
below have been performed and independently checked.**

On 31 October 2026 an unauthenticated request to
`https://www.santaradio.co.uk/api/santa-names?inventory=hosted` returned HTTP 200,
1,045,592 bytes, 9,774 records and 9,774 permanent preview URLs. The response had
`Cache-Control: no-store`, `x-vercel-cache: MISS`, `age: 0` and server `Vercel`.
This confirms exposure, not that anyone scraped it.

The Replit deployment service also identifies a separate public deployment,
`https://santa-radio.replit.app`. Publishing there does not update the Vercel
project serving `www.santaradio.co.uk`.

The connected Vercel API returned HTTP 403 for project access. Its credential
cannot be reconnected using the currently available inline flow. No Vercel
production release, cache purge, origin-host change or access-log export was
performed. Do not infer lack of scraping from unavailable logs.

Final anonymous checks at 18:55 UTC on 31 October 2026 still found:

| Target | Result |
| --- | --- |
| www names inventory | HTTP 200, 9,774 records and preview URLs |
| Replit names inventory | HTTP 200, empty records (older behaviour, not this protected release) |
| Original names index | HTTP 200, JSON |
| One previously disclosed origin MP3 | HTTP 206 for a range request, audio/mpeg |

Replit runtime logs available during this check contained startup/health-check
output, not HTTP inventory/audio access history. The available startup log was
preserved locally under ignored `generated-artifacts/security-incident/`; it
cannot establish who downloaded catalogue/audio data.

## Workspace changes

- All URL/query inventory modes and exports on the names API return 403. Bare GET
  returns 405. There is no public admin/full-inventory replacement.
- Search is POST-only, with `query` in the JSON body. No child-name search URL,
  browser persistence, full-catalogue download, total count or source filename.
- Queries require 2–80 Unicode letters/marks with ordinary name spaces,
  apostrophes and hyphens. Empty, one-letter, wildcard, control-character,
  extra-parameter and oversized requests are rejected. Results are capped at 10.
- The hero, free maker and paid-workshop name picker share bounded server lookup.
  Duplicate recordings retain stable identities, generic variant labels and
  individual previews rather than exposing source filenames.
- Preview links are same-origin, HMAC-signed capabilities, valid for five minutes,
  scoped to a single recording and preview action. Message selection uses a
  separately scoped capability. Tampering, expiry and scope substitution fail.
- Preview bytes pass through a controlled server endpoint. Message creation
  returns an MP3 directly. No permanent origin/cache descriptors reach clients.
- The public saved-greeting descriptor route returns 410. The message route no
  longer defaults to the publisher that uploaded permanent public cache MP3s.
  Previously uploaded files still need origin restriction; removing the route
  alone cannot revoke their old URLs.
- Sensitive responses set private/no-store plus CDN-specific no-store headers.
  The existing authenticated workshop-choice route remains access-controlled.
- Public name-index PHP/TXT installers and the old public verification text
  were removed. There is no full hosted-name catalogue in browser bundles or
  public assets. Server build output is not a public asset.

## Server-enforced rate limits

Limits share atomic PostgreSQL buckets across instances and restarts, reusing the
existing `santa_name_request_limits` table with a distinct namespace. No schema
change or replacement database is required. Addresses are HMAC-digested; query
text is not stored. Vercel's overwritten address header is used on Vercel;
elsewhere only the socket address is trusted, never arbitrary X-Forwarded-For.

| Action | Per address per minute | Global per minute |
| --- | ---: | ---: |
| Search | 40 | 1,200 |
| Preview | 12 | 300 |
| Message | 6 | 120 |

429 includes Retry-After. Database or signing failures fail closed with 503,
not an in-memory/unlimited fallback. Confirm the production database has the
existing limit table and SESSION_SECRET is configured before releasing.
IP limits bound abuse but do not guarantee that distributed scraping is
impossible. Apply origin/CDN controls too.

## Required production actions

### 1. Publish both serving applications

Release these workspace changes to the Vercel project serving the www domain.
Publish the separate Replit deployment too if it remains public. The agent
cannot perform the user's publishing action. Do not treat a successful Preview
test or a Replit publish as proof that the Vercel domain is protected.

If production release is delayed, the host administrator should urgently block
the public bulk route at the serving edge. The old frontend depends on that
route, so it will need the new frontend released with the replacement POST API.

### 2. Revoke already-exposed origin URLs

The current origin is `https://stagcommunications.com/santaradio/names/`.
Protecting the app cannot make these old URLs private.

Recommended staged migration, without renaming or deleting the recordings:

1. Preserve/export origin HTTP, CDN and Vercel access logs before retention
   expiry. Do not clear them during migration.
2. Copy the recordings to a directory **outside the document root**. Keep exact
   filenames/case. Do not expose a directory index or a JSON export of the copy.
3. Install `server/deployment-assets/private-names.php` as an authenticated HTTPS
   gateway. It is a host-side template, not a public downloadable installer.
   Use a supported PHP version with `hash_equals` and configure private origin
   environment values `SANTA_LIBRARY_PRIVATE_DIRECTORY` and a dedicated random
   `SANTA_LIBRARY_READ_TOKEN` of at least 32 characters. Never paste that token
   into source, frontend variables, chat, query strings or access logs. Ensure
   the host forwards the Authorization header to PHP.
4. Add the same token as a backend secret on **each** serving application.
   Configure `SANTA_LIBRARY_GATEWAY_URL` to the HTTPS gateway. The name library
   supports authenticated server-side index and selected-audio requests.
   Redirects are refused and index/audio size/time limits remain enforced.
5. Verify authenticated lookup, preview and MP3 creation against the private
   copy before disabling the old public location. The gateway template has
   been inspected, but has **not** been executed on the owner's origin host.
6. Restrict or remove public HTTP access to the original names directory,
   `names-index.php`, directory listings, exported JSON, old copies/backups,
   alternate aliases and direct MP3/WAV URLs. Disable access to personalised
   files in the legacy public `greetings-cache` directory as well. Use origin
   web-server/storage authorization, not CORS, Referer, robots.txt or hidden URLs.
   If other applications need the old URLs, migrate them to authorized server
   access first; merely adding new signed URLs leaves the exposure intact.
7. Purge the origin/CDN caches of the old inventory and audio URLs and any Vercel
   inventory caches. Code headers alone do not invalidate previously cached
   objects. CDN/host access is required; this has not been performed.

Do not disable/delete the private originals or rotate unrelated application
credentials. Use a dedicated origin-read token, not SESSION_SECRET.

### 3. Verify anonymously after release

Check both serving hosts and the origin, using fresh unauthenticated requests:

- Every former names inventory/export URL returns 403/404/405, never a catalogue.
- POST a normal two-letter-or-longer search: at most 10 records, no catalogue
  total, no original filenames or absolute origin URLs.
- Verify empty/wildcard requests are rejected, repeated requests reach 429 with
  Retry-After, and changing caller-controlled forwarding headers cannot bypass it.
- Verify an issued preview plays, expires, and cannot be used for another action.
  Recheck normal adult access, greeting creation, download and allowance.
- Confirm old origin index, exact old MP3 URLs and public cache descriptors no
  longer work, including any CDN hostnames and old copies.
- Inspect the released browser JS and public assets for inventory/source paths.
- Retain the timestamp, status and relevant cache headers for each verification.

### 4. Investigate logs without overclaiming

Review available retention windows for large inventory responses, repeated
successful inventory requests, broad MP3/WAV fetching, sustained transfer volume
and many distinct filenames per requester. Correlate origin/CDN/Vercel evidence,
distinguishing legitimate playback, the owner's checks and this verification.
Keep raw IPs, contacts and tokens in restricted evidence storage, not Git or a
public report. Report observation periods and gaps. No scraping conclusion has
been established in this session.

## Verification completed in the workspace

- Production client/SSR build and page generation passed.
- All 26 focused security/library/preview tests passed. They exercise inventory denial, bounded search, secret/source
  projection, signed preview expiry/tampering/scope, fail-closed limits and
  MP3 creation/FFmpeg decode.
- Chromium at 390px and 1440px passed real server searches, signed audio delivery,
  mocked adult signup and **real** MP3 creation with download links. Contact
  submissions were intercepted; no test contact was sent to Brevo.
- Ten targeted keyboard/touch/search/privacy/reload/handoff browser checks passed.
- Real Preview HTTP requests hit the shared rate limiter: 38 invalid queries
  returned 400, then three requests returned 429 (two earlier calls had already
  consumed that minute's allowance). Rotating spoofed X-Forwarded-For values did
  not evade it. Retry-After was present.
- Preview bulk modes returned 403, old greeting descriptors 410, unauthenticated
  workshop choices 403.
- Browser bundle inspection found no hosted names-root URL, public inventory
  request, names-index URL or legacy permanent Arabella greeting URL.

Physical Safari playback, production release, origin installation, old-URL
revocation, cache purging and log investigation remain unverified.
