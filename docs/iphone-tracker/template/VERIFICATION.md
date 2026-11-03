# Verification record — 3 November 2026

## Verified

- Built from a fresh ZIP extraction, with no pre-existing node_modules and a
  separate empty npm cache: Node **22.23.4**, npm **10.9.9**, Vite **6.4.5**,
  TypeScript **5.9.3**. Dependency tarball URLs are all public registry.npmjs.org
  URLs, with original integrity hashes. No credentials were supplied.
- `npm test`: **6/6 passing**. Checks include exact departure/completion
  boundaries; 60 unique stops and 37 Christmas UTC offsets; representative
  midnight in 2026 and 2027; half-hour/quarter-hour offsets; holiday/July/December
  boundaries; UK approach versus pinned delivery; annual reset; preview jumps
  and full-run speed; finite map position and monotonic progress for every minute
  of the journey.
- `npm run build`: **passed**, including TypeScript and the standalone Vite build.
  Rebuild reproduced the same bundled application bytes from the extracted
  source. The later favicon-only HTML change does not change application code.
- `node scripts/check-browser.mjs http://127.0.0.1:5095/`:
  **27/27 phone renders passed**, plus preview enable, completion jump, speed
  selection, reset/storage removal and collapse controls.
- `node scripts/check-browser.mjs file:///absolute/path/dist/index.html`:
  **27/27 phone renders passed**, plus the same preview interactions. This
  exercises the classic bundle, stamp and fonts from local files in Chromium.
- Each browser matrix covers **320, 375 and 390 CSS-pixel widths**, height 844,
  with reduced motion. States: July holiday, 30 November holiday, 1 December
  workshop, pre-departure preparation, exact departure, UK delivery, exact
  completion, 26 December return and 1 January rollover.
- During those render checks, non-local requests were blocked: **zero attempted
  external requests, failed assets or page exceptions**. The map was visible,
  images decoded, Inter/Cinzel loaded, all 60 phone timeline entries existed,
  and the document had no horizontal overflow. Caveat and the postcard stamp
  loaded in the holiday states.
- Visual screenshot of the built isolated demo at **390 × 844**: green/gold
  heading, SVG map, holiday badge and current intro visible, no apparent cropping.
  An initial automatic favicon 404 was eliminated using a data favicon; it was
  not a tracker asset failure.
- Archive: explicit allowlist; ZIP CRC integrity, paths, file SHA-256 manifest
  and public dependency-host checks. No secret files, private records, website
  services, Git history, node_modules, caches or old archives are included.

## Existing website checks, not a handover regression

The unchanged website check `node --test src/tracker/scripts/tracker-pass2.test.cjs`
was also run: **6 passed / 3 failed**. All three failures are in its page/metadata
harness: it tries to open `src/seo/PageSeo.js`, while the current file is
`PageSeo.jsx`. This is outside the standalone package, which does not import the
website SEO service. Its remaining map, timeline, preview and current-route checks
passed. The older `docs/tracker-handover` scripts also contain superseded 44-stop
and 10:00 completion expectations; they were not copied or presented as valid
checks of the current tracker.

## Not verified

No Xcode project, iOS Simulator, actual WKWebView or physical iPhone was available.
No claim is made about native sharing/downloads, WKWebView file-fetch policies,
VoiceOver, Dynamic Type, iOS safe-area behaviour, real suspension/resume, the
receiving app's navigation policy or its minimum supported iOS version.

Postcard PNG creation, native Web Share success/cancellation and anchor downloads
were **not exercised**. Their current implementation is preserved and documented
as optional/browser-dependent. External link destinations were identified, not
opened as part of offline render checks.

No production deployment or modification of website runtime code was performed.
