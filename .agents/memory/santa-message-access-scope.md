---
name: Santa message access intent
description: Why the adult Brevo contact step precedes the existing MP3 maker and remains separate from news consent.
---
The owner wants an adult's first name, surname and email submitted through the supplied Brevo form before immediate access to this website's existing recorded Santa MP3 maker. Successful submission should open the rebuilt site's maker, not an external legacy destination or an email-only access flow.

**Why:** The owner supplied the public CRM form and explicitly confirmed the post-submission destination. After reviewing an updated embed containing a required child's date of birth, they explicitly chose adult contact details only.

**How to apply:** Keep adult contact collection separate from child-name selection and on-demand recorded-audio mixing. Do not add a child's date of birth just because it appears in a supplied embed; the owner chose to remove that requirement in Brevo. Do not promise email delivery of the generated MP3 or introduce a second generator.

This is a signup-first, tab-session convenience flow, not authentication, email ownership verification or proof of double opt-in. Message access does not establish Santa Radio news or tracker-reminder consent.

**Why:** The approved visitor-access scope deliberately excludes accounts, secure backend authorisation, marketing enrolment and email automation changes.

**How to apply:** Do not add API credentials or connected-service changes to replace the supplied public form without a new request. Confirm owner approval before submitting real test contacts or changing Brevo autoresponders, list settings or double-opt-in configuration.

Staff-only sign-in for the private missing-name request ledger is separate from this visitor-access flow.

**Why:** The owner approved protected staff access to requested names, without asking visitors to create accounts or attaching adult contact details to their name requests.

**How to apply:** Keep staff authentication confined to the private ledger and staff sign-in pages. Preserve the existing adult Brevo step for the public MP3 maker.

Do not implement FTP, Mark's server integration or text-file uploads for missing-name requests. Keep the database-backed request system and protected staff ledger; staff-only TXT downloads are permitted.

**Why:** The owner explicitly cancelled the earlier FTP-copy plan and requested database-backed saving plus protected ledger downloads instead.

**How to apply:** Repair and extend the existing request storage and staff page without remote file uploads. Do not revive the withdrawn FTP approach.

The uploaded Brevo embed can differ from the current hosted form's required fields. Inspect the live form's field requirements, not just its CORS headers or JavaScript submission protocol.

**Why:** Read-only inspection found a required child date-of-birth field in the hosted form that was absent from the supplied adult-contact-only embed; mocked acceptance tests could not reveal that mismatch.

**How to apply:** Resolve extra required personal-data fields with the owner before declaring the integration complete. Do not silently collect additional child data, send invented values or bypass provider acceptance.

The recovery panel's “Share with friends” action is an invitation to the public message maker, not delivery of the visitor's MP3 or access state.

**Why:** It accompanies the invitation to tell friends while Santa recovers. Friends should choose their own recordings through the adult-access flow, without receiving a child's name or the visitor's contact details.

**How to apply:** Share the clean public maker URL without name/access parameters. Treat sharing a completed MP3 as a separate, explicitly labelled action.
