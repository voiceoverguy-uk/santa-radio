# Homepage name chart

`NameChart` sits immediately after Christmas Pairs and before Soundboard. It shows positions 1–5 and 6–10, with a button expanding positions 11–25. The festive design is scoped to avoid clashes with the homepage.

`GET /api/name-chart` reads the existing contenders database binding (`CONTENDERS_DATABASE_URL` or `CONTENDERS_URL`) and aggregates all retained `santa_message_daily.download_clicks`. These are recorded first download clicks per recording, not creations, listens or verified completed file transfers. Case and surrounding whitespace are normalized; tied download totals are ordered alphabetically. The public response contains only ranks, names and refresh timestamps.

Successful results are cached for 12 hours in the running handler and shared HTTP cache. The first request after cache expiry refreshes the result; no scheduled job or database migration is required. An open page refreshes at the returned expiry time. Errors are uncached and retried after one minute; a page with existing results retains them with a delayed-refresh notice.

Validation: `node --test scripts/name-chart.test.mjs`. Browser checks cover desktop, 390px mobile, ten/twenty-five row expansion, collapse and unavailable data. Live aggregate SQL was verified against the connected Santa Radio contenders database. Local browser checks used that query's names as a response fixture, because the local shell has no database binding. The deployed route still needs verification after publication.
