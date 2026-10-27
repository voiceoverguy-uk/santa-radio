# Verification and limitations — 27 October 2026

## What was exported

Current working-tree files copied unchanged from an explicit allowlist, not
the original tracker transfer ZIP. `EXPORT-SCOPE.json` records the exact UTC
snapshot time and every included original path. Root dependency manifests and
lockfile, all shareable `src/`, public application assets (except operational
download scripts), runtime server/API source, database schema, required
build/runtime scripts and tracker test source are included.

No website production source, styles, calculations or tracker behaviour was
edited for this task. Additional scripts under `handover/` only inspect/test the
export. Historical transfer documents are isolated and labelled as historical.

## Live reference checks

- `https://www.santaradio.co.uk/santa-tracker` returned **HTTP 200**, HTML served
  through Vercel, on 27 October 2026.
- A real browser screenshot at that URL showed Santa Radio navigation, current
  heading, world map, holiday status, current explanatory introduction and
  radio dock. A first-visit cookie dialog covered part of the map. This was a
  live browser render, not merely a successful metadata fetch.
- `https://www.santaradio.co.uk/` returned HTML containing `tracker-banner`.
  Its initial server-rendered placeholder did not include the client map layout
  classes, so that response alone does **not** verify the live enlarged map.
- Replit reported a successful public deployment at
  `https://santa-radio.replit.app`; source branding's configured preferred
  reference remains the www custom domain.
- No production publish, remote push or operational data access was performed.
  **Live/source parity is not guaranteed.** The live screenshot does not
  establish the exact deployed source revision, every seasonal state, or the
  homepage map's live size. Use the ZIP as this handover's source of truth.

## Checks run

Environment: Node **22.23.4**, installed Vite **6.4.4**, Linux/system Chromium.

| Check | Result |
| --- | --- |
| Existing `node --test src/tracker/scripts/tracker-pass2.test.cjs` | **6 passed, 3 failed** out of 9 |
| Existing `npx playwright test tests/santa-tracker.spec.js --project=chromium --grep 'seasonal content\|homepage enlarged map\|homepage retains' --reporter=line` | **15 passed** |
| Export-only `node --test handover/check-tracker.cjs` against extracted source | **6 passed** |
| `node handover/check-browser.mjs <running-development-URL>` | **6 boundary states passed**, no uncaught page errors |
| Extracted source `npm run build` with an empty environment except PATH, HOME and NODE_ENV=production | **Passed** browser build, SSR build and 1,559 canonical page generation |
| `node handover/check-static-build.mjs` against that built export with a clean environment | **6 boundary states passed**, external requests and `/api/` blocked, no backend installed/running for this test |
| ZIP CRC, archive paths, manifest SHA-256 and sizes | **Passed**; 1,336 archive files, 1,335 manifest entries checked, no unexpected/unsafe paths |
| Local import and asset inventory | **Passed**; 417 imports and 36 static asset references inspected, no missing source imports/assets; four known generated references reported separately |
| Pattern-based static secret scan | **No blocking findings** in included shareable text |
| Lockfile download hosts | All resolved package URLs use `registry.npmjs.org` |

### Existing failures are retained, not hidden

The three existing unit/harness failures are:

1. “main route initial server render has exactly one useful H1 and intro in hero; mounted hero keeps same slot”
2. “main/preview metadata, July variant, and actual rendered WebPage/breadcrumb identity”
3. “mounted seasonal and preview status/countdown/CTA retain behavior alongside stable intro”

All three encounter `ENOENT` because the old custom harness tries to load
`src/seo/PageSeo.js`, whereas current source correctly uses **PageSeo.jsx**.
That harness only tries `.tsx`, `.ts` and `.js` for extensionless imports.
This is not a missing export file. The second test also contains historical
Replit-host identity assertions; merely fixing its loader would not modernise
all its expectations. The original test source is preserved unchanged.

The six passing original checks cover holiday boundaries, accessible map
labelling, preview actions, timeline statuses/reduced motion, and route/year
rollover. Additional export-only checks exercise actual calculations rather than
altering original test expectations.

### Coverage detail

The 15 passing original Chromium tests cover eleven seasonal dates (March,
July, November start/end, December return and preparation, Christmas Eve live,
completion, January and February), the enlarged homepage map and working hero
countdown in holiday/preparation, and live/completed homepage statistics at
1280, 768 and 320 pixel widths.

