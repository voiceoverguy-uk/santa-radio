# START HERE — Santa Radio source and Santa Tracker handover

This is a sanitised snapshot of the **current Santa Radio website source**, not
the old imported tracker archive. The original source files are copied unchanged.
No production code, design, route calculations or functionality was changed for
this export. Read `VERIFICATION.md` for the snapshot time and actual check results.

## Public reference, not a preview address

- Tracker: **https://www.santaradio.co.uk/santa-tracker**
- Homepage, including the enlarged tracker map: **https://www.santaradio.co.uk/**
- These are the configured preferred public references in the current source.
  Temporary Replit development previews are not the public website address.
- The platform also reports `https://santa-radio.replit.app` as its published
  Replit address. The preferred custom-domain reference is served through Vercel.
  Do not replace the configured www links with the temporary preview host.
- The public tracker returned HTTP 200 and rendered its map, holiday status and
  current introductory wording when checked on 27 October 2026. A first-visit
  cookie dialog covered part of the map in the visual check. This verifies a
  reachable, rendered live tracker, **not byte-for-byte deployment parity**.
  The ZIP is the authority for this source snapshot; the live site can change.
  The homepage also returned HTML containing its tracker feature, but its
  first server-rendered placeholder does not establish the enlarged map's live
  client-side sizing. That enlargement was verified in this source's browser
  tests, not asserted to match the currently deployed homepage.

## Most important answer: where does the tracking data come from?

**This is a clock-driven estimated Christmas journey, not GPS and not an external
live tracking feed.** Bundled route stops, time-zone rules and the device's clock
drive the position, countdowns, timeline and playful estimated statistics.

**No tracking backend, API key, database, original Replit server, radio service or
SantaGuy server needs to remain running when the tracker is bundled into another
project.** A web build still needs its static files served; native code must be
adapted and compiled in the receiving app. External Google fonts, links and
browser sharing are separate from the tracking calculations.

## Read next

1. `TRACKER-GUIDE.md` — exact source map, timing, styles and minimum integration.
2. `VERIFICATION.md` — results, limitations and sanitisation findings.
3. `RECEIVING-AGENT-MESSAGE.txt` — paste into the other project's chat.
4. `EXPORT-SCOPE.json` — explicit included original source paths and exclusions.
5. `FILE-MANIFEST.json` — bytes and SHA-256 for every file except itself.

The manifest cannot checksum itself. The separate `.zip.sha256` file checks the
entire ZIP, including the manifest. Verify it with `sha256sum -c <zip>.sha256`.

## Full website startup

The root package and lockfile are unchanged: Node **22.x**, npm, React **18.3.1**,
Vite **6.4.x**, TypeScript **5.9.x**, Tailwind **4.2.x** and React Router **7.x**.
Use `npm ci` (not a fresh dependency resolution).

```sh
npm ci
npm run dev          # prepares shared audio, Vite on port 5000
npm run build        # audio, browser build, SSR bundle, public-page generation
npm start           # Node/Express serving the built website
```

`npm run preview` is Vite preview, not equivalent to the full Express production
server or Vercel API routing. `vercel.json`, `api/`, `index.js`, `vite.config.js`,
`src/entry-server.jsx` and `scripts/build-public-pages.mjs` preserve host context.
`scripts/build-tracker-pages.mjs` is an older narrow metadata generator; the
current package build uses `build-public-pages.mjs` instead.

The main dev/build commands import unrelated full-website middleware and audio
fingerprinting. They are **not** the minimal tracker dependencies. This export
includes the four shared audio ingredients needed by those commands, but excludes
local name recordings, rendered greetings and prepared audio caches.

Full-website optional services are not transferred:

| Website feature | Separate configuration/service |
| --- | --- |
| Radio playback/metadata | Public streaming/metadata hosts; network required for radio |
| Yesterday's chart/collector | PostgreSQL via `RADIO_HISTORY_DATABASE_URL` or `DATABASE_URL`; `RADIO_HISTORY_ENABLED`; external collection schedule |
| Name requests/staff access | PostgreSQL schema in `database/`, Clerk publishable/secret keys, staff role configuration in that provider |
| Workshop preview gate | Database-backed limits, `SESSION_SECRET`, ephemeral `SANTA_STUDIO_TEST_CODE_1`…`5`, `SANTA_STUDIO_TEST_EXPIRES_AT` |
| Recorded name catalogue/greetings | Existing public HTTPS catalogue and audio hosts; FFmpeg for greeting rendering |
| Optional FTPS publication | `SANTA_FTPS_*` configuration on the receiving server, only if deliberately porting greeting publication |
| Contact/song/signup forms | External Brevo forms and their existing provider configuration/consent policies |
| Analytics, video, consent | Existing privacy-controlled external services; not a tracker dependency |

Do not copy credentials from the original project or enable these services merely
to show the tracker. Disabled/unconfigured services may show unavailable states;
this is a source handover, not a transfer of operational accounts or records.
The database files contain schema only, not user data. Public song/artist/mugshot
catalogues, publicity biographies, artwork, certificates and audio demos are
included because the website intentionally publishes them.

Only tracker tests and required runtime/build scripts are included. Unrelated
package test commands and editorial/import utilities are not promised to run:
their private inputs and original uploaded exports are intentionally absent.

## Historical documentation

`historical-transfer/` is provenance only. Its old manifest, dependency notes,
verification and `INTEGRATION.md` describe earlier imports and can contain stale
hostnames, framework assumptions, creator-credit descriptions and checks.
**They do not override this guide, current source, or this export manifest.**
No old uploaded ZIP is included. No change to SantaGuy's existing tracker is
requested or implied.

## Apple platforms

This is browser React/TypeScript/CSS, **not Swift, SwiftUI or a native iOS/tvOS
implementation**. The receiving project must decide how to reuse the data and
calculations, adapt presentation, and verify devices. Do not assume a browser
WebView is supported on tvOS. Apple TV focus, remote navigation, safe areas,
large-screen readability, accessibility, sharing and store compliance remain
receiving-project work; no native-device compatibility is claimed.
