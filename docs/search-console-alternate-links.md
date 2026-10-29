# Alternate pages with proper canonicals: owner handover

## Result

**These are not 507 pages that need separate indexing.** The export records
Google's historical classification, with last-crawl dates from **3 January to
24 October 2026**. A complete read-only GET audit on **29 October 2026** found:

| Current live result | Exact URLs | Meaning |
| --- | ---: | --- |
| 200, clean free-maker canonical | 230 | Intentional name variants. Keep excluded as alternates. |
| 200, final destination self-canonical | 154 | Working www/non-www and established aliases, or canonical content whose report classification is historical. |
| 404 | 104 | Current missing routes, not a successful canonical exclusion today. |
| Certificate hostname validation failure | 19 | No usable HTTP response; hosting investigation, not evidence of missing content. |
| **Total** | **507** | Every original URL was requested individually, not inferred from a sample. |

**85 additional exact nested profile links now have local permanent (308)
redirects to their existing canonical profiles.** They are unique to this
report, were all live 404s, and reach 79 distinct existing profiles. All 79
destinations were separately checked live: 200, correct person in the initial
title, meaningful initial HTML and a single self-canonical. This is destination
verification, **not a claim that the new redirects are already live**.

No publishing, DNS/certificate changes, Search Console mutations, biography
creation, audio generation or signup changes were performed.

## Evidence and reproduction

- [507-row disposition CSV](search-console-alternate-links.csv): exact original
  URL and crawl date; live check time/result; final address and canonical
  relationship; cross-report ownership; current local result; evidence/action.
- [Live evidence](search-console-alternate-live.json): every request, redirect
  status/Location chain, final URL, canonical tags, robots metadata/header,
  title, initial H1, content length and SHA-256. Includes all original chart and
  metadata rows and archive checksum. Failures include curl exit code and error.
- [Repair destinations](search-console-alternate-destinations.json): separate
  GET evidence for all 79 destinations, with the same fields.
- [Discovery evidence](search-console-alternate-discovery.json): live
  robots.txt and full sitemap, fetched using normal certificate verification.
- [Summary](search-console-alternate-summary.json): classifications, compiled
  document link checks and sitemap findings.

The three actual CSV members were read from
`attached_assets/Alternate_page_with_proper_canonical_tag_1793271286217.zip`;
nothing was extracted over the project. Resource-fork metadata was ignored.
The archive metadata identifies **All known pages / Alternate page with proper
canonical tag**. Its chart has **80 daily observations, 5 August–23 October
2026**, increasing from 263 to 507 (range 263–507). The screenshot reports 507
and a “First detected: 11/11/25” label. Its wider date-axis labels are not
additional CSV observations. Neither graph dates nor classification dates
describe today's response.

The inventory contains 230 maker name queries, 88 nested document paths, 19
alternate-subdomain URLs, seven asset-like paths and 163 other addresses.
The local pre-change resolver had 396 initial 200s, five redirects and 106
404s. That resolver does **not** evaluate TLS, the hostname or live release
state. Do not confuse those counts with the live table above. After this work
the same local inventory has 396 initial 200s, 90 redirects and 21 404s.

Repeat after an approved release, without overwriting the reviewed baseline:

```sh
node scripts/audit-alternate-canonicals.mjs
# Writes generated-artifacts/alternate-canonical-live.json.
# Optionally supply another output filename as the first argument.
```

Public requests use curl GET with normal TLS and hostname validation, three
workers, a 35-second limit, at most eight redirects, no cookies/credentials and
no automatic retries. A TLS failure's `finalUrl` is the last attempted address,
not a verified content destination. No certificate check was bypassed.
Recorded canonical destinations were also fetched. No result from a sampled
host was applied to unrequested rows.

To recheck just the repair destinations:

```sh
node scripts/audit-alternate-canonicals.mjs --repair-destinations
```

To reproduce the compiled-document/link disposition from the saved live evidence:

```sh
npm run build
node scripts/classify-alternate-canonicals.mjs
# Add --live-discovery only when deliberately refreshing robots/sitemap evidence.
npm run test:seo
```

The dated live snapshot is evidence, not a continuously refreshed health claim.
If deliberately adopting a new baseline, preserve the old file first and
update the snapshot assertions to match the newly reviewed evidence.

## What remains intentionally consolidated

All 230 `/free-santa-message?name=…` responses have the clean
`https://www.santaradio.co.uk/free-santa-message` canonical. No per-name
landing pages were created. The incoming name is still only a lookup request:
adult access, recording-availability checks and no automatic generation remain
unchanged. Existing message-link/access regression tests remain in the SEO
suite.

The five existing local aliases remain unchanged:

- Zoe Lyons → `/mugshots/zoe-lyons-comedian`.
- `/christmas-music/` → `/christmas-music`.
- Lesley Garrett's soprano slug → `/mugshots/lesley-garrett-singer`.
- Everal A Walsh's short slug → `/mugshots/everal-a-walsh-actor`.
- Bradley McIntosh's capital-I slug → lowercase canonical slug.

Of the 153 successful non-www URLs, 149 have a host redirect followed by 200;
four additionally pass through an established path alias. Both kinds finish
at the correct www canonical. This task does not alter those host rules.
Preview, APIs, audio and integration hosts are not forced onto www.

All 155 distinct canonical destinations from the successful export rows
returned 200 with a single self-canonical and initial content, without noindex
or an X-Robots restriction. All appear in the compiled and live sitemaps.
The audit cannot read Google's selected canonical or indexing decision.

## Redirect evidence and boundaries

`src/seo/alternateRedirects.js` contains a finite list of the **85 exact
document addresses**, not a rule stripping prefixes. The source's full
profile slug matches a retained named profile and role in the supplied
catalogue. Its retained photograph, where present, and existing identity
consolidation corroborate the destination. Historical `sitemap.xml` from the
owner's original PHP archive supplies additional evidence for many profiles;
the CSV explicitly marks where that older sitemap does **not** contain one.
Its absence is not presented as evidence of absence from newer catalogues.

Two mappings use already established duplicate-person aliases directly:
Helen Skelton's Blue Peter slug and Stephen Mulhern's misspelled slug. They
finish at the reviewed canonical person without an intermediate redirect.
Stephen's duplicate has no image; the existing complete same-person profile
supplies it. Helen's canonical uses its selected retained photo, not
necessarily the duplicate's photo. No biography or photo selection changed.

Even where malformed paths include `christmas-artist` or
`christmas-karaoke-lyrics`, their final `/mugshots/full-person-role` identity
is a retained profile, not a recording. Unknown people, extra nesting, changed
roles and unrelated music suffixes still return 404. Query context is
preserved and redirects remain relative. Historical numeric artist identities
are unchanged.

## Other reports and remaining 404s

Comparison covered the complete legacy (31), duplicate (32), missing (64),
crawled (113) and discovered (447) URL inventories, matching exact URLs and
same path/query on other hosts separately. Only five rows overlap by path;
none of the new 85 redirects duplicates an existing report's URL:

| Profile | Existing report | Current result / handoff |
| --- | --- | --- |
| Alesha Dixon on listen | Crawled | TLS failure; hosting owner, retain content policy |
| Michael Ball, Kate Lawler | Crawled | Working content; no new repair |
| Paris Fury, Alex James | Missing | 404; existing missing-profile/editorial scope |

Additionally, the legacy lyrics **route-family** is already assigned to the
missing-page report even though this exact Bing Crosby query is not in its
64 rows. Hand over
`/christmas-song-lyrics?s=356-bing-crosby-i-heard-the-bells-on-christmas-day`
to that repair alongside its Carpenters and Michael Buble queries. The current
same-title/performer lyrics candidate is
`/christmas-karaoke-lyrics/356-bing-crosby-i-heard-the-bells-on-christmas-day`;
the existing repair must verify the legacy query contract. No competing
query parser or historical numeric-ID rule was added here.

