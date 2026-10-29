# Crawled – currently not indexed: exact URL audit

## Scope and findings

This is an implementation and read-only evidence report, **not a release**.
Nothing was published; no DNS, certificates, service hosts, connected services,
Search Console settings or sitemap submissions were changed.

The supplied chart starts at **1,321 affected pages on 5 August 2026** and ends
at **113 on 23 October 2026**. The screenshot also reports 113: a reduction of
about **91.4%**. Those are historical report counts, not proof of an indexing
improvement caused by this implementation. The 113 example crawl dates run from
31 December 2021 to 21 October 2026.

Read-only live GET checks on **29 October 2026**, following redirects with
normal TLS hostname validation, reproduced the handover:

| Export examples | Count | Current live observation | This branch |
| --- | ---: | --- | --- |
| Named Santa links | 59 | Final 200; requested name preserved | Existing relative 308 to the gated maker, unchanged |
| Other working content/aliases | 28 | Final 200 | Preserved; exact doubled-separator examples now work in development/Node too |
| Additional verified links | 11 | Final 404 | Exact permanent 308 to existing content |
| No established equivalent / intentional removal | 5 | Final 404 | Genuine errors retained |
| Separate 404-report overlaps | 3 | Final 404 | Still 404 here, pending integration of that separate repair |
| Alternate service-host URLs | 7 | Certificate hostname mismatch | Hosting handoff only; no attempt to bypass or repair TLS in application routing |
| **Total** | **113** | **87 final 200; 19 final 404; 7 TLS failures** | **98 content destinations; 8 retained/pending errors; 7 infrastructure failures** |

“98 content destinations” counts export examples reaching content, **not 98
distinct pages**. Names intentionally consolidate onto one maker.

## Complete evidence and reproduction

- [dispositions.csv](search-console-crawled/dispositions.csv): owner-readable
  **113-row** audit, including exact original URL, host, crawl date, live result,
  final URL, local status/location, canonical destination, overlapping ownership
  and remaining action.
- [dispositions.json](search-console-crawled/dispositions.json): the same
  independent expected outcomes for regression checks.
- [live.json](search-console-crawled/live.json): timestamped per-example GET
  evidence, response chains, attempted URLs, TLS failure details and initial-HTML
  observations. A failed TLS connection has **no fabricated HTTP status or final
  destination**.
- [destinations-live.json](search-console-crawled/destinations-live.json):
  17 additional canonical destination GETs and the live sitemap check.
- [Table.csv](search-console-crawled/Table.csv),
  [Chart.csv](search-console-crawled/Chart.csv),
  [Metadata.csv](search-console-crawled/Metadata.csv): exact CSV member bytes
  from the ZIP; issue is “Crawled - currently not indexed”, scope “All known pages”.

The small archive members were read by explicit member name; nothing was
extracted over application files. Mac resource-fork entries are not report rows.

```sh
# Optional NEW live observations: changes the timestamped evidence files.
# No credentials, TLS bypass, Search Console access or mutations are involved.
node scripts/audit-crawled-links.mjs --live
node scripts/build-crawled-dispositions.mjs
node scripts/audit-crawled-links.mjs --destinations

# Local reproducible verification (does not re-fetch live evidence):
npm run build
npm run test:seo
npx playwright test tests/santa-message-legacy-links.spec.js --project=chromium
```

The audit generator does not read the redirect implementation to choose expected
outcomes. Tests compare all 113 original examples and their dates to the ZIP.
Live checks are observations, not a test of Google's selected canonical or
indexing decision.

## Additional exact redirects and identity evidence

All responses are permanent **308** with a relative `Location`. No host forcing,
generic prefix stripping, general punctuation repair, arbitrary query joining,
historical numeric remapping or catalogue renaming was introduced.

| Exact old request | Final same-purpose destination |
| --- | --- |
| `/artist?s=494-sabrina-claudio-christmas-blues` | `/christmas-artist/494-sabrina-claudio-christmas-blues` |
| `/artist?s=108-extreme-christmas-time-again` | `/christmas-artist/108-extreme-christmas-time-again` |
| `/artist?s=153-x-mas-donkey-&-the-glittering-balls-at-the-christmas-ball` | `/christmas-artist/153-x-mas-donkey-the-glittering-balls-at-the-christmas-ball` |
| `/artist?s=277-bing-crosby-silver-bells` | `/christmas-artist/277-bing-crosby-silver-bells` |
| `/artist?s=287-mitch-miller-and-the-gang-the-twelve-days-of-christmas` | `/christmas-artist/287-mitch-miller-and-the-gang-the-twelve-days-of-christmas` |
| `/christmas-artist/549-bon-jovi-christmas-isn-t-christmas` | `/christmas-artist/549-bon-jovi-christmas-isna-tmt-christmas` |
| `/mugshots/rob-walker-bbc-sport/rob-rinder-judge` | `/mugshots/rob-rinder-judge` |
| `/mugshots/rob-walker-bbc-sport/kell-brook-boxer` | `/mugshots/kell-brook-boxer` |
| `/shop/product/mugshots/mugshots/matthew-cottle-actor` | `/mugshots/matthew-cottle-actor` |
| `/santa-messages/mugshots/christmas-artist/christmas-karaoke-lyrics/58-cliff-richard-saviours-day` | `/christmas-karaoke-lyrics/58-cliff-richard-saviours-day` |
| `/personalised` | `/free-santa-message` |

