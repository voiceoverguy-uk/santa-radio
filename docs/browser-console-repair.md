# Browser console repair verification

Initial investigation on 27 October 2026 using extension-free system Chromium through the
HTTPS development proxy. No production deployment or hosting-policy changes
were made. The original Safari console image was not available in this task
workspace; its messages are taken from the supplied task description.

**Update:** Later Safari screenshots are now available and were reviewed below.
The original investigation is retained as historical evidence; the follow-up
does not claim that Chromium results resolve the Safari warning.

## Findings and attribution

| Resource/message | Evidence | Attribution/action |
| --- | --- | --- |
| `https://www.santaradio.co.uk/santa-radio-celebrity-mugshots.png` | Direct request returned HTTP 404, `text/html; charset=utf-8`. Chromium image requests on homepage and gallery failed with `net::ERR_BLOCKED_BY_ORB`. | Broken site resource. Both references now use `/mugshot-images/santa-mugshots-logo-1.png`. |
| Logos still invisible despite successful image loading | The first new visibility test found a shared CSS rule setting both logo wrappers to `display: none`. | Removed that rule; kept the existing 220px homepage and 200px gallery maximum widths, labels and surrounding layout. |
| Safari `safari-web-extension` script blocked by CSP | Not reproduced in extension-free Chromium. That scheme identifies an extension resource, not a site script. | Do not relax CSP to accommodate extension injection. The exact enforcing policy cannot be determined from the supplied description. |
| Two Safari permission-denied resources | Their URLs are not visible in the supplied description and remain **unknown**. | No attribution to images, YouTube, radio, or other resources is justified without expanded request details. |
| Possible fullscreen warning | No original Safari warning reproduced. Song `allowFullScreen` existed without an explicit `fullscreen` entry in `allow`. | Added the explicit directive. This makes intent consistent but does not prove the source of the Safari warning. |
| Chromium “Allow attribute will take precedence over 'allowfullscreen'.” | Reproduced after the change, while effective fullscreen policy allowed fullscreen and a real gesture entered it. | Informational precedence warning; both declarations agree. Not a playback failure. |
| Chromium “No available adapters.” | Console location was the YouTube frame, on both TV and song embeds. | Provider/browser rendering diagnostic, not evidence that a site-owned resource is missing. |

Neither the proxied app documents inspected nor the existing app configuration
declared a CSP or Permissions-Policy responsible for the reported Safari
warnings. YouTube's HTTP 200 song-frame response supplied its own CSP,
Cross-Origin-Resource-Policy `cross-origin`, report-only opener/embedder
policies, and a Permissions-Policy listing client hints. Do not change those
provider policies. Direct navigation to the preview host does not inspect the
outer Replit editor iframe's effective policy, so an outer-frame restriction
remains unconfirmed, not an established explanation.

## Playback and fullscreen boundary

- The real homepage stream was contacted without interception. YouTube's
  diagnostic request reported `Sign_in_to_confirm_you_re_not_a_bot`. This is a
  provider restriction, not an app-consent failure.
- After explicitly enabling external media on the Chris Rea song page, the real
  `/embed/DDt3u2Ev1cI` returned HTTP 200 and showed the expected title/channel.
  The media element remained paused at zero with `readyState: 0`, and a visible
  native player fullscreen control was unavailable. Actual song playback was
  **not verified**; rendering the title or receiving HTTP 200 is not playback.
- The real song frame reported `fullscreenEnabled: true` and effective
  `fullscreen` permission. An ephemeral diagnostic button inserted into that
  frame, clicked with a real browser gesture, successfully requested fullscreen:
  both the top document and frame had fullscreen elements. This confirms
  delegation through the directly opened development host, not native YouTube
  controls, the outer editor iframe, or physical Safari. The diagnostic button
  was browser-only and is not shipped.
- The homepage TV was not granted fullscreen or other new capabilities. Its
  muted, inline, non-interactive settings and homepage-only privacy exception
  remain unchanged. Song and karaoke embeds still wait for explicit media
  consent, and withdrawal removes them.

## Regression results

