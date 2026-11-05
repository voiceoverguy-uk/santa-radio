---
name: Preview after dependency merges
description: Running dev processes can retain imports from a replaced dependency installation.
---
A dependency merge can leave a running development server using module paths from the old installation, even when installed packages match the updated lockfile.

**Why:** A security dependency update replaced Vite while the existing process still referenced its previous internal chunks, breaking Preview despite a valid installation.

**How to apply:** After dependency merges, verify Preview against a freshly started workflow before assuming missing internal modules mean package corruption or reinstalling dependencies.

When sharing this repository with the native pnpm workspace, keep the website's
direct Router import and react-router-dom on the same installed release.

**Why:** A leftover npm transitive Router combined with pnpm's newer DOM router
created two router contexts and broke pre-rendering despite matching React.

**How to apply:** Declare the website's directly imported Router explicitly,
align both lockfiles and verify built Node SSR as well as native exports.

Late discovery of a lazy dependency can also make Vite reload the page during the first interaction, discarding private in-memory Studio state even though the production build is sound.

**Why:** The first browser-local PDF download triggered dependency optimisation and reset the Studio before the download completed.

**How to apply:** Prebundle dependencies used by important lazy interactions and test a cold Preview session as well as the production build.

A running Preview can also miss newly merged public assets and return the HTML
app shell for their URLs, despite those files existing on disk.

**Why:** Checker MP3 requests returned HTTP 200 with `text/html` until the website
workflow was restarted; afterwards all three returned `audio/mpeg` and played.

**How to apply:** Check asset response types and sizes, not just status codes.
If public files exist but Preview returns HTML, verify a fresh workflow before
changing audio formats or blaming browser playback restrictions.
