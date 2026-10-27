# Workshop preview access

This is a lightweight shared preview gate, separate from Santa signup and staff
authentication. It does not make JavaScript bundles or public recordings private.

## Server configuration

Set `SANTA_WORKSHOP_PASSWORD` through the hosting provider's secret settings.
Use the owner's exact shared password without trimming or case changes.
`SESSION_SECRET` must also be configured with at least 32 characters.
Never prefix either secret with `VITE_`.

The workspace password is configured through the secure Secrets form. A hosting
environment must receive these server-side secrets separately where necessary,
including Vercel Preview/Production environment settings. This task does not
publish the app or change a live deployment. Do not copy secrets into source,
configuration files, command-line arguments, screenshots or logs.

`DATABASE_URL` must point to the existing application PostgreSQL database, with
the already-used `santa_name_request_limits` table present. No schema changes are
required. Password submissions fail closed if the database is unavailable.

## Behaviour

- `GET /api/santa-workshop-access` reports the current signed-cookie permission.
- `POST` accepts only same-origin JSON with one bounded password field.
- Success sets a signed HttpOnly, SameSite=Strict session cookie, Secure on HTTPS.
  It has no persistent expiry attribute; its signature expires after 12 hours.
  Browser session restoration can preserve session cookies, subject to that cap.
- Changing either secret invalidates existing preview cookies.
- PostgreSQL limits submissions atomically across processes: 10 per client
  address and 150 globally in each 15-minute window. Both successful and failed
  submissions count. Vercel's platform-controlled address header is used there;
  other servers use the socket address, conservatively grouping proxied clients.
- No-store headers apply to API responses and workshop documents. SSR and static
  builds contain only the locked entry, even for an authorised visitor. The
  builder mounts only after client verification.
- Vite development, Vite preview, built Node and the Vercel API all use the same
  handler. The page stays noindex and is not included in sitemap/navigation.

## Focused checks

`npm run test:workshop-access` covers cookies, request protection and failure
responses, plus shared concurrent limits when a development database is available.

`npm run test:workshop` starts an isolated Vite server using a generated temporary
test password, never the owner's configured password. Test sessions use the real
password endpoint, not an authentication bypass. Existing workshop suites can be
selected using this same configuration.

After `npm run build`, run the access browser suite in other serving modes:

```sh
WORKSHOP_SERVING_MODE=node npx playwright test --config playwright.workshop.config.js tests/santa-workshop-access.spec.js
WORKSHOP_SERVING_MODE=preview npx playwright test --config playwright.workshop.config.js tests/santa-workshop-access.spec.js
```

Run these serially because each uses port 5001.
