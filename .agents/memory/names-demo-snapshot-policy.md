---
name: Isolated names demo snapshot
description: Owner-approved public display-name list and browser-only filtering for /names; audio and other search flows remain protected.
---

The owner requires the separate `/names` demonstration to import the authorised
Stag name index once and thereafter use only its private bundled snapshot.
Only an explicit owner instruction after weekly additions may replace it;
failed manual imports must retain the last valid copy. No daily refresh,
refresh-on-use, expiry fallback or cold-start source download is permitted.

**Why:** The owner said, “The only time it should go to the server is if next
week i add more names, and i would manually tell it to update”.

**How to apply:** Keep source acquisition isolated from the existing homepage and
Studio search/recording/payment flows. Do not introduce runtime-writable storage,
new database/Blob services or automatic source downloads. The demo remains a
plain green page with a centred accessible search box. A future Vercel update
requires an owner-approved code release; this does not authorise publication.

The owner subsequently explicitly approved making the complete **display-name
list only** public and downloadable for `/names`, loading it once and filtering
entirely in the browser thereafter. This supersedes the earlier private
bounded-match-only rule for this demonstration, not the homepage or Studio.

**Why:** The owner requested zero individual-search network requests and explicitly
approved this public names-only exception after live server-side delays.

**How to apply:** Generate the public list from the saved snapshot with names
only: no recording IDs, filenames, paths, URLs, tokens, metadata or audio
references. Use compression, browser/CDN caching and reliable update invalidation.
Keep the two-letter minimum, suggestion limit, accessibility and keyboard/touch
controls. Audio/private files/payments/Studio and other functionality must remain
unchanged. Inspect real audio authorisation, not hidden-route assumptions, and
report pre-existing exposures separately without making audio public.
