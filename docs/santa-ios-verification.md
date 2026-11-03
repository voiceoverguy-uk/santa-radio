# Santa Radio iPhone — verification

Checked in the Linux development workspace on 3 November 2026.

## Passed here

* Generated `ios/SantaRadioiPhone.xcodeproj`, Swift app/scene delegates, Podfile,
  iPhone-only identity, branded icon, minimum iOS 16.4 and background-audio plist
  settings using `expo prebuild --platform ios --no-install`.
* Expo dependency compatibility check and TypeScript check.
* iOS production JavaScript/Hermes export: 1,987 modules, approximately 6.6 MB
  bytecode, with bundled brand assets/fonts. This is **not** a signed binary.
* Native-domain tests: radio metadata validation/unavailable handling and
  holiday/preparation/departure/completion tracker boundaries.
* Native API tests: 12 tests covering strict purchase verification, pagination,
  verifier outage, browser/cookie rejection, adult access, real signup-handler
  validation with a synthetic provider response, private response projection,
  failed/empty rendering, successful completion and refund during rendering.
  No real parent signup or charge was used.
* Grant-encryption/tamper test, plus a separately enabled **real development
  PostgreSQL** test covering exclusive credit reservation, failed release,
  successful consumption, idempotency, cross-customer restore replay and
  permanent access. Synthetic rows were removed.
* Existing Studio renderer suite: all 14 tests passed, including cancellation
  cleanup, exact variant/category selection, concurrency/deadlines and a real
  FFmpeg MP3 render using synthetic input. Output was measured, not listened to.
* Automated 390 × 844 browser preview: all five tabs, required adult form and
  invalid-email disabled state, unavailable purchase buttons, restore control,
  idle radio control, genuine Santa Dash App Store destination and simulated
  tracker. No browser JavaScript exceptions.
* Screenshots of the native-sized preview and existing website: matching logo,
  North Pole artwork and forest/gold identity. The browser intentionally shows
  protected messages and Apple purchases as native-only.
* Real public development routing: native session creation returned 201;
  authenticated status returned 200 with **verified** purchase status,
  permanent=false and credits=0 for a fresh identity. That identity was removed.
  The public radio endpoint returned a ready current title/artist.
* Website production compilation and Node SSR/prerender: 1,576 canonical pages,
  28/28 legacy identity matches. Dependency source portability passed.

## Not run here

There is no macOS, Xcode, CocoaPods installation, iOS simulator or connected
iPhone in this environment. Consequently **native compilation, installation,
device/Simulator UI, VoiceOver, background/lock-screen audio and actual Apple
purchase sheets have not been verified**. Browser layout checks are not
simulator tests.

No App Store Connect products, prices, commercial agreements, signing identities,
TestFlight distribution or live purchases have been configured. RevenueCat
product/offering definitions are present, but do not create Apple products.
Purchases remain disabled in the client; the backend accepts Apple sandbox
ownership only. The setup and sandbox test matrix are in
`artifacts/santa-radio-ios/README.md`.

No production deployment, production schema migration, website purchase change,
permanent recording archive, new login account or child date-of-birth collection
was performed.
