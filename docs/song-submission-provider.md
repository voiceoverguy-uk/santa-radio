# Song submission provider contract

The owner's attached Brevo embed is the submission contract. The song form is
independent of the Santa-message access endpoint and does not grant access or
store contact details locally.

## Read-only checks

On 14 October 2026, a GET of the dedicated public hosted form returned HTTP 200
and matched the supplied fields: required `FIRSTNAME` and `LASTNAME` (200
characters each), required `EMAIL`, required `COMPANY:name` (500 characters),
optional `SMS`, `SMS__COUNTRY_CODE` with `data-country-code="GB"`, the
`email_address_check` honeypot and `locale=en`. No upload or CAPTCHA field was
present.

A read-only GET with `Origin: https://www.santaradio.co.uk` returned
`Access-Control-Allow-Origin: https://www.santaradio.co.uk`. The provider's
public script submits multipart `FormData` by POST to the form action with
`?isAjax=1`, then reads JSON `success`, `message` and `errors`. Its native
field-error selector omits textarea controls, so the site handles errors for
`COMPANY:name` itself.

The site preserves the embedded phone-country choices and sends the selected
country code separately from the local phone text; it does not guess national
prefix transformations. Brevo performs country-specific number validation.
No provider script or stylesheet is installed globally.

## Verification boundary

Browser tests intercept all Brevo submissions. They verify outgoing mappings,
strict boolean acceptance, safe errors, retries, cancellation, keyboard use
and layout, not provider storage or automatic emails. The production build
and Node SSR are checked separately.

No live POST, real test contact, Brevo account setting change, list change or
automation change was made. Read-only hosted-form checks cannot establish that
Brevo will persist the unusual message mapping, retain contacts for a
particular period or send an email. Those checks need separate owner approval.
