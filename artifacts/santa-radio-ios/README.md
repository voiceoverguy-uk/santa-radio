# Santa Radio iPhone

A separate **Expo SDK 58 / React Native 0.88** app, not a wrapper around the
website. Five native tabs: Free Message, Santa Studio, Santa Radio, Santa Dash,
Santa Tracker. Website components, React DOM and Stripe checkout are not imported.

## Open and run in Xcode

You need a Mac with a current Xcode that supports this Expo/React Native
version, its iOS platform/simulator installed, Node 22, pnpm 10 and CocoaPods.
The generated target currently has a minimum iOS deployment version of 16.4;
use the deployment target shown by Xcode if Expo updates that requirement.

From the **repository root**:

```sh
corepack enable
pnpm install --frozen-lockfile
cd artifacts/santa-radio-ios
cp .env.example .env.local
# Edit .env.local: use your reachable HTTPS backend and Apple public SDK key.
pnpm exec expo prebuild --platform ios --no-install
cd ios
pod install
open SantaRadioiPhone.xcworkspace
```

`ios/SantaRadioiPhone.xcodeproj` is already generated and committed. `pod install`
creates the workspace; open the **workspace**, not just the project, afterwards.
Pods, DerivedData, signing credentials and user settings are intentionally absent.
Do not run `prebuild --clean` over manual Xcode edits without saving them first.

In Xcode select the **SantaRadioiPhone** scheme and an iPhone simulator. For a
physical phone, select your own development Team under Signing & Capabilities
and connect the phone. The proposed bundle ID is `uk.co.santaradio.iphone`.
Confirm you own/use that bundle ID before registering it; changing it also
requires updating the RevenueCat app and App Store Connect configuration.
No development Team, certificate, provisioning profile or paid account action
has been configured by this task.

In another terminal, from `artifacts/santa-radio-ios`:

```sh
pnpm run start:mac
```

Keep Metro running, then press Run in Xcode. The generated native shell includes
RevenueCat and audio modules; **Expo Go/browser preview is not a substitute for
an Xcode build when testing purchases**. A release archive bundles JavaScript
using the generated Xcode build phase and does not need Metro.

## Configuration

See `.env.example`. Expo public variables are compiled into JavaScript; never
put a server API key, SESSION_SECRET, database URL or provider credential there.

* `EXPO_PUBLIC_SANTA_API_URL`: the HTTPS origin of the backend containing
  `/api/santa-mobile` and `/api/radio-metadata`, without a path. A Mac's localhost
  is not this Linux workspace. The Replit dev command uses its runtime-provided
  development hostname when this variable is absent. Restart Metro after edits.
* `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`: the **public Apple SDK key** from the
  connected RevenueCat iOS app; not its server API key.
* `EXPO_PUBLIC_SANTA_IAP_SANDBOX`: defaults to `false`. Leave disabled until the
  Apple sandbox configuration below is ready. This task does **not** enable live
  commerce; the backend accepts only verified Apple **sandbox** purchases.

Server requirements: the existing PostgreSQL name/access schema,
`database/santa-mobile.sql`, SESSION_SECRET, the existing hosted audio services,
FFmpeg/prepared free clips, and the RevenueCat connector. Development mobile
tables have been created. No production database, website checkout or deployment
has been changed. If the backend is hosted outside Replit (for example the
existing Vercel website), the Replit connector is **not automatically configured
on that host**. Host/credential setup needs to be agreed and tested before using
that host as the app's backend; do not point this app at an unchanged live website.
The mobile endpoint fails closed if its database or purchase verifier is absent.

The mobile artifact also registers the **unchanged root website server** as its
`website` service on port 5000, forwarding `/api` requests. Start the managed
`artifacts/santa-radio-ios: website` workflow alongside its `expo` workflow.
There is no second copy of the website or a duplicate server process.

## Apple sandbox setup — no live purchases enabled

RevenueCat now contains an iOS app, the current `santa_studio_ios` offering and
two distinct products/packages:

| Apple product identifier | Type | Planned UK price | Package |
| --- | --- | --- | --- |
| `uk.co.santaradio.studio.permanent` | Non-consumable | £24.99 | `studio_permanent` |
| `uk.co.santaradio.studio.single` | Consumable | £4.99 | `studio_single` |

Only the permanent product is attached to `santa_studio_permanent`.
The consumable is accounted for by successful generation, not a permanent
RevenueCat entitlement. There are no subscriptions and no link to the website's
£6.50 family bundle or Stripe product.

