# Santa Radio favicon

The broken legacy favicon declaration is replaced with local `/favicon.png`
(192 × 192) and `/favicon.ico` (16, 32 and 48-pixel frames). Both come from
the supplied Santa-with-headphones artwork, not the wide wordmark.
Header logos and social-sharing artwork are unchanged.

## After an approved publication

1. Open `https://www.santaradio.co.uk/favicon.png` and
   `https://www.santaradio.co.uk/favicon.ico`. Both should return HTTP 200
   directly, display Santa, and have an image Content-Type (PNG and ICO),
   not an HTML page or a redirect.
2. View the homepage's original page source. Its head should advertise
   `/favicon.ico` with `sizes="16x16 32x32 48x48"` and `/favicon.png` with
   `sizes="192x192"`. Check `/apps` and `/santa-tracker` too.
3. Confirm the homepage and icons have no restrictive `X-Robots-Tag`
   response header, the homepage has no `noindex`, and `/robots.txt`
   continues to allow crawling. Check in a fresh browser tab/profile if
   an old tab icon is cached.
4. Optionally, in the owner's Google Search Console property, inspect
   `https://www.santaradio.co.uk/`, test the live URL, and request indexing
   of the homepage. This requests a recrawl; it does not force a favicon update.

Google controls whether the favicon appears and when it revisits and refreshes
search results. A working website icon is not proof that Google has updated
its search result. No publication or Search Console submission is part of
this change.

## Verification and artwork regeneration

Run `npm run build && npm run test:seo`. Checks cover PNG and ICO bytes and
dimensions, source/pre-rendered/runtime HTML, development GET/HEAD and built
Node image responses, crawlability, and Vercel's filesystem routing order.
Actual hosted Vercel responses still need the post-publication check above.

The committed assets can be regenerated with ImageMagick:

```sh
magick public/artist-artwork/santa-fallback.webp \
  -crop 336x336+64+28 +repage -resize 192x192 -strip PNG32:public/favicon.png
magick public/favicon.png -define icon:auto-resize=48,32,16 public/favicon.ico
```

Keep these URLs stable; do not change the source header logo or sharing images
when regenerating the favicon.