The original eight-column `messages2` rows in
`attached_assets/cl57-thesongs_1791303552293.sql` explicitly identify the five
artists/titles, Bon Jovi and Cliff Richard. The tests compare repaired source
text, artist and title with the current catalogue. The retained public-folder
archive's `sitemap.xml` independently contains the five recording identities,
Cliff's lyrics page and all three exact profile slugs. The Donkey historical
sitemap slug uses `and`; the retained source artist uses `&`, and its existing
canonical uses neither. None of these are matched by numeric prefix alone.

Bon Jovi's original source has an encoding-damaged apostrophe; decoded it is
**Christmas Isn’t Christmas**. The existing canonical intentionally stays
`christmas-isna-tmt-christmas`. This repair adds only the reported ASCII-apostrophe
variant; the separate 404 report's Unicode artist/lyrics variants are not
silently absorbed into this scope.

The Donkey query contains a **literal raw ampersand**. Query parsing splits it
into `s=153-x-mas-donkey-` and the empty key
`-the-glittering-balls-at-the-christmas-ball`. Only that exact pair is accepted,
including the equivalent Vercel-serialised empty value. The fully encoded single
`s` value also works. Repeated `s`, repeated continuation keys, nonempty
continuations, wrong suffixes and conflicts remain 404. Both identity fragments
are consumed; legitimate tracking parameters retain their values and duplicates.
Existing numeric `/artist?s=…` meanings are unchanged.

The retained **personalised.php** enumerates `audio-messages/`, removes filename
extensions and links `/personalised-santa-message/{name}`. This is direct
evidence of an audio-name index, not a paid video product. The free audio maker
is the appropriate current equivalent. Adult access remains mandatory; the
incoming URL cannot submit access or generate audio. Name links only prefill a
search after access, with no claim that an old name has a recording today.
All maker metadata stays on the clean `/free-santa-message` canonical.

## Overlap and retained errors

The separate 32-row duplicate-report repair (364) is already in this branch.
There are **no exact exported URL duplicates** with it. The row audit also
compares same-path/query meanings and shared content destinations, including
the maker and matching recordings. Its 17 narrow malformed redirects and
established name handling are reused, not reimplemented. Its reported suffix
set did **not** include the Cliff nested example; that exact additional path is
therefore handled here.

The separate 64-row 404-report work (365) was a draft at assignment time and was
reported implemented elsewhere while this work was running. Its shared
free-apps/lyrics-query code is **not present in this branch**. Do not treat that
task status as evidence of an integrated repair:

- `//free-christmas-apps` and `//free-christmas-apps/`: the live edge removes the
  extra separator, then `/free-christmas-apps` still returns 404. The 404 export
  contains `/free-christmas-apps/`. Reuse that separately verified destination
  after integration, rather than independently investigating or inventing one.
- `/christmas-song-lyrics?s=319-michael-buble-all-i-want-for-christmas-is-you`:
  this exact URL is additional to the two query examples in the 404 report.
  It remains 404 here pending reuse of that shared repair **and exact query
  verification**. A successful repair of different query values alone does
  not prove this example is covered.
- Bon Jovi's recording is shared content; the spelling and artist-versus-lyrics
  paths differ. Keep the separate fixtures and verify their combined result.

The other five errors are deliberate dispositions, not unfinished redirects:

- `/christmas-artist/422`: intentionally removed historical recording. Keep
  the genuine 404, sitemap exclusion and existing removal policy; do not map it
  to a different song. `/christmas-artist/20` already redirects correctly and
  remains unchanged.
- `/karaoke4.php?=random21512853739505`: retained PHP reads
  `radiodocs/Nowplaying.txt`, splits artist/title and looks up matching lyrics.
  It does not use the random query to identify a recording. There is no stable
  same-content destination. Keep 404; do not recreate dynamic lyrics here.
- `//questions` and `//questions/`: no original questions page in the public
  archive, no questions entry in its sitemap and no questions-route links
  found among its 69 PHP members. No equivalent FAQ purpose is established.
  Current Tracker questions are not sufficient evidence to redirect to Tracker.
  Keep 404 unless the owner provides the original content and purpose.
- `/assets/img/artists/charles-brown.jpg` on non-www: no exact original image
  in either supplied public-folder or assets-folder archive. Today's illustrated
  artist art is not the historical image. Keep 404; an original asset and rights
  confirmation would be needed before any restoration.

