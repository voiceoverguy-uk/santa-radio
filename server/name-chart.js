import { databasePool } from './contenders-database.js';
export const CHART_TTL = 12 * 60 * 60 * 1000;
// Reconstruct both rankings from retained daily counters; compare before limiting to 25.
export const NAME_CHART_QUERY = `WITH bounds AS (
  SELECT (now() AT TIME ZONE 'Europe/London')::date AS today
), totals AS (
  SELECT lower(trim(name)) AS name,
    COALESCE(sum(creations) FILTER (WHERE day >= today-29 AND day <= today),0) AS current_total,
    COALESCE(sum(creations) FILTER (WHERE day >= today-36 AND day <= today-7),0) AS previous_total
  FROM santa_message_daily CROSS JOIN bounds
  WHERE trim(name) <> '' AND day >= today-36 AND day <= today
  GROUP BY lower(trim(name))
), current_ranks AS (
  SELECT name, row_number() OVER (ORDER BY current_total DESC,name COLLATE "C" ASC) AS rank
  FROM totals WHERE current_total > 0
), previous_ranks AS (
  SELECT name, row_number() OVER (ORDER BY previous_total DESC,name COLLATE "C" ASC) AS rank
  FROM totals WHERE previous_total > 0
)
SELECT current_ranks.name, current_ranks.rank, previous_ranks.rank AS previous_rank,
  EXISTS(SELECT 1 FROM previous_ranks) AS comparison_available
FROM current_ranks LEFT JOIN previous_ranks USING(name)
ORDER BY current_ranks.rank LIMIT 25`;
export async function readNameChart(pool = databasePool()) {
  const result = await pool.query(NAME_CHART_QUERY);
  return result.rows.map(({ name, rank, previous_rank, comparison_available }) => {
    const position = Number(rank);
    const previousRank = previous_rank == null ? null : Number(previous_rank);
    const change = previousRank == null ? null : previousRank - position;
    return { rank: position,
      name: name.replace(/(^|[\s’'-])\p{L}/gu, letter => letter.toLocaleUpperCase('en-GB')),
      previousRank, change,
      movement: !comparison_available ? 'pending' : previousRank == null ? 'new' : change > 0 ? 'up' : change < 0 ? 'down' : 'same' };
  });
}
export function createNameChartHandler({ read = readNameChart, clock = Date.now } = {}) {
  let cached, pending;
  return async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); return res.end(JSON.stringify({ error: 'Method not allowed.' })); }
    try {
      if (!cached || clock() >= cached.expires) {
        if (!pending) pending = read().then(names => {
          const now = clock();
          cached = { expires: now + CHART_TTL, data: { names, metric: 'recordings-created', periodDays: 30, comparisonDays: 7, updatedAt: new Date(now).toISOString(), refreshAfter: new Date(now + CHART_TTL).toISOString() } };
        }).finally(() => { pending = undefined; });
        await pending;
      }
      const remaining = Math.max(0, Math.floor((cached.expires - clock()) / 1000));
      res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${remaining}, must-revalidate`);
      return res.end(JSON.stringify(cached.data));
    } catch {
      res.statusCode = 503;
      return res.end(JSON.stringify({ error: 'The name chart is temporarily unavailable.' }));
    }
  };
}
export default createNameChartHandler();
