import { databasePool } from './name-request-store.js';
export async function tidyCompletedRequest(id, restore = false, pool = databasePool()) {
  if (typeof id !== 'string' || !/^[1-9][0-9]{0,18}$/.test(id) || BigInt(id)>9223372036854775807n)
    throw Object.assign(new Error('Choose a completed history entry.'),{status:400});
  const result = await pool.query(`UPDATE santa_name_request_history SET deleted_at=${restore ? 'NULL' : 'COALESCE(deleted_at,now())'} WHERE id=$1 RETURNING id`,[id]);
  if (!result.rowCount) throw Object.assign(new Error('Completed entry not found.'),{status:404});
  return {ok:true};
}
