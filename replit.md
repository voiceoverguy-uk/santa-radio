# Santa Radio - React Rebuild

A faithful React + Vite rebuild of www.santaradio.co.uk — The World's Best Christmas Radio Station.

## Architecture

- **Framework**: React 18 + Vite 5
- **Routing**: React Router DOM v6
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
| `/free-santa-message` | Free Santa Message — personalised message form |

### Redirects
| Old URL | New URL |
|---------|---------|
| `/music` | `/christmas-music` |
| `/mugshots` | `/mugshots/all` |

## Key Components

- `src/components/Navbar.jsx` — sticky top navigation
- `src/components/AudioPlayer.jsx` — HTML5 audio stream player with PLAY NOW button
- `src/components/Countdown.jsx` — live Christmas Day countdown timer
- `src/components/SantaMessageForm.jsx` — personalised Santa message signup form
- `src/components/Soundboard.jsx` — interactive 16-button Santa phrase soundboard
- `src/components/YouTubeSection.jsx` — YouTube live stream embed in retro TV frame
- `src/components/MugshotsPreview.jsx` — 4-celeb preview grid on home page
- `src/components/ContactSection.jsx` — gold background contact section
- `src/components/Footer.jsx` — footer with nav links and social icons

## Design

- Dark navy starry-night backgrounds (`#0d1b3e` / `#071029`)
- Gold metallic headings using CSS gradients + Dancing Script font
- Red snow-capped buttons (CSS SVG snow effect on `::before`)
- Snowy pine tree decoration at section bottoms
- White/light sections between dark sections
- Fonts: Dancing Script (logo), Cinzel (headings), Open Sans (body)

## Audio Stream

The audio player targets `https://streaming.zeno.fm/yn65fsaurfhvv` — this may need updating if the stream URL changes. Check the original site's Network tab to find the live stream URL.

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

## Notes

- Soundboard buttons use the browser's Web Speech API (text-to-speech) to speak Santa phrases with a deep, slow voice setting — clicking a button while it speaks will stop it
- Celebrity mugshot photos are served locally from `/mugshot-images/`; fallback initials shown on error
- Santa Message form shows a success state but does not send real data (no backend)
- Twitter widget is not included (requires auth)
