# Search Console legacy-link repair

## Status and scope — 29 October 2026

These are **local, unreleased repairs**. No publishing, DNS, host-redirect or Search Console actions were performed.

The authoritative input is `attached_assets/Table_1793268036948.csv`: all 31 exact URLs, including www/non-www variants, with last-crawl dates from April to September 2026. `Metadata_1793268036948.csv` identifies the report as **Server error (5xx)**. The historical chart falls from 382 affected pages on 5 August to 31 on 23 October: a reduction of 351, approximately 91.9%. These counts do not prove indexing.

A fresh read-only GET check of **every exact exported URL**, following redirects, still found **23 final 200s, eight 404s, no reproduced 5xx** on 29 October. The eight production 404s remain until a separately approved release. The non-www Mariah Carey address redirects to its working www page. Historical crawl errors and current HTTP failures are not the same thing.

Locally, all 31 reach their expected content: **21 direct 200s and ten one-hop relative 308s to 200 pages**. Two of the ten redirects already existed (Ed Sheeran/Elton John and Band Aid). Host redirects are deliberately not reproduced locally or changed; preview stays on its own origin, while canonical metadata retains the preferred public www origin.

## Identity evidence

Current catalogue IDs alone were **not** used to infer numeric historical identities.

1. Retained `artist.php` in `attached_assets/Public_Folder_Santa_Radio_PHP_Files_1774459903533.zip`, line 32, explicitly selects `messages2` using `id = $_GET["s"]`. This establishes which original table/column the old query route read.
2. The retained original `attached_assets/cl57-thesongs_1791303552293.sql` declares `messages2` with `id`, `song`, `artist` as its first three columns. Its original INSERT rows explicitly bind the identities below.
3. The retained archive's `sitemap.xml` independently contains the four numeric songs' full artist/lyrics paths. Each identity also matches exactly one retained current recording by artist and title.

| Historical numeric query | Original SQL title | Original SQL artist | Evidence-backed destination |
| --- | --- | --- | --- |
| `494` | Christmas Blues | Sabrina Claudio | `/christmas-artist/494-sabrina-claudio-christmas-blues` |
| `140` | Ave Maria | Paul Potts | `/christmas-artist/140-paul-potts-ave-maria` |
| `314` | 100 Degrees feat Dannii Minogue | Kylie Minogue | `/christmas-artist/314-kylie-minogue-100-degrees-feat-dannii-minogue` |
| `200` | I Believe In Santa Claus | The Mills Brothers | `/christmas-artist/200-the-mills-brothers-i-believe-in-santa-claus` |

All four numeric cases are resolved; **none remains ambiguous or unresolved**. This does not authorise accepting other current numeric IDs as historical IDs. The established historical mappings 1–24 remain unchanged, including cases where today's catalogue uses the same number for another recording.

The two slug queries contain explicit performer/title identities. The same original SQL export confirms `(84, The Christmas Song, Barbra Streisand)` and `(450, This Christmas, Donny Hathaway)`. Only these two exact complete query values are accepted; neither their numeric prefixes alone nor arbitrary mismatching slugs are accepted.

| Remaining reported failure | Permanent destination |
| --- | --- |
| `/artist?s=450-donny-hathaway-this-christmas` | `/christmas-artist/450-donny-hathaway-this-christmas` |
| `/artist?s=84-barbra-streisand-the-christmas-song` | `/christmas-artist/84-barbra-streisand-the-christmas-song` |
| `/christmas-karaoke-lyrics/christmas-karaoke-lyrics/369-dean-martin-let-it-snow-let-it-snow-let-it-snow` | `/christmas-karaoke-lyrics/369-dean-martin-let-it-snow-let-it-snow-let-it-snow` |
| `/christmas-karaoke-lyrics/564-laufey-santa-claus-is-comin--to-town` | `/christmas-karaoke-lyrics/564-laufey-santa-claus-is-comin-to-town` |

