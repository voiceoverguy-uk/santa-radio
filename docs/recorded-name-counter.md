# Recorded-name counter

The owner approved restoring the aggregate number without restoring public
catalogue access. This is the explicit exception to the earlier no-total rule.
Name lookup itself remains bounded, POST-only and count-free.

## Contract

- `GET /api/santa-name-count` returns exactly `{ "total": <non-negative integer> }`.
- `HEAD` has the same status/headers and no body. Other methods and query
  parameters are rejected.
- No names, IDs, aliases, source filenames, audio addresses or credentials are
  returned. Errors are generic, with no upstream details.
- The number counts hosted recording entries, exactly as the earlier hosted
  counter did. It is not a count of search results or necessarily unique spellings.
- The source is the existing authoritative private catalogue, with its existing
  server-side cache, concurrent-load sharing and failure backoff. Failed/invalid
  inventory does not become a successful zero.
- The independent `count` rate-limit bucket allows 30 requests per address per
  minute and 6,000 globally, using the existing atomic shared limiter. Counter
  reads do not spend the search bucket. Storage/limiter failures fail closed.
- Responses are no-store. Internal source caching bounds upstream work without
  sharing personalised responses or cached rate-limit errors.

## Display and refresh

The message-maker fetches the total before signup or name entry, without cookies
or browser persistence. It refreshes every five minutes while visible and on
return to the tab when due. Requests time out after 15 seconds and are aborted
when the maker unmounts. There is no retry loop or background polling.

The shared Studio A and Studio B display starts at `max(0, total - 50)`, then adds
one every five seconds, capped at the total. The timer stops at the cap and clamps
to a lower refreshed total. A failed/invalid refresh removes the number and keeps
“Recorded names available to search”; a later valid response restarts safely.
The count-up is presentation, not evidence of recordings being created.

Selected-child wording, parent signup fields, private name search, allowances,
audio generation and the paid/free boundary are unchanged.

## Verification

```sh
node --test scripts/santa-name-count.test.mjs scripts/santa-name-security.test.mjs
npx playwright test tests/santa-name-counter.spec.js --project=chromium
npm run build
```

Backend checks verify the numeric-only projection, methods/inputs, valid zero,
invalid totals, sanitised errors, limiter failures, authoritative source caching
and development/Node/Vercel route wiring. Existing security checks verify private
lookup restrictions, scoped previews/messages and shared limiter behaviour.

Browser checks cover 320/390/1440 px, exact five-second increments, cap, matching
Studio counts, small/zero totals, failures, lower totals, foreground refresh,
signup refusal/success, selected-child continuity and unmount cleanup.

The running development endpoint and a locally launched built Node server both
returned a valid numeric-only response. These are not checks of the published
www host or a Vercel release. No publication was performed.
