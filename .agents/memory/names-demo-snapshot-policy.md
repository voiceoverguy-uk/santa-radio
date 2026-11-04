---
name: Isolated names demo snapshot
description: Owner-only snapshot updates for the separate /names demonstration; no automatic Stag access or catalogue services.
---

The owner requires the separate `/names` demonstration to import the authorised
Stag name index once and thereafter use only its private bundled snapshot.
Only an explicit owner instruction after weekly additions may replace it;
failed manual imports must retain the last valid copy. No daily refresh,
refresh-on-use, expiry fallback or cold-start source download is permitted.

**Why:** The owner said, “The only time it should go to the server is if next
week i add more names, and i would manually tell it to update”.

**How to apply:** Keep this isolated from the existing homepage and Studio
search/recording/payment flows. Use a private deployment-packaged snapshot,
not runtime-writable local storage or new database/Blob services. Return only
bounded matches and retain the existing anti-harvesting protections. The demo
is a plain green page with a centred accessible search box. A future Vercel
update needs an owner-approved code release to distribute the changed snapshot;
the demonstration request does not authorise publication.
