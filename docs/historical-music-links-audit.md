# Historical music sitemap audit

## Finding — 29 October 2026

**Four remaining music URLs return 404; no wrong-performer or wrong-title
destinations were found among the other audited URLs.** All four belong to two
previously approved removals, not newly discovered accidental losses. Keep these
as genuine errors: there is no approved equivalent destination.

This is an **audit only**, against the current local shared route resolver.
No redirects, catalogue records, established historical mappings, server settings
or public site were changed. No production HTTP checks or publishing took place.
These results do not establish live status, indexing, playback or lyric accuracy.

## Focused list of remaining errors

All addresses below are exact `<loc>` values in the retained `sitemap.xml`.
Each returns **404 directly**, with no redirect.

| Historical URL | Identity evidence | Disposition |
| --- | --- | --- |
| https://www.santaradio.co.uk/christmas-artist/482-on-ember-ft-blend-on-ember | Original `messages2` row `(482, 'on-ember', 'On Ember ft Blend', …)`; full artist/title slug also agrees. | Intentional removal. No replacement approved. |
| https://www.santaradio.co.uk/christmas-karaoke-lyrics/482-on-ember-ft-blend-on-ember | Same original row and full slug; lyrics route for that entry. | Intentional removal. No replacement approved. |
| https://www.santaradio.co.uk/christmas-artist/422-r-kelly-world-christmas | Full historical sitemap slug. **No row 422 exists in the supplied SQL export**; do not manufacture a SQL identity or split this credit differently. | Intentional removal. No replacement approved. |
| https://www.santaradio.co.uk/christmas-karaoke-lyrics/422-r-kelly-world-christmas | Same historical full slug; lyrics route for that entry. | Intentional removal. No replacement approved. |

`docs/live-lyrics-audit.md`, “Subsequent user-approved corrections”, explicitly
records the owner's removal of **R Kelly World** and **On Ember**. Do not
reintroduce either song or redirect these links to the music index, home page,
an unrelated recording or an invented identity merely to obtain a 200.
No routing fix is recommended by this audit.

## Scope and totals

Input: `sitemap.xml` inside
`attached_assets/Public_Folder_Santa_Radio_PHP_Files_1774459903533.zip`.
The archive contains **1,311 URLs**, including:

| Music family | URLs before exclusions |
| --- | ---: |
| `/christmas-artist/…` | 433 (424 full slugs and nine numeric-only paths) |
| `/christmas-karaoke-lyrics/…` | 424 |
| `/christmas-music/` | 1 |
| **Total music URLs** | **858** |

The exclusion set is all 31 exact report URLs used by
`scripts/search-console-legacy.test.mjs`, read from
`attached_assets/Table_1793268036948.csv`. Host variants are collapsed **only
for exclusion comparison** by pathname plus query, so an already-covered
non-www case is not counted again as a new www finding. Twelve sitemap music
URLs overlap that set; the other 19 report examples are not additional URLs in
this sitemap's music families.

**846 distinct remaining music URLs were audited:**

| First response | Count | Final result |
| --- | ---: | --- |
| 200 | 690 | Same page, 200 |
| 308 | 152 | One relative, same-origin hop to 200 |
| 404 | 4 | The intentional removals above |

There are **842 final 200s**, no redirect chains beyond one hop, no loops and no
cross-origin redirects. The 152 working redirects are not broken links.
The music index redirects only to its slash-free canonical route.
Non-catalogue families (Mugshots, blog posts, news, apps, schedule and other
site pages) are outside this music-route audit.

## Identity checking, not just successful status codes

Evidence:

- `src/seo/routes.js`: actual shared request resolution, aliases and independent
  historical `/artist?s=…` handling.
- `src/data/legacy-songs.js`: established historical query identities, preserved
  unchanged. No new identities were added.
- `attached_assets/cl57-thesongs_1791303552293.sql`: original eight-column
  `messages2` export, **454 rows**. Its schema declares `id`, `song`, `artist`
  first. The read-only parser is `parseMusicRows` in
  `scripts/import-music-catalogue.js`; the importer itself is not executed.
- Retained `artist.php`: its `SELECT` reads `messages2.id` from `$_GET["s"]`.
  This lookup statement is checked without reproducing obsolete connection
  settings from the PHP file.
- Full historical artist/title slugs in the sitemap independently corroborate
  SQL identities; they are not reduced to numeric IDs.
- `src/seo/catalogue.js` and `src/data/songs.json`: the actual destination
  recordings and existing aliases, including duplicate consolidation.
- `docs/search-console-legacy-links.md`: completed earlier scope and historical
  namespace restrictions.

