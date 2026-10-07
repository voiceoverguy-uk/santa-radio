# Santa Radio integration

The supplied tracker source, world map, 44 stops, seasonal data, stories and UTC
calculations are retained. Next-specific routing/metadata were adapted to the
existing Vite/React 18 host. Tailwind utilities are compiled without preflight;
no second audio player or reminder backend was added.

- Visitor route: `/santa-tracker`.
- Unlinked development controls: `/santa-tracker/preview`, with `noindex` metadata
  and response headers. It is not added to a sitemap.
- Canonical, social and exported postcard links use the verified current public
  Santa Radio host, `https://santa-radio.replit.app`. Change the shared tracker
  branding configuration when the primary domain actually moves.
- The voiceover CTA remains on SantaGuy; creator credit is retained.
- Native postcard sharing falls back to PNG download when unavailable or blocked.
- Reminder signup was omitted because no compatible opted-in subscriber provider,
  consent/storage and unsubscribe flow are configured. These must be selected and
  implemented before adding reminders.

Checks:

```
node --test src/tracker/scripts/tracker-pass2.test.cjs
npx playwright test tests/santa-tracker.spec.js
npm run build
```

The original transfer guide and manifest are retained alongside this note.
No SantaGuy page changes, publishing or remote pushes are part of this integration.
