---
name: Studio audio retention scope
description: Owner requires finished Studio MP3s to be temporary for the user session, not an archive.
---
Source audio comes from the existing external audio server. Finished MP3s are
temporary for the user's session; the owner does not intentionally archive them.
Do not introduce permanent MP3 storage.

**Why:** The owner explicitly stated this scope while investigating live
recording failures and asked what the recording tables store.

**How to apply:** Do not assume an existing persistence mechanism establishes
approved retention. Before enabling or changing MP3 persistence, ensure it
actually has a session-bounded lifecycle rather than merely an expiring access
cookie. Preserve metadata and usage-reporting distinctions.