The **21 locally retained 404 rows** include two Bryony Gordon addresses that
fail TLS before reaching HTTP live. The remaining **19 live 404s** are:

- Seven asset-like `/assets/img/artists/…/mugshots/…` paths. Recognisable
  person slugs alone do not prove an image request meant an HTML profile.
  Do not redirect a missing image to a biography. Exact addresses are in the CSV.
- The Bing Crosby lyrics query above, owned by the existing lyrics repair.
- `/search?q=%7Bsearch_term_string%7D`: an unexpanded placeholder, not a real
  supported search page. Keep a truthful 404.
- Three nested profiles without a proven single destination: Sir Michael
  Palin (two distinct retained profiles/photos), Sam Ryder and Steve Bracknall
  (no exact retained public profile). Do not guess from a person's name alone.
- Seven direct missing profiles: Matt Edmondson and Mollie King, Paris Fury,
  Bryony Gordon, Alex James, Harry Enfield, Rylan and Gyles Brandreth. Do not
  manufacture missing biographies or redirect to the gallery/homepage.

Scanning `href`, `src` and `action` attributes in all **1,560 compiled canonical
documents**, resolving relative URLs and decoding `&amp;`, found **no emitted
links to any exact reported bad path/query**. Neither the compiled sitemap nor
the freshly fetched live sitemap emits those bad addresses. This is exact
inventory coverage, not proof that no other bad link exists anywhere, and not
a crawl of every interactive/signed-in state. Current intended name links
are not classified as bad links.

## Hosting owner handoff

All 19 alternate-host requests failed certificate hostname validation:

| Host | Exact examples |
| --- | ---: |
| apis.santaradio.co.uk | 11 |
| listen.santaradio.co.uk | 6 |
| old-login.santaradio.co.uk | 1 |
| scm.santaradio.co.uk | 1 |

The CSV contains every exact path, request time and failure. Ask the
domain/hosting administrator to confirm the intended purpose of each host and
whether those historical document addresses should be supported, deliberately
retired or redirected at the hosting layer. First check whether any host
serves audio, authentication or another integration. A certificate failure
occurs before application redirects/canonicals can help; changing this app's
canonical tags will not fix it. No DNS, certificates, subdomain routes or
integration routing were touched here. Local 200 eligibility on a host does
not override its observed TLS failure.

## After an approved release

1. Rerun the audit against the exact inventory. Check GET and HEAD on the new
   nested redirects, then GET their final destinations: permanent status,
   correct Location, same person/biography/photo, initial HTML and one clean
   www canonical. Check query preservation on preview without leaving preview.
2. Keep unsupported paths as real 404s. Keep name variants canonicalised to
   the clean maker; verify Arthur's name lookup still passes through adult
   access. Recheck robots/sitemap and separately hand TLS hosts to hosting.
3. In Search Console, use **URL Inspection** on Arthur's parameter URL and the
   clean maker, a non-www profile such as Giovanna Fletcher and its www
   destination, Zoe Lyons's alias and comedian destination, and one repaired
   nested URL such as Ben Fogle.
4. Compare the last crawl, user-declared canonical and Google-selected
   canonical where shown. Use **Test live URL** to check today's fetch/render;
   it is not proof of Google's stored canonical or eventual indexing.
5. Request indexing only for a genuine canonical destination if appropriate
   after inspection. **Do not request separate indexing of name variants,
   non-www duplicates or malformed redirect sources. Expected “Alternate page
   with proper canonical tag” exclusions do not need Validate fix.**
   Any validation of repaired errors belongs to their actual error report and
   verified released scope, not a blanket attempt to empty this category.

No indexing, timing, traffic or ranking guarantee follows from these checks.
