# Arabella-only saved-greeting pilot

## Scope and operation

Only the exact `arabella.mp3` recording IDs are eligible. No automatic uploads,
other-name caches, batch generation, new services or deployment are included.
The existing UI fetches the approved complete MP3 directly from cPanel, verifies
its exact byte count and SHA-256, and hands its Blob to the unchanged history,
player, download and native-file-share controls. Both saved and generated
results consume the existing allowance once. Playback/download/share consume
no extra allowance.

The cPanel filename is not evidence of freshness. Approval is explicit in
`src/data/savedSantaGreeting.js`, including the source-name content hash,
complete-file checksum and recipe fingerprint. Set `enabled: false` to disable
and rebuild/restart normally; no secrets or hosting changes are needed.

The Vite build computes the current recipe fingerprint from the original shared
recordings, preparation/filter code, generation/name-loading code and FFmpeg
package version, plus the declared exact hosted-name revision. A mismatch skips
the saved request completely. Do not update the approved fingerprint merely to
make a failing test pass: first generate, compare/listen to and approve the
correct current greeting.

**External source replacement rule:** replacing `arabella.mp3` on cPanel must
also update its declared source-content hash and invalidate/reapprove this pilot,
or disable it before replacement. There is no automatic remote-name change
notification or remote name-audio download on a saved hit. Uncoordinated remote
replacement cannot be detected from an unchanged filename. This pilot does not
claim otherwise. Renaming/replacing the saved greeting without updating its
checksum will cause a safe miss, not acceptance of the replacement.

Each lookup uses a version query parameter and `cache: no-store`. Missing,
inaccessible, CORS-blocked, timed-out (three seconds), truncated, oversized,
wrong-type or checksum-mismatched responses fall back to normal generation.
User cancellation remains cancellation. The existing backend renderer is
unchanged; no name download, name decode or render endpoint is used on a hit.

## Hosting requirement still outstanding

The supplied file is publicly reachable at:

https://stagcommunications.com/santaradio/greetings-cache/Santa-message-for-Arabella.mp3

The owner's upload/playback confirms the public mapping, not the physical cPanel
document-root path. Keep finished messages outside the source-name directory.

On 20 October 2026 the GET response was `audio/mpeg`, 1,016,937 bytes, but had
**no Access-Control-Allow-Origin header**. Real Chromium fetches from both the
proxied preview and `https://www.santaradio.co.uk` failed with `TypeError`.
Direct tab/audio playback alone does not establish fetch/Blob access.

Mark must make the MP3 response include:

```http
Access-Control-Allow-Origin: *
```

For Apache, he can add the following to the **existing greetings-cache folder's**
`.htaccess`, preserving any existing rules, if `mod_headers` and the relevant
override permission are enabled:

```apache
<Files "Santa-message-for-Arabella.mp3">
    Header always set Access-Control-Allow-Origin "*"
</Files>
```

This is a public, anonymous recording; the browser explicitly omits credentials.
The wildcard allows both www and the development preview. No cookies, upload
permission, Authorization header or custom request headers are needed. If Apache
does not permit this directive, the hosting administrator must set the response
header instead. Ensure it applies to GET requests with the recipe query string.
Do not add a duplicate conflicting CORS header.

Until this is done, the pilot safely generates normally; **real saved hits are
not verified or claimed**.

## Verification

Commands:

```sh
node --test scripts/saved-santa-greeting.test.mjs
npx playwright test tests/saved-santa-greeting.spec.js tests/santa-message-share.spec.js --project=chromium
npm run build
```

Browser tests fetch the actual uploaded bytes for their fixture. The successful
saved-hit test supplies a **simulated CORS-enabled response**, blocks/counts the
generation endpoint, verifies zero calls, advances actual audio playback and
checks unchanged downloaded/shared bytes and filename. The forced-404 test
allows the real local backend to fetch the hosted name and render with FFmpeg;
its output matches the uploaded MP3 byte for byte. Separate real-host probes
record actual CORS outcomes without substituting a successful response.

After Mark's header change, repeat real browser access and the unmocked UI flow.
After a future owner-approved Vercel release, verify the deployed recipe matches,
the saved GET goes directly to cPanel, no `/api/santa-message` POST occurs on
a hit, and a forced miss still generates, plays, downloads and shares normally.
No Vercel release is part of this pilot implementation.
