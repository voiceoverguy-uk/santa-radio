# County and state trial handoff

## External upload required

The website cannot update the audio server's PHP index through a website deployment.
Nothing in this change uploads to that server, changes recordings or publishes the site.

1. Back up the existing external `workshop-index.php`.
2. Take the updated **`public/downloads/workshop-index.php`** from this task
   (also served by the website at `/downloads/workshop-index.php` once merged).
3. With the owner's approval, upload that one file as `workshop-index.php` **inside**
   `names/personalised-message/` on the existing audio server. Leave
   `names-index.php`, all recordings and the five required folders unchanged.
4. Regional recording folders must be siblings of `countries`:

   | Exact folder | Parent country recording |
   | --- | --- |
   | `usa-states` | `countries/united-states.wav` |
   | `england-counties` | `countries/england.wav` |
   | `scotland-counties` | `countries/scotland.wav` |
   | `wales-counties` | `countries/wales.wav` |
   | `northern-ireland-counties` | `countries/northern-ireland.wav` |

   Only existing readable nonempty WAV/MP3 recordings become website choices.
   Preserve their exact names, case and accents. This task supplies no audio.
5. Check the existing HTTPS endpoint:
   `https://stagcommunications.com/santaradio/names/personalised-message/workshop-index.php`.
   It retains version 1 and the original five categories and adds available
   regional groups under `categories`, with their `excludedAudioCounts`.
   Missing optional folders are omitted; empty folders return empty arrays.
   Neither case prevents country-only creation. Symlink folders/files are not indexed.
6. Allow up to five minutes for the website's private catalogue cache to refresh,
   then reload Studio. Uploading the index alone does not merge this website change.

## Owner's short checklist

- Use an authorised Studio tester session. Country order starts England, Scotland,
  Northern Ireland, Wales, United States when those recordings exist. Ireland
  remains a separate searchable choice, with no county step.
- Choose each of those five countries. Continue without a region once. Then try
  **Choose a county/state**: one wheel replaces the country wheel; the heading
  and search refer only to the chosen country's counties/states.
- Search a region without selecting it, clear search, and go back. Nothing should
  silently change. Select a region; confirm `region, country`, **Change county/state**
  and **Use [country] only**. Change the country and check the old region clears.
- Review, edit and return. The summary and letter name both region and country.
  The spoken wording preview names only the selected regional recording.
- Create, listen to and download one real MP3 per group. Confirm Santa speaks the
  state/county **instead of** the country, with no second destination clip.
  Check pronunciation against the actual source recording. Try country-only again.
- On a phone, try touch scrolling, search with the keyboard open and backing out.
  On desktop, try Tab, arrow keys and 200% text. Ensure every action remains reachable.
- If a regional folder is unavailable, verify the concise notice and country-only
  path rather than an empty regional picker.

## Evidence and limitations

Automated fixtures exercise all five fixed parent relationships, both 1365px
desktop and 320px phone widths, regional search and clearing, keyboard selection,
focus on back/open, restoring the parent wheel position, review/edit, parent changes,
country-only reset and old/empty regional inventories. A phone capture also checks
200% text. These fixtures do **not** assert live availability or playback.

PHP execution tests cover optional missing/empty/symlink folders and stable SHA-256
identities. Parser/API tests cover mismatched, stale, forged and path/URL selections,
the unchanged five required categories and exactly one effective destination download.
The existing real FFmpeg test checks the unchanged render recipe, whole clips and
MP3 output. Fixture screenshots are generated under ignored `generated-artifacts/`.

Live county/state playback remains **unverified until the external index is updated
and actual recordings are available**. Real iPhone Safari behaviour is not verified
by Chromium emulation. No external upload or production deployment is authorised here.

A read-only check during implementation returned HTTP 200, all five original
categories and the existing Northern Ireland country recording, but zero
available regional recordings in each of the five optional groups.

### Completed checks

- **44 Node tests passed, zero skipped**, including execution of the PHP index
  with an installed PHP CLI via `PHP_BINARY`, parser/hostile-input tests,
  regional message resolution, letter selection and real FFmpeg rendering:
  `node --test scripts/workshop-https-index.test.mjs scripts/workshop-https-catalogue.test.mjs scripts/santa-studio-message.test.mjs scripts/studio-selected-letter.test.mjs scripts/studio-letter-responses.test.mjs scripts/studio-fuller-letter.test.mjs`
- **7 Chromium fixture tests passed**:
  `npx playwright test --config playwright.workshop.config.js tests/santa-workshop-search.spec.js`
- **2 Chromium real HTTPS catalogue / country-only tests passed**:
  `npx playwright test --config playwright.workshop.config.js tests/santa-workshop-live-catalogue.spec.js`
  These used a synthetic recorded-name response and an isolated tester session,
  but the real hosted non-name inventory. No real message was requested.
- **`npm run build` passed**, including browser build, Node SSR build and public
  page generation.
- The managed application restarted cleanly. Its ordinary unauthorised preview
  still shows the tester-code gate; the protected picker screenshots and
  interaction checks used isolated authorised browser tests, not an auth bypass.

Fixture-only component captures (site navigation omitted from the crop) are
`generated-artifacts/studio-regional-1365.png`,
`generated-artifacts/studio-regional-320.png` and
`generated-artifacts/studio-regional-320-enlarged.png`.
