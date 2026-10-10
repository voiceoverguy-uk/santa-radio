# Shared artist artwork: mobile handoff

## Status and address

Feed path: **`/artist-artwork/catalogue.json`** on the published website.
This is a public JSON resource, not an HTML artist page or a JavaScript bundle.
Use the confirmed published website origin configured in the mobile project.
Do not use a Replit development hostname for a released app.

The feed is implemented in this website. The separate iOS project has not been
edited or verified: its source and existing feed contract were not provided.
The screenshot's report that the app refreshes its gallery/player catalogue is
not proof that it already consumes this new endpoint.

**Publish this website before connecting production mobile clients.** A change
in this workspace does not change a previously published feed. No website or
mobile release was performed as part of this work.

## Schema version 1

```json
{
  "schemaVersion": 1,
  "refreshAfterSeconds": 300,
  "fallback": {
    "path": "/artist-artwork/santa-fallback.webp",
    "version": "<SHA-256 of image bytes>",
    "url": "/artist-artwork/santa-fallback.webp?v=<same SHA-256>"
  },
  "artists": {
    "chris kamara": {
      "path": "/artist-artwork/chris-kamara.webp",
      "version": "<SHA-256 of image bytes>",
      "url": "/artist-artwork/chris-kamara.webp?v=<same SHA-256>"
    }
  },
  "version": "<SHA-256 of schema, refresh interval, mappings and image versions>"
}
```

All actual hashes are 64 lowercase hexadecimal characters. `artists` includes
every explicitly mapped portrait and approved alias, not every singer in the
song catalogue. An absent key means use `fallback`. No fuzzy matching is needed.
The feed is deterministic: it has no timestamp that changes on every build.

Normalise the complete artist name exactly as the website does:

```js
function normalizeArtistName(name) {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .trim().replace(/\s+/g, ' ');
}

function artworkUrl(feed, artist, feedUrl) {
  const key = normalizeArtistName(artist);
  const image = Object.hasOwn(feed.artists, key) ? feed.artists[key] : feed.fallback;
  return new URL(image.url, feedUrl).href;
}
```

Resolve `url` against the actual feed URL, not the app's own origin. For redirected
feeds use the final response URL where available. Always use **`url`**, including
its `?v=` query, for image requests and native image cache keys. `path` is the
unversioned compatibility address, not the recommended mobile cache key.

Accents, casing and extra spaces are ignored; punctuation is preserved. Do not
split collaborations, drop band prefixes or equate a solo artist with a band.
Approved exceptions (such as Holly Johnson for Frankie Goes to Hollywood) are
already explicit keys in the feed.

## One shared mobile store

- Fetch with no credentials at app launch; refresh on foreground/resume when
  the last successful refresh is at least `refreshAfterSeconds` old.
- While open, refresh at that interval; offer manual refresh when appropriate.
  Use request timeouts and prevent overlapping fetches. Do not poll in the background.
- Validate HTTP success, JSON schema version, required fallback, mapping shape,
  image URL origin/path and hash fields before atomically replacing cached data.
  An HTML response from an old hosting rewrite is an error, not an empty catalogue.
- Store the last successfully validated feed for offline use. A network or parse
  failure must retain that feed and expose a retryable refresh error, not erase
  existing artist portraits. With no cached feed, use the app's bundled offline
  Santa placeholder until a successful fetch.
- Refresh the gallery, radio player and iPhone lock-screen artwork from this
  **same store**. When the feed version changes, recompute artwork for the current
  track even if its artist/title have not changed. Pass the full versioned URL
  to the native Now Playing artwork loader too.
- On a particular image failure, try the feed's versioned Santa fallback once;
  if it also fails, use the offline placeholder. Avoid recursive error loops.
- Never append random timestamps: content hashes change only when bytes change.

The public feed/images allow anonymous cross-origin browser access, including a
separately hosted web preview. Servers use `Cache-Control: no-cache` so responses
must be revalidated; native caches still need the complete versioned image URL.

## Adding and replacing artwork here

1. Preserve the original upload; create the optimised WebP under `public/artist-artwork`.
2. Add or update the single mapping in `src/data/artistArtwork.js`.
3. Development serves fresh feed data through Vite. Production builds emit
   `dist/artist-artwork/catalogue.json` automatically; no JSON list is edited manually.
4. Missing or invalid mapped WebP files fail the feed/build explicitly.
5. Publish the website, then check the feed and image URLs on the intended origin.
   The mobile app sees the update on its next successful refresh after connection.

Replacing an image at its existing filename changes its image hash, versioned URL
and overall feed version automatically. Existing unversioned inbound image links
continue to work. Website music cards/details keep their existing resolver and URLs.

## Checks

```sh
npm run test:artwork
npm run build
npm run test:artwork-production
npx playwright test tests/artwork-feed.spec.js tests/chris-kamara-artwork.spec.js tests/artist-artwork-new-portraits.spec.js
```

Production tests launch a temporary local Node server against the built files,
verify every unique image's served bytes against its advertised hash, and check
headers and missing-file handling. Vercel configuration is checked locally;
no live Vercel deployment was changed or tested.

Still required in the separate mobile project: connect this contract, then check
Chris Kamara and George Michael in the gallery, current-track player and lock
screen, test a replacement at the same filename, and test offline/resume behaviour.
