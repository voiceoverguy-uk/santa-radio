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
| `/music` | Music — Christmas song lyrics & artists grid with search |
| `/mugshots` | Mug Shots — celebrity hall of fame with search |
| `/free-santa-message` | Free Santa Message — personalised message form |

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

## Notes

- Soundboard buttons use the browser's Web Speech API (text-to-speech) to speak Santa phrases with a deep, slow voice setting — clicking a button while it speaks will stop it
- Celebrity mugshot photos load from the original site's CDN; fallback initials shown on error
- Santa Message form shows a success state but does not send real data (no backend)
- Twitter widget is not included (requires auth)
