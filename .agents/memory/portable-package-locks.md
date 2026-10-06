---
name: Portable package lockfiles
description: Keep dependency download URLs usable outside Replit for Vercel builds.
---
This project is deployed to Vercel from GitHub. Package tooling may write Replit-internal registry URLs into lockfiles; check portability after adding dependencies.

**Why:** Vercel cannot resolve Replit-internal hostnames, so installation fails before the app builds even if local builds succeed.

**How to apply:** Before delivering dependency changes, check all lockfile resolved URLs. For approved packages, use publicly accessible npm tarball URLs with unchanged versions and integrity hashes, verifying their availability. Do not bypass security blocks or change the workspace's registry security configuration.
