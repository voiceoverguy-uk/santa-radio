import pg from 'pg';
let pool, prepared;
export function databasePool() {
  if (!process.env.DATABASE_URL) throw Object.assign(new Error('Name request database is not configured'), { code: 'DATABASE_NOT_CONFIGURED' });
  return pool ||= new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3,
    connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000, statement_timeout: 8000, query_timeout: 10000 });
}
export async function prepareNameRequests() {
  // Read-only readiness check, never CREATE/ALTER at request time or in production.
  if (!prepared) prepared = databasePool().query(
    'SELECT request_key, recorded_at FROM santa_name_requests LIMIT 0; SELECT id FROM santa_name_request_history LIMIT 0',
  ).catch(error => { prepared = undefined; throw error; });
  await prepared;
}
export async function saveNameRequest({ name, key, submissionKey }, visitorKey, bucketKey, now = new Date()) {
  await prepareNameRequests();
  const client = await databasePool().connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM santa_name_request_submissions WHERE expires_at <= $1', [now]);
    await client.query('DELETE FROM santa_name_request_limits WHERE expires_at <= $1', [now]);
    // A stable submission token also covers a first response lost before the
    // browser receives its visitor cookie. Both aliases must be new to count.
    const aliases = [...new Set([visitorKey, submissionKey].filter(Boolean))].sort();
    const submitted = await client.query(`INSERT INTO santa_name_request_submissions(visitor_key,request_key,expires_at)
      SELECT alias,$2,$3 FROM unnest($1::text[]) AS alias ORDER BY alias
      ON CONFLICT DO NOTHING RETURNING visitor_key`,
    [aliases, key, new Date(now.getTime() + 7 * 86400000)]);
    if (submitted.rowCount !== aliases.length) {
      await client.query('COMMIT');
      return { duplicate: true };
    }
    const expires = new Date((Math.floor(now.getTime() / 3600000) + 1) * 3600000);
    const limit = await client.query(`INSERT INTO santa_name_request_limits(bucket_key, expires_at)
      VALUES($1,$2) ON CONFLICT(bucket_key) DO UPDATE SET attempts=santa_name_request_limits.attempts+1
      WHERE santa_name_request_limits.attempts < 20 RETURNING attempts`, [bucketKey, expires]);
    if (!limit.rowCount) {
      const error = new Error('Please wait before requesting more names.');
      error.status = 429; error.retryAfter = Math.max(1, Math.ceil((expires - now) / 1000)); throw error;
    }
    await client.query(`INSERT INTO santa_name_requests(request_key,name,first_requested_at,last_requested_at)
      VALUES($1,$2,$3,$3) ON CONFLICT(request_key) DO UPDATE SET
      request_count=santa_name_requests.request_count+1,last_requested_at=EXCLUDED.last_requested_at,
      recorded_at=NULL`, [key, name, now]);
    await client.query('COMMIT');
    return { duplicate: false };
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}
export async function listNameRequests(page, q, status = 'outstanding', all = false) {
  await prepareNameRequests();
  const completed = status === 'completed';
  const table = completed ? 'santa_name_request_history' : 'santa_name_requests';
  const where = `strpos(request_key,$1)>0${completed ? '' : ' AND recorded_at IS NULL'}`;
  const params = [q];
  const totalResult = await databasePool().query(`SELECT count(*) FROM ${table} WHERE ${where}`, params);
  const total = Number(totalResult.rows[0].count);
  page = Math.min(page, Math.max(1, Math.ceil(total / 100)));
  const result = await databasePool().query(`SELECT ${completed ? 'id::text' : 'request_key'} AS id,
    name, request_count AS count, first_requested_at AS "firstRequestedAt",
    last_requested_at AS "lastRequestedAt", recorded_at AS "recordedAt"
    FROM ${table} WHERE ${where}
    ORDER BY ${completed ? 'recorded_at DESC,id DESC' : 'request_count DESC,last_requested_at DESC,request_key'}
    ${all ? '' : 'LIMIT 100 OFFSET $2'}`, all ? [q] : [q, (page - 1) * 100]);
  return { requests: result.rows, total, page, pageSize: 100, status };
}

export async function recordNameRequest(key, now = new Date()) {
  await prepareNameRequests();
  const client = await databasePool().connect();
  try {
    await client.query('BEGIN');
    const found = await client.query('SELECT * FROM santa_name_requests WHERE request_key=$1 FOR UPDATE', [key]);
    const row = found.rows[0];
    if (!row) throw Object.assign(new Error('This requested name was not found.'), { status: 404 });
    if (!row.recorded_at) {
      await client.query(`INSERT INTO santa_name_request_history
        (request_key,name,request_count,first_requested_at,last_requested_at,recorded_at)
        VALUES($1,$2,$3,$4,$5,$6)`, [key, row.name, row.request_count, row.first_requested_at, row.last_requested_at, now]);
      await client.query('UPDATE santa_name_requests SET recorded_at=$2 WHERE request_key=$1', [key, now]);
    }
    await client.query('COMMIT');
    return { recorded: true, duplicate: !!row.recorded_at };
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}
