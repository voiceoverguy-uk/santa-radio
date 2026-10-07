# Santa Tracker → Santa Radio transfer

This is a source integration bundle from the working SantaGuy workspace, not a
standalone application or a rebuild. Tracker source and assets are copied
unchanged. No radio player, subscriber records, credentials, environment files,
Git history, logs, installed dependencies or build outputs are included.

## Folder layout

- `source/`: copy these files into the corresponding paths of the destination
  project. Includes the tracker page, noindex preview page, components, data,
  logic, stamp artwork, existing social image and existing tracker tests.
- `styles/tracker.css`: extracted tracker theme, star field and motion styles.
  It deliberately excludes unrelated marquee/equalizer styles and global body
  resets. Integrate this with the destination's existing Tailwind stylesheet.
- `optional/homepage-banner/`: existing homepage banner, if wanted.
- `optional/email-reminders/`: existing signup backend, Resend audience helper
  and scheduler reference. These are optional; see the important UI note below.
- `DEPENDENCIES.json`: installed direct versions used by this export; merge
  into the destination's dependencies rather than replacing its package.json.
- `MANIFEST.json`: archive file list, sizes, SHA-256 checksums and original paths.
- `VERIFICATION.txt`: package checks and test results at export time.

## Recommended integration

1. Upload/extract this ZIP into the separate Santa Radio project. Back up or
   review conflicting destination paths before copying. Do not overwrite its
   app/layout.tsx, player, package.json or global stylesheet.
2. This code expects Next.js App Router, React, TypeScript and Tailwind v4.
   Merge the listed dependencies using the destination's package manager.
   Retain its existing framework configuration. Use a supported Node runtime
   (the source currently runs Node 22).
3. Copy `source/` contents into the destination project root (or corresponding
   `src/` folders). Preserve the `@/*` alias mapping to that root. The original
   tests expect the root-level layout; adjust their root resolution if needed.
4. Merge/import `styles/tracker.css` into the destination's global Tailwind v4
   stylesheet, after its existing `@import "tailwindcss"`. Ensure Tailwind scans
   the copied source. Do not add a second Tailwind installation or replace the
   site's existing styles blindly. Santa colour/font tokens can affect other
   destination components if their names overlap.
5. Load Caveat weights 400/500/600 for postcard handwriting, as the original does:
   https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600&display=swap
   Font source is not bundled. If self-hosting, obtain the font and preserve its
   licence. The main font is Inter with a system sans-serif fallback; original
   tracker markup uses that inherited font stack. Apply `font-sans` to the
   destination tracker wrapper if its site body uses a different font. The
   original site also uses smooth HTML scrolling and hides horizontal overflow;
   assess those base behaviours in the destination without replacing its body
   background or applying unrelated SantaGuy page resets.
6. Use the destination's existing header/footer and radio player. There is no
   tracker audio engine to transfer. Hero top spacing assumes a fixed header;
   compare against Santa Radio's header before changing any spacing.
7. Decide whether to enable email reminders as described below. The source UI
   is preserved exactly, so do not leave an enabled-looking signup without its
   backend.
8. Adapt only the branding/URLs below; preserve route calculations, seasonal
   content, preview state and component styling.
9. Run `node --test scripts/tracker-pass2.test.cjs`, destination type checks and
   its production build. The existing tests intentionally assert SantaGuy
   canonical URLs and descriptions: update those expected values only after
   making the corresponding branding changes.
10. Check /santa-tracker and /santa-tracker/preview on desktop/mobile; postcard
    share/download; countdown ticks; July/holiday/workshop/live/complete states;
    preview jumps, speed/run/reset; and canonical/noindex metadata. No publishing
    is performed by this bundle.

## Branding and link checklist

- `app/santa-tracker/page.tsx`: SantaGuy canonical/OG URLs, site name, metadata
  descriptions, WebPage/BreadcrumbList website identity, home breadcrumb,
  Twitter handles and social image. Replace these with the destination's actual
  domain and identity. Never point the new tracker canonical back to SantaGuy.
- `public/santa-guy-logo-og.png`: included because the unchanged page references
  it. Replace with Santa Radio's sharing image and update the references.