Dean Martin's exact recording and existing canonical lyrics path establish the duplicated-prefix correction. Laufey's exact recording and existing single-hyphen canonical lyrics path establish the double-hyphen correction. No broad prefix stripping or hyphen normalisation was added.

Source SHA-256 checksums, for identifying the evidence without copying private legacy connection settings:

- Original SQL: `ccaf604bc1a199a49a3cf5e05a6e7a169d877c7b091024589a14a8902e0cc8a6`
- PHP archive: `cfc0409b2b4843d0e560785b4a352945c4db810fb35b73a2bfb870ef82ff4654`

## All 31 exported URL outcomes

“Live” means the final status after any existing host/path redirects in the fresh read-only check. “Local” includes the first response and expected destination. Full original host variants are preserved here and in the CSV-driven tests.

| Exact exported URL | Live | Local |
| --- | --- | --- |
| https://www.santaradio.co.uk/christmas-karaoke-lyrics/509-ed-sheeran-and-elton-john-merry-christmas | 200 | Existing 308 → `509-ed-sheeran-elton-john-merry-christmas`, 200 |
| https://www.santaradio.co.uk/christmas-karaoke-lyrics/74-aurora-half-the-world-away | 200 | 200, unchanged |
| https://www.santaradio.co.uk/christmas-karaoke-lyrics/60-chris-rea-driving-home-for-christmas | 200 | 200, unchanged |
| https://www.santaradio.co.uk/christmas-karaoke-lyrics/83-band-aid-do-they-know-it-s-christmas | 200 | Existing 308 → `83-band-aid-do-they-know-its-christmas`, 200 |
| https://www.santaradio.co.uk/christmas-karaoke-lyrics/144-run-dmc-christmas-in-hollis | 200 | 200, unchanged |
| https://www.santaradio.co.uk/christmas-karaoke-lyrics/270-scottish-quest-all-stars-santa-is-a-scotsman | 200 | 200, unchanged |
| https://www.santaradio.co.uk/christmas-karaoke-lyrics/8-shakin-stevens-merry-christmas-everyone | 200 | 200, unchanged |
| https://www.santaradio.co.uk/christmas-karaoke-lyrics/561-gwen-stefani-hot-cocoa | 200 | 200, unchanged |
| https://www.santaradio.co.uk/christmas-karaoke-lyrics/238-the-seekers-morningtown-ride | 200 | 200, unchanged |
| https://www.santaradio.co.uk/christmas-karaoke-lyrics/57-cliff-richard-mistletoe-and-wine | 200 | 200, unchanged |
| https://www.santaradio.co.uk/christmas-karaoke-lyrics/557-freya-skye-snow-angels | 200 | 200, unchanged |
| https://www.santaradio.co.uk/christmas-karaoke-lyrics/563-ed-sheeran-under-the-tree | 200 | 200, unchanged |
| https://www.santaradio.co.uk/christmas-karaoke-lyrics/564-laufey-santa-claus-is-comin--to-town | 404 | New 308 → exact Laufey lyrics page above, 200 |
| https://www.santaradio.co.uk/christmas-karaoke-lyrics/christmas-karaoke-lyrics/369-dean-martin-let-it-snow-let-it-snow-let-it-snow | 404 | New 308 → exact Dean Martin lyrics page above, 200 |
| https://santaradio.co.uk/christmas-karaoke-lyrics/25-mariah-carey-oh-santa | 200 | 200, unchanged; live redirects to www |
| https://www.santaradio.co.uk/artist?s=494 | 404 | New 308 → Sabrina Claudio recording above, 200 |
| https://www.santaradio.co.uk/christmas-karaoke-lyrics/428-toni-braxton-holiday-celebrate | 200 | 200, unchanged |
| https://www.santaradio.co.uk/christmas-karaoke-lyrics/89-the-beach-boys-bells-of-christmas | 200 | 200, unchanged |
| https://santaradio.co.uk/mugshots/mike-bushell-presenter | 200 | 200, unchanged |
| https://santaradio.co.uk/mugshots/brian-conley-comedian | 200 | 200, unchanged |
| https://santaradio.co.uk/mugshots/stuart-maconie-radio-presenter | 200 | 200, unchanged |
| https://santaradio.co.uk/mugshots/mike-read-radio-presenter | 200 | 200, unchanged |
| https://santaradio.co.uk/mugshots/vogue-williams-model | 200 | 200, unchanged |
| https://santaradio.co.uk/mugshots/radzi-chinyanganya-presenter | 200 | 200, unchanged |
| https://www.santaradio.co.uk/christmas-karaoke-lyrics/559-robbie-williams-bad-sharon | 200 | 200, unchanged |
| https://www.santaradio.co.uk/christmas-karaoke-lyrics/562-meghan-trainor-gifts-for-me | 200 | 200, unchanged |
| https://www.santaradio.co.uk/artist?s=140 | 404 | New 308 → Paul Potts recording above, 200 |
| https://www.santaradio.co.uk/artist?s=450-donny-hathaway-this-christmas | 404 | New 308 → Donny Hathaway recording above, 200 |
| https://www.santaradio.co.uk/artist?s=314 | 404 | New 308 → Kylie Minogue recording above, 200 |
| https://www.santaradio.co.uk/artist?s=200 | 404 | New 308 → The Mills Brothers recording above, 200 |
| https://santaradio.co.uk/artist?s=84-barbra-streisand-the-christmas-song | 404 | New 308 → Barbra Streisand recording above, 200 |

