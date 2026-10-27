# Tracker source map and adaptation guide

## Find the current implementation

| Concern | Current source |
| --- | --- |
| Public React route and intro/FAQ | `src/tracker/app/santa-tracker/page.tsx` |
| Preview route | `src/tracker/app/santa-tracker/preview/page.tsx` |
| Router and host wrappers | `src/App.jsx`, `src/main.jsx`, `src/entry-server.jsx` |
| Homepage insertion | `src/pages/Home.jsx` renders `SantaTrackerBanner` after `SantaMessageForm` |
| Enlarged homepage map / live statistics | `src/tracker/components/SantaTrackerBanner.tsx` |
| Clock, random holiday selection and layout | `src/tracker/components/SantaTrackerClient.tsx` |
| Full SVG map, visited line/dots, Santa marker | `src/tracker/components/SantaMap.tsx` |
| Dashboard, stories/postcard and timeline | `SantaStats.tsx`, `SantaStory.tsx`, `SantaTimeline.tsx` in that same components folder |
| Simulation UI / saved clock | `SantaPreviewPanel.tsx`, `src/tracker/lib/santaPreview.ts` |
| Seasonal state, progress, position and counters | `src/tracker/lib/santaRoute.ts` |
| 44 stops, representative IANA zones, dwell and constants | `src/tracker/data/santaRouteStops.ts` |
| Holiday destinations and SVG geometry | `src/tracker/data/santaHolidays.ts`, `worldMapPaths.ts` |
| Brand links / metadata | `src/tracker/lib/trackerBrand.js` |
| Scoped Tailwind and tracker presentation | `src/tracker/tracker.css` |
| Shared reset/typography/variables and host refinements | `src/index.css`, `src/north-pole.css`, `src/north-pole-glow.css` |
| Homepage host sizing | `src/pages/Home.css` plus tracker-banner rules in `tracker.css` |
| SEO / route resolution | `src/seo/catalogue.js`, `routes.js`, `PageSeo.jsx`, `server/tracker-html.js`, `server/public-html.js` |
| Build / route delivery | `vite.config.js`, `vercel.json`, `index.js`, `api/public-page.js`, `scripts/build-public-pages.mjs`, `scripts/build-tracker-pages.mjs` |
| Existing tracker checks | `src/tracker/scripts/tracker-pass2.test.cjs`, `tests/santa-tracker.spec.js`, `playwright.config.js` |
| Additional export checks | `handover/check-tracker.cjs`, `handover/inspect-package.mjs`, `handover/check-browser.mjs`, `handover/check-static-build.mjs` |

### Map and artwork

Both world maps use **bundled SVG path strings**, not map tiles or a maps API.
They have a 1000 × 500 viewBox and 2:1 projection. Coordinates are
`x = (longitude + 180) / 360`, `y = (90 - latitude) / 180`, scaled to the
viewBox. The marker is an emoji; glyph appearance varies across platforms.

The enlarged homepage map is already in the source. Keep the banner layout,
`tracker-banner-map-layout`, `tracker-banner-visual` and `tracker-banner-map`
styles; do not substitute a new small map. Off-season/preparation shows the map,
while live/completed mode shows four stats cards. The main homepage countdown
remains in the homepage hero, not inside the tracker banner.

`public/images/santa-post-stamp.png` is the postcard stamp.
`public/images/santa-tracker-share.png` is social artwork, and
`public/images/santa-radio-logo.png` is host artwork. Preserve their root-relative
`/images/...` URLs or explicitly remap them to receiving-app assets.
The remaining public assets support the full website, not the tracking engine.

## Timing and state — preserve these actual boundaries

The client updates effective time every **one second**, using `new Date()`.
Random facts rotate every six seconds. No server polls or position requests
are needed. Device clock errors affect the estimate.

- All route boundaries use UTC, independently of the viewer's locale.
- Journey: **24 December 10:00 UTC through 25 December 10:00 UTC inclusive**.
  The end is stored as hour **34** relative to 24 December; JavaScript normalises
  this to 10:00 on the 25th.
- `PREPARING`: 24 December 00:00 UTC up to, but excluding, 10:00 UTC.
- `LIVE`: inclusive start and end. At exactly the end, progress is 100% but mode
  is still LIVE. `COMPLETE` starts **one millisecond after** the end and lasts
  until, but not including, 26 December 00:00 UTC.
- `OFF_SEASON`: otherwise. On 26 December the UI is off-season again. The
  dashboard's raw progress/visited numbers still describe that year's finished
  route, while `getVisitedStops` returns an empty set outside LIVE/COMPLETE.
  On 1 January annual calculations reset to the new year's route.
- Departure countdown targets this year's 24 December 10:00 until the instant
  passes, then next year's departure. A raw countdown during the live journey
  therefore points to next year; the UI hides it in LIVE/COMPLETE.

### Stops, clocks and UK window

