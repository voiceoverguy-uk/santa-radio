# Cookie browser verification

## Homepage TV loading exception — 21 October 2026

The homepage TV now loads automatically after preference hydration only when no
saved current or legacy record exists. This is a homepage loading policy, not
consent. It does not save a record or enable song/karaoke videos, TuneIn,
Google Analytics or Meta. Existing refusals, older records without media
permission, expired records and damaged records keep it off. Unreadable
preference storage also keeps it off until the visitor makes a visit-only choice.
Expiry in an open tab unloads the TV rather than returning to the first-visit
default. Clearing browser storage can restore the first-visit default on reload.

The cookie suite checks fresh loading without an off-notice flash, saved media
acceptance/refusal before any provider request, independent tracking choices,
decline after automatic loading, cross-tab refusal/re-enabling, expiry, older
and damaged records, unchanged song/karaoke/TuneIn gates, and mobile bounds.
`tests/video-autoplay.spec.js` checks muted inline autoplay parameters and
pause/resume without changing the separate radio element. It cannot guarantee
that the provider or browser actually plays the video.

Build first, then run the compiled-server hydration checks:

```sh
npm run build
npx playwright test tests/homepage-tv-production.spec.js --project=chromium
```

These use a temporary local Node production server, not a production deployment.
Provider frames are mocked; no claim is made about actual provider cookies,
advertising behaviour, real-device autoplay or legal compliance. The older
engine results below describe the earlier opt-in policy, not this exception.
The updated Chromium cookie checks, video controls and compiled-server
hydration checks passed. Firefox and WebKit could not launch in this workspace
because their Playwright executables are missing; no current result is claimed
for those engines.

## Recorded result — 20 October 2026

| Engine | Result |
| --- | --- |
| Chromium 152 | All 22 scenarios verified |
| Firefox 155, third-party cookies rejected | All 22 scenarios verified |
| Linux WebKit 26.6, headed under Xvfb | All 22 scenarios verified |

These results combine the full-suite runs and targeted reruns after test-harness
corrections. Chromium's full run passed 22/22; changed focus/layout/radio checks
also passed on rerun. Firefox's full run passed 21/22 before the font-layout
settling correction; the affected layout check and changed keyboard, enlarged
text and radio checks then passed. WebKit's full run passed 20/22; the interrupted
navigation case and corrected radio-mount check both passed on rerun.

No application cookie-flow bug was found. The test fixes were:

- Wait for React's radio dock before capturing the original audio element;
  WebKit can reach DOMContentLoaded before React mounts it.
- Settle font/layout measurements and wait for the measured overflow condition.
- Use DOMContentLoaded and locator assertions instead of waiting on every
  unrelated page asset to finish loading.
- Check tracker revocation rather than expecting already-loaded script tags
  to disappear; withdrawing consent cannot undo a script download.
- Respect TuneIn's separate load-player action after media consent.
- Store screenshots in each test/project's output directory.

The running privacy page was also visually checked at a phone-sized viewport.
No physical Safari or Firefox device, real provider playback, or audible radio
continuity is claimed.

## Scope and repeatable checks

Run the app separately, then:

```sh
npx playwright install chromium firefox webkit
# On a supported Linux test host, also install Playwright's OS dependencies.
npx playwright install-deps chromium firefox webkit
npm run test:cookies
```

`--project=chromium`, `--project=firefox`, or `--project=webkit` selects one
engine. Other existing tests still run only in Chromium. The Chromium project
uses Replit's system browser when available, otherwise Playwright's downloaded
browser (or an explicit `CHROMIUM_PATH`).

The cookie suite includes:

- Equal one-click accept/decline controls at 320, 390 and 1280 pixels.
- All eight independent analytics/marketing/media combinations; drafts do not
  load providers, and saved choices survive navigation and reload.
- Existing preference timestamps and absence of implied media permission.
- YouTube consent gates on home/song/karaoke pages, TuneIn's consent and
  additional load-player action, and cross-tab withdrawal of loaded media.
- Clearing accessible optional cookies while preserving functional storage.
- Same-tab and cross-tab tracker withdrawal without replacing, pausing or
  restarting the main radio element.
- Keyboard operation, visible focus, Escape/cancel focus restoration,
  enlarged text, and clearance above both compact and expanded radio docks.
- Expiry in an open tab and withdrawal before provider scripts finish loading.
- Failed writes and completely inaccessible local storage: visit-only choice,
  visible persistence warning, dismissal, revocation and fresh consent on reload.
- Non-persistent browser contexts: choices survive reload within a session, but
  a new session starts without the previous context's choice.
- Mocked cross-origin players whose storage access throws, plus a mocked adult
  access submission after declining all optional categories.

Firefox is launched with `network.cookie.cookieBehavior=1` (reject third-party
cookies). This is a targeted restriction, not a claim that every Firefox
Enhanced Tracking Protection mode is reproduced.

## Safety

Google/Meta scripts and YouTube/TuneIn frames are mocked. Brevo requests are
intercepted at context level, including second tabs, and the one adult-access
check uses an explicit mock success response and fictional test data. No real
adult-form submission is made. Main-radio playback is stubbed when testing
continuity; the original audio element, play/pause calls and visible playing
state are checked. These are consent/lifecycle tests, not proof of audible
streaming or third-party playback.

The 20 October checks changed no application consent components, radio feeds,
authentication or tracking configuration. The homepage-only exception described
above is a subsequent application policy change.

## Environment and interpretation

The development proxy's certificate is not trusted by the downloaded
Firefox/WebKit certificate stores in this workspace. Tests ignore certificate
errors only when using the Replit development-domain configuration. This does
not alter application TLS or authentication.

The Nix workspace needed temporary browser-library setup. Linux WebKit's
headless renderer could not create an EGL display; the alternative is headed
WebKit under Xvfb with `GSK_RENDERER=cairo`, a compatible GTK dependency stack,
GIO TLS modules and GStreamer plugins. Launching an empty WebKit page alone was
not sufficient: navigating to a page with an audio element also exercised
multimedia dependencies. These temporary system-library/cache adjustments are
not application dependencies and are not checked in. For a clean repeatable
run, prefer the supported Playwright Linux host setup above or macOS rather
than relying on temporary workspace library paths. Do not bypass Playwright's
dependency validation on a normal test runner.

## Real-device boundaries

Linux Playwright WebKit is not the shipped macOS/iOS Safari application. These
tests cannot establish Safari's exact Intelligent Tracking Prevention policy,
native Private Browsing UI, Full Keyboard Access settings, iPhone safe areas,
browser chrome/keyboard viewport changes, or background-tab suspension.
Non-persistent contexts are not a complete reproduction of branded Safari
Private Browsing or Firefox Private Browsing.

Storage exceptions in the top page and mocked cross-origin frames deliberately
exercise denied-storage paths. They do not establish actual YouTube/TuneIn
behaviour, cookie partitioning policy or Storage Access API prompts.

Before claiming physical-device coverage, use an intercepted/staging setup on
a real iPhone and Mac Safari and Firefox Private Browsing. Repeat accept,
decline, independent choices, close/reopen, keyboard/focus, expanded-radio
clearance and cross-tab withdrawal. Keep all providers and Brevo mocked; do not
submit real adult details. Verify audible main-radio continuity separately
with owner-approved playback, without changing its feed.
