# Reported missing pages — outcome and release checklist

## Status

Prepared on 29 October 2026. **Local changes only; not published.**
The complete owner-facing, 64-row audit is
[`search-console-missing-links.csv`](search-console-missing-links.csv).
It preserves every original address (including HTTP, non-www, Unicode and
comma-containing URLs), original crawl date, baseline status, disposition,
destination, full performer/title or person identity, and an evidence key.

| Disposition | Export rows | Local result |
| --- | ---: | --- |
| Verified same-content redirect | 42 | Relative permanent 308, directly to a meaningful canonical 200 |
| Deliberately retained error | 15 | Real 404, no redirect, noindex |
| Owner decision required | 7 | Remains a real 404; no assumed replacement |
| **Total** | **64** | **Every original export row accounted for** |

The 42 repairs comprise 30 direct music variants, two lyrics query links,
seven malformed nested links, one additional direct person alias, the former
free-apps page and TuneIn. Existing historical numeric mappings, withdrawn
recordings, canonical song slugs and biographies are unchanged.

### Baseline provenance and scope

Input: `attached_assets/Not_found_(404)_1793271072351.zip`, specifically
`Not found (404)/Table.csv`, `Chart.csv` and `Metadata.csv`.
Read these named members only, without extracting over the workspace or reading
Mac resource forks. The regression parses quoted CSV correctly.

The **404 baseline column is the supplied read-only live GET audit from
29 October 2026**, which followed redirects for all 64 original URLs; it is not
a claim of another live check after these edits. The supplied pre-change shared
resolver baseline also reported 404 for every example. These historical
observations are frozen, not replaced with today's expected local results.
No live changes, Search Console changes or DNS changes were performed here.

Metadata: `Sitemap = All known pages`, `Issue = Not found (404)`.
The export crawl dates span 9 May–24 October 2026. The chart runs from
5 August–23 October: 25 affected pages on 5 October, rising to 64 on 20 October
and remaining 64 through 23 October. The suite reads and checks all three
original CSV members and reconciles all 64 URLs/dates against the audit.
These failures do **not** establish that the whole website is unindexed.

## Evidence key and decisions

### `music`, `music-nested`, `lyrics-query`, `music-bon-jovi`

- Current identities: `src/data/songs.json`, public filtering and duplicate
  mappings in `src/seo/catalogue.js`.
- Historical identities: parse the eight-column `messages2` inserts from
  `attached_assets/cl57-thesongs_1791303552293.sql` **as data, never execute SQL**.
  `scripts/import-music-catalogue.js` and `scripts/import-mugshots.js` preserve the
  existing text-repair semantics. Tests compare complete artist **and** title
  against both the audit and retained SQL, not a numeric match.
- Source URL/title relationships are retained by the existing catalogue links,
  source song aliases and the supplied report; only exact reviewed addresses
  are newly accepted. No automatic punctuation-normalisation rule is installed.
- Tom Jones' SQL credit is `Tom Jones & C Matthews`; the retained current
  catalogue expands it to `Tom Jones & Cerys Matthews`. Both refer to
  `Baby Its Cold Outside`; the old URL also explicitly carries `c-matthews`.
  This is a documented single credit expansion, not a general name heuristic.
- Bon Jovi: original SQL and current catalogue identify **Bon Jovi —
  Christmas Isn’t Christmas**. Both reported Unicode-apostrophe URLs redirect
  to the retained `549-bon-jovi-christmas-isna-tmt-christmas` canonical slug.
  Do not rename it or confuse this recording with Jon Bon Jovi's other songs.
- `/christmas-song-lyrics?s=100-the-carpenters-sleigh-ride` and
  `?s=333-michael-buble-silver-bells` accept **only those two exact values**,
  redirect to lyrics (not artist biographies), remove the obsolete `s` selector,
  and preserve other query values. Empty, repeated, conflicting, arbitrary
  numeric and invented slug selectors are rejected.
- Dean Martin — White Christmas and The Carpenters — Sleigh Ride are the two
  verified nested artist addresses. They do not license prefix stripping for
  other songs. The preceding duplicate-report repairs remain in place and
  their original export suite still runs.

### `profile-nested`

The five nested profile addresses explicitly identify Mark Berry - Bez,
Melissa Jacques, Sir Ian McKellen, Spike (911) and Dave Vitty.
Their complete retained public profiles, photos and biographies are in
`src/data/mugshots.json`, consolidated by `src/data/mugshot-catalogue.js`.
Each gets an exact redirect to their own profile. A Rob Walker prefix is not
evidence that the request is for Rob Walker; no parent-profile fallback exists.

### `profile-liesl` — corrected planning assumption

