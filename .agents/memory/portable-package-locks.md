---
name: Portable package lockfiles
description: Keep dependency download URLs usable outside Replit for Vercel builds.
---
This project is deployed to Vercel from GitHub. Package tooling may write Replit-internal registry URLs into lockfiles; check portability after adding dependencies.

**Why:** Vercel cannot resolve Replit-internal hostnames, so installation fails before the app builds even if local builds succeed.

**How to apply:** Before delivering dependency changes, check all lockfile resolved URLs. For approved packages, use publicly accessible npm tarball URLs with unchanged versions and integrity hashes, verifying their availability. Do not bypass security blocks or change the workspace's registry security configuration.

Inspect parsed URL hostnames, not just a few grep terms such as `replit.dev`,
`artifactory` or `localhost`. A clean result for those strings can still miss
the package firewall's `.internal` hostname. Public npm packages with `replit`
in their names are not themselves private sources.

**Why:** A previous negative substring check missed internal download URLs
introduced by an otherwise valid security dependency update.

**How to apply:** Keep source portability enforced before hosted installation
and production builds. Verify both public registry metadata and downloaded
tarball SRI against the existing lock, not merely HTTP availability. A fresh
installation needs an empty cache and no existing node_modules; an isolated
public-registry test must not rewrite the workspace's managed security settings.

Check every lockfile representation, not just the modern packages graph.

**Why:** npm lockfile v2 can retain internal tarball sources in its legacy
compatibility graph even when the main graph is fully public; an earlier
portability check falsely passed by inspecting only the main graph.

**How to apply:** Validate legacy nested dependencies whenever that graph is
present, and include a regression where the main graph is clean but the
compatibility graph contains the internal source.

The root website package is consumed through the pnpm workspace even though
the repository also keeps an npm lockfile. A dependency present in
`package.json` and `package-lock.json` but missing from the root pnpm importer
may be absent from `node_modules`, causing Vite builds and tests that import it
to fail while unrelated browser tests still pass.

**Why:** A workspace install omitted an already-declared dependency because
the lockfiles had drifted, masking the problem until the production build and
multi-message browser tests loaded that package.

**How to apply:** After dependency merges, confirm new root dependencies are
present in both lockfiles and the pnpm-installed module tree before relying on
source-only browser checks.
