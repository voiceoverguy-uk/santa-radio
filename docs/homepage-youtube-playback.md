# Homepage YouTube playback investigation

## Outcome — 21 October 2026

Actual embedded playback of the owner's video `mMrHniQJNCM` succeeded through
the HTTPS Replit development proxy in system Chromium. No reproducible
site-side playback failure was found. The existing embed, layout, consent gate,
muting and radio controls were deliberately left unchanged.

This is a preview result, not confirmation that the owner's original browser
or the published website works. No production deployment or YouTube account
changes were made. No evidence supported asking the owner to change embedding
permissions, replace the video, or change account settings.

## Real-provider observations

These runs did **not** intercept or mock YouTube:

- Fresh browser contexts at 1280 × 900 and 390 × 844 loaded the homepage via
  `https://$REPLIT_DEV_DOMAIN/`, not localhost.
- Before consent, including after declining optional cookies, there was no
  webcam iframe and no request to its YouTube embed.
- Clicking **Enable external media** loaded the supplied embed. YouTube's
  player response reported `status: OK` and `playableInEmbed: true`.
- Media segment requests to Google's video delivery servers returned HTTP 200.
- The underlying video was playing (`paused: false`), muted, had
  `readyState: 4`, and had no media error.
- Samples approximately 3.5 seconds apart confirmed real motion:

  | Viewport | Playback time, first → second (seconds) | Decoded frame count |
  | --- | --- | --- |
  | 1280 × 900 | 46800.333035 → 46803.862611 | 12 → 118 |
  | 390 × 844 | 46801.226235 → 46804.709984 | 40 → 145 |

- A screenshot showed the snowy North Pole stream, rather than just a player
  shell or thumbnail. Screenshots are in the ignored `generated-artifacts/`
  directory; they are diagnostic output, not application assets.
- **Pause video** removed the iframe; **Resume muted video** recreated it.
  Withdrawing media permission in Cookie settings removed it again.
- **Watch directly on YouTube** continued to point to
  `https://www.youtube.com/watch?v=mMrHniQJNCM` after withdrawal.

No autoplay block, sign-in restriction, embedding denial, missing referrer
error or unavailable-stream error occurred in these runs. Some ancillary
YouTube statistics requests were aborted, but media segments loaded and
playback advanced; those requests did not establish a playback fault.

## Deterministic checks

The existing Chromium webcam autoplay test and all 23 cookie-experience tests
passed:

```sh
npx playwright test tests/video-autoplay.spec.js tests/cookie-experience.spec.js --project=chromium
```

Those tests mock YouTube. They establish consent, embed URL, muted parameters,
pause/resume, direct links and radio independence, **not** actual provider
playback. A separate regression test now aborts the embed request and checks
that the direct link stays available and permission withdrawal still unloads
the iframe.

The Firefox/WebKit cookie runs could not start: their browser binaries were
initially absent; after downloading them, required host libraries were still
missing (Firefox GTK/X11 libraries; WebKit multimedia and graphics libraries).
These are environment launch failures, not failed cookie UI assertions. No
Firefox/WebKit or physical iPhone playback success is claimed. A narrow
Chromium viewport is not an iPhone/Safari test.

## Repeating the real playback check

1. Use a fresh browser context on the accessible HTTPS development proxy.
   Observe embed requests before consent and after declining optional cookies.
2. Enable external media and bring the TV into view.
3. Inspect the YouTube frame's video using browser automation or browser
   developer tools. Sample `currentTime` and
   `getVideoPlaybackQuality().totalVideoFrames` twice, several seconds apart.
   Require both to advance, with `muted === true`, `paused === false`, and no
   media error. Metadata, iframe rendering and an HTTP 200 alone are insufficient.
4. Check provider errors and media segment responses without storing signed
   media URLs. Record any actual provider message verbatim if playback fails.
5. Pause/resume, withdraw permission, and confirm the iframe unloads and the
   direct link remains.

If the original failure persists, the next useful evidence is its browser and
device, the URL being viewed, consent state, and the exact on-screen YouTube
error. Only recommend an owner-side account or stream change when that error
supports it. Do not bypass consent or provider restrictions to obtain playback.
