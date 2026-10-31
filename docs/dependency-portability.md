# Portable dependency installation

## Repair

Four lockfile tarballs used a Replit-only dependency hostname that Vercel could
not resolve. They now use the official HTTPS npm registry:

| Package | Exact locked version retained |
| --- | --- |
| body-parser | 2.4.0 |
| express | 5.3.0 |
| qs | 6.17.1 |
| vite | 6.4.5 |

For each package, the public registry's exact-version metadata and the SHA-512
digest of the downloaded public tarball matched the existing lockfile integrity
value. Only four `resolved` URLs changed. All 307 locked package versions,
integrity values, dependency relationships and other lockfile metadata were
preserved. No packages were upgraded or downgraded for this repair.

## Recurrence checks

```sh
npm run check:dependency-portability
npm run test:dependency-portability
```

The standalone check uses only Node built-ins, so it can run before dependencies
exist. Vercel runs it before `npm ci`; `npm run build` also runs it automatically.
It fails rather than rewriting dependency sources.

It checks the complete npm lock graph, including nested/optional packages,
requiring official public HTTPS npm tarballs and retained npm integrity values.
It also inspects manifest dependency settings/overrides, root package-manager
configuration, alternative lockfiles, Python source configuration and Vercel's
package commands for private/local URLs. Public packages such as
`@replit/connectors-sdk` and `stripe-replit-sync` remain valid.

The separate Python tooling uses public PyPI and files.pythonhosted.org sources.
No other private dependency sources were found in project installation settings.
The workspace's managed npm registry is intentionally Replit-specific; that is
not a committed project install setting and has not been changed.

When a package tool rewrites lockfile URLs, stop and verify the exact public
package/version and tarball SRI before repairing the source. Do not regenerate
the graph, remove integrity, disable TLS/audit, ignore installation scripts,
change workspace security configuration or downgrade packages to avoid a block.

## Verification scope

Verified results:

- Six portability regression tests passed, including the actual internal Vite
  URL and a failing command-line preflight.
- A fresh public-registry `npm ci` installed successfully from an empty cache
  with no existing node_modules; npm reported zero vulnerabilities.
- The clean installation left the lockfile byte-for-byte unchanged.
- That installation completed the client/SSR production build and prerendered
  1,576 canonical pages; all 28 legacy identity checks matched.
- Preview restarted successfully and the homepage rendered normally.

Non-fatal Vite warnings about large chunks and runtime-resolved image paths
remain; unrelated application code/assets were not changed for this repair.

Fresh installation/build verification is performed in a disposable copy of the
build inputs, with no node_modules and a dedicated empty npm cache. Only that
test process uses the public registry and empty, distinct user/global npm
configuration files, matching an external builder. Normal TLS, integrity,
audit and package installation scripts stay enabled. The existing Preview
installation and workspace registry settings are not replaced.

This is not an actual Vercel deployment. Vercel account-level settings,
environment variables, remote cache behaviour and runtime/provider configuration
still require a separately approved hosted build. Node remains on 22.x; a
warning about an account-level Node selection being superseded by that engine
setting is not the dependency-hostname failure.
