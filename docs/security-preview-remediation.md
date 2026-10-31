# Preview security remediation

## Scope

Preview only. No publishing, live payments, real test-contact submissions,
outbound test emails, destructive attack payloads or bulk audio downloads.
The separate hero-card work and the existing private-name inventory protections
are preserved. This work does not close the production incident.

## Dependency verification

The GitHub advisory API confirmed all three advisories are active:

| Advisory | Affected installed dependency | Patched baseline | Preview resolution |
| --- | --- | --- | --- |
| [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828) | body-parser 2.3.0 | 2.4.0 | 2.4.0 |
| [GHSA-8g5g-mxqh-grgj](https://github.com/advisories/GHSA-8g5g-mxqh-grgj) | Vite 6.4.4 | 6.4.5 | 6.4.5 |
| [GHSA-6pq8-jhm2-2vcw](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw) | qs 6.16.0 | 6.16.1 | 6.17.1 |

Express remains on the compatible 5.3.0 release. Explicit parser/qs dependencies
hold the patched transitive baseline. The qs vulnerable comma-stringify call was
not found in application code; the package was nevertheless updated. Body
inflation is disabled on the Express JSON/raw parsers as defence in depth.

## Application controls

- Missing-name POSTs have shared address/global limits in addition to the
  existing visitor-cookie checks. Clearing cookies does not reset those limits.
- Address identification uses the platform-overwritten Vercel address header
  on Vercel and the socket elsewhere, never arbitrary X-Forwarded-For.
- Adult signup is forwarded server-side to the existing fixed Brevo form, with
  bounded input/output, timeouts, origin checks and shared abuse limits.
  Only explicit provider acceptance issues a signed, Secure, HttpOnly,
  session cookie. No DOB or email-verification step was added.
- The free recording API independently requires that grant and atomically
  reserves a generation slot in existing shared storage. Successful generation
  starts the rolling two-hour allowance. Failed generation releases its short
  lease; losing a process cannot leave an unlimited reservation.
- The adult identity is a secret-keyed digest, not a stored contact address or
  a resettable visitor ID. A fresh signup for the same adult retains the wait.
  Distinct adults are not subjected to a blanket household two-hour lockout.
- Christmas Contenders has shared trusted-address/global limits. Real voting
  remains explicitly disabled. Existing consent and demo restrictions remain.
- Private/no-store headers precede staff authentication. Credential-free staff
  requests now correctly return 401 rather than a generic malformed-input 400.
  The verified-owner allowlist is unchanged; authentication failures fail closed.
- Added missing Vercel wrappers for webhook, checkout and paid-access routes.
  Unsigned webhook POSTs reach signature validation and return 400 rather than
  falling through to the page handler. Existing sandbox/live-payment restrictions
  remain unchanged.
- Added nosniff, strict-origin-when-cross-origin and a limited CSP covering
  framing, base URLs and objects, including Replit's Preview parents. It does
  not introduce script/connect/media/frame source restrictions that could block
  the existing media, Clerk, Brevo or Stripe flows.
- Preview's development file serving denies private server/scripts/assets
  directories in addition to Vite's secret-file protections.

## Verification

- Dependency audit: zero reported vulnerabilities after updating.
- Static scans completed with two reviewed warnings, not an unqualified clean
  result: SAST's request-to-cookie session-fixation rule follows the submitted
  email into the grant, but the actual cookie is freshly randomized,
  server-signed, expiry-checked and HttpOnly; callers cannot choose a valid
  grant. The privacy scanner calls the literal sessionStorage value `granted`
  an auth token. It contains no secret/contact details and confers no server
  authority. Forgery, missing-signup and cleared-storage tests verify those
  boundaries. Neither warning is evidence of exposed authentication secrets.
- Production build: passed, including prerendering.
- Focused server regressions cover inventory access, signed previews,
  adult signup grants, forgery/expiry, atomic allowance and failed generation,
  trusted limits, disabled real voting, staff responses and Stripe restrictions.
- Phone-width and desktop Chromium checks use real private lookups, signed
  previews, real FFmpeg mixing and playable MP3 downloads.
- Browser tests also remove storage/cookies, verify unauthenticated generation
  is denied, then issue a fresh fixture grant for the same adult and verify the
  real shared two-hour limit still returns 429 with Retry-After.
- The completed checks are focused regressions, not a full-suite certification.
  Some older form fixtures still target direct browser-to-Brevo multipart
  submission and need migration to the server-proxy contract. The guard below
  prevents those stale fixtures from accidentally sending real contacts.
- Brevo acceptance is mocked in browser tests and injected at the transport
  boundary in server tests. There is no runtime test-auth bypass. The test guard
  blocks unexpected internal signup POSTs before they can contact Brevo.

## Release steps and outstanding checks

1. Obtain approval to publish; this work has not published either site.
2. Confirm the production database contains the existing request-limits table
   and the application can read/update it. This change reuses that table and
   does not create or migrate a production database.
3. Publish frontend, API wrappers, dependency lock and route/header configuration
   together. Do not enable live voting or alter Stripe production restrictions
   as part of this release.
4. Recheck both live hostnames: private catalogue denial, bounded lookup,
   legitimate signup/allowance behaviour, signed preview and one normal download,
   private staff responses, unsigned webhook rejection and security headers.
5. An approved staff member must verify signed-in access. Anonymous 401 and
   allowlist regression checks do not prove a real signed-in Clerk session.
6. Brevo's real acceptance and external media/payment-provider compatibility
   require approved live checks; no contacts or payments were sent to prove them.
   Phone checks here use Chromium emulation, not physical iPhone Safari.
7. Mark's original audio-host restrictions and retained-log review are still
   outstanding. Hosting administration/log access was unavailable. Vercel
   integration access previously returned 403, with no reconnect available.
   Do not describe those exposure/incident checks as resolved.
