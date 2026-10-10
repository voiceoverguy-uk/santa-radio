# Santa Radio - React Rebuild

A faithful React + Vite rebuild of www.santaradio.co.uk — The World's Best Christmas Radio Station.

## Architecture

- **Framework**: React 18 + Vite 6
- **Routing**: React Router DOM v7
- **Styling**: Plain CSS (no UI library) — custom Christmas theme
- **Port**: 5000 (webview)
- **No backend** — pure frontend, static data

## Pages

| Route | Page |
|-------|------|
| `/` | Home — hero, audio player, countdown, santa message form, soundboard, YouTube, mugshots preview, contact |
| `/apps` | Apps — Santa Radio App, Santa Voicemail, Santa Messages sections |
| `/christmas-music` | Music — Christmas song lyrics & artists grid with search |
| `/mugshots/all` | Mug Shots — celebrity hall of fame with search |
| `/mugshots/:slug` | Mugshot Detail — individual celebrity page with photo, name, role, SEO |
| `/christmas-artist/:id-:slug` | Song Detail — individual song/artist page with lyrics, YouTube, Twitter share |
| `/christmas-karaoke-lyrics/:id-:slug` | Karaoke Lyrics — karaoke lyrics page for each song |
| `/artist?s={id}` | Artist Detail — legacy URL support for individual song pages |
| `/free-santa-message` | Free Santa Message — personalised message form |

### Redirects
| Old URL | New URL |
|---------|---------|
| `/music` | `/christmas-music` |
| `/mugshots` | `/mugshots/all` |

## Key Components

- `src/components/Navbar.jsx` — transparent hero navigation, solid on scroll/secondary pages, accessible mobile menu and saved effects preference
- `src/components/RadioProvider.jsx` — one persistent HTML5 radio instance shared across routes, cancellable loading, timeout/retry, volume and truthful station state
- `src/components/AudioPlayer.jsx` — persistent compact radio dock and shared hero/navigation controls
- `src/components/Countdown.jsx` — live Christmas Day countdown timer
- `src/components/SantaMessageForm.jsx` — message availability disclosure and real email contact; no fake submission or download
- `src/components/Soundboard.jsx` — 12 original Santa recordings with play/stop controls
- `src/components/YouTubeSection.jsx` — click-to-load YouTube live stream with direct-channel fallback
- `src/components/MugshotsPreview.jsx` — 4-celeb preview grid on home page
- `src/components/ContactSection.jsx` — forest-green contact section with real email link
- `src/components/Footer.jsx` — footer with nav links and social icons

## Design

- Cinematic North Pole village hero with original optimised imagery at `/images/north-pole-hero.webp` and mobile crop `/images/north-pole-hero-mobile.webp`
- Deep forest green `#1B4332` / night green `#081e17`, crimson `#9B111E`, gold `#D4AF37`, cream `#FFF8E7`
- Cinzel normal-weight headings, Inter body/buttons, existing Dancing Script wordmark
- Crimson pill buttons and fine gold-outline controls; no cartoon snow caps or tree decorations
- Four-panel countdown below the hero, editorial welcome, message availability, video, soundboard, livestream, celebrity and contact sections
- Restrained transform-only snowfall and aurora, saved effects toggle and reduced-motion support
- `src/north-pole.css` applies the shared visual system to all existing listing/detail/legacy pages without changing routes or data

## Audio Stream

The audio player targets the user-supplied `https://global.citrus3.com:8164/` endpoint, which serves the Santa Radio live MP3 stream directly.

## Deployment (Vercel)

- `vercel.json` is configured with SPA rewrites so React Router works on page refresh
- Build command: `npm run build` → outputs to `dist/`
- Framework: Vite (auto-detected by Vercel)
- All routes rewrite to `/` for client-side routing

## Mugshots Data

- 730 unique celebrity mugshot images stored locally in `public/mugshot-images/`
- `src/data/mugshots.json` — 735 entries with fields: `artist` (name), `song` (slug), `image` (path), `link` (role) matching original DB schema
- 700 entries from image filenames + 35 additional entries from sitemap to cover all legacy URLs
- Reproducible generation script: `node scripts/generate-mugshots.cjs` (extracts zip, parses filenames, adds sitemap entries)
- Mug Shots listing page loads 48 at a time with "Load More" pagination for performance
- Search filters by celebrity name or role
- Each mugshot card links to its individual detail page at `/mugshots/{slug}`
- Homepage MugshotsPreview pulls 4 featured celebs from the same JSON data

## Songs Data

- `src/data/songs.json` — 433 entries with fields: `id`, `artist`, `song`, `info`, `image`, `lyrics`, `link` (slug), `youtube`
- Generated from original sitemap.xml URL patterns extracted from the PHP zip file
- Preserves exact `{id}-{slug}` combinations from original indexed URLs
- Reproducible generation script: `node scripts/generate-songs.cjs` (extracts sitemap from zip)
- Each song card links to its detail page at `/christmas-artist/{id}-{slug}`
- Song detail pages include toggleable lyrics, YouTube embed, karaoke link, and Twitter share
- Karaoke lyrics pages at `/christmas-karaoke-lyrics/{id}-{slug}`

## SEO

- All dynamic pages have per-page `<title>`, meta description, OG tags, Twitter cards via react-helmet-async
- JSON-LD structured data (BreadcrumbList) on all detail pages
- MusicRecording schema on song detail pages
- Canonical URLs set on all pages
- Old URLs (`/music`, `/mugshots`) redirect to new canonical equivalents

## SQL Import Tooling

- SQL import script at `scripts/import-sql.js` parses a MySQL dump file and can output populated `src/data/songs.ts`
  - Usage: `node scripts/import-sql.js path/to/dump.sql`
  - Handles multi-row INSERTs, SQL string escaping (backslash and doubled-quote), semicolons in strings, and explicit column lists
- TypeScript data layer files (`src/data/songs.ts`, `src/data/mugshots.ts`) provide typed interfaces for song and mugshot data
- Legacy URL `/artist?s={id}` supported via ArtistDetail page with SEO meta tags, breadcrumbs, Schema.org structured data

## Notes

- Soundboard plays user-supplied MP3 files from `public/audio/soundboard/`. Only one clip plays at a time; playback stops on navigation. No text-to-speech fallback.
- Celebrity mugshot photos are served locally from `/mugshot-images/`; fallback initials shown on error
- Santa Message service has no backend. The UI explicitly discloses unavailable requests/downloads and never claims a successful submission; email contact remains available.
- Twitter widget is not included (requires auth)