The planning snapshot described six direct profile links as having no retained
public destination. Current inspection found **Liesl Soards** under
`/mugshots/liesl-radio-presenter`, with an existing biography and photograph.
The exact name, role, shorter slug and biography all agree. The reported
`/mugshots/liesl-soards-radio-presenter` is therefore a verified direct alias,
not a new biography. The remaining **five** direct profile links stay 404.

### `profile-absent`, `profile-no-biography`

- Paris Fury, Alex James and Sian Welby: no retained public profile of that
  identity. No generic gallery or homepage redirect is installed.
- Chris Ramsey and Wesley Nelson: source rows exist but contain no biography
  and are deliberately excluded by the current biography-content rule.
  Do not recreate them, invent prose or choose another person's profile.
- Existing separate biography work remains the place for any later
  owner-supplied researched content; these URLs are **not** counted as repaired.

### `apps`

`src/pages/apps-data.js` explicitly identifies
`https://www.santaradio.co.uk/free-christmas-apps/` as the source of the app
copy and store destinations. The retained public-folder archive's
`newmenu.php` labels that URL **Apps**; `live.php` links its named app anchors
and the same Santa Radio Apple listing, `id1021183593`.
The current `/apps` page retains that app-directory purpose and those app/store
identities. Redirect the old free-apps index to `/apps`; do not restore withdrawn
apps, obsolete claims that every app is free, or obsolete individual anchors.

### `tunein`

Retained `tunein.php` embeds
`https://tunein.com/embed/player/s252505/`. The current `src/pages/Links.jsx`
contains **Santa Radio on TuneIn**, the same station identifier and an explicit
station link. `/tunein` therefore redirects directly to `/links`, whose
canonical initial HTML contains that section. Current consent and click-to-load
requirements remain intact: redirecting must not automatically load the iframe.
Do not use the different TuneIn identifier present in unrelated old index
markup or replace this with a generic homepage redirect.

### `radio-apps` — owner decision, 404 meanwhile

The old sitemap proves `/christmas-radio-apps/` existed, but the supplied
public-folder ZIP does not contain its page body or route configuration.
It is not enough to establish whether this was an app directory, a radio-app
product page, or editorial content. `/apps` has a Christmas Radio listing but
that fact alone does not prove equivalence. Supply the old page/rewrite or
confirm its original purpose before choosing a destination.

### `message-index` — owner decision, 404 meanwhile

`/messages/` is not established as the current MP3 maker.
The public archive's `messagesphp.php` reads published `messages2` entries
using `live='Yes'`. In the separately retained assets ZIP,
`assets/adminmessages/editOLDER.php` links its **View Page** action to
`http://www.santaradio.co.uk/messages/`. This is evidence of an older message
publication workflow, not proof of the free audio-maker index.
The page/rewrite itself is absent. Do not replace that workflow with a signup
form or resurrect old forms. Ask for original page evidence/purpose.

### `santa-name` — five owner decisions, 404 meanwhile

The exact `/santa-messages/Hermione`, `/Bradley`, `/Chase`, `/Tyler` and `/Maia`
paths have no retained route definition/body proving that this prefix served
the same free MP3 experience. The archive's `personalised.php` instead emits
`/personalised-santa-message/NAME` from audio filenames, and `app1.php` describes
the free personalised-message website. Neither establishes that
`/santa-messages/NAME` was equivalent. Names in an old form or name-file index
are not proof of the old route's purpose, entitlement or present recordings.

**Needed decision:** provide the old route/page evidence, or explicitly confirm
that these five links should now open today's free maker with a requested name.
If approved, add only the reviewed redirects, validate each carried name with
`santaMessageRequestedName`, preserve one unambiguous name and a clean
`/free-santa-message` canonical. Retain adult signup, do not promise that the
recording exists and never unlock or generate audio automatically.

The existing, independently proven `/personalised-santa-message/NAME` behaviour
is unchanged and is regression-checked alongside this export. Its requested
name replaces a conflicting query name, invalid names fail, initial maker HTML
still presents adult access, and its canonical excludes name/query values.
No free/paid product, allowance or audio behaviour was changed.

### `blog`, `obsolete-form`, `schedule`, `code-words`

- Six blog URL examples, including original HTTP and non-www variants:
  no corresponding retained current article. A music catalogue is not a
  replacement for a ranked-song article; Santa Stories is not a replacement
  for “A day in the life of Santa”; a streaming-film article cannot be replaced
  with a newly invented list. All stay 404.
- `/record/` and `/thanks/`: no proven live form/confirmation equivalent.
  No recorder, submission or success page is recreated.
- `/schedule/`: old schedule scripts do not establish a current schedule;
  no show times invented.
- `/code-words`: no retained current code-word service; the promotional
  app text does not prove a replacement website.
