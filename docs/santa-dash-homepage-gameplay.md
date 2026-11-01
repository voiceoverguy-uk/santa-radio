# Homepage Santa Dash gameplay preview

## Scope

The homepage Santa Dash banner now includes a dark landscape handset.
The Apps page is unchanged. Both approved rooftop illustrations, the heading,
the artwork's store destination and the separate download link are retained.
The complete handset is scaled to two thirds of the original large desktop
version, including the bezel, and sits inside the artwork's bottom-left corner
with the same small inset. On narrow mobile its displayed width is capped at
48% of the artwork to keep the baked-in title and store badge unobscured.
The artwork keeps its original dimensions.
The whole handset (including frame, video and still) is 90% opaque; surrounding
artwork, heading, store links and pause/play controls remain fully opaque.
Nothing has been published.

## Media

- Source: supplied 18,651,863-byte MOV, approximately nine seconds.
- The recording's 90-degree display matrix makes it landscape, 2868 × 1320.
  Rotation was applied once during conversion, not with CSS.
- Delivery: `public/media/santa-dash-gameplay-v1.mp4`, **1,414,192 bytes**
  (1.41 MB / 1.35 MiB), approximately **92.4% smaller** than the MOV.
- 1434 × 660, preserving the exact 239:110 gameplay aspect ratio.
- H.264 High Profile Level 4.0, 30 fps, yuv420p, square pixels, BT.709
  limited-range colour, 9.033 seconds. No audio track.
- Faststart MP4 metadata precedes media bytes for progressive playback.
- Poster: `public/media/santa-dash-gameplay-poster.webp`, **55,484 bytes**,
  956 × 440, extracted from the actual gameplay.

The small delivery assets are normal static application files; the original
18.7 MB recording is not copied into the public site. Do not replace content at
the immutable `-v1.mp4` URL after publishing: use a new versioned filename.

## Behaviour

- No MP4 source is attached before the banner approaches within 200 px.
- Silent, inline, continuous playback starts only while visible.
- Scrolling away or hiding the document pauses playback. Explicit manual pause
  persists when the visitor scrolls away and returns.
- Reduced motion starts with the still and no MP4 request. Play is an explicit
  opt-in; changing to reduced motion again cancels the previous opt-in.
- Loading, rejected autoplay and media errors leave the gameplay still visible.
  Blocked autoplay exposes Play; media errors expose a clear retry action.
- The keyboard-accessible pause/play button is outside both store links.
- Artwork crossfades only during playback and stops for reduced motion/pause.
- The complete game frame is contained inside the screen. Bezel details do not
  cover the game's HUD or controls.
- The plain Node production server now sends MP4 MIME/byte-range headers.
  Existing Vite/Vercel static serving remains in place.

## Verification

Commands:

```sh
npm run build
node --test scripts/santa-dash-video-serving.test.mjs
npx playwright test tests/santa-dash-gameplay.spec.js tests/home-santa-dash.spec.js --project=chromium
```

Completed:

- Production client and SSR build, including 1,576 prerendered canonical pages.
- Three production-serving checks: video/poster MIME and HEAD metadata,
  bounded/open/suffix ranges plus invalid ranges, and MP4 faststart order.
- Ten focused Chromium browser checks passed across the verification runs.
  They cover actual decoding/playback/looping at 1440, 390 and 320 px;
  initial no-video-request lazy loading; reduced motion with explicit Play;
  held-response loading still, failed-media still and retry; rejected autoplay
  and Play retry; keyboard pause/play; persistent pause across scrolling;
  offscreen pausing/resume; visibilitychange handling; retained artwork,
  responsive geometry and App Store links opening the expected new-tab URL.
- The existing banner checks also cover 768/767 px and both keyboard-activated
  download links. Store responses were controlled test pages, not purchases.
- Preview restarted and rendered; desktop/mobile section captures are in
  `generated-artifacts/santa-dash-gameplay/` and
  `generated-artifacts/santa-dash-home/` (ignored generated output).
- Changed-file review confirms no Apps-page, dependency or security-flow edits.

Autoplay rejection and document-hidden transitions were simulated through the
browser's media/visibility interfaces for deterministic checks. Real H.264
decoding, playback progression and looping were exercised. Physical iPhone
Safari (including Low Power Mode/backgrounding) and a future published host
have not been verified; neither is implied by Chromium mobile viewport tests.
