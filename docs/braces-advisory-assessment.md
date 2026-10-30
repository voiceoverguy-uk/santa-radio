# braces advisory assessment

Checked on 30 October 2026.

## Disposition

The reported finding `GHSA-vfj7-8cjw-p6xm` (`CVE-2026-93687`) has
been withdrawn upstream. No dependency or application change is needed for
this finding.

The [GitHub advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
states:

> This advisory has been withdrawn because it's not a practically exploitable vulnerability.

The [GitHub advisory API](https://api.github.com/advisories/GHSA-vfj7-8cjw-p6xm)
reports `withdrawn_at: 2026-10-23T12:53:02Z` and no patched version.

## Dependency checks

- `npm ls braces` identifies the installed chain as
  `http-proxy-middleware@4.2.0 → micromatch@4.0.8 → braces@3.0.3`.
- `npm view braces version` returns `3.0.3`, the latest published release.
- `npm view http-proxy-middleware version dependencies --json` reports
  `4.2.1` as latest, still depending on `micromatch@^4.0.8`.
- A fresh Replit dependency audit does **not** report this braces advisory.
  It reports unrelated findings in `body-parser`, `qs` and `vite`, which
  are outside this assessment's scope. This is not a clean-bill-of-health
  statement for all dependencies.

No audit exclusions, overrides, registry changes or authentication-proxy
replacement were introduced. The existing dependency manifests and lockfile
are unchanged. Build and browser checks were not necessary because no
executable code or dependencies changed.

If the finding is displayed again, refresh the dependency scan and compare
its advisory status with the upstream record before considering remediation.
