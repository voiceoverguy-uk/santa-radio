---
name: Stripe connector authentication compatibility
description: Proxy-based native Stripe authentication differs from the managed-sync template.
---

The connected Stripe API integration can authenticate through the connectors SDK even when the older managed-credential template cannot obtain `settings.secret_key`. Do not treat that template failure alone as proof that the API connection failed.

**Why:** Sandbox balance and resource operations succeeded through the SDK while the managed-credential template reported `STRIPE_MANAGED_SECRET_MISSING`. The installed sync package expects a raw secret key, whereas the connector's instructions prescribe proxy authentication.

**How to apply:** Follow the current connected integration's instructions. Verify `livemode: false` before writes. Check the current sync package's supported authentication interface before configuring managed webhooks; do not invent credentials, request keys in chat or direct the owner into live setup to fix a sandbox-only task.
