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
and the separate iPhone artifact do not use this treatment.