- These unsupported routes are deliberately retained errors, not repaired
  links. Any future restoration needs separate editorial
  or product approval.

## Implementation and verification

- Exact path allowlist: `src/seo/reportedMissingLinks.js`, used by the shared
  resolver. Each destination must be an existing canonical path.
- All new redirects are relative 308 responses. Preview URLs stay on preview;
  the same mapping applies to www, non-www and HTTP request identities without
  adding any host rules or touching production host/DNS settings.
- The nine reported paths containing literal `&` have explicit ordered Vercel
  rewrites with **escaped query payloads**. Otherwise a raw capture copied into
  `?__sr_route=$1` could split at `&` before the resolver sees the complete
  path. These rules accept the same literal or percent-encoded ampersand and
  still pass through shared resolution for the permanent response.
- `scripts/search-console-missing.test.mjs` reconciles the original ZIP and
  64-row audit, checks full retained music/person identities, direct relative
  destinations, retained errors and safety negatives.
- All 64 GET and HEAD cases run through development SSR, compiled Node serving
  and the Vercel ordered rewrite/document handler. Destination checks include
  one canonical/title, initial lyrics or biography and correct performer/title,
  real app content or TuneIn section, noindex for errors, and empty HEAD bodies.
  Query tests preserve duplicate non-selector values and tracking parameters;
  an external `next` value stays inert data rather than a redirect destination.
- Current internal-link and sitemap inspection is limited to these exact
  reported broken addresses; this is not another whole-sitemap live audit.
  Historical source files, audit fixtures and redirect definitions intentionally
  retain the old strings and are not links emitted by current pages.

Reproduce from the project root:

```sh
npm run build
npm run test:seo
```

The normal SEO command includes this new export suite and the existing legacy,
duplicate, serving, targeting, message-link and metadata checks.
Do not treat these local results or the rewrite simulation as proof of an
already-published Vercel response.

### Completed local checks

- `npm run build`: passed; generated the client, compiled SSR and canonical
  document HTML. Existing unrelated letter-image/chunk-size build warnings
  did not prevent output.
- `npm run test:seo`: **43 passed, zero failed**, including all three delivery
  surfaces for this 64-row export.
- Exact reported broken `href`/form-action scan of generated client HTML:
  **zero emissions**. The old free-apps URL in the app data is a provenance
  comment, not a current public link; no current links needed changing.
- `git diff --check`: passed.
- Restarted development workflow: running cleanly.
- Visually inspected the repaired Bon Jovi lyrics address in Preview: the
  intended lyrics page renders, with its normal cookie-choice overlay and
  media-consent controls. No browser error was reported by the capture.
- Node serving now recognises reviewed redirects before interpreting a dot
  in “Jr.” as a file extension. Unrecognised asset requests still return 404.

## After an approved release — not performed here

1. Merge through the normal review process. Only publish when the owner approves.
   No production deploy, DNS/host change or Search Console mutation is part
   of this repair.
2. Read the CSV's **42 rows with a Destination**, retaining each original scheme
   and host. For each, GET and HEAD without following redirects first:
   confirm a permanent 308 and the reviewed relative Location. Then follow
   redirects, confirm the intended final page is 200, and inspect its initial
   content and single `https://www.santaradio.co.uk/...` canonical.
   Existing infrastructure host redirects may add a transport/host hop for
   HTTP/non-www forms; the content alias itself must go straight to the final
   canonical path. Do not silently count host infrastructure as a local fix.
3. Specifically inspect punctuation-bearing paths at the real edge, including
   literal/encoded ampersands, Bon Jovi's Unicode apostrophe and Peggy Lee's
   commas. Confirm preserved tracking parameters and rejected repeated `s`
   selectors on lyrics queries.
4. Sample retained 404s and unknown paths. Verify no homepage, parent-profile,
   paid-product or free-maker fallback has appeared. The seven owner-decision
   rows remain unresolved even if the 42 redirects pass.
5. In Search Console, use **URL inspection → Test live URL** for representative
   repaired originals and their final canonical destinations. An old URL may
   correctly be classified as a redirect; it need not itself become indexed.
6. Only after confirming the released repairs, use
   **Page indexing → Not found (404) → Validate fix** if appropriate.
   This is an issue-level action, not a claim that every export row was fixed.
   **Do not promise the whole report will pass:** 22 rows intentionally still
   return 404. If Google validates the entire issue, these can remain reported
   or make issue-wide validation fail. Track the 42 resolved rows separately;
   do not use generic redirects simply to clear the report.
7. Monitor new crawl dates and Google-selected canonicals after recrawling.
   No sitemap submission, removal request, indexing request or ranking promise
   is included. Successful fetching or validation does not guarantee indexing.
