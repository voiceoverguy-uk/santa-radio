# Vercel function packaging repair

## Confirmed failure

Read-only Vercel inspection on 3 November 2026 compared:

| Deployment | Git revision | Result |
| --- | --- | --- |
| `dpl_CXkpG6aoHAWhakKWyAM8Epq2tPSM` | `9a1b40c1f9312d0a12b4d38556eeba29cb9ecbba` | Deployment completed |
| `dpl_7K2RKMH9GWcv52k9Qoksn8nHMeDD` | `036215a79ba566902cbd1cb1b07784438eb0a5bc` | `patch_build_4xx` after “Deploying outputs…” |

Both used CLI 65.4.0, the configured npm clean install, Node 22, successful
client/SSR compilation and completed builds. Both logged the Node 24-to-22
override warning. That warning is **not** the cause.

The failed log additionally records:

1. Package-manager detection changed from npm to pnpm.
2. The explicit website install still ran `npm ci` successfully.
3. During Node function packaging, an additional automatic **pnpm** install ran,
   resolving the root and native workspace dependency graph.
4. The build completed, but output upload rejected an invalid function package
   mentioning symlinked directories.

The lockfile addition, rather than the Mac artwork change, is relevant: Vercel's
Node builder independently detects pnpm in preference to npm when both lockfiles
are present. The website's project-level install command does not automatically
control this second function-level install.

## Exact invalid output reproduced locally

An isolated checkout of the failing revision, under Node 22.23.4, was installed
with the configured clean npm install. Invoking `@vercel/node@28.0.0` (the builder
declared by CLI 65.4.0) reproduced the additional pnpm install.

The resulting **builder file maps** for these entrypoints are invalid:

- `api/santa-message.js`
- `api/santa-mobile.js`
- `api/santa-studio-message.js`

Each contains the directory symlink:

```text
node_modules/ffmpeg-static
  -> .pnpm/ffmpeg-static@5.3.0/node_modules/ffmpeg-static
```

and ten files under that same symlink path, including:

```text
node_modules/ffmpeg-static/ffmpeg
node_modules/ffmpeg-static/index.js
node_modules/ffmpeg-static/package.json
```

Tracing adds the symlink and its pnpm target; `includeFiles` expands the FFmpeg
directory into files below the symlink as well. An extractor cannot create both
a directory symlink and files inside that symlinked directory. Checking only
root `api`, `server` or `public` source trees misses this dependency-output
collision.

This establishes a concrete invalid layout matching the hosted error, not a
claim that Vercel identified a single specific function in its generic error.
The local builder was exercised for all 20 source API entrypoints (including
the Clerk proxy); hosted runtime statistics reported 18 then 19 Node functions.
These counts are different measurements, not evidence that the new mobile
handler itself has a logic error.

## Correction and boundaries

Every first-matching `vercel.json` function configuration now sets
`installCommand: ""`. The final `api/**/*.js` catch-all covers otherwise
unconfigured and future API files. Specific configurations also need the
setting: Vercel uses the **first** matching configuration, not merged defaults.

This disables only the redundant dependency install during function packaging.
It does **not** disable a function or skip the website installation:

```text
node scripts/check-dependency-portability.mjs && npm ci
```

The function builder therefore traces the flat, exact website npm installation.
Existing duration limits and `includeFiles` remain unchanged. FFmpeg, shared
prepared clips, Studio assets, private name assets and built documents are
still packaged. The native app, both lockfiles, pnpm workspace, presentation,
purchase/access rules, runtime readiness and recording retention are unchanged.

Do not replace this with removing workspace lockfiles, excluding the FFmpeg
binary, turning off functions, or weakening storage/readiness enforcement.

## Repeatable verification

On Node 22:

```sh
npm run test:function-layout
npm run check:vercel-packaging
```

The fast tests include the actual FFmpeg symlink/descendant layout, valid
in-package symlinks, broken/escaping/absolute/cyclic links, unsafe paths, missing
handlers, and first-match configuration coverage.

