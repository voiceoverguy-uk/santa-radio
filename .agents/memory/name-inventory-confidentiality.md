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

Studio recording previews must tolerate visitors spending longer on the form
than a short-lived preview link remains valid.

**Why:** The review screen could retain an expired link even though the Danny
recording itself was available. Extending link lifetime would weaken the owner's
chosen protection rather than address the form's timing.

**How to apply:** Refresh access privately when playback is requested, preserving
the exact recording identity among spelling variants. Keep expiry, rate limits
and source-location confidentiality intact; cancel pending work when stopped.

**How to apply:** Independently check each live serving host and the original
audio host before calling an inventory-exposure incident resolved.
