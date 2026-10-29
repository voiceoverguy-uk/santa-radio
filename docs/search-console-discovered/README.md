# Discovered — currently not indexed: complete audit

## Owner summary

All 447 exact exported URLs returned HTTP 200 during the full read-only check on
29 October 2026, 10:58:23–10:59:46 UTC. None redirected, timed out or failed.
Each had one correct self-canonical, index/follow metadata, no X-Robots-Tag
restriction, an H1 and meaningful initial main content. Every exported URL was
present in the live sitemap and reachable through checked ordinary, server-rendered
internal links. **No technical fault was found by these checks.**

This is not a broken-link report. “Discovered” means Google knows about the
address but has not reported it crawled in this coverage category; it is not the
same as “Crawled — currently not indexed”. A present-day successful GET does not
establish what Google previously fetched, selected as canonical or will index.
Do not infer a crawl-budget problem, penalty, ranking outcome or a reason for
Google's scheduling from this report.

The main investigation left open is content differentiation: 373 of the 447
addresses (83.4%) are lyrics pages whose corresponding song pages also contain
the lyrics. Representative initial-HTML comparisons confirm real overlap, not
just a shared template. That is a hypothesis worth inspecting, **not a proven
cause of this Search Console category**. No content, routes, canonicals or
indexing policies were changed.

## Preserved input and scope

- Source: attached_assets/Discovered_-_currently_not_indexed_1793271218067.zip.
  Only the three named CSV members are read; the archive is not extracted into
  the workspace and macOS sidecars are ignored.
- inventory.json preserves all 447 exact URLs in export order, their original
  crawl-date cells, all 80 chart rows and both metadata rows. Archive and member
  SHA-256 hashes allow the input to be identified and reproduced.
- Families: 373 sing-along/lyrics pages, 49 song pages, 25 Mugshot profiles.
  No duplicate exact URLs. All belong to the preferred www origin.
- All 447 “Last crawled” cells are 1970-01-01 placeholders. These are **not
  historical crawl evidence**, and do not mean Google crawled the site in 1970.
- Chart: 5 August–23 October 2026; first count 464, observed range 447–494,
  final count 447. This historical coverage count is not today's crawl result.
- Screenshot: attached_assets/Screenshot_2026-10-29_at_10.53.07_1793271195936.png
  displays this issue, 447 affected pages and “First detected: 11/18/25”.
  That first-detected label is report-level, not a per-URL last-crawl date.
- Metadata: Sitemap = “All known pages”; Issue = “Discovered - currently not indexed”.
  “All known pages” is the export's filter, not proof of a particular discovery source.

This report owns only this discovered-page export. Existing malformed-link,
legacy-server-error and crawled-but-unindexed work remains separate. See
docs/search-console-legacy-links.md and docs/historical-music-links-audit.md
for existing historical-identity ownership. No legacy mappings were changed,
no old recording was restored and no separate export was re-audited.

## What was checked for every URL

The complete row-by-row handover is audit.csv; report.html is a self-contained,
searchable owner copy with all 447 rows and this checklist. live-audit.json is
the machine-readable evidence, including intermediary discovery documents;
representative-pairs.json records the content comparisons.

Local/source checks:

- Every exact exported URL resolves directly as 200, is a retained current
  catalogue record and is included in the canonical sitemap inventory.
- No exported local route is marked noindex. Expected canonical destinations
  are the same exact exported URLs, not invented replacements.
- All 373 exported lyrics records have nonempty source text. Source text ranges
  from 56 to 3,493 characters. **Nonempty does not certify complete or accurate
  sung lyrics**; see the instrumental and content discrepancy below.

Live HTTP/initial-HTML checks:

- 447/447 direct HTTP 200s; zero redirects, errors or timeouts on this run.
- 447/447 one expected self-canonical and index/follow metadata; no restrictive
  meta directive or X-Robots-Tag observed.
- 447/447 H1s containing the expected performer/profile subject; song and lyrics
  H1s also contain the expected song title. Main content exceeds the audit's
  basic 100-character presence threshold. This is a presence check, **not a
  Google quality score**.
- 373/373 lyrics pages contain a nonempty initial HTML preformatted text block.
  Song pages contain artist-background content in their initial HTML. The
  local regression tests additionally compare all exported song/lyrics text
  with the full current source text, including text inside closed details.