- `components/SantaTrackerClient.tsx`: Guy Harris promotional text and
  `/hire-santa-voice` CTA. Decide the Santa Radio equivalent.
- `components/SantaStory.tsx`: postcard footer `www.santaguy.co.uk`.
- Optional `SantaTrackerBanner.tsx`: `/santa-tracker` link and placement.
- Optional email cron route: sender brand, email footer, destination tracker URL.
- `lib/resendAudience.ts` in the optional module: audience name. Deliberately
  decide whether Santa Radio uses a separate list or the existing list; do not
  accidentally reuse subscriber data by sharing the same account/audience.
- Preview stays noindex; keep its metadata when integrating.

## Optional email reminders

`source/components/NotifySignup.tsx` is present because the unchanged tracker
imports and renders it. Backend files are isolated under
`optional/email-reminders/source/`.

To keep reminders: merge that optional source into the project, install Resend,
and configure these setting names through the destination's secrets/settings
tools. No values are included:

- `RESEND_API_KEY`
- `CONTACT_FROM_EMAIL`
- `CRON_SECRET`

Use a verified sending identity. Signup posts to `/api/notify-signup`, validates
the email, uses a honeypot and an in-memory rate limiter, and stores contacts in
Resend. No application database is required. Subscriber data is not in this ZIP.

`scheduler-reference.json` is the original Vercel configuration, included as a
reference only. It requests `/api/cron/christmas-eve` at 06:00 UTC on 24 December
each year. A Replit-hosted destination needs its own scheduler configuration;
copying this file does not create a schedule there. The endpoint expects an
Authorization Bearer value matching `CRON_SECRET`.

Existing behaviour to account for: the notification is scheduled before the
10:00 UTC departure; it has no durable sent-once ledger, so repeated calls can
send duplicates. The contact-list helper uses one provider list response rather
than explicit pagination. Confirm provider limits for the destination list.
Do not invoke the production email endpoint just to test the transfer.

To omit reminders: in the destination only, remove the NotifySignup import and
its conditional signup section from SantaTrackerClient, and omit the optional
backend/Resend dependency. This is the one explicit opt-out change needed
because the original source is kept unchanged.

## Behaviour preserved

- Local SVG world map and 44 fixed route stops; no paid map API or location feed.
- UTC route starts 24 December 10:00, ends 25 December 10:00. Fixed per-stop UTC
  offsets target local Christmas midnight; dwell and interpolation animate the
  marker, including longitude/date-line handling.
- Browser-clock driven one-second updates. Estimated gifts/distance/progress,
  UK alerts and local-time displays are calculations, not external telemetry.
- March–October holidays; North Pole return 1 November; July festivities;
  December workshop dispatches; rotating facts and shareable postcards.
- Random holiday choice happens at mount. Fixed route offsets are not an IANA
  timezone/DST service; holiday local time is longitude-based and some postcard
  wording uses the visitor's local date. Preserve these existing semantics.
- Preview controls and storage key `santa-tracker-preview`; all seven jumps,
  speed choices, accelerated journey runs and reset.
- Server-rendered heading/intro with interactive loading state; map accessible
  name/description, preview states, timeline text labels and reduced-motion
  timeline scrolling.

Existing limitations are not fixed by export: expanded preview controls can
overlap content on narrow screens; the map's SVG SMIL pulse is not reliably
suppressed by CSS reduced-motion rules. Test these in the destination rather
than assuming the export changed them.

## Assets, rights and portability

The stamp and metadata image are copied as-is, the map is embedded SVG path
data, postcard texture is inline SVG, and Santa/flags are system emoji.
No sound files or radio components are needed for the tracker.

The major packages are permissively licensed (MIT; Lucide React reports ISC).
Retain their notices through normal dependency installation. No clear licence
or provenance for the local map paths/stamp was established by the focused
inspection; confirm your rights to reuse those assets. This export does not
grant rights beyond those you already hold.

The original repository remote is:
https://github.com/voiceoverguy-uk/Santa-guy

This archive uses the current workspace, not a fresh GitHub checkout. No push,
deployment, redirect or removal of the original tracker is part of this export.
