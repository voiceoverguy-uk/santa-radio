# Santa Radio SEO implementation review

Prepared for review only. No publish or DNS operation was performed.

For the separate 447-URL **Discovered — currently not indexed** export, see
[the complete discovered-page audit](search-console-discovered/README.md),
including the full live evidence, CSV inventory, portable HTML report and
owner Search Console checklist. This does not change the older review's
historical counts or duplicate other export repairs.

## Delivery

- Preferred public identity and canonicals: https://www.santaradio.co.uk.
- No host-wide redirects: Replit preview, same-origin APIs and external artwork integrations remain usable.
- Public React pages are server-rendered during development and pre-rendered during production builds. Their initial HTML includes actual headings, biographies, links, lyrics, metadata and JSON-LD. The production Tracker renders on request so its initial seasonal display does not become stale.
- Production Node serves the built pages, explicit relative redirects and actual 404s. Vercel configuration includes an equivalent document handler for aliases, unknown routes and legacy queries.
- Sitemap: 1,546 intended canonical pages: 450 recordings, 450 separate sing-along pages, 636 mug photographs and ten static pages. Preview and historical aliases, including legacy query URLs, are excluded.
- The 452 source recordings remain in the source data. Identical recording pairs 233→99 and 345→204 consolidate public URLs without deleting their source records.
- 23 legacy queries match an exact normalized artist/title identity. The Gladys Knight & The Pips query now matches through a verified shortened-title alias, so all 24 legacy queries redirect directly to their established canonical pages. See `docs/editorial/music-credit-verification.md` for evidence and the remaining uncertain music credits.
- The random/gallery approval order and Load More remain, alongside a permanent linked A–Z directory.
- All distinct retained celebrity photos and existing credits remain.
- Schema uses WebPage/CollectionPage, MusicRecording, supported Person/MusicGroup/PerformingGroup subjects, ImageObject, ItemList and visible breadcrumbs. No celebrity ProfilePage, invented rating/date/endorsement or uncertain sameAs links.
- The original photographs remain accessible; 320/640px WebP derivatives are generated into build output, not committed source assets.

## Tracker timing decisions

The March–November holiday, 1 December return, 24 December preparation and 10:00 UTC departure remain unchanged. The journey is LIVE at exactly 10:00 UTC on 25 December, as before, and COMPLETE immediately afterwards; completion ends at 26 December UTC.

Fractional arrivals now use millisecond arithmetic. Representative Christmas offsets use IANA rules for each stop/year. This corrects New Zealand, Fiji, Warsaw, Lagos and Jamaica, among others if rules change. Broad regional clocks represent the named reference location rather than every country in a region. Fiji & Tonga is labelled Fiji because its coordinates and postcard are Fijian and the countries use different offsets. The 44-stop inventory remains.

The UK is the current location/map/clock during its estimated midnight-to-00:50 UTC delivery window. Dwell windows end exclusively at their documented endpoint, preventing an expired stop from being called current at that instant. Season transition instants are unchanged.

Dashboard figures are labelled estimates. In transit, the clock identifies the last stop, not the visitor's time zone. Holiday postcard clocks remain explicitly approximate.

## Validation and editorial review

- `npm run build` generates all public HTML, sitemap/robots and image variants.
- `npm run test:seo` checks full retained metadata inventories, all built canonical pages, JSON parsing, alias loops, legacy mappings, image files, schema subjects/credits and Tracker boundaries.
- `npx playwright test tests/seo-improvements.spec.js` checks representative initial/rendered pages, JavaScript-disabled lyrics/directory, mobile interactions, HTTP responses, image MIME types and preview exclusion.
- `node scripts/seo-editorial-report.mjs` generates a downloadable editorial review CSV. Uncertain subjects and all unverified external identities are intentionally withheld from schema, not silently guessed.

Schema.org semantic checks and supported Google-feature fields are tested locally; JSON parsing alone is not described as Google rich-result approval. MusicRecording/Person/ImageObject/collections are semantic markup, not promised Google rich results. FAQ rich results were retired in 2026: the Tracker has useful questions but no FAQPage markup. Breadcrumbs and homepage WebSite identity are the relevant supported features.

## Requires release/hosting access
The full older biography browser batch exceeded the five-minute execution window; it is not reported as a completed browser suite. Full initial-HTML biography and lyrics content is checked against all retained source entries. Targeted no-JavaScript, mobile, gallery, credits, neighbour navigation, artwork-feed and schema browser checks are run separately.

After owner approval, publish the reviewed build through the actual production host. Vercel must use this repository's ordered document routes/functions and Node 22; a static-only SPA override would bypass status handling. Documents run through the handler before the filesystem; artwork/API files keep filesystem delivery. Replit production must build first and run `npm start`, not Vite preview. Host-level www/TLS/domain settings and any non-www redirect policy remain external hosting responsibilities; no DNS was changed here.

After release, verify both live hosts, Google-selected canonicals, indexed pages, sitemap acceptance and Core Web Vitals in Search Console. Google Rich Results Test/live URL Inspection were not claimed for these unpublished changes, and rich appearance/ranking is never guaranteed.
