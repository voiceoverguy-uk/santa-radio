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

Keep shared allowance, identity locks and retry metadata durable on stateless
Vercel, but recover new audio by re-stitching rather than archiving MP3 bytes.
Preserve access to existing legacy user data without creating new archives.

**Why:** This reconciles the owner's temporary-audio requirement with their
requirement to preserve limits, recover lost responses and retain existing data.

**How to apply:** Keep the browser's completed MP3 until a replacement succeeds.
Do not promise reload recovery is independent of upstream availability for new
recordings. Do not turn temporary audio into per-instance entitlement state.

The owner prioritises working message creation over voucher usage records:
“If it means we get it working, i'm not fussed about keeping a record.”

**Why:** The owner authorised removing optional voucher collection and reporting
dependencies, while preserving voucher checks, entitlements and applicable
message limits.

**How to apply:** Do not require reporting tables for entry or creation. Keep
existing records and historical reporting separate from mandatory security
state, and do not remove allowance/identity enforcement as an analytics cleanup.

Coordinate storage enablement with the metadata-only renderer rollout.

**Why:** Creating previously missing tables can activate an older serving
renderer that archives MP3 bytes, even before the replacement code goes live.

**How to apply:** Keep Studio generation closed during an approved transition
until the non-archiving renderer is verified live; preserve the separate free
maker and do not treat hostname confirmation as migration permission.
