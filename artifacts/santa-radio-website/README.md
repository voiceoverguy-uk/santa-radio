# Santa Radio website preview

This artifact registers the existing website in Replit's app selector. It does
not contain a second frontend or a copy of the website.

Website source, public assets, server routes and production build remain at the
repository root. Edit those original files as before. This artifact's managed
`web` service runs the root website on port 5000 and serves both pages and `/api`.

Select **Santa Radio Website** for the website preview and **Santa Radio iPhone**
for the separate mobile app. The website retains `/`; the mobile app has its own
`/santa-radio-ios/` preview registration and still uses the Expo development host.

Do not start a second website process from the mobile artifact. Its API requests
use this same root website service. This preview registration does not publish
the website or change the existing GitHub-to-Vercel release process.

## Shared red actions

`src/red-actions.css`, imported by the root `src/index.css`, owns the website's
red-action geometry and finish: 44px minimum height, 7px corners, a fine muted
gold edge and subtle inset bevel. Labels may wrap and grow taller when needed.
Component styles retain widths, horizontal padding, typography and layout.
Add new red-action selectors to the shared lists rather than adding local
shape or colour rules. Intentionally cream disabled gift controls and grey
unavailable creation controls retain their disabled appearance. Non-red controls
and the separate iPhone artifact do not use this treatment, except the Studio
review's Start Again control shares geometry only with its adjacent creation
action, retaining its transparent fill, gold outline and cream lettering.

## Soundboard phrase controls

`src/components/Soundboard.css` owns the phrase buttons. They share the red
action geometry (44px minimum height, 7px corners, 1px muted gold edge, restrained
inset bevel) but keep a forest-green idle fill with cream text; the selected or
playing phrase turns ruby. Each button is a two-column grid: icon, then label with
the Loading note on its own row beneath, so labels wrap at enlarged text. The grid
is 4 columns, 2 at 760px and below, 1 at 360px and below. Legacy soundboard button
and grid sizing in `src/north-pole.css` was removed; do not reintroduce it.

## Studio name previews

Step one and review reuse the same red recorded-name control and Studio-owned,
in-memory audio cache. Playback is click-only and preserves the exact recording
variant. Changing/clearing the recording or leaving Studio releases the cache;
moving between stages stops playback without discarding successful audio.

Focused private-lookup checks (separate from the legacy preview suite):

```sh
npx playwright test --config playwright.workshop.config.js tests/santa-workshop-name-preview-step-one.spec.js --project=chromium
node --test scripts/workshop-name-preview.test.mjs scripts/workshop-name-preview-cache.test.mjs
```
