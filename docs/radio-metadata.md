# Radio track feeds

## Shared website contract

The public GET endpoint is `/api/radio-metadata`, relative to the website host.
Vite serves it during development and preview (`vite.config.js`), the built Node
server serves it (`index.js`), and `api/radio-metadata.js` exports the same handler
for Vercel's filesystem API routing. All responses use `Cache-Control: no-store`.
Non-GET requests return 405 with `Allow: GET`; unknown `part` values return 400.

- No query, or `?part=all`: combined current and upcoming fields.
- `?part=current`: only `current` (artist/title object or null) and
  `currentStatus` (`ready` or `unavailable`). Never waits for queue reads.
- `?part=upcoming`: only `upcoming` (up to three artist/title objects),
  `upcomingStatus` (`ready`, `stale` or `unavailable`), and `upcomingUpdatedAt`
  (last successful upstream queue read, Unix milliseconds; initially zero).
  Reads current and queue concurrently to reconcile even on a cold service.

Combined and upcoming responses omit **one matching queue head** using the latest
completed current read at response assembly. Both artist and title must match,
ignoring case and repeated whitespace only. The raw cached list is not changed.
Later repeats and nonmatching songs retain broadcast order. Artist-less and
Santa Radio announcements are excluded before queue reconciliation. If current
is unavailable, the service does not guess which song to remove.

## Three separate refresh timings

1. **Automation publication:** the remote files may update separately. Faster
   reads cannot make the automation publish sooner.
2. **Shared service fetching:** successful reads are reused for at most one
   second per channel, in memory per running server/function instance. Concurrent
   requests share an in-flight read per source, including across partial and
   combined routes. Current has a six-second timeout. Queue attempts have
   three-second timeouts, at most two attempts with a 500 ms delay. Failure
   results are also briefly cached (one second with default settings). A failed
   queue can retain the raw last successful list for less than 45 seconds from
   its original success, marked `stale` and reconciled again against current.
   Repeated failures do not extend that deadline; expiry yields an unavailable
   empty list. Current failures do not erase queue data.
3. **Website consumer fetching:** `useRadioMetadata` requests both partial routes
   approximately every five seconds after completion while visible. A confirmed
   current-song change requests the queue promptly; if a queue request is active,
   changes coalesce into one immediate follow-up without aborting that request.
   Current failures retry after three seconds. Browser requests time out after
   nine seconds. Hidden pages stop queue polling, and stop current polling unless
   radio playback is active/loading. Visibility return and restored pages refresh
   promptly, cancel superseded reads and clear expired values. These are normal
   refresh targets, not strict deadlines during slow reads or suspended timers.

## Upstream feeds

Feed filenames are case-sensitive:
- Now Playing: `https://stagcommunications.com/santaradio/Nowplaying.txt`
- Coming Up: `https://stagcommunications.com/santaradio/Next3.txt`

Existing upstream cache-busting is retained to keep metadata fresh.
No FTP credentials or cross-origin browser requests are needed. These sources
are independent of the main website domain; there is no fallback to the
retiring Heart Internet host. HTML is rejected rather than displayed as music.

Broadcast metadata can lead buffered audio. No precise synchronization or
upcoming start times are promised.

## iPhone evidence and limits

The owner confirms the iPhone app consumes website data. The supplied screenshot
showed Leona Lewis's **One More Sleep** both current and first upcoming. A later
direct HTTPS observation found current still Leona while Next3 began with Bryan
Adams, then an artist-less announcement and Bo Selecta. That later observation
proves the queue had advanced by then; it does not locate the earlier delay.

Repository routing and website fetch code verify `/api/radio-metadata` as this
website's shared metadata endpoint. There is no native app source, configured
app metadata URL, request trace or device capture here proving the app's exact
absolute host/path/query. Its use of this JSON route rather than a legacy website
feed/adapter or direct text-feed route remains unconfirmed. Do not invent that
URL or assume the app polls at the website's five-second interval.

The server correction applies to consumers of this endpoint, not just the
website display. Development and built-server checks do not change the deployed
service or prove native-device success. After the normal merge/release process,
confirm the app's actual request URL and inspect a current/queue transition on a
device. Native polling, releases, upstream file changes and publishing are outside
this change.

## Local verification

- `npx playwright test tests/radio-metadata.spec.js tests/radio-refresh.spec.js tests/radio-transitions.spec.js`
  covers controlled service clocks, source order/races, retries, expiry, repeated
  songs, browser polling/counts, transition coalescing, visibility/cancellation,
  and development endpoint compatibility. Browser transition tests consume the
  real service with deterministic upstream fixtures.
- `npm run build`, then `node --test scripts/radio-metadata-serving.test.mjs`
  verifies combined/current/upcoming HTTP shapes, correction and no-store/error
  handling through the built Node server and the exported Vercel API handler.
  Test-only fetch preloading isolates upstream data; it is never imported by the
  application. This checks local serving, not a deployed Vercel instance.