Of the 842 successful URLs, **831** have matching original SQL and destination
performer/title identities, **eight** use the four documented editorial
corrections below, **two** are the Michael Buble full-slug case below, and
**one** is the music index. Identity comparisons normalise case, accents,
punctuation and `&`/`and`; they do not use fuzzy title matching.

### Reviewed exceptions that are not misdirections

Each row covers both the artist and matching lyrics URL.

| Historical slug | Current outcome | Why this is not a broken/misdirected link |
| --- | --- | --- |
| `134-michael-buble-ave-maria` | 308 → `328-michael-buble-ave-maria` | SQL has no 134 row. The full historical slug explicitly identifies Michael Buble / Ave Maria; original SQL row 328 independently records that performer/title and the retained alias reaches it. This does **not** establish a historical numeric query identity for 134. |
| `135-mike-oldfield-il-dulci-jubilo` | 200 at the retained path, title “In Dulci Jubilo” | SQL says “Il Dulci Jubilo”; the owner-approved spelling correction and preserved instrumental handling are recorded in `docs/live-lyrics-audit.md`. |
| `212-gladys-knight-and-the-pips-it-s-christmas-everyday` | 308 → `212-gladys-knight-the-pips-its-christmas-everyday` | SQL's shortened title becomes “When You Love Someone (It's Christmas Everyday)”; documented in `docs/editorial/music-credit-verification.md` and `docs/live-lyrics-audit.md`, not a different recording. |
| `489-megan-trainor-my-kind-of-present` | 308 → `489-meghan-trainor-my-kind-of-present` | SQL preserves the old “Megan Trainor” spelling. The existing catalogue credit and explicit retained alias correct it to Meghan Trainor without changing the song. |
| `5-tom-jones-and-c-matthews-baby-its-cold-outside` | 308 → `5-tom-jones-c-matthews-baby-its-cold-outside` | SQL's “C Matthews” is expanded to Cerys Matthews. Her official release evidence is recorded in `docs/editorial/music-credit-verification.md`. |

Other existing consolidations also keep the correct performer/title:
`186-frank-sinatra-hark-the-herald-angels-sing` → `379-…`,
`233-the-carpenters-merry-christmas-darling` → `99-…`, and
`345-bing-crosby-i-wish-you-a-merry-christmas` → `204-…`.
Their lyrics equivalents resolve correctly too. Consolidation is not evidence
that arbitrary recordings sharing a title are interchangeable.

### Numeric-only paths and query identities are separate

All nine `/christmas-artist/{number}` entries resolve in one hop to recordings
whose identities agree with the **original SQL**, not just today's number:

| Numeric path suffix | Original SQL performer / title |
| --- | --- |
| 37 | Johnny Mathis / When a Child Is Born |
| 57 | Cliff Richard / Mistletoe And Wine |
| 12 | Pogues / Fairytale of New York |
| 67 | Bing Crosby / White Christmas |
| 403 | Boney M / Mary's Boy Child / Oh My Lord |
| 277 | Bing Crosby / Silver Bells |
| 376 | Frank Sinatra / Have Yourself A Merry Little Christmas |
| 76 | Andy Williams / It's The Most Wonderful Time Of The Year |
| 456 | Levi Roots / Reggae Reggae Christmas |

There are **no `/artist?s=…` URLs in this sitemap**. Do not extrapolate query
mappings from these path results. In particular, `/christmas-artist/12` reaches
Pogues, while established `/artist?s=12` must continue to reach Bing Crosby /
The Christmas Song. Both are intentional, separate historical namespaces.
`/artist?s=212`, `/artist?s=422`, `/artist?s=482`, arbitrary unknown IDs,
mismatching full query slugs and duplicate/conflicting `s` values remain errors.
No blanket numeric fallback, slug-prefix parsing or general normalisation rule
was introduced.

## Reproduce and verify

```sh
node scripts/audit-historical-music-links.mjs
node --test scripts/search-console-legacy.test.mjs
```

The first command is read-only and emits counts, source checksums, four errors
and the ten reviewed exception URLs as JSON to stdout. It follows the shared
resolver rather than making HTTP requests; unresolved or conflicting identity
classifications remain findings, never replacement routes. It also checks that
established query destinations still resolve and selected unknown/conflicting
queries still return 404.

The second command is the existing 31-case regression suite, including original
identity preservation and development, built Node and Vercel-function serving.
No application code changed, so no new build or workflow restart is required.

Evidence checksums match the earlier handover:

- SQL SHA-256: `ccaf604bc1a199a49a3cf5e05a6e7a169d877c7b091024589a14a8902e0cc8a6`
- Archive SHA-256: `cfc0409b2b4843d0e560785b4a352945c4db810fb35b73a2bfb870ef82ff4654`

Any public-site confirmation must be a separate read-only check after an
independently approved release. This audit is not permission to publish.
