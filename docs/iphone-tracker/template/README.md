# Santa Radio — iPhone Tracker source handover

This is an **iPhone-only integration handover**, not an Xcode project or a native
app. It packages the current website tracker, not the original imported archive
or the previous whole-site export. The website has not been changed.

The tracker is a **local-clock-driven estimated journey**, not GPS, a live
location feed or an official delivery service. Core tracking needs **no original
website server, database, API key, account or credentials**. All route data, map
geometry, artwork and fonts required to render are bundled.

## Build and run

Use Node.js 22 and npm (verification versions are in `VERIFICATION.md`).

```sh
npm ci
npm test
npm run build
npm run preview
# Open http://localhost:5173/ and http://localhost:5173/?preview=1
npm run test:browser -- http://localhost:5173/
```

`npm ci` needs internet access to the public npm registry, but the **built core
tracker does not need internet**. The exact versions and integrity hashes are
locked. `node_modules` is intentionally not shipped. Browser tests use Playwright
Chromium; on a development machine without it, run `npx playwright install chromium`
(and install the OS libraries Playwright requests), or set `CHROMIUM_PATH`.
Do not put dependencies or test browsers in your iPhone bundle.

`dist/` is a ready-built static demonstration. A clean rebuild produces it from
the included source. Do not use Vite's development server in a shipping app.
The web demo entry is `/`; `?preview=1` enables development controls. Vite fallback
also accepts `/santa-tracker` and `/santa-tracker/preview`. Bundled-file integration
should use **index.html plus the query**, not pretend those are physical folders.

## Simplest appearance-preserving iPhone integration: bundled WKWebView

The receiving app can be UIKit, SwiftUI, React Native, Flutter or something else.
The wrapper is the receiving developer's choice. Bundling the static web build
inside a WKWebView preserves the supplied React/CSS/SVG implementation more
directly than recreating it with native controls.

1. Add the **entire `dist` directory** as an app-bundle folder resource, retaining
   `index.html`, `assets/` and all filenames. Avoid flattened resource copies.
2. Obtain the bundled `dist/index.html` URL. For a native WKWebView wrapper, use
   `loadFileURL(indexURL, allowingReadAccessTo: distDirectoryURL)`. Grant read
   access only to this resource directory, not the entire app sandbox.
3. The build has relative asset URLs and a classic IIFE script (no module script
   or lazy chunk request). `scripts/finalize-build.mjs` removes Vite's module
   attribute intentionally. Keep this step when rebuilding. The postcard stamp
   and CSS fonts are build-managed resources, not `/images` or `/fonts` requests
   to an assumed website server.
4. `viewport-fit=cover` and the export host's `env(safe-area-inset-*)` padding
   account for browser safe areas. Decide whether the native container already
   applies insets; avoid double-insetting. Keep the map's 2:1 aspect ratio,
   document scrolling and responsive utility classes. The website's generous
   top/bottom tracker spacing is retained; there is no website navigation or
   fixed radio dock in this package.
5. Handle external navigation in the wrapper's navigation delegate. Open only
   explicitly approved HTTPS links in the system browser or a deliberate
   in-app browser. Reject unexpected schemes and do not let unrelated sites
   replace the local tracker. Do not enable arbitrary file access, disable
   origin checks or add a broad App Transport Security exception to make sharing
   work. No JavaScript/native bridge is supplied or required for core tracking.
6. Re-read device time on foreground/resume (the existing one-second timer
   re-evaluates `new Date()`). Test after suspension, clock changes and time-zone
   changes rather than treating a suspended timer as an authoritative clock.

These are integration instructions, **not a claim that WKWebView has been tested**.
The checks here run in desktop Chromium at phone viewport sizes, including a
local `file:` build check where recorded. A Chromium file-origin result is not
proof of WKWebView compatibility. Test on your minimum supported iOS version
and a real iPhone before shipping; there is no supplied simulator/Xcode project.

## Source map and exact export-only adaptations