No retained error redirects to the homepage. Development serving now explicitly
retains the two missing `.jpg`/`.php` errors rather than letting Vite's SPA
fallback return misleading 200 HTML. `//`, `//christmas-music` and
`//christmas-music/` mirror their already-working live consolidation using exact
matches. HTTP request parsing preserves leading separators as paths, not
protocol-relative hostnames; this prevents pre-resolver development failures
without a blanket normalisation rule.

## Seven certificate failures: hosting handoff

No HTTP document was obtained from these hosts. The public counterparts below
were checked separately on www and all returned 200, meaningful HTML and a
single correct canonical. A counterpart is **not a redirect observed from the
failed service host**.

| Original host | Original profile suffix | Intended www profile suffix |
| --- | --- | --- |
| apis.santaradio.co.uk | alesha-dixon-singer-presenter | alesha-dixon-singer-presenter |
| apis.santaradio.co.uk | dan-hatfield-tv-personality | dan-hatfield-tv-personality |
| listen.santaradio.co.uk | tracy-brabin-mp-actress | tracy-brabin-mp-actress |
| scm.santaradio.co.uk | sara-davies-dragon | sara-davies-dragon |
| listen.santaradio.co.uk | anne-hegerty-tv-personality | anne-hegerty-tv-personality |
| listen.santaradio.co.uk | sarah-beeny-presenter | sarah-beeny-presenter |
| listen.santaradio.co.uk | faye-tozer-singer | faye-tozer-singer-dancer |

Each suffix is under `/mugshots/`; the audit preserves its exact original URL
and crawl date. The hosting owner should first establish each hostname's
intended service role and locate obsolete links, then separately approve any
hosting remedy. Application redirects cannot fix a TLS handshake failure.
Do not disable hostname verification, repoint integration/feed hosts, or assume
these hosts should redirect all traffic to www.

## HTML, sitemap and local verification

All 87 live 200 examples had meaningful initial HTML, a heading, one correct www
canonical and no unintended HTML/response-header noindex. The 17 supplemental
destinations had meaningful initial HTML and correct single self-canonicals.
All distinct canonical destinations identified by this audit were included in
the live **1,560-entry sitemap**. This does not make old aliases or personalised
name URLs eligible as independent indexable pages.

The export-driven suite checks shared resolution, Vite development serving,
compiled Node serving and actual ordered Vercel rewrite handling. It covers
GET/HEAD, final artist/title/lyrics/profile identities, meaningful initial HTML,
canonical count/value, noindex mistakes, relative locations, query preservation,
raw/encoded ampersands, negative cases, no loops and sitemap hygiene. The seven
TLS failures are not falsely “fixed” by local host substitution; only their
explicit www counterparts are tested locally.

Browser checks include all 59 exported names, the existing duplicate-report
names and `/personalised`. They verify adult access, post-access prefill, clean
canonical metadata and no automatic generation. Brevo/recording lookup is
mocked: this is not a live signup or recording-availability claim.

Verification completed on **29 October 2026**:

- Production build succeeded, generating **1,560 canonical pages**.
- All **43 SEO checks** passed, including all export examples across the four
  serving/resolution layers and isolated Vercel packaging.
- All **23 related artwork-feed/workshop-access checks** passed after the
  request-target parsing correction.
- All **79 Chromium browser checks** passed, including all 59 crawled-report
  names and the original `/personalised` audio index.
- The running Preview was visually checked through the raw-ampersand Donkey
  query and displayed **At The Christmas Ball** by the correct group. The
  normal cookie notice was present; no consent or media policy was changed.

The existing build warnings about unresolved decorative image/font references
and large bundles were non-blocking and are unrelated to these routing changes.

## Owner's release and Search Console checklist

1. Review and merge the approved repairs, including the separate 404 work when
   available. Reconcile the **three explicitly pending rows**; do not describe
   the whole export as fixed while they still fail.
2. After a **separately approved release**, rerun the exact 113 live GETs.
   Check first-hop GET/HEAD and then final responses. Expect the 11 new exact
   redirects to the listed equivalent pages, not unrelated home redirects.
   Existing HTTP/non-www and double-separator edge hops may remain.
3. Inspect initial source of representative final recording, lyrics, profile
   and maker pages: meaningful content, single correct www canonical, no
   unintended noindex. Confirm preview still redirects within preview and the
   maker still requires adult access without generating audio on arrival.
4. Confirm sitemap canonical destinations and robots access on the released
   site. Old names, redirects and genuine errors should not be sitemap pages.
5. In Search Console URL Inspection, compare **the old URL and its intended
   final canonical**. Examine last crawl, fetch result, declared canonical and
   Google's selected canonical. Use a live test to check accessibility; it is
   not a guarantee of indexing. Google may correctly exclude a redirected URL.
6. Use **Validate fix** only for the resolved issue scope after live checks.
   Retained removals and TLS cases need their own documented treatment; they
   are not evidence that content should be recreated or unrelated redirects
   added. The owner can decide whether to request indexing of suitable final
   pages; this task does not do that on their behalf.
7. Allow recrawling and review later report changes. Technical success,
   validation and correct canonicals do **not** guarantee indexing or rankings.