- `npm run build`: passed, including client build, bundled SSR and prerendering.
  Existing build warnings include an unresolved `/images/north-pole-hero.webp`
  CSS reference; this is separate from the repaired Mug Shots logo.
- `node --test scripts/seo-serving.test.mjs`: all four checks passed.
  Coverage now includes homepage/gallery built HTML references, HTTP 200 PNG
  bytes identical to the public asset (not an HTML fallback), HEAD behaviour,
  and the existing Vercel filesystem routing reaching the copied asset.
- Chromium cookie-experience suite: all 31 checks passed.
- Chromium video-autoplay suite: all three checks passed, including new song
  and karaoke consent, explicit/effective fullscreen policy, no forced autoplay,
  and withdrawal assertions. Provider responses are mocked in these tests.
- The new homepage/gallery logo check passed after the hidden-wrapper fix:
  both images are visible, decode successfully, have same-origin sources and
  HTTP 200 PNG responses, preserve their accessible labels, and make no
  request to the old remote filename.
- The first combined run was 36 passed / 7 failed; the new logo failure was
  fixed and rerun successfully. The other six failures were in unchanged
  Mugshots checks: catalogue counts (649 versus expected 636), homepage count,
  imported count (748 versus expected 735), Steve Davis social-link lookup,
  a page crash during removed-profile navigation, and the old photo-fallback
  locator. These are not counted as passing and were not repaired as part of
  this work. The existing catalogue-check follow-up covers that work; the
  page crash also limits that particular run's evidence.
- A preview screenshot confirmed the gallery logo is rendered. The browser
  check also scrolled to and verified the homepage logo.

## Safari handoff

For each of the two permission-denied rows, expand the Safari console/network
entry and supply the complete request URL, status/error, initiator/frame and
response headers. Include the full policy-warning text and blocked extension
URL, whether the page is inside the editor preview or opened directly, Safari
and OS versions, and whether the same result occurs with extensions disabled.
Redact credentials and signed query strings before sharing.

Physical Safari song playback and native player fullscreen still need a device
check where YouTube permits playback. No claim is made that all third-party
console messages have been removed.

## Homepage fullscreen follow-up — 27 October 2026

### New evidence and attribution

- The owner reports the fullscreen warning on directly opened
  `https://www.santaradio.co.uk/` with extensions disabled. Do not attribute this
  reproduction to the editor's outer iframe.
- Reviewed supplied screenshots at 17:09:42 and 17:11:45. They show
  `Permission policy 'Fullscreen' check failed for document with origin
  'https://www.youtube.com'` (count 2). The expanded stack is in YouTube
  `base.js` / `m=root,base`, including `loadNewVideoConfig`; it identifies
  provider code, but not the precise denied API call or top-level route.
  The direct-homepage route and extension-disabled result come from the owner's
  reproduction report, not from these cropped console images alone.
- The 17:07:27 Network screenshot attributes `webauthn-listeners.js` and
  `injected.js` to **1Password for Safari**. The 17:10:55 console image shows a
  CSP-blocked `safari-web-extension:…/inline/injected/webauthn-listeners.js`.
  This is separate from the YouTube fullscreen warning.
- The owner's subsequent extension tests strongly implicate **TopCashback**
  in the two other permission-denied errors. Their original complete request
  URLs were not recovered here, so this is not proof that a particular
  extension initiated each original request. No extension settings, CSP or
  hosting permissions were changed.

### Public baseline versus updated development version

Extension-free system Chromium **152.0.7977.64**, real provider requests with no
YouTube interception, directly opened HTTPS documents:

| Document | Observed YouTube frame URL | Fullscreen permission |
| --- | --- | --- |
| Public homepage, before this correction | `https://www.youtube.com/embed/mMrHniQJNCM?si=O7nNcINykyWwgyXC&autoplay=1&mute=1&controls=0&disablekb=1&playsinline=1` | iframe policy false; provider `document.fullscreenEnabled` false |
| Development homepage, before correction | Same as public homepage | false in both |
| Public and development song after explicit media consent | `https://www.youtube.com/embed/DDt3u2Ev1cI` | true in both |
| Updated development homepage | Same homepage URL with **`&fs=0`** appended | still false in both |
| Updated development song and karaoke with media consent | `https://www.youtube.com/embed/DDt3u2Ev1cI` | still true in both |

