---
name: Native development API routing
description: Public API routing requires an explicit managed service alongside Expo.
---
An Expo development host being reachable does not establish that the shared
website API is reachable through the public development hostname.

**Why:** The website server responded locally while native session creation
returned a proxy 404. Explicit registration of the existing server's `/api`
service made both normal and Expo development domains reach it.

**How to apply:** Test a native connection through the public development
hostname, not only loopback. Keep the managed website/API service alongside
Expo, avoid a duplicate server on the same port, and preserve the website's
original source/runtime rather than rebuilding it to solve routing.