44 broad regions are scheduled at their **representative place's local midnight
on 25 December**. The route list is sorted by actual arrival time, not blindly
played in array order. `getStopUtcOffset` uses `Intl.DateTimeFormat` with IANA
zones on Christmas Day of the requested year. This accounts for that zone's
Christmas-time DST rules and half-hour offsets. Arrival is
`24 December 00:00 UTC + (24 - offset) hours`; India uses the fractional hour.
Native ports need equivalent, current time-zone data and fractional-hour maths.

Several regions share arrival times. Current-stop selection normally chooses
the last arrived entry in sorted order, even after its dwell, until another
arrives. `LIVE_AT_STOP` means a dwell interval is active; otherwise `IN_TRANSIT`.
`getCurrentStop` can therefore represent the last stop, not a GPS location.
The transit card labels its clock “Last Stop’s Local Time”.

UK delivery is 25 December **00:00–00:50 UTC** (exclusive dwell end).
`UK_SPECIAL_WINDOW` begins two hours earlier, at 24 December **22:00 UTC**,
and ends at 00:50. Before midnight it is an *approaching* window, not proof of
UK delivery. During actual UK dwell, current stop and marker are explicitly
pinned to the UK despite simultaneous arrivals. `approachingUK` only applies
before midnight and provides the countdown card.

Some current UI copy (notably the homepage status and UK story) uses a delivery
phrase throughout the wider special window. The dashboard headline distinguishes
approaching from delivering. This is documented as-is, not corrected in this
handover. Do not infer an extra feed from any “live” wording.

### Position and estimates

- The marker stays at a stop during dwell and linearly interpolates latitude
  and longitude between dwell end and next arrival.
- Longitude takes the short arc across ±180° and wraps back into range.
  The SVG polyline joining visited dots is a simple list of points, not a
  geodesic/date-line-split route. Do not confuse that line with marker maths.
- UK dwell is pinned. After the last stop, and in COMPLETE, position is Hawaii,
  not an animated return flight to the North Pole.
- Progress is elapsed fraction of the 24-hour journey, clamped to 0–100.
  Dashboard progress rounds to one decimal place.
- Gifts are `round(2,500,000,000 × progress fraction)`.
- Distance is `round(510,000,000 km × progress fraction)` and the UI converts it
  to miles. Live speed is a fixed playful **6,650,000 mph**, not distance/time
  derived from location samples. Counts are arrival-based, not household data.
- No real children, addresses, deliveries or GPS devices are queried.

## Holiday UI is not a dashboard mode

`isHolidaySeason` is March **through 30 November inclusive**, using UTC months.
January/February are ordinary off-season North Pole presentation. July has
“Christmas in July” content. On **1 December UTC**, holiday presentation ends.
1–23 December shows workshop dispatches even though the engine still returns
`OFF_SEASON`; 24 December 00:00 starts `PREPARING`.

The dashboard function initially returns a North Pole position and `holiday:null`.
The client and homepage independently pick random bundled holiday destinations
when entering holiday season; selections can differ between those components or
after reload. The client overrides displayed headline, location and marker;
stats/story receive that selection separately. Stats include a playful “Maybe”
next destination, rotating speed labels and an approximate longitude-derived
postcard clock (`round(lng/15)` hours), **not an IANA local time**.
Holiday speed advances every six seconds; postcards and workshop dispatches
rotate every fifteen seconds. UI holiday labels do not mean the core route
engine has moved into a GPS/holiday-tracking mode.

## Preview controls and concrete checks

`/santa-tracker/preview` is an unlinked, noindex development route, not an
authenticated staff tool. Public route and homepage ignore preview storage.
Only the preview route loads localStorage key **`santa-tracker-preview`**.
It stores enabled state, real activation milliseconds, simulated start,
speed multiplier and jump target. Simulated time is
`start + (Date.now() - activatedAtRealMs) × multiplier`; it advances while closed.
Reset disables it and removes the storage key. Storage errors are caught.

Speeds: 1×, 10×, 60×, 300×. Jumps use the device's current UTC year:
route start **24 Dec 09:55** (five minutes before departure), Australia 13:00,
Asia 15:30, Middle East 19:45, UK “arrival” **23:30** (actually approaching),
USA **25 Dec 05:00**, complete **25 Dec 10:05**. All are UTC.
“Run full journey” maps 24 hours into 2/5/10 real minutes, starting at 09:55.
It does not auto-stop, and its 24-hour interval ends five minutes before the
journey's true end. There is no rendered pause button despite an unused import.

Use fixed browser clocks or pure functions for exact boundaries:

