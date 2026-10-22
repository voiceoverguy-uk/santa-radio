---
name: Python package TLS trust in the workspace
description: Python package tooling may require an explicit system certificate path.
---
If Python package installation reports an unknown certificate issuer, use the system trust bundle explicitly, without disabling TLS verification.

**Why:** Native TLS alone did not resolve the workspace's package-download trust failure; explicitly pointing SSL_CERT_FILE at /etc/ssl/certs/ca-certificates.crt did.

**How to apply:** Retry the approved package manager with the system certificate path and native TLS. Do not use insecure hosts or disable certificate checks.
