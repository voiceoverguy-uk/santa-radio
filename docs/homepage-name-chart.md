# Homepage name chart

`NameChart` sits immediately after Christmas Pairs and before Soundboard. It shows positions 1–5 and 6–10, with a button expanding positions 11–25. The festive design is scoped to avoid clashes with the homepage.

`GET /api/name-chart` reads the existing contenders database binding (`CONTENDERS_DATABASE_URL` or `CONTENDERS_URL`) and aggregates `santa_message_daily.creations` for the current UK calendar day and preceding 29 days, matching the dashboard’s ‘Popular recorded names’ measure and time window. Downloads and listens do not determine this ranking. Case and surrounding whitespace are normalized; tied creation totals are ordered alphabetically. The public response contains only ranks, names, the metric, time window and refresh timestamps.

Successful results are cached for 12 hours in the running handler and shared HTTP cache. The first request after cache expiry refreshes the result; no scheduled job or database migration is required. An open page refreshes at the returned expiry time. Errors are uncached and retried after one minute; a page with existing results retains them with a delayed-refresh notice.

Validation: `node --test scripts/name-chart.test.mjs`. Browser checks cover desktop, 390px mobile, ten/twenty-five row expansion, collapse and unavailable data. Live aggregate SQL was verified against the connected Santa Radio contenders database. The original deployment was verified in the live browser. The corrected ranking must show Olivia first and use the recordings-created metric. The versioned client query avoids reusing cached download rankings.

## Weekly position movement

Each 12-hour refresh also reconstructs the ranking for seven UK calendar days earlier from the retained daily creation totals. Both rankings use 30-day windows and identical case-normalization and alphabetical tie-breaking. All names are ranked before selecting the current top 25, so movement from outside the chart is calculated correctly. The public response includes previousRank, signed change, movement and comparisonDays. No separate snapshot storage or migration is required.

Turquoise ↑ and pink ↓ show the number of places moved; — indicates no movement; NEW means no recordings in the earlier window. When no earlier ranking exists, dashes have an accessible explanation and the chart says the weekly comparison is still building. The current dataset has insufficient week-old history, so arrows will appear automatically once the comparison is available.