| UTC instant | Expected engine/UI |
| --- | --- |
| 2026-02-28 23:59:59 | OFF_SEASON, North Pole |
| 2026-03-01 00:00 | OFF_SEASON, holiday UI |
| 2026-07-15 12:00 | OFF_SEASON, July postcards |
| 2026-11-30 23:59:59 | OFF_SEASON, still on holiday |
| 2026-12-01 00:00 | OFF_SEASON, North Pole/workshop dispatch |
| 2026-12-24 00:00 / 09:59:59 | PREPARING |
| 2026-12-24 10:00 | LIVE, Pacific kickoff, 0% |
| 2026-12-24 18:30 | India representative midnight (UTC+5:30) |
| 2026-12-24 22:00 / 23:30 | UK_SPECIAL_WINDOW, approachingUK true |
| 2026-12-25 00:00 / 00:49:59 | UK_SPECIAL_WINDOW, UK pinned |
| 2026-12-25 00:50 | UK_SPECIAL_WINDOW ended |
| 2026-12-25 10:00 exactly | LIVE, 100% |
| 2026-12-25 10:00:00.001 | COMPLETE, 44 visited |
| 2026-12-26 00:00 | OFF_SEASON, no visited map dots |
| 2027-01-01 00:00 | OFF_SEASON, new annual journey, 0 visited |

## Minimal browser integration (no website services)

Keep `src/tracker/components`, `lib`, `data` and `tracker.css` together. In a
Vite host use React and the Tailwind v4 Vite plugin, and configure **`@` to mean
`src/tracker`**, not `src`. The nested `tsconfig.json` documents this alias, but
the actual Vite resolver must also be configured. This is a Vite/React app;
Next-like folder names and `"use client"` do not make it a Next.js application.

For a minimal host, use a **separate minimal Vite config in the receiving
project**, rather than importing the exported root config's service plugins:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src/tracker', import.meta.url)) } },
  server: { host: '0.0.0.0', port: 5000, allowedHosts: true },
});
```

The tracker browser dependencies are React/ReactDOM, `lucide-react` and
`html-to-image` (lazy, postcard only). React Router supplies banner links and
`react-helmet-async` supplies page/preview metadata; keep these if using those
components. Vite, its React plugin, TypeScript and Tailwind build the web code.
Do not import `src/App.jsx`, the full root `vite.config.js` or audio providers
when the goal is tracker-only use.

For exact current full-page intro/FAQ/SEO, render the existing public page under
`HelmetProvider` and a router; include its `src/seo` modules and public catalogue
dependencies. For a smaller integration, render the original
`SantaTrackerClient` inside `<main className="santa-tracker">` and pass the same
`heading` and `introCopy` from the current page. Copy the FAQ deliberately if
wanted. A bare client without these props uses its own default heading/copy.
Use `showPreview` only in development.

Import `src/index.css` (or deliberately reproduce its reset, root colour
variables, typography, box sizing and focus treatment), `tracker.css`,
`north-pole.css` and `north-pole-glow.css`, in the host's equivalent cascade
order. The original root mounts shared CSS and page imports as shown in
`src/App.jsx` and `src/main.jsx`; preserve their effect rather than dropping
them. The `.santa-tracker` wrapper is essential for scoped colours and layout.
Keep the banner's own wrapper classes and its Tailwind utilities.
The shared styles have site-wide selectors: in another host scope equivalent
rules intentionally instead of globally restyling that app.

Google Fonts requests provide **Cinzel**, **Inter**, **Dancing Script** from
`index.css` and **Caveat** for handwritten postcards from metadata. For a smaller
host, retain the Caveat stylesheet link from the preview route or public page
metadata. Offline/native versions need properly licensed bundled fonts or an
explicit fallback; do not assume external font requests work offline.

Serve the stamp image at its existing path. The map itself requires no external
imagery. Keep footer/radio/navigation only if the receiving app wants them;
they are website chrome, not required to calculate or show the journey.
Current tracker links to SantaGuy availability; creator attribution elsewhere
is separate. Do not change SantaGuy's hosted site.

## Native iOS and Apple TV constraints

Port the bundled stop data, seasonal rules, time-zone calculations, interpolation
and preview model if building Swift/SwiftUI, rather than calling an invented API.
React JSX, SVG markup, CSS utilities, DOM timers and browser APIs do not run as
native Swift views. No native implementation is supplied here.

Postcard export uses DOM capture (`html-to-image`), fetch, canvas/data URLs,
File/Blob and `navigator.share`/`canShare`, falling back to an anchor PNG download.
HTTPS, image/font fetch permissions, browser capabilities and embedding policies
affect it. Test failure/cancel cases and supply a native alternative if needed.
Do not assume downloads or native share sheets exist on Apple TV.

For tvOS, choose a supported native rendering architecture rather than assuming
WKWebView availability. Validate focus order/visible focus, Siri Remote actions,
timeline navigation, readable distance text, safe areas, reduced motion,
VoiceOver names and non-colour stop states. On iOS test Dynamic Type, narrow
screens, safe areas, background/resume clock updates, offline time zones/fonts,
external links and real sharing. None of those device checks has been performed
in the receiving project by this handover.
