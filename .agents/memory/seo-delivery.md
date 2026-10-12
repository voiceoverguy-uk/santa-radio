---
name: SEO delivery rules
description: Owner-approved public identity, release scope and SSR validation constraints.
---
Use https://www.santaradio.co.uk as the preferred public identity and canonical origin. Do not force preview or API requests onto that host.

**Why:** The owner requested www consistency while explicitly protecting Replit preview and integration access. The audit implementation was authorised without permission to publish or change DNS.

**How to apply:** Keep internal requests/redirects relative. Publishing and host/DNS changes need separate owner permission.

The owner wants to track search performance for “Online christmas music” and “Christmas Radio”, amongst other terms.

**Why:** The owner explicitly named these searches when reviewing Google Search Console enhancements.

**How to apply:** Distinguish query performance and keyword targeting from structured-data enhancement reports. Valid schema and successful live URL tests do not establish indexing or rankings.

Legacy `/personalised-santa-message/all` and `/personalised-santa-message/{Name}` URLs have historical visibility for Santa-message searches.

**Why:** The owner supplied Search Console page-level results identifying these URLs for “message from santa” and Santa-message queries.

**How to apply:** Include this route family when auditing migrations and preserving equivalent destinations. Do not assume search history automatically transfers to a differently named audio-maker URL.

Consolidate historical message-name links onto one canonical audio maker, carrying the requested name as a search parameter rather than creating thousands of near-identical indexable pages.

**Why:** The current maker provides the same personalised-audio workflow for all names. Consolidation preserves the old links' purpose without claiming that a recording exists merely because a name appeared in an old URL.

**How to apply:** Retain the requested name through the adult-access handoff, check actual recording availability, keep the maker's canonical URL free of name parameters, and never create audio automatically from an incoming link.

Initial public HTML should come from the real application templates, not independent SEO-only copies.

**Why:** The owner wants meaningful content without JavaScript while preserving the existing player, galleries, paths and seasonal behaviour. Separate template copies would diverge.

**How to apply:** Check initial response content and JavaScript-disabled browsing alongside the interactive application.

Validate both Vite SSR and the compiled Node SSR runtime.

**Why:** React Router server exports depended on resolution conditions in this environment. A development import smoke test did not establish that compiled external imports were usable.

**How to apply:** Exercise the built document handler/Node server as well as Vite before calling SSR changes complete; do not replace the browser router solely to work around server resolution.

Serverless document handlers must not import uncompiled TypeScript source at runtime.

**Why:** Vercel omitted a TypeScript data dependency from a JavaScript function's deployed package. The handler passed local Node tests because the workspace still contained the source, but all live document requests crashed with a missing-module error.

**How to apply:** Share runtime data through JavaScript or JSON and keep types in wrappers used by the frontend build. Test an isolated function package without TypeScript files and with Node type stripping disabled; a whole-workspace import test is insufficient.

Bundle all UI dependencies into the SSR output rather than externalising them.

**Why:** The workspace resolved its ESM exports successfully, but Vercel resolved a CommonJS entry and crashed on the named Helmet export. Local Node rendering alone did not reproduce that resolution difference.

**How to apply:** Enable SSR noExternal for production builds only; Vite's development module evaluator cannot run raw CommonJS React modules. Exercise the compiled handler without node_modules and with external package resolution blocked. Verify live document responses after a Vercel rebuild before declaring the outage repaired.

Serve ordinary Vercel document requests from the real application's pre-rendered build pages; reserve runtime React rendering for the time-sensitive Tracker.

**Why:** Multiple deployment-only module-resolution failures took down every document because all pages loaded the SSR renderer at request time, even though the build already generated complete HTML.

**How to apply:** Package generated document HTML with the function, preserve canonical redirects and real error statuses, and keep Tracker rendering time-sensitive. Do not substitute empty app-shell HTML or fabricated SEO-only content.
