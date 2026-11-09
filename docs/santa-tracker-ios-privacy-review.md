# Native iOS tracker privacy — owner review

Review destination: `/privacy-policy#santa-tracker-ios-privacy`.
The owner corrected the placement: the full policy belongs in its own section
inside the main policy, with a visible section-navigation link.
`/santa-tracker/privacy` remains available and shares the same native-policy
content. Other app sections and website disclosures are preserved. This change
does not publish the site.

## Verification

- Full website production build passed, including server rendering and the
  generated public policy document.
- Preview browser checks cover direct anonymous access, tracker-page and
  main-policy navigation, section reload/focus, existing policy/contact links,
  and 320/390px overflow checks.
- Phone-width screenshot checked with the standard website shell and privacy
  styling. Existing unrelated policy wording is preserved.

## Basis and boundaries

The app facts are supplied with this request from a review of the current native
iOS tracker code; this website change is not an independent audit of a signed
iOS release. The section scopes its statements to The Santa Tracker by Santa Radio
for iOS, distinguishes local settings from collection, and separates optional
external browser visits from bundled tracker use. No new legal entity, email
address, effective date or website processing claim is introduced.

The contact destination `/submit-a-song?mode=general` is the existing general
enquiry route, already used by other public site notices. The website policy is
linked for website practices, not rewritten beyond adding the native app section.

## Owner checks before release

- Confirm the final app name and release build match the reviewed native source,
  including local bundling, on-device calculations, no account/GPS requirement,
  no analytics/ads/tracking SDK and no tracker activity/settings transmission.
- Confirm there are no additional native services, crash reporting, purchases,
  permissions or other data flows outside that reviewed tracker code which need
  disclosure. Do not infer this from the standalone web export.
- Review iOS backup, local-settings clearing and uninstall/restore behaviour
  before adding any promises about deletion, retention or backup. None are
  asserted on the page.
- Confirm the general enquiry route remains the intended privacy/support
  contact. Any required controller identity, jurisdictional wording or effective
  date needs owner/legal confirmation rather than an invented value.
- Check the final release's App Store privacy answers separately. This page is
  not a compliance certification or an audit of Apple's own processing.
