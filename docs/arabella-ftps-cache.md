# Arabella-only secure FTPS saved greetings

## Boundaries

Only hosted `arabella.mp3` is eligible. No other name, bulk render, paid service,
automatic deployment or changes to the manually uploaded MP3 are included.
Set `savedSantaGreeting.enabled = false` to turn off the whole pilot and rebuild.
Set `SANTA_FTPS_ENABLED=false` to disable uploads only; validated existing hits
and normal generation still work.

All FTPS settings are consumed **only by Node server modules**. Never prefix
these keys with `VITE_`, put them in frontend code, or paste credentials in chat.

## Exact private settings

Enter these in **Replit Tools > Secrets** for this project:

| Name | Value |
| --- | --- |
| `SANTA_FTPS_ENABLED` | `true` when ready to enable uploads; otherwise `false` |
| `SANTA_FTPS_HOST` | `ftp.stagcommunications.com` |
| `SANTA_FTPS_USER` | The provider's exact FTP account username |
| `SANTA_FTPS_PASSWORD` | That account's password |
| `SANTA_FTPS_MODE` | Provider-confirmed `explicit` or `implicit` |
| `SANTA_FTPS_PORT` | Provider-confirmed numeric port |
| `SANTA_FTPS_DIRECTORY` | `greetings-cache` |

**Still needed from Mark/provider:** explicit AUTH TLS versus implicit TLS,
the corresponding port, a publicly trusted certificate valid for the supplied
hostname, and permission to upload/rename in this folder. Confirm passive data
connections with TLS (`PROT P`) are allowed. Explicit often uses 21 and implicit
often uses 990, but neither is assumed or defaulted. Do not select plain FTP or
SFTP; do not disable certificate validation to fix a certificate error.

Credentials must be restricted to this existing hosting account/folder as far
as the provider permits. No administrative cPanel password is required by the
application.

**Vercel is separate:** enter the same seven keys in the existing Vercel
project's Settings > Environment Variables, selecting the actual environments
where the pilot will run (Production and/or Preview, and Development only if
using Vercel locally). Replit Secrets do **not** automatically configure this
external Vercel project. A **new Vercel deployment is required** to run the new
code with the new settings. No deployment or Vercel settings changes were made
as part of implementation. Restart preview after adding Replit settings.

## Directory and public URL verification

The owner confirms the account starts inside `/santaradio` and intends
`greetings-cache/` relative to that login directory. The physical cPanel path is
reported as `/public_html/santaradio/greetings-cache/`; it is not used as an FTP
absolute path.

The publisher logs in, obtains PWD, uses **CWD greetings-cache**, and verifies PWD
is exactly the normalized login PWD plus that child directory. Both chrooted `/`
and visible `/santaradio` login roots can therefore work without guessing.
It does not create directories, walk parents or list unrelated files.

Next it uploads a UUID temporary file, renames it to a **new UUID MP3**, and
retrieves its public HTTPS bytes under:

`https://stagcommunications.com/santaradio/greetings-cache/`

Only if size and SHA-256 match does it publish the cache manifest. This verifies
the FTP-to-HTTPS mapping, not merely that a folder of the right name exists.
Actual mapping, authentication, certificate trust, data-port reachability and
rename semantics remain unverified until the provider details and secrets are
entered and the live proof succeeds.

## Identity, direct delivery and failure handling

The browser asks `/api/santa-greeting?name=...` for a validated descriptor, then
fetches the MP3 **directly from cPanel** into the existing Blob workflow.
Playback, download filename, sharing and the two-message allowance are unchanged.

The server reads the current compressed name source and hashes its **actual
bytes** without decoding. Its recipe fingerprint also covers original shared
ingredients, preparation/filter code, generation/name-loading implementation
and FFmpeg package version. A same-filename source replacement therefore changes
the automatic key immediately. Shared ingredient/code updates change it after
the normal rebuild/deployment.

This means a hit does perform a small **source revision read**, unlike the
earlier manually pinned browser-only pilot, but still performs **zero name
decode and zero FFmpeg render**. The complete greeting is not proxied by Vercel.