The inspected top-level responses supplied no `Permissions-Policy` header.
Real YouTube frame responses were HTTP 200 with their own CSP and client-hints
Permissions-Policy, not an observed `fullscreen` directive. Neither a global
app policy change nor new homepage delegation is justified by these results.

The public homepage observed during the comparison **did not contain `fs=0`**.
Only the development source/build was changed. No production deployment was
performed, so reloading the public site is not a test of this correction.

### Exact correction and its limits

Only the homepage iframe URL gains `fs=0`. YouTube's
[supported player parameters](https://developers.google.com/youtube/player_parameters#fs)
say this prevents the fullscreen **button** from displaying (default `1`).
It is an explicit player setting, **not a Permissions-Policy**, and the
documentation does not promise to stop every internal fullscreen capability
check or suppress Safari diagnostics.

`controls=0`, `disablekb=1`, `playsinline=1`, `mute=1`, `autoplay=1`,
`allow="autoplay; encrypted-media"`, no `allowfullscreen`, `tabIndex=-1`,
`inert`, and `pointer-events:none` are unchanged. Pause still removes the
frame; resume creates it again with the same restricted URL. SongVideo,
consent code, radio, CSS, server headers and Vercel settings are unchanged.

### Results and remaining browser boundary

- Chromium reproduced **no Safari-style fullscreen policy warning before or
  after** the change. This is not an A/B demonstration of warning removal.
  YouTube still logged “No available adapters.” Song/karaoke also logged the
  existing allow/allowfullscreen precedence warning.
- With `fs=0`, the real homepage provider video was `paused:false`,
  `muted:true`, `playsInline:true`, `readyState:4`, and its time advanced from
  `46807.231190` to `46808.748598` seconds. This verifies muted inline playback
  in this Chromium session, unlike the earlier bot-challenged session; it
  does not establish playback in Safari.
- Real song/karaoke frames retained effective fullscreen permission but video
  remained paused at zero with `readyState:0` during observation. Song playback
  and native YouTube fullscreen were not verified in this follow-up.
- `npm run build`: passed client build, bundled SSR, 1,559 prerendered pages.
  Existing unresolved hero-image CSS reference and chunk-size warnings remain.
- `npx playwright test tests/video-autoplay.spec.js tests/cookie-experience.spec.js --project=chromium --reporter=line`:
  **34 passed**. Provider responses are mocked for deterministic checks, not
  Safari-warning proof. Assertions now include `fs=0`, effective homepage
  fullscreen denial, unchanged restrictions on resume, direct link,
  withdrawal while radio keeps playing, and no `fs` override on song/karaoke.
  Existing first-visit, saved refusal, cross-tab and consent coverage passed.
- `node --test scripts/seo-serving.test.mjs`: **4 passed**, including built
  Node serving and the deployment-style document handler.
- Workflow restarted cleanly. Preview screenshot confirmed homepage rendering.
  Unrelated Mugshots tests were not run or modified.
- **Safari confirmation pending.** This Linux workspace has no actual Safari
  device/session; the configured Playwright WebKit executable is also absent.
  Firefox/WebKit suites were not run. Linux WebKit would not by itself prove
  the result in the owner's Safari version.

### One Safari check against the updated preview

Open the [updated development homepage](https://34ac2d71-37e1-4a7c-a1f8-8f607b9fd534-00-tge93yq9y9vf-u39zk2kn.janeway.replit.dev/)
directly in the same Safari setup, ensure homepage TV is enabled, clear the
console and reload once. Check whether the exact fullscreen warning returns;
confirm the TV frame request ends in `&fs=0`. If it remains, share the expanded
warning and Safari/macOS versions. Do not change extension settings for this
check. If preview access is gated, open it through the workspace's direct
preview action first; do not deploy to make the test accessible.

Until that check, the supported configuration correction is implemented, but
the reported Safari warning is **not confirmed resolved**.
