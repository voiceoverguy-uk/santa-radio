import {del} from '@vercel/blob';
import {assetPath,kinds} from './message-account-store.js';

export async function deleteSavedMessage(db,userId,id,remove=del) {
 if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return false;
 // Expire first so reads and new upload authorizations stop immediately.
 // Keep the row for cleanup: already-issued upload tokens can last ten minutes.
 const {rows}=await db.query(`UPDATE santa_saved_messages m SET expires_at=LEAST(m.expires_at,now())
 WHERE m.id=$1 AND EXISTS (SELECT 1 FROM santa_message_accounts a WHERE a.purchase_id=m.purchase_id AND a.user_id=$2)
 RETURNING m.id`,[id,userId]);
 if(!rows.length)return false;
 await remove(Object.keys(kinds).map(kind=>assetPath(id,kind)));
 return true;
}

// Serialize account removal with account linking. Keep only expired, anonymous
// message rows for the existing delayed cleanup of previously issued upload URLs.
export async function deleteMessageAccount(db, userId, removeIdentity, remove = del) {
 const client = await db.connect();
 try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [userId]);
  await client.query('SELECT purchase_id FROM santa_message_accounts WHERE user_id=$1 FOR UPDATE', [userId]);
  const {rows} = await client.query(`UPDATE santa_saved_messages m
   SET expires_at=LEAST(m.expires_at,now()), child_name=''
   WHERE EXISTS (SELECT 1 FROM santa_message_accounts a WHERE a.purchase_id=m.purchase_id AND a.user_id=$1)
   RETURNING m.id`, [userId]);
  for (const row of rows) await remove(Object.keys(kinds).map(kind => assetPath(row.id,kind)));
  await client.query('DELETE FROM santa_message_accounts WHERE user_id=$1', [userId]);
  await removeIdentity(userId);
  await client.query('COMMIT');
  return true;
 } catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
 } finally { client.release(); }
}
