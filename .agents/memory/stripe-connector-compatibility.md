---
name: Stripe connector authentication diagnosis
description: Verify native response shape before treating a template error as failed provisioning.
---

Inspect the native connection response's field names, never credential values, before concluding that missing template fields mean a proxy-only connection or failed sandbox provisioning.

**Why:** The first investigation incorrectly inferred proxy-only authentication from a missing template field and referred the owner to support. A field-name-only inspection showed a different credential naming convention; the standard sync package then authenticated, registered its managed webhook and received a genuine test payment notification without reconnecting.

**How to apply:** Preserve a working sandbox connection. Exhaust response-shape and package-compatibility checks before requesting owner action. Do not infer that the connectors SDK is the only supported path merely because the integration's generated instructions show it. Keep all credentials inside server-side runtime code and verify explicit test mode before writes.