| Area | Entry |
| --- | --- |
| Minimal web host | `index.html`, `src/main.tsx`, `src/host.css`, `src/fonts.css` |
| Current public layout, intro and FAQ | `src/tracker/app/santa-tracker/page.tsx`, `src/questions.js` |
| Clock, seasonal layout and random holiday | `src/tracker/components/SantaTrackerClient.tsx` |
| SVG map / estimates / stories / timeline | `SantaMap.tsx`, `SantaStats.tsx`, `SantaStory.tsx`, `SantaTimeline.tsx` in that folder |
| Preview controls / simulation model | `SantaPreviewPanel.tsx`, `src/tracker/lib/santaPreview.ts` |
| Route engine, state, countdown and interpolation | `src/tracker/lib/santaRoute.ts` |
| Stops, holidays, facts, SVG continent geometry | `src/tracker/data/` |
| Current brand links / metadata helper | `src/tracker/lib/trackerBrand.js` |
| Scoped presentation and generated Tailwind utilities | `src/tracker/tracker.css` |
| Local stamp, Inter, Cinzel, Caveat and OFL notices | `src/assets/` |
| Original page entry points for reference only | `reference/` (not compiled) |
| Source allowlist hashes / archive file hashes | `SOURCE-MANIFEST.json`, `FILE-MANIFEST.sha256` |