- Live /robots.txt returned 200 with “User-agent: *” and “Allow: /”, with the
  preferred sitemap advertised and no Disallow rule.
- Live /sitemap.xml returned 200 with 1,560 locations. 447/447 exported URLs
  occur in that actual response, not merely in the local generator.

Discovery is verified from HTML anchor hrefs, not from JSON-LD, the XML sitemap
alone, a search box or simulated Load More clicks:

- 49 song URLs: Home → Christmas Music → exact song detail.
- 373 lyrics URLs: Home → Christmas Music → corresponding song detail →
  exact lyrics page. These are indirect collection links through the song
  page, not direct lyrics links on the collection.
- 25 Mugshots: Home → Mug Shots → exact profile. The permanent A–Z directory
  supplies ordinary profile links independently of the interactive gallery.
- All edges in all 447 paths were present in the checked source document's
  initial HTTP HTML. The two collection pages and homepage returned 200.
  These are available discovery paths, not proof that Google used them.

There were 778 unique GET targets in total: 776 HTML documents, robots and
sitemap. This includes exported pages and the extra song/intermediary pages
needed to verify their discovery paths. All 776 HTML targets returned 200.

## Representative lyrics/song overlap and distinct usefulness

These are observations of the saved live rendered initial HTML and the actual
React templates, not a template-count assumption. Character counts below
normalise whitespace and HTML entities, so differ slightly from raw JSON lengths.

| Recording | Exact lyrics shared by its song/lyrics pair | Song main chars | Lyrics main chars |
| --- | --- | --- | --- |
| Waitresses — Christmas Wrapping | 3,167 characters | 3,918 | 3,739 |
| Glee Cast — Christmas Wrapping | 3,167 characters | 4,099 | 3,736 |
| Run-DMC — Christmas Is | 3,485 characters | 4,372 | 4,042 |
| Barbra Streisand — The Christmas Song | 997 characters | 2,182 | 1,587 |
| Michael Buble — The Christmas Song | 767 characters | 2,281 | 1,348 |
| The Ronettes — Sleigh Ride | 728 characters | 1,799 | 1,299 |

All six pairs render identical lyric text within their own pair. Both pages
reference the same catalogue recording/video. Song pages add artist background,
performer classification, artwork, neighbouring songs and related recordings;
their full lyrics are initially inside a closed details disclosure but remain
in the server-rendered HTML. Lyrics pages omit artist background, display lyrics
without that disclosure, use a lyrics-specific heading and instruction, and
offer a return to the recording page. The local browser screenshot confirms
the dedicated Waitresses reading layout; a cookie choice overlay was present.
No video playback or transcription-to-audio verification was performed.

Waitresses and Glee Cast have different linked video IDs (nud2TQNahaU and
zL3N3RkNlzc) and separate performer backgrounds, while sharing the same supplied
lyric text. This does not prove identical recordings: retain distinct performer
credits and recording identity. Barbra Streisand and Michael Buble likewise have
different video IDs (Dd9ZaR-wxH8 and h_FV01Diqn0), with different supplied lyric
lengths despite a shared song title. Do not merge same-title recordings merely
because the composition or template overlaps.

Two specific editorial caveats, not routing defects:

1. https://www.santaradio.co.uk/christmas-karaoke-lyrics/135-mike-oldfield-il-dulci-jubilo
   contains a 56-character instrumental notice/joke, not sung lyrics. Existing
   docs/live-lyrics-audit.md records the owner's approval to retain this joke
   and the corrected displayed title “In Dulci Jubilo”. The historical slug
   intentionally remains unchanged. No new removal or rewriting is proposed.
2. https://www.santaradio.co.uk/christmas-karaoke-lyrics/181-michael-buble-frosty-the-snowman
   and its corresponding song page render text beginning “Ave Maria Gratia
   plena” under “Frosty The Snowman”. That title/text mismatch is directly
   observable in both saved HTML documents. It needs recording-specific
   editorial verification and owner approval before correction; this audit
   does not establish the correct transcription or a link to non-indexing.

Editorial options for a separate owner decision:

- Retain both page types for distinct recording/browsing and sing-along reading
  purposes, with recording-specific editorial improvements where justified.
