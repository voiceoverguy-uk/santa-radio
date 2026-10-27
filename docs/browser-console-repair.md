# Browser console repair verification

Verified on 27 October 2026 using extension-free system Chromium through the
HTTPS development proxy. No production deployment or hosting-policy changes
were made. The original Safari console image was not available in this task
workspace; its messages are taken from the supplied task description.

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
