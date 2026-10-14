# Shared contact/song submission provider contract

General enquiries and song submissions use the owner's unchanged dedicated
public Brevo endpoint (`SONG_FORM_URL` in `src/lib/songSubmission.js`).
This is independent of the Santa-message access endpoint: it does not grant
message-maker access or store contact details locally.

## Read-only hosted-form check

On 14 October 2026, a fresh GET of the dedicated hosted form returned HTTP 200:

| Field | Current hosted control | Website behaviour |
| --- | --- | --- |
| `FIRSTNAME` | Required input, maxlength 200 | Separate required first name |
| `LASTNAME` | Required input, maxlength 200 | Separate required surname |
| `EMAIL` | Required input | Required email, validated before sending |
| `MESSAGE` | Optional textarea, maxlength 500 | Required non-blank message, maxlength 500 |
| `email_address_check` | Hidden honeypot | Must remain empty |
| `locale` | Hidden input, value `en` | Sends `en` |

The hosted form's relative action resolves to the same dedicated endpoint.
`COMPANY:name` is absent. The owner's attached embed is historical evidence of
the previous required `COMPANY:name` textarea, not the current message contract.
The website now uses `MESSAGE` throughout state, controls, validation, counting,
payload and provider field-error handling. It does not send both message keys.

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
`MESSAGE` values alongside the honeypot and locale, and absence of `COMPANY:name`,
phone fields and criteria in outgoing requests for both modes. They also check
required entry, character limits/counting, safe `MESSAGE` errors, draft retention,
retries, cancellation, mode navigation, acceptance-only confirmation, keyboard
use and layout. The independent Santa-message access regression suite and
production build are checked separately.

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