The six added calculation tests check:

- Inclusive start/end, completion at +1 ms, 26 December and January rollover.
- March–November holiday predicate, July and December workshop separation.
- All 44 representative-midnight arrivals, including India's half-hour.
- UK approach from 22:00, actual 00:00–00:50 delivery pinning and dwell end.
- Midpoint/completion gift/distance/progress estimates and fixed speed.
- Finite interpolation and a real route segment crossing the date line.

The six added browser states are **30 Nov 23:59:59**, **1 Dec 00:00**,
**24 Dec 09:59:59**, **24 Dec 10:00**, **25 Dec 00:15** and
**25 Dec 10:00:00.001**, all UTC in 2026. The static-build repeat uses only
the extracted export's generated files and blocks API/external requests, showing
the tracker can render these states without credentials or its original backend.
Other website features are intentionally unavailable under those restrictions.

## Extraction, dependency and build limitations

The archive was extracted into a fresh temporary directory. Its original source
bytes were checked against the manifest and the package's relative/alias imports
and static asset references inspected. Three imports of
`dist/server/entry-server.js` are intentional build outputs, and
`/artist-artwork/catalogue.json` is generated by the artwork plugin. Generated
build files are not part of the ZIP.

Verification reused the workspace's already-installed dependency directory via
a temporary symlink **outside the archive**. No dependency folder or symlink is
shipped. A new `npm ci` download was not run. The package/lockfile were retained
unchanged; receiving installations still need network access and a compatible
Node/npm/FFmpeg platform. No original secret values were read or copied.

The extracted build ran with no inherited provider credentials. It completed
successfully with existing large-chunk warnings and an SSR warning that the
root-relative `/images/north-pole-hero.webp` is resolved at runtime; that public
image is included. Full-site thumbnail generation used the FFmpeg binary from
the existing installed dependency. A fresh machine's binary installation was
not tested. Public fonts are still external unless the receiving app deliberately
bundles suitable fonts.

## Sanitisation and archive inspection

The allowlist excludes all environment files and `.replit`, private operational
data, database contents, staff/user/subscriber records, local name recordings,
generated greetings, repository history, agent/task records, dependencies,
builds, caches, test outputs, logs, old uploads, archives and operational PHP
download tools. Only schema SQL is included. Public song/mugshot catalogues,
biographies, publicity pictures, demos and artwork are intentional public inputs,
not private database exports.

Source/configuration inspection and pattern scanning check private-key markers,
recognisable provider credential prefixes, credential-bearing PostgreSQL URLs
and suspicious hardcoded password/secret/token assignments. No findings blocked
the export. Environment variable **names**, public provider URLs, public form
identifiers and catalogue names are expected source context, not copied secrets.
This is a targeted sanitisation check, **not an exhaustive security audit** or a
claim that arbitrary unknown secret formats are impossible.

The exporter rejects symlink source files, unsafe archive paths, dependency/
cache/build paths, environment files, nested ZIPs, databases and logs. ZIP CRCs
are verified. `FILE-MANIFEST.json` lists byte counts and SHA-256 values for all
archive files except itself. The external ZIP checksum covers the manifest too.

## Reproduce on receipt

Before building (so generated files do not appear as unexpected inventory):

```sh
npm ci
node handover/inspect-package.mjs
node --test handover/check-tracker.cjs
node --test src/tracker/scripts/tracker-pass2.test.cjs  # known failures above
```

Then:

```sh
npm run build
node handover/check-static-build.mjs
npm run dev
# In a second terminal, point tests to the running host:
node handover/check-browser.mjs https://your-development-host
npx playwright test tests/santa-tracker.spec.js --project=chromium \
  --grep 'seasonal content|homepage enlarged map|homepage retains'
```

The static-build script requires Chromium (system path in this workspace, or
Playwright's installed Chromium). Browser dependencies may need setup elsewhere.
The original Playwright config does not start a server; configure the receiving
host and base URL appropriately. These tests belong to the website, not a
native app's test runner.

## Not claimed

- No iOS, iPadOS or Apple TV device/simulator validation in the receiving project.
- No Swift/SwiftUI/tvOS implementation, WebView support or store approval.
- No fresh dependency installation or full unrelated website test suite.
- No Firefox/WebKit, native postcard share/download, radio, signup, staff login,
  FTPS, external catalogue or database-service verification in this handover.
- No proof that production is currently identical to this snapshot.
