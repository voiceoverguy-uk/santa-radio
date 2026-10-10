---
name: SEO delivery rules
description: Owner-approved public identity, release scope and SSR validation constraints.
---
Use https://www.santaradio.co.uk as the preferred public identity and canonical origin. Do not force preview or API requests onto that host.

**Why:** The owner requested www consistency while explicitly protecting Replit preview and integration access. The audit implementation was authorised without permission to publish or change DNS.

**How to apply:** Keep internal requests/redirects relative. Publishing and host/DNS changes need separate owner permission.

Initial public HTML should come from the real application templates, not independent SEO-only copies.

**Why:** The owner wants meaningful content without JavaScript while preserving the existing player, galleries, paths and seasonal behaviour. Separate template copies would diverge.

**How to apply:** Check initial response content and JavaScript-disabled browsing alongside the interactive application.

Validate both Vite SSR and the compiled Node SSR runtime.

**Why:** React Router server exports depended on resolution conditions in this environment. A development import smoke test did not establish that compiled external imports were usable.

**How to apply:** Exercise the built document handler/Node server as well as Vite before calling SSR changes complete; do not replace the browser router solely to work around server resolution.

Serverless document handlers must not import uncompiled TypeScript source at runtime.

**Why:** Vercel omitted a TypeScript data dependency from a JavaScript function's deployed package. The handler passed local Node tests because the workspace still contained the source, but all live document requests crashed with a missing-module error.

**How to apply:** Share runtime data through JavaScript or JSON and keep types in wrappers used by the frontend build. Test an isolated function package without TypeScript files and with Node type stripping disabled; a whole-workspace import test is insufficient.