## Regression and serving checks

`scripts/search-console-legacy.test.mjs` reads all 31 exact CSV URLs rather than maintaining a smaller substitute list. It checks:

- Shared resolution, one-hop 308s, no loops and same-origin preview navigation.
- All 24 pre-existing numeric historical recordings, not just the new mappings.
- All 31 through development Vite SSR, built Node serving and the Vercel document function using compiled pre-rendered HTML.
- Initial meaningful performer/title and lyrics content, artist-page biographies, one title, canonical metadata and indexable destinations. Sing-along pages deliberately do not include artist biographies.
- HEAD redirects, obsolete `s` removal, preservation of unrelated/tracking parameters, and no open redirect through a `next` parameter.
- Genuine noindex 404s for unknown, mismatching, duplicate/conflicting, prefixed, extended or otherwise invalid identifiers.
- Original PHP lookup semantics and the six relevant SQL identities, without exposing historical connection settings.

The production build succeeds and pre-renders 1,560 canonical pages, with 28/28 historical identity matches. Existing build warnings about chunk sizes and unresolved static CSS references are outside this change. The original SEO checks passed; the new serving checks also pass after correcting the test to respect the existing lyrics-only page content.

Commands:

```sh
npm run build
npm run test:seo
```

The preview workflow was restarted successfully and a browser screenshot confirmed `/artist?s=494` reaches Sabrina Claudio's “Christmas Blues” page.

## Owner checklist — only after a separately approved release

1. First confirm the approved build has actually been released. These local results do not change the live site or Google's report.
2. Recheck all 31 exact exported addresses with GET, following redirects; expect each final page to return 200. For the eight repairs, inspect the permanent redirect and verify the correct recording/lyrics, not merely a successful status. Keep original non-www examples in the check.
3. In Search Console, use **URL inspection → Test live URL** on the repaired addresses and their canonical destinations. Where the old URL is reported as a redirect, inspect/test its final canonical address as well. Confirm Google can fetch the intended content.
4. When those live checks pass, open **Page indexing → Server error (5xx)** and choose **Validate fix**. Do not validate before the new build is live.
5. Monitor later crawl dates and validation results. Old redirected URLs need not be indexed themselves; Google should assess the canonical destinations. Successful live tests, validation and the historical 92% decline do not guarantee indexing or rankings.
