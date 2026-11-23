import { list, get, del } from '@vercel/blob';
import { databasePool } from './name-request-store.js';
export const TRASH_HOURS = 48;
const prefix = 'little-helpers/';
export const clipPath = value => typeof value === 'string' && /^little-helpers\/(test|submissions)\/[a-f0-9-]{36}\.(m4a|wav|mp3)$/.test(value);
const options = () => {
  const token = process.env.SLH_BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('Little Helpers storage is not configured.');
  return { token };
};
export async function syncClips(pool = databasePool()) {
  let cursor;
  do {
    const page = await list({ ...options(), prefix, cursor, limit: 1000 });
    const clips = page.blobs.filter(b => clipPath(b.pathname));
    if (clips.length) await pool.query(`INSERT INTO santa_helper_clips(id,pathname,bytes,created_at)
      SELECT id,pathname,bytes,created_at FROM jsonb_to_recordset($1::jsonb)
      AS x(id text,pathname text,bytes bigint,created_at timestamptz) ON CONFLICT DO NOTHING`,
      [JSON.stringify(clips.map(b => ({id:b.pathname.split('/').pop().split('.')[0],pathname:b.pathname,bytes:b.size,created_at:b.uploadedAt})))]);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
}
// A row lock serializes restore/keep/trash with expiry; failed Blob deletions are retried.
export async function maintainClips(pool = databasePool()) {
  await pool.query(`UPDATE santa_helper_clips SET trashed_at=now()
    WHERE trashed_at IS NULL AND deleted_at IS NULL AND NOT kept
    AND created_at <= now() - interval '12 months'
    AND (SELECT automatic_expiry FROM santa_helper_settings WHERE singleton)`);
  const client = await pool.connect();
  let deleted = 0;
  try {
    await client.query('BEGIN');
    const {rows} = await client.query(`SELECT id,pathname FROM santa_helper_clips
      WHERE trashed_at <= now()-interval '48 hours' AND deleted_at IS NULL
      ORDER BY trashed_at LIMIT 100 FOR UPDATE SKIP LOCKED`);
    for (const row of rows) {
      if (!clipPath(row.pathname)) throw new Error('Invalid stored recording path.');
      await del(row.pathname, options());
      await client.query('UPDATE santa_helper_clips SET deleted_at=now() WHERE id=$1',[row.id]);
      await client.query('DELETE FROM santa_helper_permissions WHERE id::text=$1',[row.id]);
      deleted++;
    }
    await client.query('COMMIT');
    return {deleted};
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}
export async function clipReport(query, pool = databasePool()) {
  const scope = query.scope === 'trash' ? 'trash' : 'inbox';
  const page = Math.max(1, Math.min(100000, Number(query.page) || 1));
  const condition = scope === 'trash' ? "trashed_at > now()-interval '48 hours'" : 'trashed_at IS NULL';
  const {rows} = await pool.query(`SELECT id,pathname,bytes::int,created_at AS "createdAt",
    trashed_at + interval '48 hours' AS "purgeAt",kept,pathname LIKE 'little-helpers/test/%' AS "testOnly"
    FROM santa_helper_clips WHERE deleted_at IS NULL AND ${condition}
    ORDER BY created_at DESC,id LIMIT 50 OFFSET $1`,[(Math.floor(page)-1)*50]);
  const counts = await pool.query(`SELECT count(*) FILTER (WHERE trashed_at IS NULL)::int AS inbox,
    count(*) FILTER (WHERE trashed_at > now()-interval '48 hours')::int AS trash
    FROM santa_helper_clips WHERE deleted_at IS NULL`);
  const setting = await pool.query('SELECT automatic_expiry AS "automaticExpiry" FROM santa_helper_settings WHERE singleton');
  return {clips:rows,scope,page:Math.floor(page),pageSize:50,...counts.rows[0],...setting.rows[0],trashHours:TRASH_HOURS};
}
export async function changeClip(body,pool = databasePool()) {
  if (body.action === 'expiry' && ['true','false'].includes(body.enabled)) {
    await pool.query('UPDATE santa_helper_settings SET automatic_expiry=$1 WHERE singleton',[body.enabled === 'true']);
    return;
  }
  if (!/^[a-f0-9-]{36}$/.test(body.id || '')) throw Object.assign(new Error('Invalid recording.'),{status:400});
  let sql;
  if(body.action === 'trash') sql = 'SET trashed_at=COALESCE(trashed_at,now()) WHERE id=$1 AND deleted_at IS NULL';
  if(body.action === 'restore') sql = "SET trashed_at=NULL,kept=true WHERE id=$1 AND deleted_at IS NULL AND trashed_at > now()-interval '48 hours'";
  if(body.action === 'keep') sql = 'SET kept=true WHERE id=$1 AND deleted_at IS NULL AND trashed_at IS NULL';
  if(body.action === 'unkeep') sql = 'SET kept=false WHERE id=$1 AND deleted_at IS NULL AND trashed_at IS NULL';
  if(!sql) throw Object.assign(new Error('Invalid action.'),{status:400});
  const result = await pool.query('UPDATE santa_helper_clips '+sql+' RETURNING id',[body.id]);
  if(!result.rowCount) throw Object.assign(new Error('Recording unavailable. Refresh the list.'),{status:404});
}
export async function clipAudio(id,pool=databasePool()) {
  if (!/^[a-f0-9-]{36}$/.test(id || '')) return null;
  const {rows} = await pool.query(`SELECT pathname FROM santa_helper_clips WHERE id=$1 AND deleted_at IS NULL
    AND (trashed_at IS NULL OR trashed_at > now()-interval '48 hours')`,[id]);
  if(!rows[0] || !clipPath(rows[0].pathname)) return null;
  const result = await get(rows[0].pathname,{...options(),access:'private'});
  return result?.statusCode===200 ? {stream:result.stream,pathname:rows[0].pathname} : null;
}
