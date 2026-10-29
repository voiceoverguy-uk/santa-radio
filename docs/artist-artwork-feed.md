# Shared artwork feed

## Status and publication gate

Public path: **`/artist-artwork/catalogue.json`**. Schema version remains **1**.
This work adds `recordings` without changing `artists`, `fallback`,
`refreshAfterSeconds` (300), artist image paths or their versioned URL format.
It does not publish the website, switch an origin or release an app.

The supplied native-project handoff reports that iOS currently extracts website
scripts from **https://santa-radio-three.vercel.app**, retains website song IDs,
receives only artist/title in live metadata, and does **not** consume this feed.
Some approved bundled images have priority, including Sia assignments. These are
reported source-inspection findings, not an installed-device test here.

Before publication, identify existing feed consumers and verify their decoders
accept unknown top-level fields. Local tests prove the old fields are unchanged
and simulate an artist-only reader; they cannot prove compatibility with unavailable
older native source or every deployed client. A strict decoder may need updating.
Agree and verify one production feed origin with the native maintainer; do not
assume www is already the app's configured origin. See the
[copyable iOS handoff](song-artwork-native-handoff.md) for implementation and release checks.

## Additive schema version 1

```json
{
  "schemaVersion": 1,
  "refreshAfterSeconds": 300,
  "fallback": {
    "path": "/artist-artwork/santa-fallback.webp",
    "version": "<64-character lowercase SHA-256 of image bytes>",
    "url": "/artist-artwork/santa-fallback.webp?v=<same SHA-256>"
  },
  "artists": {
    "ariana grande": {
      "path": "/artist-artwork/ariana-grande.webp",
      "version": "<image SHA-256>",
      "url": "/artist-artwork/ariana-grande.webp?v=<same SHA-256>"
    }
  },
  "recordings": {
    "75": {
      "artist": "Ariana Grande",
      "title": "Last Christmas",
      "image": {
        "path": "/artist-artwork/ariana-grande-last-christmas.webp",
        "version": "6eeaec84dd39b5c5eb1fd4ab3b7444fa9222e4c21befa8420b061d8ffdf2a48d",
        "url": "/artist-artwork/ariana-grande-last-christmas.webp?v=6eeaec84dd39b5c5eb1fd4ab3b7444fa9222e4c21befa8420b061d8ffdf2a48d"
      }
    }
  },
  "version": "<SHA-256 of deterministic content excluding this version field>"
}
```

This is an abbreviated shape, not the full feed. No image addresses are renamed.
`recordings` keys are string website recording IDs, not artist keys or stream IDs.
Only explicitly assigned recordings appear; absence means use the artist/Santa
fallback, not missing catalogue data. Canonical artist and title come from the
website catalogue after validation of the assignment.

`artists` still includes every catalogue artist, supplied portrait keys and
approved artist aliases. A catalogue artist without a portrait has an explicit
Santa entry. Absent artist keys also fall back to Santa. Song images never
replace artist portraits.

Normalise artist keys with NFD, remove combining marks, lowercase, trim and
collapse whitespace; preserve punctuation and full collaboration credits.
Do not split names, guess aliases or infer song assignments from filenames.

## Source and validation

- `src/data/artistArtwork.js`: the existing artist mappings and Santa fallback.
- `src/data/songArtwork.js`: the single shared list of exact song assignments.
- `src/data/songs.json`: stable website IDs and canonical artist/title.
- `server/artwork-feed.js`: validates each assigned ID resolves to exactly one
  catalogue entry with the same artist/title; validates paths and readable WebP
  signatures; hashes bytes with SHA-256. Missing or invalid assigned files fail
  the request/build explicitly, never disappear silently from a successful feed.
- Vite reloads artist, song and catalogue modules for development requests.
  Production builds emit `dist/artist-artwork/catalogue.json`; there is no second
  manually maintained JSON list.

All current song assignments are shared, including Bad Sharon. This supersedes
their previous website-only feed exclusion, not their precise recording scope.
Website cards, pages, sharing metadata and live matching are unchanged, including
song → artist → Santa failure handling.

Output is deterministic, with no build timestamp. The overall version covers
schema, interval, artists, fallback, recording identities/mappings and image
versions. Replacing bytes at the same path changes the image hash, full URL and
overall version. Adding/removing/reassigning a recording changes the overall
version even if the referenced image already exists. Unchanged image hashes
and artist entries remain stable.

## Delivery and refresh

JSON and images remain anonymous resources with `Access-Control-Allow-Origin: *`
and `Cache-Control: no-cache`; GET, HEAD and OPTIONS retain their existing handling.
No credentials are needed. Resolve each returned `url` against the final feed
response URL and retain its full `?v=` query in network and decoded-image caches.
`path` is the old unversioned compatibility address, not a replacement cache key.

Fetch at launch; refresh while open every 300 seconds and on foreground/resume
when due; allow manual refresh. Do not poll in the background. Validate HTTP,
JSON, schema, entries and safe same-origin artwork URLs, then atomically store
the last good feed. Keep that feed offline or on errors; expose a retryable error
instead of clearing it. With no cached feed, use the approved offline placeholder.

A changed feed version must recompute visible and native Now Playing artwork
even when metadata has not changed. A failed recording image tries the versioned
artist image, then feed Santa, then offline Santa, each at most once.
See the handoff for ambiguity and approved bundled-image rules.

## Local checks

```sh
npm run test:artwork
node --test scripts/song-artwork.test.mjs
npm run build
npm run test:artwork-production
npx playwright test --project=chromium tests/artwork-feed.spec.js tests/exact-song-artwork.spec.js tests/song-specific-artwork.spec.js
```

Development checks use an isolated Vite server to exercise live assignment edits
without restarting or altering the real mappings. Development and built Node
delivery check every unique image against its advertised SHA-256. Production
tests also cover served/prerendered/direct SSR artwork, headers, missing files and
Vercel routing configuration. Local Vercel configuration checks are not a live
hosting check. Publication and actual iPhone/CarPlay checks remain separate.
