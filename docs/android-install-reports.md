# Android install reports

The private Santa dashboard reads Google Play country-dimension install CSV files through the Google Cloud Storage JSON API. It displays the four current Android listings beside the Apple rankings. Legacy removed apps are excluded.

Server configuration: `GOOGLE_PLAY_REPORTS_BUCKET` and `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (or the existing `GOOGLE_ANALYTICS_SERVICE_ACCOUNT_JSON`). The Google identity needs Play Console's account-level **View app information and download bulk reports (read-only)** permission. No publishing or financial permissions are needed. Credentials stay in the server environment.

The owner-authenticated `GET /api/message-statistics?view=android-installs` endpoint fetches three months, sums only the country breakdown, and caches results for 15 minutes. It runs separately from other dashboard data. Dashboard opening/refresh triggers retrieval; no background job or database migration is required. Google exports normally lag 3–7 days.

A shared latest available report date anchors the 7/30-day windows. Missing dates yield unavailable totals, not zero. Device installs are not Apple first downloads or Play first opens. Missing files do not imply an app is pending; review status remains separately verified in Play Console.

Validation: `node --test scripts/android-install-statistics.test.mjs` covers UTF-16, quoted CSV, duplicate rejection, cross-month totals, gaps, API scope/caching, and owner authentication.

Official source: https://support.google.com/googleplay/android-developer/answer/6135870
