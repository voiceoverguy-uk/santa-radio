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

Website and mobile artifacts must have distinct preview paths, even when the
mobile artifact uses an Expo-specific domain.

**Why:** The artifact creator checks preview-path ownership across artifact
types. Changing only the mobile service paths did not free `/` while its
artifact-level preview path still claimed `/`, preventing website registration.

**How to apply:** Reserve `/` for the original website and give the mobile
preview a separate entry route. Keep the native Expo packager's root manifest
and app routes intact. Restore the website by registering its existing runtime,
not by copying or redesigning its frontend. One website service should own pages
and the shared API; check the public website, mobile API and Expo manifest after
changing ownership.
