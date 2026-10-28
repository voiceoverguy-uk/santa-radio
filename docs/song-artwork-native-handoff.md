# Exact song artwork and native lookup handoff

## Website changes (not yet published by this work)

These are **website-only recording assignments**, not replacement artist portraits.
Each is checked by catalogue ID, full artist credit and title. Cards, detail pages,
Open Graph/Twitter/JSON-LD images and reliably matched live artwork use the same
resolver. Failed images try the existing artist portrait, then Santa.

| ID | Catalogue artist | Exact title | Delivery filename in `/artist-artwork/` |
| --- | --- | --- | --- |
| 557 | Freya Skye | Snow Angels | `freya-skye-snow-angels.webp` |
| 46 | Frank Sinatra | Let It Snow! Let It Snow! Let It Snow! | `frank-sinatra-let-it-snow.webp` |
| 40 | The Jackson 5 | Santa Claus Is Coming To Town | `jackson-5-santa-claus-is-coming-to-town.webp` |
| 43 | Gabriella Cilmi | Warm this Winter | `gabriella-cilmi-warm-this-winter.webp` |
| 537 | Sia | Candy Cane Lane | `sia-candy-cane-lane.webp` |
| 538 | Sia | Naughty & Nice | `sia-naughty-and-nice.webp` |
| 480 | Sia | My Old Santa Claus | `sia-my-old-santa-claus.webp` |
| 457 | Sia | Santa's Coming For Us | `sia-santas-coming-for-us.webp` |

All eight original PNG uploads remain in `attached_assets/`. Delivery WebPs are
512 × 512, approximately 103–132 KB rather than the 2.7–3.1 MiB originals.
Conversion uses sRGB, aspect-preserving resize, centred transparent square padding,
metadata stripping and WebP quality 84. Seven originals are 1254 × 1254;
`sia-santas-coming-for-us_1793156002084.png` is 1278 × 1230, fitted to approximately
512 × 493 with transparent top/bottom padding. Nothing is stretched or centre-cropped.

### Duplicate review

Checked `src/data/songs.json` and the original
`attached_assets/cl57-thesongs_1791303552293.sql` export, parsing the latter without
reimporting it. Each of these eight artist/title pairs has exactly one record in
each source, with the IDs above. Gabriella's SQL credit has trailing whitespace,
not an additional recording. Other Sinatra and Jackson 5 songs have different
titles; versions by other performers are not these recordings.
The old SQL video for Sia's **Naughty & Nice** differs from today's catalogue
video, but it is still the same single ID, not a second record to assign.
No bulk deduplication, redirect changes, video changes or extra song assignments
were made. Unrelated Sia recordings (including future additions such as
**Snowman**) retain `sia-festive.webp`.

### Two narrow website match exceptions

| Observed radio metadata | Canonical website recording | Website path |
| --- | --- | --- |
| `Paul Burling` / `Another Christmas Song` | **439**, Paul Burling & Joseph Bell / Another Christmas Song | `/christmas-artist/439-paul-burling-joseph-bell-another-christmas-song` |
| `Tom Jones & C Matthews` / `Baby, Its Cold Outside` | **5**, Tom Jones & Cerys Matthews / Baby Its Cold Outside | `/christmas-artist/5-tom-jones-c-matthews-baby-its-cold-outside` |

Before these changes, `matchLiveSong` returned `unmatched` for both observed
pairs despite artist artwork resolving correctly. The two explicit pair aliases
now select their canonical pages and existing clean portraits, retaining the
full joint credits. Ordinary punctuation/case normalisation still applies.
There is no artist-wide credit rewrite, title-only lookup, fuzzy prefix match,
or stripping of `(Live)`/other version labels. Unknown titles and unrelated
performers remain unmatched; conflicting aliases remain ambiguous.
This website matcher is **not evidence of the native client's lookup behaviour**.

## What was verified on the public website

Read-only check: **28 October 2026, 03:19 UTC**, at the supplied public address
`https://www.santaradio.co.uk/artist-artwork/catalogue.json`.

- Feed: HTTP **200**, `application/json; charset=utf-8`, `schemaVersion: 1`,
  `Cache-Control: no-cache`, `Access-Control-Allow-Origin: *`,
  `Access-Control-Allow-Methods: GET, HEAD, OPTIONS`.
- Published feed version at that check:
  `15268b69dd62739c59669e7aeacea8f7b799178b49083c20ed128d717f0005e1`.
- All six alias entries below exist. Fetching each entry's complete **versioned**
  `url` returned **200 image/webp**, with the same no-cache/CORS headers.
  Image bytes matched both the advertised SHA-256 and the local clean WebP.
- Both images had `Last-Modified: Wed, 28 Oct 2026 02:57:29 GMT`.
  Paul image ETag: `"26688642960b898cf71480f274132598"`;
  Tom/Cerys ETag: `"2437e738ada5d20b67319887f765ebbb"`.
  Responses reported `x-vercel-cache: HIT`; that alone says nothing about an
  individual device's catalogue or native decoded-image cache.

| Expected normalised artist keys | Existing path | SHA-256 / `v` query |
| --- | --- | --- |
| `paul burling`, `paul burling & joseph bell`, `paul burling and joseph bell` | `/artist-artwork/paul-burling.webp` | `2ccc294a71ad9c0d8a0e3d2dbc225c25425bd84773663d9eb83dfde1ae4d9c4b` |
| `tom jones & c matthews`, `tom jones & cerys matthews`, `tom jones and cerys matthews` | `/artist-artwork/tom-jones-and-cerys-matthews.webp` | `43463b9d51b4d9e46cff9805394b29453a301a276c22272a907c84f00e539a21` |

