# Duplicate-report legacy links

## Scope and baseline

This is a local repair, **not a release**. No publishing, DNS changes, sitemap
submission or Search Console changes are authorised or performed here.

The complete, row-by-row disposition is
[search-console-duplicate-links.csv](search-console-duplicate-links.csv).
It preserves all **32 exact URLs**, including Matt Monro's non-www address,
their original last-crawl dates, classification, supplied live baseline,
exact intended destination and (where applicable) performer/title.
The CSV is also an independent regression fixture, not generated from the
redirect implementation.

All three supplied exports are accounted for:

- `attached_assets/Table_1793271000630.csv`: 32 URL examples; crawl dates range
  from **29 December 2018 to 10 October 2026**.
- `attached_assets/Metadata_1793271000629.csv`: property scope **All known
  pages**; issue **Duplicate without user-selected canonical**.
- `attached_assets/Chart_1793271000629.csv`: 80 daily observations from
  **5 August to 23 October 2026**. The affected count starts at 22, peaks at 36
  and ends at 32. This is report history, not a test of today's HTTP responses.

The task handover supplied read-only live GET findings: 14 name links and one
Matt Monro link already reached 200 pages with appropriate canonicals; 17
malformed nested URLs returned real 404s. Those live findings are retained as
the **pre-change baseline**, not claimed as a new production check by this
implementation. Before editing, the local shared resolver independently
reproduced those 17 errors and 15 working redirects.

| Classification | Count | Supplied live baseline | Implemented local outcome |
| --- | ---: | --- | --- |
| `working-name` | 14 | Redirect to name-prefilled free maker, 200 | Unchanged: relative 308 directly to `/free-santa-message?name=NAME`, then 200 |
| `working-song` | 1 | Matt Monro alias redirects to canonical song, 200 | Unchanged: relative 308 to `/christmas-artist/130-matt-monro-marys-boy-child`, then 200 |
| `repair-song` | 8 | 404 | Exact relative 308 to matching artist/song, then 200 |
| `repair-lyrics` | 5 | 404 | Exact relative 308 to matching lyrics, then 200 |
| `repair-profile` | 3 | 404 | Exact relative 308 to matching Mugshot profile, then 200 |
| `repair-gallery` | 1 | 404 | Exact relative 308 to `/mugshots/all`, then 200 |
| **Total** | **32** | **15 working, 17 errors** | **32 single-hop redirects to content** |

This does **not** show that 32 current content pages lack canonical tags.
Old crawl dates, currently redirected legacy links and malformed links are
different issues. Do not create separate indexable name pages to address this
report.

## Destination evidence

No mapping is inferred solely from a historical numeric ID. No established
numeric `/artist?s=…` mapping changes.

### Music and lyrics

Each of the 13 nested song/lyrics suffixes appears as a full artist/title URL
in `sitemap.xml` retained in
`attached_assets/Public_Folder_Santa_Radio_PHP_Files_1774459903533.zip`.
The original eight-column `messages2` rows in
`attached_assets/cl57-thesongs_1791303552293.sql` independently name the same
performer and title. The current retained song and its full slug agree.
The tests check all three, rather than treating a successful response as proof
of identity.

The original SQL identities are:

| Source row | Artist | Title |
| --- | --- | --- |
| 216 | Rizzo Gonzo | It's The Most Wonderful Time Of The Year |
| 413 | The Jackson 5 | I Saw Mommy Kissing Santa Claus |
| 120 | James Brown | The Christmas Song |
| 89 | The Beach Boys | Bells Of Christmas |
| 137 | Nat King Cole | Frosty The Snowman |
| 401 | Aretha Franklin | Joy To The World |
| 311 | The Magnets | A Winter's Tale |
| 213 | The Carpenters | It's Christmas Time |
| 199 | State of the Heart | I Believe In Father Christmas |
| 252 | Burl Ives | Rudolph The Red-Nosed Reindeer |
| 10 | The Ronettes | Sleigh Ride |
| 93 | Bing Crosby | The Christmas Song |
| 180 | Frank Sinatra | The First Noel |

The five lyrics routes stay in `/christmas-karaoke-lyrics/`; the eight artist
routes stay in `/christmas-artist/`, including the three with an additional
malformed `/mugshots/` segment. Existing punctuation aliases are resolved
**before** adding the exact mapping: Rizzo Gonzo's `it-s` → `its`, The Magnets'
`winter-s` → `winters`, and The Carpenters' `it-s` → `its`. There is no
intermediate alias hop. The unchanged Matt Monro mapping is corroborated by
the original SQL identity **Matt Monro / Mary's Boy Child** and historical
sitemap, with its existing `mary-s` → `marys` alias preserved.

### Mugshots and gallery

The same retained sitemap explicitly contains:

- `/mugshots/jeff-mostyn-bournemouth-fc-chairman`
- `/mugshots/mark-radcliffe-radio-presenter`
- `/mugshots/everal-a-walsh`
- `/mugshots/all`