- Consider an intentional content split if the owner wants the lyric page to
  provide a clearer independent use. Assess the visitor experience first.
- If the owner instead prefers one page, plan any consolidation per recording
  after inspecting Google's selected canonicals and preserving useful content.
  No blanket canonical, redirect, noindex or deletion is justified here.

## Confirmed technical faults and repair scope

**None found in the tested inventory and discovery paths.** There is therefore
no technical repair URL list to fabricate. The exact title/text discrepancy
above is an editorial finding, not an HTTP/indexing fault. The audit does not
assert the absence of every possible rendering, accessibility, playback,
legal, quality or Googlebot-specific problem. No Search Console account was
accessed, and the ordinary audit user agent is not Google's crawler.

## Short owner Search Console inspection checklist

Start with these actual exported examples:

- Lyrics: https://www.santaradio.co.uk/christmas-karaoke-lyrics/3-waitresses-christmas-wrapping
- Its recording pair (comparison, not necessarily in this export):
  https://www.santaradio.co.uk/christmas-artist/3-waitresses-christmas-wrapping
- Song: https://www.santaradio.co.uk/christmas-artist/130-matt-monro-marys-boy-child
- Mugshot: https://www.santaradio.co.uk/mugshots/amanda-holden-tv-personality
- Additional first/middle/last family examples are in inventory.json and the
  complete table; expand the sample if any inspection shows a discrepancy.

For each URL, record the inspection date and copy these fields where available:

1. Indexed-page inspection: current coverage reason/status and last crawl
   date, crawler type, crawl allowed, page fetch result and indexing allowed.
   If no crawl is recorded, write “not available”, never the export's epoch.
2. Discovery: referring page and sitemap shown by Google. Missing discovery
   details are not proof there are no internal links or sitemap entries.
3. User-declared canonical versus **Google-selected canonical**, including
   the corresponding song/lyrics URL if Google chooses it. If selection is
   unavailable because the page is not indexed/crawled, record that explicitly.
4. Optional live inspection: check current Google fetch/crawl availability and
   inspect rendered HTML for H1, lyrics/profile content and links. Keep this
   live result separate from the stored indexed-page result; a live test
   neither confirms indexing nor predicts the selected canonical.

All Google-only fields above remain **unverified** in this audit: actual
discovery source, Google's last crawl/fetch, bot-specific crawl availability,
indexing decision, selected canonical and scheduling/priority. Do not request
indexing, submit a sitemap or click Validate fix as part of this checklist.

## Repeatable audit and regression checks

From the project root:

    node scripts/audit-discovered-pages.mjs --fixture
    npm run audit:discovered
    node scripts/report-discovered-pages.mjs
    npm run build
    npm run test:discovered
    npm run test:seo

The fixture command preserves exact CSV values and hashes; it is not an
opportunity to replace this export with another report. The network audit is
read-only: two workers, 150 ms pause per worker between targets, one attempt
per hop, a 15-second timeout covering response/body, at most five redirects
(six responses), loop detection and **zero automatic retries**. Redirects
outside the audited HTTPS origin are recorded as unavailable and not followed.
Redirect chains retain every observed status, Location and X-Robots-Tag.
Failures/timeouts are recorded with their exact URLs and must not become passes.
Rerunning the audit replaces the snapshot files; preserve an earlier snapshot
elsewhere first if historical comparisons are needed.

The deterministic suite uses no live network or Google service. It checks all
447 exported pages plus discovery intermediaries against development HTTP,
compiled Node HTTP and Vercel's rewritten document handler, using existing
application rendering and serving paths. It catches route loss, noindex or
nofollow, incorrect/multiple canonicals, sitemap omission, missing initial
content/lyrics and missing server-rendered discovery anchors. Negative tests
exercise metadata/content/link failures and network evidence handling.

Verified: build succeeded; all six dedicated audit tests and all 37 combined
SEO tests passed. The pre-existing isolated serverless-package test also
passed in the combined suite. Live evidence records the website at the times
above; local tests describe this branch, not a future published build.

No publishing, DNS/hosting changes, sitemap submission, indexing requests,
Validate fix, biography rewriting, recording restoration or content/indexing
policy changes were performed. Any later repair or publication requires a
separately scoped decision.
