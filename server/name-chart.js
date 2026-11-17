import { databasePool } from './contenders-database.js';
export const CHART_TTL = 12 * 60 * 60 * 1000;
export async function readNameChart(pool = databasePool()) {
  const result = await pool.query(`SELECT lower(trim(name)) AS name, sum(download_clicks)::bigint AS downloads
    FROM santa_message_daily WHERE trim(name) <> ''
    GROUP BY lower(trim(name)) HAVING sum(download_clicks) > 0
    ORDER BY downloads DESC, lower(trim(name)) COLLATE "C" ASC LIMIT 25`);
  return result.rows.map(({ name }, index) => ({ rank: index + 1,
    name: name.replace(/(^|[\s’'-])\p{L}/gu, letter => letter.toLocaleUpperCase('en-GB')) }));
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
          cached = { expires: now + CHART_TTL, data: { names, updatedAt: new Date(now).toISOString(), refreshAfter: new Date(now + CHART_TTL).toISOString() } };
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
