import pg from 'pg';
let pool, prepared;
const schema = `
CREATE TABLE IF NOT EXISTS santa_name_requests (
  request_key text PRIMARY KEY, name text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  first_requested_at timestamptz NOT NULL, last_requested_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS santa_name_request_submissions (
  visitor_key text NOT NULL, request_key text NOT NULL, expires_at timestamptz NOT NULL,
  PRIMARY KEY(visitor_key, request_key)
);
CREATE TABLE IF NOT EXISTS santa_name_request_limits (
  bucket_key text PRIMARY KEY, attempts integer NOT NULL DEFAULT 1, expires_at timestamptz NOT NULL
);`;
export function databasePool() {
  if (!process.env.DATABASE_URL) throw new Error('Name request database is not configured');
  return pool ||= new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000 });
}
export async function prepareNameRequests() {
  if (!prepared) prepared = databasePool().query(schema).catch(error => { prepared = undefined; throw error; });
  await prepared;
}
export async function saveNameRequest({ name, key }, visitorKey, bucketKey, now = new Date()) {
  await prepareNameRequests();
  const client = await databasePool().connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM santa_name_request_submissions WHERE expires_at <= $1', [now]);
    await client.query('DELETE FROM santa_name_request_limits WHERE expires_at <= $1', [now]);
    const expires = new Date((Math.floor(now.getTime() / 3600000) + 1) * 3600000);
    const limit = await client.query(`INSERT INTO santa_name_request_limits(bucket_key, expires_at)
      VALUES($1,$2) ON CONFLICT(bucket_key) DO UPDATE SET attempts=santa_name_request_limits.attempts+1
      WHERE santa_name_request_limits.attempts < 20 RETURNING attempts`, [bucketKey, expires]);
    if (!limit.rowCount) {
      const error = new Error('Please wait before requesting more names.');
      error.status = 429; error.retryAfter = Math.max(1, Math.ceil((expires - now) / 1000)); throw error;
    }
    const submitted = await client.query(`INSERT INTO santa_name_request_submissions(visitor_key,request_key,expires_at)
      VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING request_key`,
    [visitorKey, key, new Date(now.getTime() + 7 * 86400000)]);
    if (submitted.rowCount) await client.query(`INSERT INTO santa_name_requests(request_key,name,first_requested_at,last_requested_at)
      VALUES($1,$2,$3,$3) ON CONFLICT(request_key) DO UPDATE SET
      request_count=santa_name_requests.request_count+1,last_requested_at=EXCLUDED.last_requested_at`, [key, name, now]);
    await client.query('COMMIT');
    return { duplicate: !submitted.rowCount };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export async function listNameRequests(page, q) {
  await prepareNameRequests();
  const params = [q];
  const totalResult = await databasePool().query('SELECT count(*) FROM santa_name_requests WHERE strpos(request_key,$1)>0', params);
  const total = Number(totalResult.rows[0].count);
  page = Math.min(page, Math.max(1, Math.ceil(total / 100)));
  const result = await databasePool().query(`SELECT name, request_count AS count,
    first_requested_at AS "firstRequestedAt", last_requested_at AS "lastRequestedAt"
    FROM santa_name_requests WHERE strpos(request_key,$1)>0
    ORDER BY request_count DESC,last_requested_at DESC,request_key LIMIT 100 OFFSET $2`, [q, (page - 1) * 100]);
  return { requests: result.rows, total, page, pageSize: 100 };
}
