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