**Still required by the owner, outside this task:**

1. In the owner's App Store Connect account, configure an app with the confirmed
   bundle ID and those exact IAP identifiers/types. Set the UK storefront prices
   to £24.99 and £4.99, supply required metadata/review information and complete
   Apple's commercial agreements where applicable. No such account actions have
   been performed here.
2. Connect the relevant Apple credentials to the RevenueCat iOS app through its
   secure setup. Never paste Apple private keys into this repository or an Expo
   public variable. Verify both products appear in the current offering.
3. Use a Sandbox Apple Account on an Xcode-installed device build, or a properly
   configured TestFlight build and its sandbox flow. TestFlight distribution is
   not performed here. A local StoreKit configuration can exercise UI, but its
   unverified/local transactions are **not** accepted by this server.
4. Set `EXPO_PUBLIC_SANTA_IAP_SANDBOX=true` in that test build and rebuild. The
   actual prices come from Apple's storefront via RevenueCat, never hardcoded
   purchase buttons. Until configured, both planned choices remain visible but
   disabled.
5. Test cancellation, pending/Ask to Buy, interrupted verification, restore on a
   second installation, refund/revocation and a successful single generation.
   Restore supports the non-consumable. Apple does not restore already-consumed
   consumables; do not promise account-based recovery. Completed single-message
   usage cannot replay even when RevenueCat transfers the purchase to a new
   anonymous app identity.

Never submit this sandbox-only binary for live commerce. Production-purchase
support and activation require a separately authorised change. Apple review
approval is not promised.

## Privacy, access and audio behaviour

* No new user accounts or email ownership verification. The adult signup uses
  the website's existing provider validation, grant and shared two-hour allowance.
* An anonymous server-generated connection credential is held in the iOS
  Keychain. It is not an email login. The client cannot choose its RevenueCat
  identity or send website cookies to bypass access. Signup grants stay
  encrypted on the server.
* Names are searched privately by explicit POST, with a small result limit.
  No bulk name list, origin audio URL or recording filenames reach the phone.
  Studio choice responses project only opaque IDs and labels.
* Both purchase status and Studio rendering are checked against the server's
  fresh RevenueCat read. Client CustomerInfo is never authority. Unverified,
  cancelled, pending, refunded, Test Store, promotional and production
  transactions do not grant this sandbox build access.
* One generation is reserved atomically and consumed only for a successful,
  nonempty MP3 after a second purchase check. Failure releases the reservation;
  the same transaction cannot be spent twice, even across restores. A completed
  recording is not regenerated by replaying its request ID.
* MP3 bytes are request-local server-side; only usage hashes are retained. On the
  phone they live in a session cache cleared on cold launch/provider disposal,
  and after a prolonged background absence. Use **Save or share** before leaving.
  Saved files chosen in the share sheet belong to the user, not an app archive.
  A network failure **after successful completion** may leave a used single
  generation without a delivered file: no permanent recovery copy is retained.
* Radio never autoplays. It uses the existing confirmed HTTPS stream and public
  now-playing endpoint. It survives tab changes, supports iOS background audio
  and lock-screen controls, respects OS pause/interruption, and reconnects at the
  live edge. Metadata refreshes in the foreground; background timers are not
  promised. Returning foreground clears stale titles before fetching again.
  Broadcast metadata may lead buffered audio.
* Message playback pauses the radio. It does not silently restart radio later.
* Tracker uses a copy of the existing route data/calculations, not GPS or location
  permissions. Holiday postcards continue through 30 November; North Pole
  preparation resumes on 1 December. Its estimate follows the phone's clock.
  Santa Dash is only a link to the existing game's App Store listing.

## Checks

From the repository root:

```sh
npm run test:mobile
# Real development-database locking/replay check; synthetic sessions are removed:
RUN_MOBILE_DATABASE_TESTS=1 node --test scripts/santa-mobile-store.test.mjs
pnpm --filter @workspace/santa-radio-ios run typecheck
pnpm --filter @workspace/santa-radio-ios test
CI=1 pnpm --filter @workspace/santa-radio-ios exec expo install --check
pnpm --filter @workspace/santa-radio-ios run export:ios
# With the managed Expo workflow running:
node --test scripts/santa-ios-preview.test.mjs
```

`docs/santa-ios-verification.md` records what was actually checked and what still
needs a Mac/device. Exported bundles and preview screenshots are ignored under
`generated-artifacts/`; they are not an installable `.ipa`.
