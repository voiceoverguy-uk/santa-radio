---
name: Vercel function install boundaries
description: Independent function dependency installation can replace the website's npm layout with pnpm.
---

Treat website compilation and Vercel Node function dependency installation as
separate stages. A successful explicit npm clean install does not prevent the
function builder from detecting another workspace package manager.

**Why:** The Node builder independently preferred the native workspace's pnpm
lockfile, replacing the npm dependency layout after compilation. FFmpeg's
explicit asset inclusion then overlapped with a traced directory symlink and
the hosted output extractor rejected the function package.

**How to apply:** Keep website function installation on the completed website
dependency graph without deleting native workspace lockfiles. Verify emitted
function maps, not just source symlinks. Preserve this boundary in every
first-matching function configuration; Vercel does not merge a wildcard default
into an earlier exact match. Local builder success is not hosted recovery.
