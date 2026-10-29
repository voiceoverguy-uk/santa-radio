# Mugshot photograph licensing handoff

## Scope and local verification

The owner confirmed that Santa Radio owns the Mugshot photographs, including
photographs Bruce Davis supplies for Santa Radio to use and own. Photographer
credit is separate from copyright ownership. No catalogue records, photographs,
biographies, historical paths or image-specific credits were changed.

- Public terms: `/photo-usage-and-licensing`, linked from the footer and each
  Mugshot photograph caption.
- Terms require permission for reuse except where applicable law permits
  otherwise, with requests directed to the existing general-contact form.
- Both the primary-image and dedicated-photograph ImageObjects reference the
  absolute canonical terms URL. Logos, music artwork and other imagery do not
  inherit these terms.
- `npm run build`: passed; 1,560 canonical pages generated.
- `npm run test:seo`: 26 checks passed, including all 649 profiles, both photo
  nodes, preserved credits and biographies, unrelated-image isolation, sitemap,
  canonical handling, initial built HTML, Node document serving and the
  deployment-style function package without runtime UI dependencies.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5056 npx playwright test
  tests/mugshot-licensing.spec.js --project=chromium`: both checks passed against
  the built Node server, including hydrated navigation, browser history,
  general-contact mode and mobile browsing without JavaScript.
- Existing `tests/seo-improvements.spec.js`: two checks passed; three fail on
  outdated counts (636 rather than 649 Mugshots; 1,546 rather than 1,560 sitemap
  entries). The pre-change inventory already had 649 profiles and 1,559 sitemap
  entries; this work adds just the terms page. Those older checks remain unchanged.

## After a separately approved deployment

Nothing was published, and Search Console was not operated for the owner.
The project uses the owner-approved canonical origin
`https://www.santaradio.co.uk`. Replit also reports a public deployment at
`https://santa-radio.replit.app`; that does not establish that this fork is live
or that the custom-domain release has been updated.

1. After merging and an approved deployment to the site serving the canonical
   domain, inspect these canonical URLs:
   - Representative Mugshot:
     `https://www.santaradio.co.uk/mugshots/a1-singers`
   - Terms:
     `https://www.santaradio.co.uk/photo-usage-and-licensing`
   The assignment did not supply an individual URL from Google's affected
   examples. Also inspect an actual reported Mugshot URL from Search Console;
   do not assume the representative above is one of the reported examples.
2. Confirm both return HTTP 200, the terms are readable without signing in, the
   permission link selects General enquiry, and the terms canonical is correct.
   Check the Mugshot's initial page source and Google URL Inspection live test
   for the absolute `license` property on both photograph ImageObjects. Check
   the visible caption link and existing photographer credit.
3. Once the released fix is confirmed on the affected live URLs, open Search
   Console's Image Metadata report, select the missing `license` issue and
   choose **Validate fix**.
4. Google must recrawl and process the updated pages. Validation may take time,
   and the report's count need not immediately match all 649 published profiles.
   No immediate clearance, image badge, indexing or ranking improvement is
   promised. This non-critical metadata warning is not itself evidence of
   copyright infringement or an indexing failure.
