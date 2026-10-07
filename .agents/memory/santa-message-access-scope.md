---
name: Santa message access intent
description: Why the adult Brevo contact step precedes the existing MP3 maker and remains separate from news consent.
---
The owner wants an adult's first name, surname and email submitted through the supplied Brevo form before immediate access to this website's existing recorded Santa MP3 maker. Successful submission should open the rebuilt site's maker, not an external legacy destination or an email-only access flow.

**Why:** The owner supplied the public CRM form and explicitly confirmed the post-submission destination.

**How to apply:** Keep adult contact collection separate from child-name selection and on-demand recorded-audio mixing. Do not promise email delivery of the generated MP3 or introduce a second generator.

This is a signup-first, tab-session convenience flow, not authentication, email ownership verification or proof of double opt-in. Message access does not establish Santa Radio news or tracker-reminder consent.

**Why:** The approved scope deliberately excludes accounts, secure backend authorisation, marketing enrolment and email automation changes.

**How to apply:** Do not add API credentials or connected-service changes to replace the supplied public form without a new request. Confirm owner approval before submitting real test contacts or changing Brevo autoresponders, list settings or double-opt-in configuration.

The uploaded Brevo embed can differ from the current hosted form's required fields. Inspect the live form's field requirements, not just its CORS headers or JavaScript submission protocol.

**Why:** Read-only inspection found a required child date-of-birth field in the hosted form that was absent from the supplied adult-contact-only embed; mocked acceptance tests could not reveal that mismatch.

**How to apply:** Resolve extra required personal-data fields with the owner before declaring the integration complete. Do not silently collect additional child data, send invented values or bypass provider acceptance.
