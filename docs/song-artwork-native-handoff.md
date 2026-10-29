# Copyable iOS handoff: exact-recording artwork

## Please implement feed consumption before claiming parity

The website now generates an additive schema-version-1 artwork feed at
`/artist-artwork/catalogue.json`. It shares the existing song-specific assignments
as well as unchanged artist portraits and Santa fallback. **The app must implement
feed consumption before automatic website/app artwork parity is possible.**

The supplied native handoff
(`attached_assets/Pasted-The-iOS-native-artwork-selector-also-supports-song-spec_1793266434686.txt`)
reports:

- App catalogue extraction currently reads published scripts from
  **https://santa-radio-three.vercel.app**, not the artwork JSON feed.
- Website recording IDs are retained, but live metadata supplies only artist/title.
  A shared ID in live metadata has not been verified.
- Native song-specific lock-screen/CarPlay selection exists; automatic feed parity
  does not. Approved bundled images, including recent Sia artwork, can take priority.
- Foreground checks run about every minute using image headers, not this feed's
  SHA-256 contract.

These findings are from the supplied source/HTTP inspection, not independent
inspection of the separate native source or an installed-iPhone test here.
No native files, bundled precedence, origin settings or releases were changed.

## Exact contract

Retain schemaVersion **1**, `artists`, `fallback`, `refreshAfterSeconds: 300`
and the overall `version`. Add optional `recordings` for clients upgrading from
older feeds; interpret an absent `recordings` as `{}`. New website output always
includes the object.

```ts
type Image = { path: string; version: string; url: string };
type ArtworkFeed = {
  schemaVersion: 1;
  refreshAfterSeconds: number;
  fallback: Image;
  artists: Record<string, Image>;
  recordings?: Record<string, {
    artist: string;
    title: string;
    image: Image;
  }>;
  version: string;
};
```

