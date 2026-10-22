# Nice List certificates — development verification

## Behaviour

Each completed greeting now has **Download your audio** and **Download your Nice
List certificate**, with the certificate labelled **A4 landscape PDF**. The
certificate takes the display spelling from that completed result, not the
current form selection, recording ID or MP3 filename.

Only a name is added to the supplied blank master. Names and generated PDFs
remain in browser memory; personalised files use local Blob URLs and a generic
filename. No certificate API, recipient storage, telemetry or public hosting was
added. Audio generation, allowance, saved-greeting reuse and both existing
sharing actions are unchanged. Certificate errors have their own retry.

## Approved assets

Extracted only the master PDF, static Certificate Serif font and the two font
licences from the supplied editable pack. No bundled builder was run, duplicate
PDFs and macOS metadata were ignored, and the artwork was not recreated.

SHA-256:

- Master PDF: `94645c18638ec995932d7e0e45039db7483a74993acdb9d2a15f8fe244f0f15f`
- Supplied font: `817b056eb83c041c922d907976df54c7a88d6477fa254e2047bc22097a526f04`

The entire supplied font is embedded. Subsetting initially produced missing
visible letters despite correct text extraction; full embedding fixed this.
Regression checks assert that the complete font bytes remain embedded.

## Passing checks

- **10 certificate Chromium browser checks:** normal, long and accented/
  punctuated canonical names; form changes; two-result identities after SPA
  return; desktop keyboard and 390-pixel touch controls; cooldown; isolated
  failure and retry with playback/download/sharing and unchanged allowance;
  corrupt-asset recovery; repeated-click single flight; navigation cancellation;
  Blob URL release; eviction; and saved-audio reuse with zero generation calls.
- **30 existing browser checks:** hosted-name selection, audio playback and
  real MP3 downloads, mobile layout, cooldown/storage/cross-tab limits,
  public invitation sharing and native MP3 sharing.
- **2 existing saved-greeting browser checks:** verified saved bytes preserve
  playback/download/share with zero generation calls, and forced saved-file
  failure falls back to actual FFmpeg generation.
- **24 Node checks:** certificate bounds/embedding/artwork/metadata, allowance
  and saved-greeting logic.
- **7 audio API/render checks:** actual MP3 rendering, input errors, concurrent
  limits, stereo output and worker cancellation.
- **5 built-serving checks:** exact master/font/licence bytes, lazy certificate
  work, built Node SSR, deployment-style rendering and existing route/status/
  metadata behaviour.
- **Production build:** client build, SSR build and 1,559 pre-rendered pages.
  Existing bundle-size and unresolved-at-build-time hero-image warnings remain;
  the hero image is served at runtime.
- **Dependency portability:** all six added package tarball URLs use the public
  npm registry and returned HTTP 200.

One existing cooldown assertion referred to wording no longer present before
this feature; it was aligned with the existing form description and passed.

## Broader asset/catalogue check

The completion check exposed an earlier checkpoint's deletion of 609 unrelated
tracked inputs under `attached_assets/`. These were already absent when
certificate implementation started. They were restored byte-for-byte from the
preceding Git tree; comparison against that tree now shows no asset deletions.
Existing source ZIPs, SQL and original artwork were preserved, not regenerated.

After restoration:

- `node --test scripts/song-artwork.test.mjs`: **8 passed**.
- `npx playwright test tests/music-catalogue.spec.js tests/mugshots.spec.js --project=chromium`:
  **3 passed, 10 failed**. These are existing expectation mismatches (including
  636 expected versus 649 actual Mugshot records, 455 expected versus 452 actual
  music records, older biography/social-link/route expectations and page
  selectors). The affected catalogue data, pages, importers and these two test
  files have no changes relative to the pre-certificate branch.
- Certificate browser checks: **10 passed again**; certificate PDF and built
  serving checks: **10 passed again**.

The broader catalogue suite is therefore **not reported as passing**. Fixing its
unrelated expectations or changing the catalogue is outside this feature.

## Actual PDF inspection

Browser-downloaded PDFs were saved under ignored
`generated-artifacts/nice-list/`, including:

- `normal.pdf`: Olivia
- `long.pdf`: Alexandria-Catherine Elizabeth Montgomery-Worthington
- `unicode.pdf`: Élodie O’Neill-Sáenz
- `two-first.pdf`, `two-second.pdf`: retained result identities after navigation
- `saved-audio.pdf`: the same certificate path after a saved greeting

`.agents/scripts/render-nice-list-pdfs.py` rendered these actual downloads with
PyMuPDF. It checked a single 841.8898 × 595.2756-point page (297 × 210 mm),
extractable name text, unchanged generic metadata, embedded drawable glyphs and
pixel-for-pixel identical artwork outside the approved name area.

The normal, long and Unicode renders were visually inspected: all letters,
accents, apostrophe and hyphen render correctly; names are centred above the gold
line; the long name shrinks proportionally; the large decorative signature,
wax-style seal, existing wording and blank-field treatment remain intact.
Desktop and mobile result screenshots were also visually inspected.

## Reproduction

With the development workflow running:

```sh
npx playwright test tests/nice-list-certificate.spec.js --project=chromium
node --test scripts/nice-list-certificate.test.mjs scripts/santa-message-allowance.test.mjs scripts/saved-santa-greeting.test.mjs
npm run test:santa-audio
npm run build
node --test scripts/nice-list-serving.test.mjs scripts/seo-serving.test.mjs
python .agents/scripts/render-nice-list-pdfs.py
```

The rendering script requires PyMuPDF; it is a development-only verification
tool, not an application dependency.

## Limitations

- Browser interaction checks used Linux Chromium, desktop keyboard input and
  mobile viewport/touch emulation. Real iPhone/iPad Safari, Firefox, Android
  download managers and native system share sheets were not verified.
- No physical printer or paper proof was available.
- The screenshot tool sees the public access form, not completed greetings.
  Completed-result UI was checked in the browser tests with mocked adult access
  and the existing access controls left intact.
- Recent results remain tab-memory-only across SPA navigation, not refresh.
- No deployment or live-service configuration change was made.
