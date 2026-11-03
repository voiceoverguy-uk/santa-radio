import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'node:crypto';
import { databasePool } from '../name-request-store.js';

export const mobileProblem = (status, message) => Object.assign(new Error(message), { status });
export const digest = value => createHash('sha256').update(value).digest('hex');
const encryptionKey = () => {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error('Signing unavailable');
  return createHash('sha256').update(`mobile-grant:${process.env.SESSION_SECRET}`).digest();
};
// Free signup grants stay encrypted server-side; no website cookie is copied
// to the app or accepted from a native caller.
export function sealGrant(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}
export function openGrant(value) {
  if (!value) return '';
  const bytes = Buffer.from(value, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
}

export function createMobileStore(pool = databasePool()) {
  return {
    async createSession() {
      const token = randomBytes(32).toString('base64url');
      const customerId = `sr_${randomBytes(24).toString('hex')}`;
      const expiresAt = Date.now() + 180 * 86400000;
      await pool.query(`INSERT INTO santa_mobile_sessions(token_hash,customer_id,expires_at) VALUES($1,$2,$3)`,
        [digest(token), customerId, new Date(expiresAt)]);
      // Only credentials expire. Completed consumable accounting must survive
      // reinstall/restore and customer transfer so the same purchase cannot replay.
      await pool.query('DELETE FROM santa_mobile_sessions WHERE expires_at < now()');
      return { token, customerId, expiresAt };
    },
    async session(token) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token || '')) throw mobileProblem(401, 'Please reconnect the app.');
      const { rows } = await pool.query(`SELECT customer_id,free_grant FROM santa_mobile_sessions
        WHERE token_hash=$1 AND expires_at>now()`, [digest(token)]);
      if (!rows[0]) throw mobileProblem(401, 'Your app connection expired. Please reconnect.');
      return { customerId: rows[0].customer_id, freeGrant: openGrant(rows[0].free_grant), tokenHash: digest(token) };
    },
    async setFreeGrant(session, value) {
      await pool.query('UPDATE santa_mobile_sessions SET free_grant=$2 WHERE token_hash=$1',
        [session.tokenHash, sealGrant(value)]);
    },
    async entitlement(purchases) {
      if (!purchases.single.length) return { verified: true, permanent: purchases.permanent, credits: 0 };
      const result = await pool.query(`SELECT purchase_key FROM santa_mobile_generations WHERE purchase_key=ANY($1::text[])
        AND (completed OR expires_at>now())`, [purchases.single]);
      const unavailable = new Set(result.rows.map(r => r.purchase_key));
      return { verified: true, permanent: purchases.permanent, credits: purchases.single.filter(k => !unavailable.has(k)).length };
    },
    async reserve(customerId, requestId, purchases) {
      if (!/^[a-f0-9-]{36}$/.test(requestId || '')) throw mobileProblem(400, 'A message request identifier is required.');
      const requestKey = digest(`${customerId}:${requestId}`);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Serialize across all sessions for the same RevenueCat customer.
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [customerId]);
        await client.query('DELETE FROM santa_mobile_generations WHERE completed=false AND expires_at<=now()');
        const existing = await client.query('SELECT request_key FROM santa_mobile_generations WHERE request_key=$1 OR (customer_id=$2 AND completed=false)',
          [requestKey, customerId]);
        if (existing.rowCount) throw mobileProblem(409, 'This request is already preparing or completed. A completed recording is not kept on the server.');
        let purchaseKey = null;
        if (!purchases.permanent) {
          for (const candidate of purchases.single) {
            const reserved = await client.query(`INSERT INTO santa_mobile_generations(request_key,customer_id,purchase_key,expires_at)
              VALUES($1,$2,$3,now()+interval '125 seconds') ON CONFLICT DO NOTHING RETURNING request_key`, [requestKey, customerId, candidate]);
            if (reserved.rowCount) { purchaseKey = candidate; break; }
          }
          if (!purchaseKey) throw mobileProblem(402, 'A verified Studio purchase is needed before creating this message.');
        } else await client.query(`INSERT INTO santa_mobile_generations(request_key,customer_id,expires_at)
          VALUES($1,$2,now()+interval '125 seconds')`, [requestKey, customerId]);
        await client.query('COMMIT');
        return { requestKey, purchaseKey };
      } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
      finally { client.release(); }
    },
    async finish(lease, success) {
      if (!success) {
        await pool.query('DELETE FROM santa_mobile_generations WHERE request_key=$1 AND completed=false', [lease.requestKey]);
        return;
      }
      const done = await pool.query(`UPDATE santa_mobile_generations SET completed=true WHERE request_key=$1
        AND completed=false AND expires_at>now() RETURNING request_key`, [lease.requestKey]);
      if (!done.rowCount) throw mobileProblem(409, 'This preparation expired. Your generation has not been used.');
    },
  };
}
