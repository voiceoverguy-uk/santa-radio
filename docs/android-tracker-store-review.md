# Android Santa Tracker review access

The free-studio form includes a collapsed **App store reviewer sign-in** section.
Use username `play-review` and the private password recorded in Play Console.
The password is not in this repository or the Android app. The server checks its
SHA-256 digest from `SANTA_TRACKER_REVIEW_PASSWORD_SHA256` in production.

The credential opens the same free maker as normal verified visitors, using a
fresh isolated session per sign-in with the normal 24-hour expiry and two-hour
message allowance. It issues no adult contact cookie, sends no verification or
marketing email and grants no customer, paid or staff access. Invalid requests
retain the normal same-origin and signup rate limits. To perform another complete
message flow during the allowance period, sign in again in a fresh app session.
Changing/removing the digest rotates/disables reviewer login; existing free
sessions expire normally within 24 hours. Do not disable access while review or
ongoing automated store checks require it.

The privacy policy adds a dedicated `#santa-tracker-android-privacy` section. It
covers the offline tracker, optional embedded message collection, local files,
sharing and deletion requests. Existing iOS statements are left unchanged.

Validation: focused review-login and existing email-verification HTTP tests.
Full deployment build and live review checks are recorded in the Android project.
