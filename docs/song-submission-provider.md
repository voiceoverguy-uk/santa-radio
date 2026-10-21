# Shared contact/song submission provider contract

General enquiries and song submissions use the owner's unchanged dedicated
public Brevo endpoint (`SONG_FORM_URL` in `src/lib/songSubmission.js`).
This is independent of the Santa-message access endpoint: it does not grant
message-maker access or store contact details locally.

## Read-only hosted-form check

On 21 October 2026, a fresh read-only GET of the dedicated hosted form returned
HTTP 200 and independently matched the owner's newly supplied embed,
`attached_assets/brevo_form_song_submission_1792592730052.rtf`:

| Field | Current hosted control | Website behaviour |
| --- | --- | --- |
| `FIRSTNAME` | Required input, maxlength 200 | Separate required first name |
| `LASTNAME` | Required input, maxlength 200 | Separate required surname |
| `EMAIL` | Required input | Required email, validated before sending |
| `SONG_REQUEST` | Required textarea, placeholder `MESSAGE`, maxlength 500 | Complete trimmed, required non-blank message, maxlength 500 |
| `email_address_check` | Hidden honeypot | Must remain empty |
| `locale` | Hidden input, value `en` | Sends `en` |

The hosted form's relative action resolves to the same dedicated endpoint.
`COMPANY:name` and a field named `MESSAGE` are absent. `MESSAGE` is the textarea's
placeholder, not its provider field name. This supersedes the 14 October GET
which showed an optional `MESSAGE` textarea, and the older supplied text embed
which used `COMPANY:name`. The current RTF and hosted form agree; no further
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
multipart `FormData` to the dedicated action with `?isAjax=1`, using JSON
`success`, `message` and `errors`. Only an OK, non-opaque response with boolean
`success: true` confirms provider acceptance. No provider script or stylesheet
is installed globally.

## Verification boundary

Browser tests intercept all Brevo submissions; no test POST reaches Brevo.
They verify exact non-empty, trimmed `FIRSTNAME`, `LASTNAME`, `EMAIL` and
`SONG_REQUEST` values alongside the empty honeypot and `locale=en`, and absence of `MESSAGE`, `COMPANY:name`,
phone fields and criteria in outgoing requests for both modes. They also check
required entry, character limits/counting, safe `SONG_REQUEST` errors, draft retention,
retries, cancellation, mode navigation, acceptance-only confirmation, keyboard
use and layout. The independent Santa-message access regression suite and
production build and both built contact/song SSR checks are checked separately.
SSR rendering makes no provider requests.

These checks prove the outgoing mapping, not Brevo's saved-record persistence,
notification delivery or email personalization. The supplied screenshots show
first-name personalization working only; they do not prove surname or message
persistence. `FIRSTNAME` and `LASTNAME` already match the current hosted contract.
Correcting the message key must not be described as fixing the missing surname
or notification template.

To investigate those provider-side questions, ask the owner for a saved-record
view and notification-template view, or obtain separate approval for a live test.
No live POST, real test contact, email, provider attribute/list/automation change
or publishing is authorised by this mapping correction.
