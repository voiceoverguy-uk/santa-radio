---
name: HTTP canonical-host verification
description: An environment-specific Node fetch limitation when exercising trusted-origin and Host checks.
---

In this workspace's Node runtime, fetch can ignore a caller-supplied `Host` header and send the URL's localhost host instead. Origin alone is not enough when testing canonical production-host guards.

**Why:** Origin-protection tests received 403 despite supplying the intended production Host; a direct header inspection showed fetch had substituted localhost. Weakening the server guard would have hidden the test-client limitation.

**How to apply:** Use `node:http.request` with an explicit Host for local HTTP security tests. Keep the actual application host/origin guards strict. Do not use this workaround to send real credentials or signed capabilities to unrelated hosts.