The retained current Mugshots catalogue identifies Jeff Mostyn and Mark
Radcliffe at those profile slugs. Everal A Walsh's **existing** catalogue
alias points from `everal-a-walsh` to `everal-a-walsh-actor`, whose profile
identifies him as Actor. The new exact nested mapping takes that final
destination directly, not Rob Walker's profile or a similarly named person.
The terminal `all` is the historical gallery link, not a person called All;
it returns to the existing gallery. These findings explain the four exact
Mugshot-family mappings without generalising to other nested paths.

## Implementation and boundaries

`src/seo/routes.js` contains only the 17 verified exact-path additions.
Unknown combinations, conflicting slugs and numeric-only nested routes remain
404s. Removed R Kelly World and On Ember songs remain absent. There is no
general prefix stripping, numeric fallback, unrelated gallery/home fallback
or redirect to an external host.

GET and HEAD use permanent **308** responses with relative `Location` values.
Query values (including repeated tracking parameters) are preserved. Existing
name-link handling continues to replace conflicting `name` values with the
name from the path. It only carries a search request; it does not assert that
a recording exists, submit adult access or generate audio.

Redirects stay on the requesting origin, including Preview. Final content
metadata has exactly one canonical on `https://www.santaradio.co.uk`; the free
maker's canonical has **no name or tracking parameters**. This preferred public
canonical does not move preview requests to the live site.

No change was needed to the document handlers or `vercel.json`: the existing
Vercel catch-all already forwards `/santa-messages/…` to the shared resolver.
Regression checks model the ordered rewrite rules, including this catch-all.

## Local verification

```sh
npm run build
npm run test:seo
npx playwright test tests/santa-message-legacy-links.spec.js --project=chromium
```

The new `scripts/search-console-duplicate.test.mjs` is included in `test:seo`.
Its CSV-driven checks cover all 32 exported URLs through the shared resolver,
Vite development SSR, built Node serving and the Vercel document handler.
Checks include GET/HEAD, direct final destinations, absence of loops, meaningful
initial lyrics/biographies/gallery/maker HTML, exactly one correct canonical,
same-origin query preservation and genuine 404/noindex negative cases.

The browser checks read all 14 name URLs from the actual export. Each must
retain the adult access gate, prefill the requested name after access and
make no automatic audio-generation request. Recording lookup and access
submission are mocked in these browser checks; this does not claim that all
14 names exist in the hosted library or that the live signup service was tested.

Existing SEO checks also cover the independent historical query namespace,
previous export repairs, built serving and serverless document packaging.
See [the earlier legacy-link repair](search-console-legacy-links.md) and
[the historical music audit](historical-music-links-audit.md) for their separate
scope and unchanged intentional removals.

Verification on 29 October 2026: the build succeeded and generated 1,560
canonical pages; all **37 SEO checks and 19 Chromium browser checks passed**,
including each of the 14 exported name links. The running Preview was also
visually checked via the malformed Carpenters link and displayed the correct
song page. Existing build warnings about unresolved decorative letter images
and large chunks did not prevent the build; this task does not alter them.

## Owner's post-release Search Console checklist

These steps are **instructions for after a separately approved release**,
not actions performed by this task.

1. Confirm that the approved build containing these exact redirects is live.
   Do not select **Validate fix** based only on local/Preview success.
2. Test **all 32 exact old URLs** from the CSV with a live GET and no automatic
   redirect following first. The 17 repaired paths should return a permanent
   308 with the listed equivalent destination, not a home-page fallback.
   Check HEAD as well. Test a Preview URL separately if needed: its redirect
   must stay on Preview.
3. Follow each old URL to its final page. Confirm 200, the right artist/title,
   lyrics or profile/gallery, and no loops or intermediate punctuation aliases.
   The supplied non-www Matt Monro URL may also have the site's pre-existing
   host-normalisation hop; this repair neither changes nor promises to remove
   that hosting behaviour.
4. Inspect **initial page source**, not only a JavaScript-updated browser head:
   each final page should contain real content and exactly one canonical with
   the listed parameter-free path on `https://www.santaradio.co.uk`.
   The name links must land with their requested `name` value, but all share
   the canonical `https://www.santaradio.co.uk/free-santa-message`.
   Visiting must not generate audio or bypass the adult access form.
5. Test an unlisted nested path (for example
   `/santa-messages/christmas-artist/unknown`) and an intentionally removed
   song; both must remain genuine 404s, not successful substitute pages.
6. In Search Console's **Duplicate without user-selected canonical** report,
   use URL Inspection on representative repaired old URLs and their final
   destinations. Compare the user-declared canonical and Google's selected
   canonical, and use the live test where available. Resolve any remaining
   live errors first. Then the owner may choose **Validate fix** for this
   issue. This task does not submit a sitemap, request indexing or modify
   Search Console.
7. Allow time for recrawling. Historical examples/exclusions may persist or
   move to another category (for example, a redirected-page exclusion).
   A legacy redirect is not itself an indexable destination. Successful
   validation and correct canonical signals **do not guarantee indexing** or
   that Google will select the declared canonical.