The exact URL is each path above plus `?v=` and its full hash. These public images
are **not missing** at the time checked. This does not prove that the app requests
this endpoint, looks up these keys, or has refreshed its own catalogue.

The existing artist mappings, generator/schema, these clean images and Sia's
general portrait are unchanged. The complete locally generated artist-only feed
was compared before/after and is identical, including its version
`8edad85140e046c4118fa06e64203bb4f7906e88022cb9713bc870223fdb047e`.
That local version differs from the published snapshot; no cause or app cache
state is inferred from that difference. The eight song images do not enter the
mobile feed. Mobile song-specific artwork needs a separately agreed contract
and client implementation.

## Screenshot evidence, not image masters

The following three supplied files were reviewed but never installed as artwork:

- `Screenshot_2026-10-28_at_02.40.42_1793155992843.png`: native player displaying
  **Another Christmas Song / Paul Burling**, with a Santa placeholder.
- `Baby_Its_Cold_Outside_—_Tom_Jones_&_Cerys_Matthews_Santa_Radio_1793156142640.png`:
  website page showing the existing Tom/Cerys illustration.
- `Screenshot_2026-10-28_at_02.00.02_1793156142641.png`: native **Artists** screen
  displaying **Baby, Its Cold Outside / Tom Jones & C Matthews** and
  “This artist is not in the available catalogue. No matching profile could be
  opened.” with “Try updating catalogue”.

The last message concerns **profile lookup**, not proof of an artwork download
failure. Artist artwork and song/profile matching are separate paths.

## Native-project checks required before diagnosis or repair

Please supply the actual iOS project/source (or relevant lookup/store code) and
sanitised diagnostics. No device verification, native code change, rebuild or
release has been performed here. The private catalogue source, app version,
normalisation, route construction, refresh result and cache state are unknown.

1. **Identify the two sources independently.** Record the actual resolved URL,
   HTTP status/content type, schema/version and last successful refresh time for
   (a) artist artwork and (b) artist/song profiles. Check whether “Try updating
   catalogue” refreshes both stores or only one. Do not assume the profile
   catalogue is `/artist-artwork/catalogue.json`, which contains no song IDs or
   profile routes.
2. **Trace raw metadata through lookup.** Capture the two exact artist/title pairs
   above, then log the normalised artist key, profile-match input, selected ID,
   page route and failure reason. Check the abbreviated credit against full
   catalogue credits and preserve both names on canonical profiles.
   If the native project has an independent matcher, add only verified
   recording-pair aliases for **439** and **5**, with tests for unrelated titles,
   solo Tom Jones/Joseph Bell, live versions, ambiguity and missing records.
   Do not assume the website alias table is automatically downloaded by the app.
3. **Check the profile data and indexing.** Confirm the current native catalogue
   actually contains canonical IDs 439 and 5, their titles/full credits and
   usable page destinations. Verify decoding/indexing does not drop joint credits
   or depend on a guessed artist slug. Check that profile lookup does not gate
   otherwise valid artist artwork (or vice versa).
4. **Check artwork resolution separately.** With `paul burling` and
   `tom jones & c matthews`, inspect the selected entries against the table above.
   Use the full returned `url` resolved against the final feed response URL.
   Record status, downloaded hash and decoding errors. Preserve the `?v=` query
   in URLCache, third-party image cache and Now Playing artwork keys; do not
   silently reduce them to a path, artist name or unchanged track ID.
5. **Test refresh/cache propagation, not just download success.** On launch,
   foreground, manual update and the advertised 300-second interval, confirm a
   validated feed atomically replaces the last good one. A changed feed version
   must recompute current player/gallery/lock-screen artwork even when the track
   is unchanged. Inspect cached feed version, in-memory models, disk image cache,
   negative “no profile” cache and refresh error handling separately. Test cold
   start, warm refresh, offline/resume and recovery; do not label caching the
   cause without observing these values.

## Website verification

- `node --test scripts/song-artwork.test.mjs scripts/artwork-feed.test.mjs`:
  **28 passed**.
- `npm run build`: client, Node SSR and **1,559** canonical prerenders succeeded.
  Existing bundle-size and unresolved `/images/north-pole-hero.webp` warnings
  remain outside this task.
- `npm run test:artwork-production`: **8 passed**, including built/served and
  direct SSR images/OG/Twitter/JSON-LD, unchanged feed and served image bytes.
- Chromium: `tests/exact-song-artwork.spec.js`,
  `tests/song-specific-artwork.spec.js`, `tests/home-live-artwork.spec.js`,
  `tests/live-lyrics.spec.js`, `tests/artist-artwork-paul-burling.spec.js`:
  **39 passed, 1 pre-existing failure**. All six new tests passed, covering all
  eight recordings at desktop/phone widths, live pairs, fallback and padding.
  The old first lyrics test still expects a `Live radio songs` homepage region
  absent from both the pre-task and current identical `Home.jsx`.
  It was not changed to expand this artwork task.
- App-preview screenshot inspected the Sia **Santa's Coming For Us** phone page;
  browser checks also inspected the rendered square image bounds and transparent
  padding. Stream playback and metadata were controlled fixtures in live UI tests,
  not a claim that these tracks were broadcast or tested on an iPhone.

No website publication, DNS/metadata-feed changes or iOS release was performed.