Each version has an atomic JSON manifest containing its exact key, recipe,
name revision, UUID MP3 filename, size and checksum. The browser additionally
checks exact returned bytes. A JSON descriptor is not allowed to redirect it to
an unrelated host. The legacy manually uploaded file is accepted only when its
approved recipe and source hash match; its filename is never freshness proof.
Compatibility is reapproved only after a normal render matches the original
approved checksum, not by changing a fingerprint to suppress a failed test.

On a miss or unreadable/invalid/CORS-blocked saved MP3, the existing generator
produces the normal audio. The same name bytes used for identity are passed to
decoding, preventing an identity/render race if the source changes mid-request.
The server attempts publication but returns successful audio even if credentials
are missing or upload fails. A slow/failed source cannot enable an unverifiable
hit; it falls back to normal resolution/generation, which may itself need the
same source host.

Uploads require TLS 1.2+, certificate/hostname validation and encrypted data
connections. There is **no plain FTP, SFTP or insecure TLS fallback**.
Uploads have a ten-second connection/publication deadline plus bounded cleanup;
late-running render requests skip upload to preserve response time.

Temporary `.upload` objects are never manifest targets. Publication requires
server-side rename; if unavailable, uploading directly to a public final name
is **not** used as a fallback. Across processes, competing requests create
separate complete UUID objects; an atomic manifest swap selects one complete
object, not a partial file. If replacing an existing manifest is unsupported,
publication may fail safely and normal delivery still succeeds. Within one
process, simultaneous Arabella generation shares a single pending render.

The manual `Santa-message-for-Arabella.mp3` is never a write/delete target.
Only the current operation's UUID temporary files are cleaned up. Completed
orphan test/competing objects are not automatically deleted in this pilot.

Diagnostics contain allowlisted status codes only, never credentials, commands,
raw FTP exception messages or submitted contact details. Examples:
`UPLOAD_DISABLED`, `FTPS_SETTINGS_MISSING`, `FTPS_SETTINGS_INVALID`,
`FTPS_MAPPING_INVALID`, `FTPS_AUTH_REJECTED`, `FTPS_TLS_REJECTED`,
`FTPS_TIMEOUT`, `HTTPS_VERIFY_FAILED`, `ATOMIC_PUBLICATION_FAILED`,
`FTPS_UPLOAD_FAILED`. A browser timeout/cancellation can fall back while the
bounded lookup completes; it cannot publish or render by itself.

## Verification and exact next steps

Without credentials:

```sh
node --test scripts/santa-ftps.test.mjs scripts/saved-santa-greeting.test.mjs
npx playwright test tests/saved-santa-greeting.spec.js tests/santa-message-share.spec.js --project=chromium
npm run build
```

The FTPS tests use an in-memory transport, **not real FTP**. They cover required
mode/port, TLS options, directory checks, temporary+rename publication, wrong
HTTPS mapping, deadlines, concurrent writers, source/recipe invalidation,
single flight and non-secret failure diagnostics. Browser tests distinguish
simulated responses from unmocked direct HTTPS hits and real normal rendering.

After Guy confirms mode/port and enters the secrets:

1. Restart the Replit application.
2. Run **`node scripts/verify-santa-ftps.mjs`**. This deliberately uploads a NEW
   uniquely named approved Arabella artefact, verifies the HTTPS bytes, atomically
   publishes the current version's manifest, then verifies a subsequent automatic
   lookup and matching bytes with zero FFmpeg invocations. It stops before
   network work if required settings are missing.
3. Run the browser suite above. The unmocked test must fetch that new UUID MP3,
   play/download it and make zero generation requests. The forced-storage-failure
   test must generate successfully. Native sharing tests inspect the shared
   file via a stub; the actual phone share sheet/delivery still needs Guy.
4. Only after a separately authorised Vercel release, repeat saved-hit and
   forced-miss checks on that deployed environment. A successful Replit FTPS
   connection does not prove Vercel network egress or settings are correct.

Do not claim the real FTPS upload/mapping/round trip passed before step 2
actually succeeds. The existing folder-scoped MP3 wildcard CORS rule permits
UUID MP3 delivery too; the JSON manifest is server-fetched, so it does not need
browser CORS. Other host rewrite/access rules still need real verification.
