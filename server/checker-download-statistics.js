import { databasePool } from './contenders-database.js';
export const validDownloadId = id => typeof id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id);
export async function recordCheckerDownload(id, pool = databasePool()) {
  if (!validDownloadId(id)) throw new Error('Invalid download identifier');
  // Random per-download identifier only: no name, verdict, answers or visitor ID.
  await pool.query(`INSERT INTO santa_checker_downloads(id,day) VALUES($1,(now() AT TIME ZONE 'Europe/London')::date)
    ON CONFLICT(id) DO NOTHING`, [id]);
}
export async function checkerDownloadReport(pool = databasePool()) {
  const result = await pool.query(`SELECT count(*)::integer AS "allTime",
    count(*) FILTER (WHERE day=(now() AT TIME ZONE 'Europe/London')::date)::integer AS today,
    count(*) FILTER (WHERE day>=(now() AT TIME ZONE 'Europe/London')::date-29)::integer AS "last30Days",
    min(day)::text AS since FROM santa_checker_downloads`);
  return result.rows[0];
}
