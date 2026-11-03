# Rebuild the iPhone-only tracker handover

This folder is export tooling, not part of the website runtime. It deliberately
does not reuse the old `docs/tracker-handover` whole-site export.

1. `python docs/iphone-tracker/prepare-fonts.py` retrieves the current site's
   Inter/Cinzel families with OFL notices into ignored generated output.
2. `node docs/iphone-tracker/build-handover.mjs` creates a fresh allowlisted source
   directory under `generated-artifacts/iphone-tracker/`.
3. In that source directory, use `npm ci`, `npm test`, `npm run build`.
4. Verify a ZIP extracted into a new directory with the same commands and
   `npm run test:browser -- <built-preview-url>`. Also check the file-origin build.
5. Replace the verification template with actual results, add a per-file SHA-256
   manifest, then ZIP source plus `dist`, excluding node_modules and caches.
   Inspect every archive path and publish the ZIP and its SHA-256 descriptor.

`build-handover.mjs` rejects an existing output directory and any non-public
dependency download URL. Source hashes record original inputs; the receiving
guide documents every export-only adaptation. Live website files are read only.
