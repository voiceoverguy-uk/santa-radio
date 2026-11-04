---
name: Name inventory confidentiality
description: Owner's security requirement superseding earlier public browser inventory, count and preview-URL approvals.
---

Keep the complete name catalogue and original audio locations server-side. Public
name lookup must be bounded and rate-limited, without bulk/empty/wildcard exports,
unnecessary totals, client credentials, or names in request URLs or durable
browser storage. Previews require controlled server access with short-lived,
scoped capabilities.

**Why:** The owner reported a confirmed public bulk exposure and explicitly
requested immediate closure, including all equivalent exports and the permanent
audio URLs already disclosed. This supersedes earlier public inventory and
counter instructions, not adult access or greeting downloads.

**How to apply:** Do not restore client-side catalogue filtering, public index
installers, public saved-greeting descriptors or permanent origin preview URLs to
repair an old test. Preserve legitimate lookup, selection and MP3 creation
through protected server paths. Revoking old URLs requires real origin-host
authorization and cache invalidation; signing new URLs alone is insufficient.
Keep access-log evidence, and make no scraping claim without evidence.

The owner reports approximately 9,700 names, updated in bulk roughly once a week.
For faster private search, use refresh after recording updates with a daily
fallback; original audio must not move to Blob for this change.

**Why:** The owner supplied this update cadence and requested private indexing
rather than frequent source downloads during searches.

**How to apply:** Keep refresh coordinated across server instances; increasing
only an instance-local cache lifetime does not provide a shared daily refresh.
Keep catalogue and original audio locations private and preserve anti-enumeration
protections when optimising checks.

Treat refreshing the complete private inventory as an operator operation, not
a privilege granted by a paid Studio purchase.

**Why:** Visitor access to bounded suggestions must not become a way to trigger
repeated complete origin downloads or obtain operator-level catalogue access.

**How to apply:** Preserve that boundary when adding convenient refresh
controls. Keep explicit refresh separate from ordinary lookup and retain
cross-instance coordination, even for an authenticated caller.

The owner subsequently approved restoring the recorded-name counter using a
total-only response, retaining the previous slow count-up.

**Why:** The owner chose “Restore the counter” after being told the total could be
returned separately without exposing the name list or audio locations.

**How to apply:** This authorises the aggregate for the counter only, not catalogue
exports, per-name inventory metadata or original audio locations. All other name
privacy and bounded-search requirements above remain in force.

The www domain is served separately from the Replit deployment.

**Why:** A successful workspace or Replit release does not establish that the
Vercel-hosted www endpoint changed.

**How to apply:** Independently check each live serving host and the original
audio host before calling an inventory-exposure incident resolved.

Studio recording previews must tolerate visitors spending longer on the form
than a short-lived preview link remains valid.

**Why:** The review screen could retain an expired link even though the Danny
recording itself was available. Extending link lifetime would weaken the owner's
chosen protection rather than address the form's timing.

**How to apply:** Refresh access privately for the first uncached playback, preserving
the exact recording identity among spelling variants. Keep expiry, rate limits
and source-location confidentiality intact; cancel pending work when stopped.

Keep one downloaded name preview temporarily in the open Studio so replays do
not repeat server requests. Clear it when the name changes, Studio is left, or
the page refreshes; unrelated detail edits should not discard it.

**Why:** The user explicitly approved this temporary caching approach after asking
whether every play contacted the server. They did not approve permanent browser
storage or weaker protection for the initial download.

**How to apply:** Cache only the selected recording, distinguish recording
variants by identity, release discarded audio resources and never retain failed
or cancelled downloads. Keep the cache page-local, not a cross-page or durable
name/audio store.