Alias `@/` means **src/tracker/**, not src. Vite/React is the host;
Next-like folder names and `"use client"` do not imply Next.js.

The six runtime components, route/preview/brand helpers and six data files are
copied from current source. **Only SantaStory's stamp path is adapted** to a
build-managed relative asset. The public page retains its heading, intro, FAQ
and link labels. Website-only `PageSeo`/catalogue imports are removed, its FAQ
array is copied alone, and its two unrelated page links become absolute HTTPS
links to the original site. The original entry points are retained as reference.
Preview uses the unchanged client/controls without `react-helmet-async`.

Shared website styles are replaced by the precise reset, variables, typography
and focus block used by this page and the two applicable shared FAQ rules.
The tracker stylesheet is retained, except its Caveat URL becomes build-relative
and the **unused homepage-only backdrop URL** becomes `none`. No homepage
banner or its background image is exported. Inter and Cinzel, externally loaded
by the website, become local copies of the same families and weights. Caveat is
the existing bundled font. Safe-area padding is export-only. Emoji flags and
the Santa marker remain system glyphs and may look different on an iPhone.

No full app router, SEO catalogue, SSR server, database, authentication, radio,
payments, FTPS, contact system, private records, test credentials, operational
data or history is included. The current FAQ's reference to listening describes
the original website; **this package has no radio player**. Social URLs in the
brand helper are strings, not image requests; the social preview image is not
needed to render the local tracker and is not included.

## Timing, annual rollover and seasonal content

All boundaries use **UTC**, independently of the viewer's selected time zone.
The device clock determines the estimate. An incorrect device date produces an
incorrect tracker; there is no server time synchronisation.

- **60 stops / 37 Christmas UTC offsets**. Departure: **24 December 10:00 UTC**.
  The journey is LIVE from that instant, **excluding** the end instant.
- End: **25 December 11:20 UTC** (hour `35 + 1/3` relative to 24 December).
  The final stop is **American Samoa after Hawaii**, not Hawaii.
  COMPLETE starts **at exactly 11:20**, lasting until 26 December 00:00 UTC.
- PREPARING is 24 December 00:00–10:00 UTC, exclusive at 10:00.
- OFF_SEASON applies otherwise. Holiday presentation runs March through
  **30 November inclusive**; July gets its own postcards. January/February are
  North Pole off-season. On **1 December UTC**, Santa returns to the North Pole:
  1–23 December has workshop dispatches but the engine still says OFF_SEASON.
- On 26 December the seasonal UI returns; raw dashboard progress and visited
  counters can still describe that year's finished route, while the visited-map
  set is empty outside LIVE/COMPLETE. On 1 January calculations reset for the
  new year. Preserve these differences instead of inventing a return flight.
- The departure countdown targets this year's 24 December 10:00 until it
  passes, then next year. The UI hides it during LIVE/COMPLETE.

The client ticks once per second. Festive facts and holiday speed labels rotate
every six seconds; postcards/workshop dispatches every fifteen seconds. Random
holiday selection occurs on entry to holiday season/reload, not along the
Christmas delivery route. Holiday approximate clocks use `round(longitude/15)`,
not IANA zones. Keep playful antics separate from sourced/qualified festive facts.

### Local midnight, UK window and estimates

Each delivery stop arrives at a **representative location's local midnight on
25 December**, not midnight at every place within its broad region. IANA
`Intl.DateTimeFormat` support and current time-zone data are required. The route
computes Christmas offsets for the requested year (including applicable DST,
half-hour and quarter-hour offsets), then sorts arrival times. Do not replace
this with the viewer's offset or whole-hour maths.

Shared arrivals choose the last arrived entry in sorted order, except UK dwell
is explicitly pinned. UK's special window starts **24 December 22:00 UTC**:
before midnight it is *approaching*, not delivery. Actual UK dwell is
**25 December 00:00–00:50 UTC**, exclusive at 00:50. Some playful story wording
uses delivery language during the broader window; this export preserves it.
The dashboard headline distinguishes approaching from delivering.

Marker position stays at a stop during dwell, then interpolates to the next.
Longitude crosses the short arc at ±180°. The visited-dot SVG polyline is simpler
and is not geodesic/date-line-split. UK dwell stays pinned; completion stays at
American Samoa. SVG paths and the map are bundled, not map tiles or a map service.

Journey progress is elapsed fraction, clamped to 0–100%, rounded to one decimal
in the dashboard. Gifts are `round(2,500,000,000 × fraction)`; distance is
`round(510,000,000 km × fraction)`, displayed in miles. LIVE speed is a fixed
playful `6,650,000 mph`, not derived telemetry. No real deliveries or children
are queried.

## Preview controls

Use `?preview=1` only for development. The ordinary page ignores preview
storage. The preview reads `santa-tracker-preview` from localStorage, catching
unavailable-storage errors. Simulation is
`simulatedStartMs + (Date.now() - activatedAtRealMs) × speedMultiplier`;
it continues to advance between openings. Reset removes storage and uses real
time. Speeds: 1× / 10× / 60× / 300×. Full runs cover **25h25m** (five minutes
before departure through completion) in 2/5/10 real minutes. They do not auto-stop.

Jumps use the **current device UTC year**, all times UTC:
route-start 24 Dec 09:55; Chatham Islands 10:15; Australia 13:00; Asia 15:30;
Kathmandu 18:15; Middle East 19:45; UK “Arrival” 23:30 (**approach**, not delivery);
USA 25 Dec 05:00; Hawaii 10:00; American Samoa 11:00; Complete 11:20.
There is no pause button despite an unused import. Seasonal tests use a fixed
browser clock; there is no public holiday date-selector UI to recreate.

## External links and optional postcard export

Core render, fonts, stamp and calculations are local. No external font stylesheet
is used in the package. The two FAQ links open original website pages.
Postcard share text points to `https://www.santaradio.co.uk/santa-tracker`.
Brand constants also contain the SantaGuy voice-service destination; this is
not a tracking API or an instruction to replace SantaGuy's existing tracker.
No links are fetched just to render the tracker.

Postcard sharing is **optional and browser-dependent**: `html-to-image` captures
DOM/SVG/canvas after `document.fonts.ready`, fetches the stamp and produces a PNG.
It uses File/Blob, data/blob URLs, `navigator.canShare` / `navigator.share`, then
an anchor download fallback. `file:` fetch restrictions, secure-context rules,
user activation, WKWebView download handling and share-sheet availability can
prevent export even when the tracker renders correctly. A local read grant
does not guarantee fetch, canvas export or Web Share support.

The original error and download behaviour is retained. If the receiving app
needs dependable sharing, implement a **narrow native export/share bridge** or
deliberately hide the optional control, with product approval. Neither is
implemented here. Do not promise WKWebView downloads, add a hidden tracking
service or send postcard content to an invented backend.

## If choosing a native SwiftUI port instead

There is no assumption that your app uses SwiftUI. A native port must recreate:
the 60-stop data and IANA Christmas offsets; UTC seasonal/year boundaries;
arrival sorting, dwell, shared arrivals and UK pinning; countdowns, progress and
map interpolation; SVG geometry/projection and marker styling; dashboard,
vertical phone timeline, facts/postcards and random/rotation behaviour; the
Cinzel/Inter/Caveat typography, colours, gradients, spacing and responsive
layout; preview simulation/storage; accessibility labels, reduced-motion
behaviour and any native postcard rendering/sharing.

React JSX, CSS/Tailwind, DOM timers and `html-to-image` do not become native views
by copying their files. Use equivalent native date/time-zone support, not a new
API. Validate exact seasonal boundaries against the included checks.

## Before shipping in the receiving app

Test real WKWebView/local resource loading in airplane mode, notch/home-indicator
safe areas, portrait/landscape narrow layouts, VoiceOver order/labels, enlarged
text (web text is not automatically native Dynamic Type), reduced motion,
suspend/resume and device-clock changes, time-zone availability, external-link
handling, and postcard success/failure/cancellation with native share sheets.
These device checks remain receiving-app work. No signing, App Store submission,
Apple TV, iPad-specific adaptation or Android implementation is included.
