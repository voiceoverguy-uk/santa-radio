---
name: Contact and song submission routing
description: Shared contact form routing and owner-approved provider contract.
---
General enquiries and song submissions use one shared form. General enquiry is the default; song entry links preselect Song submission.

**Why:** The owner approved the existing Brevo destination for both: general enquiries are infrequent and everything goes to the same inbox. This supersedes separate general-email and song-form routing.

**How to apply:** Keep the two modes distinct in guidance and confirmation, without adding provider attributes, lists or automations to separate their routing.

Treat the owner's supplied song form as the provider contract, including unusual attribute mappings. Do not replace an unusual message mapping with a conventional contact field merely because it looks more familiar.

**Why:** The owner specifically required the supplied mappings and excluded Brevo attribute, list and automation changes. Read-only form inspection and mocked acceptance do not establish actual record persistence.

**How to apply:** Preserve the contract when maintaining song submission. If the provider rejects its configuration, report the exact mismatch rather than inventing replacement fields. A live persistence or automatic-email check needs separate owner approval.

Song submissions must not collect a phone number or country code. Their message criteria include a link to any promotion of Santa Radio, alongside the artist, song, listening link and short bio or description.

**Why:** The owner requested removal of the phone line and addition of the promotion-link criterion.

**How to apply:** Preserve these requirements in future form changes, including shared contact/song forms. The “Have you met the criteria?” checkbox confirms the submission requirements; it is not marketing consent or a new Brevo contact attribute.