The isolated check:

- Copies version-controlled source with working-tree edits, not existing
  `node_modules`, `.env`, `dist` or untracked assets.
- Runs dependency portability, clean `npm ci`, complete production compilation
  and prerendering without native dependencies.
- Runs dependency-portability, mobile protection and real audio-render tests.
  Only the test child receives a fresh synthetic signing key; no live secrets
  or database connection is supplied. The opt-in database-ledger integration
  test is deliberately skipped.
- Runs the existing deployment-style document test with no runtime UI packages.
- Calls the pinned Vercel Node builder on **every** API entrypoint.
- Inspects every output path/link, checks explicit included assets and the
  uncompressed 250 MiB limit, and rejects native/pnpm-store leakage.
- Materialises each output as a separate function package with runtime/handler
  metadata under `generated-artifacts/vercel-packaging/`.
- Exercises packaged prerendered pages, dynamic Tracker, private staff document
  cache headers, protected mobile requests, free-message failure without
  required storage, Studio origin protection and the packaged FFmpeg executable.
  Each runtime probe uses a detached temporary copy outside the workspace, so
  missing dependencies cannot fall back to the workspace's `node_modules`.
- Writes per-function file counts, byte sizes and runtime/handler metadata to
  `summary.json`, explicitly recording that no hosted deployment was attempted.

The full Vercel CLI could not be installed here: both 65.4.0 and the latest
release were blocked by the workspace's dependency security policy on their
`tar@7.5.11` dependency. The policy was not bypassed. The independently
installable exact Node builder was used instead. This verifies the actual
function file maps and isolated runtime imports, **not** Vercel's final hosted
upload/extraction or a complete CLI build orchestration.

Generated output is ignored by Git and Replit packaging. Do not upload these
test packages as a substitute for an approved normal release.

### Recorded local result

The final isolated run on 3 November 2026 passed all **20** function layouts,
the detached document/audio/mobile runtime probes, and the included-asset
checks. Production compilation prerendered **1,576** canonical pages.
The dependency/mobile/audio group passed **29** tests with the one opt-in
database test skipped; the deployment-style document test also passed.
The four fast layout regressions passed separately.

Representative uncompressed function payloads:

| Entrypoint | Files | Bytes |
| --- | ---: | ---: |
| `api/public-page.js` | 1,610 | 36,800,130 |
| `api/santa-message.js` | 395 | 140,294,967 |
| `api/santa-mobile.js` | 888 | 143,060,051 |
| `api/santa-studio-message.js` | 789 | 97,288,292 |

The largest payload was 143,060,051 bytes, below 250 MiB. The local summary
and complete run log are under `generated-artifacts/vercel-packaging/`.
The website workflow was restarted successfully and its homepage preview
checked; the native workspace dependencies and app source were not changed.

## Hosted recovery is not yet verified

No deployment, live setting, DNS, secret or database was changed.
After separate owner approval for a deployment:

1. Deploy the merged repair through the normal Vercel process.
2. Check that the website npm clean install succeeds, function packaging skips
   additional installs, and no automatic pnpm dependency replacement occurs.
   Detection-only pnpm messages are not by themselves failures.
3. Confirm **Deploying outputs completes** and the deployment reaches Ready.
4. Check `/`, `/apps`, a song page, `/santa-tracker`, private staff entry pages,
   normal redirects and a genuine 404 on the newly deployed version.
5. Confirm mobile origin/cookie rejection and method checks, then use authorised
   native sandbox access to verify the shared API. Check a permitted free and
   Studio recording with the existing readiness and allowance rules intact.
6. Verify FFmpeg execution and document assets in hosted runtime logs. Do not
   expose selections, credentials, private origin paths or completed MP3s.

Only those hosted checks can establish production recovery. A successful local
package check does not prove that live Studio storage, purchases, signup
providers or recording origins are operational.
