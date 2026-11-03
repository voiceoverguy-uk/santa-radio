---
name: Studio temporary generation policy
description: Owner superseded durable message allowances and recovery with temporary creation, playback and download.
---

Santa Studio should generate from Mark's source audio, let the user play and
download the MP3, then retain no generated audio or generation history.
Do not require generation-record tables, durable per-user success counts,
correction allowances, identity locks or reload recovery.

**Why:** The owner explicitly superseded the earlier two-success/correction
requirement: “We don't need to store any mp3's just allow the user to generate
the file, and click save. Thats it. We don't need to keep a record of anything
or hold audio anywhere.”

**How to apply:** Preserve genuine voucher validation, payment entitlements,
access expiry and reasonable request-abuse protection. Do not promise durable
per-user counts. Tell users to download before leaving or refreshing; creation
is temporary and cannot be recovered later. Leave existing data and unrelated
database-backed features untouched. No new service or database provisioning
is authorised or needed for this flow.
