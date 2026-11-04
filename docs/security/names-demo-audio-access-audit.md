# Names demo: separate existing audio-access finding

## Scope and finding

Before implementing browser-only filtering, a bounded read-only check of a
previously documented known original-host recording returned:

- Unauthenticated HTTP HEAD: **200**
- Content-Type: **audio/mpeg**
- Nonzero audio content length

Only headers were inspected; no audio was downloaded, directory enumeration
performed, credentials guessed or origin configuration changed. The exact
recording URL is deliberately not reproduced here or added to public demo data.
This was checked on 4 November 2026 and establishes one existing reachable
original, not the security status of every recording/category/alias or cache.

**Risk:** Publishing display names can make name-based filename guesses easier.
A signed website proxy cannot protect an original that can be reached directly.
The new public list does not contain source filenames, IDs, paths or audio URLs,
but that exclusion alone is not an access-control guarantee.

## Website controls inspected

Bounded live checks on the verified website host returned:

- Preview with no token: **403**
- Preview using a guessed-name parameter: **403**
- Guessed private server-audio file route: **404**

Code inspection shows the preview endpoint verifies signed, expiring,
preview-scoped capabilities before resolving/fetching any source. The public
bounded search endpoint issues preview capabilities to legitimate rate-limited
search callers; previews are **not** purchaser-only or account-only. Knowing a
display name does not itself forge a capability, but a visitor can use the
existing legitimate search-to-preview flow. The `/names` demo neither calls
that flow nor issues capabilities.

Message creation separately enforces adult access/allowance and a current
message-scoped selection. Studio checks its independent voucher/purchase
authorisation. No cookie, capability, entitlement, source fetch or shared search
behaviour was changed for this demonstration.

The existing automated security fixtures passed checks for invalid/tampered,
expired and wrong-scope preview tokens, arbitrary source parameters, malformed
requests, rate-limit/storage failure, forged access and valid authorised preview
and MP3 creation. These tests do not establish the original host is protected.

## Separate remediation required before an audio-security claim

An authorised original-host operator should identify and close unauthorised
direct recording/index/directory/alias access while preserving the website's
authorised server-to-server retrieval. Recheck direct origins and cached copies
independently after any approved change. Do not assume an unlisted filename or
an application route provides security, and do not change credentials, files,
origin rules or CDN caches without separate owner approval.

The owner has approved preparing a public **names-only** demo and has not
approved publication/deployment in this task. The direct-origin exposure is
reported separately, not silently fixed or represented as resolved.