`version` on each image is the lowercase 64-character SHA-256 of served image
bytes; `url` is `path + "?v=" + version`. The feed version is a deterministic
SHA-256 including all recording identities/mappings/image versions and the old
fields (excluding the feed's own version). Do not calculate it from pretty-printed
JSON on the client. No timestamps or Last-Modified heuristics are required.

Actual local recording entries (abbreviated feed; hashes change on replacement):

```json
{
  "recordings": {
    "75": {
      "artist": "Ariana Grande",
      "title": "Last Christmas",
      "image": {
        "path": "/artist-artwork/ariana-grande-last-christmas.webp",
        "version": "6eeaec84dd39b5c5eb1fd4ab3b7444fa9222e4c21befa8420b061d8ffdf2a48d",
        "url": "/artist-artwork/ariana-grande-last-christmas.webp?v=6eeaec84dd39b5c5eb1fd4ab3b7444fa9222e4c21befa8420b061d8ffdf2a48d"
      }
    },
    "527": {
      "artist": "Ariana Grande",
      "title": "Winter Things",
      "image": {
        "path": "/artist-artwork/ariana-grande-winter-things.webp",
        "version": "ec86848472a981a378b0f1fd1a58a5f95feff75192733ef3bf0a7fb5542271c3",
        "url": "/artist-artwork/ariana-grande-winter-things.webp?v=ec86848472a981a378b0f1fd1a58a5f95feff75192733ef3bf0a7fb5542271c3"
      }
    },
    "559": {
      "artist": "Robbie Williams",
      "title": "Bad Sharon",
      "image": {
        "path": "/artist-artwork/robbie-williams-bad-sharon.webp",
        "version": "da49799b75954e4226249e831166c543c596c79cf2a34005996a5350390d4b1f",
        "url": "/artist-artwork/robbie-williams-bad-sharon.webp?v=da49799b75954e4226249e831166c543c596c79cf2a34005996a5350390d4b1f"
      }
    }
  }
}
```

All current assigned IDs:

| ID | Canonical artist | Canonical title |
| --- | --- | --- |
| 24 | Mariah Carey | All I Want For Christmas Is You |
| 40 | The Jackson 5 | Santa Claus Is Coming To Town |
| 43 | Gabriella Cilmi | Warm this Winter |
| 46 | Frank Sinatra | Let It Snow! Let It Snow! Let It Snow! |
| 75 | Ariana Grande | Last Christmas |
| 399 | Elvis Presley | Blue Christmas |
| 457 | Sia | Santa's Coming For Us |
| 480 | Sia | My Old Santa Claus |
| 527 | Ariana Grande | Winter Things |
| 528 | Katy Perry | Cozy Little Christmas |
| 537 | Sia | Candy Cane Lane |
| 538 | Sia | Naughty & Nice |
| 557 | Freya Skye | Snow Angels |
| 559 | Robbie Williams | Bad Sharon |

This table is explanatory, not a second source to maintain in the app. Generate
native indexes from the downloaded feed. Artists stay portraits: e.g. `artists["sia"]`
still uses `sia-festive.webp`, and Robbie Williams keeps his general portrait.
Unassigned recordings such as Mariah's Oh Santa must not inherit her other song's
illustration. Sharing this feed does not approve new images or broader assignments.

## Matching and fallback rules

1. Use a website recording ID only when its provenance/equivalence has been
   verified for that selected catalogue record. Treat keys as strings. Do not use
   a stream provider's unrelated ID, assume numbers are shared, or reuse the
   previously playing track's ID. Reject conflicts with available artist/title.
2. With live artist/title only, match **both** against canonical recording pairs.
   Prefer equality; allow conservative Unicode/case/whitespace/punctuation
   normalisation, but preserve words, credited collaborators and version labels
   such as `(Live)`, remix, acoustic, remaster and years. Do not strip a version
   label, fuzzy-match a prefix, match a title alone or rewrite all artist credits.
3. Check the full native catalogue for ambiguity, not just this small assigned
   subset. Multiple possible recordings mean **artist portrait**, even if only one
   candidate has a feed image. Require a verified unique identity before using its
   `recordings[id]`. Conflicting aliases are also ambiguous. Do not choose the first
   match or silently copy the website's historical duplicate coalescing.
4. Add only explicitly verified **artist-and-title pair** aliases. Website aliases
   are not automatically delivered by this feed. For example the website accepts
   `Paul Burling` / `Another Christmas Song` as ID 439 with canonical joint credit
   Paul Burling & Joseph Bell, and `Tom Jones & C Matthews` / `Baby, Its Cold Outside`
   as ID 5 with canonical Tom Jones & Cerys Matthews. Both use existing artist
   portraits, not new recording images. Solo Joseph Bell or other Tom Jones titles
   must not gain these matches. Do not infer aliases from image filenames.
5. Bad Sharon's canonical title is exactly `Bad Sharon`. The website has a narrow
   rule for a dangling `ft.` credit with no name. That is not permission to strip
   real featured names/version labels globally; independently verify native support.
6. Resolve the chosen recording image, otherwise the normalised full artist key,
   otherwise feed Santa. On download/decode failure, try recording → artist →
   feed Santa → approved offline placeholder, deduplicating URLs and trying each
   once. Unknown/ambiguous tracks must clear the previous recording choice.
7. Profile lookup is separate: missing artist biography/profile data must not block
   an otherwise valid artwork lookup. This task does not repair native navigation.

Artist-key normalisation is the website's existing contract:

```js
const artistKey = name => name.normalize('NFD').replace(/\p{M}/gu, '')
  .toLowerCase().trim().replace(/\s+/g, ' ');
```

Artist punctuation and collaboration credits remain significant. Approved
artist aliases are explicit `artists` keys; they are not automatic song aliases.

## Copyable implementation checklist

In the separate `artifacts/santa-radio-mobile/` project:

- `lib/catalogue.ts`: keep catalogue IDs and provenance. Read this JSON feed rather
  than extracting artwork assignments from minified website scripts. Do not
  replace profile/song catalogue data with the much smaller artwork feed.
- `hooks/useCatalogue.ts`: add a shared validated feed store, last successful
  refresh time, feed version and offline persistence. Validate HTTP success,
  JSON content, schema 1, required old fields, optional recordings, SHA-256 fields
  and same-origin `/artist-artwork/` URLs before an atomic swap. Tolerate unknown
  additive fields. Reject HTML/error responses and unsafe URLs.
- Fetch anonymously at launch, every advertised 300 seconds while open, on
  foreground/resume when due, and on manual refresh. Use timeouts, prevent overlap
  and do not background-poll. Keep the last good feed on network/parse errors and
  expose retryable errors, not an empty successful catalogue.
- `lib/live-artwork.ts`: build recording and artist indexes with the matching
  rules above. Keep resolution independent from profile availability.
- `hooks/useLiveArtwork.ts` and `components/CatalogueGallery.tsx`: use this same
  store/selection for selected songs, live player and gallery. Resolve returned
  image `url` against the **final feed response URL**, retaining the complete query.
- `plugins/santa-lock-screen.swift`: pass the same selected identity and image
  version/full URL to native Now Playing/CarPlay. On feed version change recompute
  the current selection even if the track did not change; replace decoded artwork
  and native map references, not just the downloaded JSON.
- Cache by full versioned URL (or origin + path + SHA-256), never only artist,
  unchanged track ID, bare path, ETag or Last-Modified. A replacement at the same
  filename must bypass the old decoded-image cache. Verify downloaded hashes when
  practical and handle decode/hash failures explicitly.
- Cancel or disregard outdated image requests after track/feed changes so an
  older asynchronous download cannot overwrite newer Now Playing artwork.

### Safe migration of approved bundled images

Inventory current overrides, their exact recording scope and approval first.
For each one, compare the proposed website assignment and actual image on the
agreed published origin. Preserve approved bundle precedence until equivalence is
explicitly verified; do not remove Sia overrides in bulk. Once approved, move that
specific recording to feed-first with the bundle as offline fallback. Roll out
incrementally and retain a rollback path. If images differ, ask the owner to resolve
the difference rather than overwriting an approved image. Local website tests do
not establish equivalence to unavailable bundled bytes.

## Publication and release coordination

1. Confirm old feed consumers tolerate additive fields. Local field-invariance
   tests are evidence for the contract, **not** universal native compatibility.
   Obtain older-client decoder/source or representative client tests before
   publication; update strict clients first if necessary.
2. Agree the feed origin with the native maintainer. The reported current origin
   is the Vercel address above; www is not assumed configured. Do not change DNS
   or the app's origin as part of this work. Resolve redirects and images on the
   agreed origin and verify anonymous JSON, CORS/no-cache headers and image hashes.
3. Publish the website through the normal authorised process, then check all
   14 recording entries and old artist fields on that actual origin. Workspace
   output is not a published update. No deployment happens automatically here.
4. Implement/integrate the native feed store, matching, caching and approved bundle
   migration. Coordinate availability with website publication; older feeds without
   recordings should safely remain artist-only.
5. Test on actual iPhone and CarPlay before an independently authorised app release:
   two Ariana songs, all four Sia songs, Bad Sharon, an unassigned song by those
   artists, different performers of the same title, live/version-label mismatch,
   ambiguous metadata, image failure, offline launch/resume, manual/timed refresh,
   and a same-filename replacement while the current track stays unchanged.
   Check gallery, player, lock screen and CarPlay select the same approved image.
   Record app version, OS/device, resolved feed origin/version and selected image
   hash. Do not treat a simulated browser test as a device check.

## Verification boundaries

- Local run on **29 October 2026**: 13 feed/development checks, 22 website
  song-artwork unit checks, 8 built-production checks and 25 focused Chromium
  checks passed (**68 total**). `npm run build` completed client, Node SSR and
  1,559 canonical prerenders. Existing bundle-size/unresolved-image build warnings
  were not changed by this feed work. The mobile-width artwork page was also
  inspected in app preview; no native screen was inspected.
- **Locally verified website behaviour:** canonical identity and all 14 assignment
  entries, unchanged artist/fallback fields, deterministic hashes, replacement and
  mapping invalidation, clear invalid/missing-file errors, development hot mapping
  refresh, development/built served image bytes, SSR/prerendered images and focused
  Chromium website artwork/fallback checks. See commands in
  [shared artwork feed documentation](artist-artwork-feed.md).
- **Publication still needed:** older-consumer compatibility evidence, agreed
  production origin, authorised publication and checks on the actual published
  feed/images. No live-origin verification is claimed for this extension.
- **Native changes still needed:** feed consumption, shared store, matching/cache
  integration, native Now Playing refresh and safe bundle migration.
- **Device checks:** none performed here. No installed-iPhone, lock-screen or
  CarPlay parity is claimed. No iOS release was made.
