# Contact and song submission provider contracts

The website keeps one shared contact page with two separate public Brevo actions
in `src/lib/songSubmission.js`:

- General enquiry uses `GENERAL_FORM_URL`, the unchanged action in
  `attached_assets/brevo_form_song_submission_1792592730052.rtf`.
- Song submission uses `SONG_FORM_URL`, the exact action in the latest supplied
  `attached_assets/Song_Suggestion_Form_1793023903195.rtf`.

The actions are intentionally distinct. This supersedes the earlier approval to
send both modes to the old shared destination; it does not reroute General
enquiry or change any provider settings.

Both are independent of the Santa-message access endpoint: neither grants
message-maker access or store contact details locally.

## Read-only hosted-form check

On 26 October 2026, a fresh read-only GET of the new song action returned
HTTP 200 and independently matched the owner's latest Song Suggestion Form RTF.
The General enquiry contract remains the existing action and field mapping,
also rechecked read-only on 26 October 2026 (HTTP 200, matching www-origin CORS).
Both use these fields:

| Field | Current hosted control | Website behaviour |
| --- | --- | --- |
| `FIRSTNAME` | Required input, maxlength 200 | Separate required first name |
| `LASTNAME` | Required input, maxlength 200 | Separate required surname |
| `EMAIL` | Required input | Required email, validated before sending |
| `SONG_REQUEST` | Required textarea, placeholder `MESSAGE`, maxlength 500 | Complete trimmed, required non-blank message, maxlength 500 |
| `email_address_check` | Hidden honeypot | Must remain empty |
| `locale` | Hidden input, value `en` | Sends `en` |

The new hosted song form's relative action resolves to the supplied song endpoint.
`COMPANY:name` and a field named `MESSAGE` are absent. `MESSAGE` is the textarea's
placeholder, not its provider field name. This supersedes the 14 October GET
which showed an optional `MESSAGE` textarea, and the older supplied text embed
which used `COMPANY:name`. The latest song RTF and hosted form agree; no further
required-field discrepancy was observed.

The website uses `SONG_REQUEST` throughout state, controls, validation, counting,
payload and provider field-error handling. It sends neither `MESSAGE` nor
`COMPANY:name`, and a `SONG_REQUEST` rejection appears beside and focuses the
visible Message textarea rather than reporting an unsupported requirement.

The hosted form still offers optional `SMS` and `SMS__COUNTRY_CODE` controls.
The website deliberately neither collects nor sends phone numbers or country
codes. Song criteria are a website-only confirmation, not a Brevo attribute.
No new fields, uploads or CAPTCHA were observed.

The GET with `Origin: https://www.santaradio.co.uk` returned
`Access-Control-Allow-Origin: https://www.santaradio.co.uk`. The website sends
multipart `FormData` to the selected mode's action with `?isAjax=1`, using JSON
`success`, `message` and `errors`. Only an OK, non-opaque response with boolean
`success: true` confirms provider acceptance. No provider script or stylesheet
is installed globally.

## Verification boundary

Browser tests intercept all Brevo submissions; no test POST reaches Brevo.
A context-level guard blocks unexpected provider requests (including new tabs)
and fails the test for any unmocked POST. Mode-specific mocks accept only their
exact URL, so rerouting either mode to the other destination fails the checks.
They verify exact non-empty, trimmed `FIRSTNAME`, `LASTNAME`, `EMAIL` and
`SONG_REQUEST` values alongside the empty honeypot and `locale=en`, and absence of `MESSAGE`, `COMPANY:name`,
phone fields and criteria in outgoing requests for both modes. They also check
required entry, character limits/counting, safe `SONG_REQUEST` errors, draft retention,
retries, cancellation, mode navigation, acceptance-only confirmation, keyboard
use and layout. The independent Santa-message access regression suite and
production build and both built contact/song SSR checks are checked separately.
SSR rendering makes no provider requests. The active request captures its mode
before submitting; pending history changes cannot reroute it or replace its
accepted confirmation. No Brevo embed scripts or global styles are imported.

These checks prove the outgoing destination and mapping, not Brevo's
saved-record persistence, notification delivery or email personalization.
Earlier provider screenshots showed first-name personalization working only;
they did not prove surname or message persistence. `FIRSTNAME` and `LASTNAME`
already match the current hosted contract. Updating the song destination must
not be described as fixing missing surname personalization or a notification
template. The latest attached website screenshot is an appearance reference,
not provider persistence evidence.

### Implementation verification, 26 October 2026

- `npm run build` passed; existing bundle-size and unresolved-at-build-time
  hero-image warnings remain.
- `node --test scripts/song-submission-ssr.test.mjs scripts/contact-form-ssr.test.mjs`
  passed all six checks against the current build.
- `npx playwright test tests/song-submission.spec.js tests/santa-message-access.spec.js --project=chromium --reporter=line`
  initially passed 65 of 68 cases. All three failures passed on targeted
  `--last-failed` reruns after correcting the older RTF hyperlink extraction,
  waiting for the privacy-page render before releasing a cancelled request,
  and allowing either valid randomly selected audio outro in the independent
  access regression. All 68 cases are covered by the successful checks.
- The running song page was visually checked; its existing green-and-gold
  presentation remains in place. No form styles or General enquiry wording
  were changed.
- Both hosted actions were inspected using GET only. All browser provider
  submissions were intercepted, with unexpected POSTs blocked and reported.

To investigate those provider-side questions, ask the owner for a saved-record
view and notification-template view, or obtain separate approval for a live test.
No live POST, real test contact, email, provider attribute/list/automation change
or publishing is authorised by this destination update.
