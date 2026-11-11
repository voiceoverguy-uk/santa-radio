import { randomUUID } from 'node:crypto';
import { put, head } from '@vercel/blob';
import { databasePool } from './contenders-database.js';
import { databasePool as payments } from './name-request-store.js';
import { livePaidPurchaseId } from './studio-live-access.js';
import { digest } from './studio-live-store.js';
export const accountEnabled = () => process.env.STUDIO_ACCOUNTS_ENABLED === 'true';
export const kinds = { audio: 'audio/mpeg', certificate: 'application/pdf', letter: 'application/pdf', picture: 'image/png' };
export function expiryFor(now = new Date()) {
 return new Date(Date.UTC(now.getUTCFullYear() + (now.getUTCMonth() === 0 ? 0 : 1), 1, 1));
}
export const assetPath = (id, kind) => `santa-messages/${id}/${kind}.${kind === 'audio' ? 'mp3' : kind === 'picture' ? 'png' : 'pdf'}`;
export async function committed(row) {
 const result = await payments().query('SELECT 1 FROM santa_studio_creation_allowances WHERE access_key=$1 AND $2::uuid=ANY(operations)', [digest(`studio-purchase:${row.purchase_id}`), row.operation_id]);
 return result.rowCount === 1;
}
// Store before charging the existing allowance. Visibility is checked against the
// committed operation, including after an interrupted response or retry.
export async function archiveRecording(req, audio, operation, name, signal) {
 if (!accountEnabled()) return null;
 const purchase = await livePaidPurchaseId(req);
 if (!purchase) return null;
 const db = databasePool();
 const linked = await db.query('SELECT 1 FROM santa_message_accounts WHERE purchase_id=$1', [purchase]);
 if (!linked.rowCount) return null;
 const expiry = expiryFor();
 const { rows: [row] } = await db.query(`INSERT INTO santa_saved_messages(id,purchase_id,operation_id,child_name,expires_at)
 VALUES($1,$2,$3,$4,$5) ON CONFLICT(operation_id) DO UPDATE SET operation_id=EXCLUDED.operation_id RETURNING *`, [randomUUID(), purchase, operation, name.slice(0,80), expiry]);
 if (row.purchase_id !== purchase) throw new Error('Operation belongs to another purchase');
 const path = assetPath(row.id, 'audio');
 await put(path, audio, { access:'private', abortSignal:signal, contentType:kinds.audio, addRandomSuffix:false, allowOverwrite:true,
 ttlDays:Math.max(1, Math.ceil((new Date(row.expires_at)-Date.now())/86400000)) });
 await db.query(`UPDATE santa_saved_messages SET assets=assets || $2::jsonb WHERE id=$1`, [row.id, JSON.stringify({audio:path})]);
 return row.id;
}
export async function acceptAsset(row, kind) {
 const path = assetPath(row.id, kind);
 const blob = await head(path);
 if (blob.contentType !== kinds[kind] || blob.size > 16*1024*1024) throw new Error('Invalid gift');
 await databasePool().query(`UPDATE santa_saved_messages SET assets=assets || $2::jsonb WHERE id=$1 AND expires_at>now()`, [row.id,JSON.stringify({[kind]:path})]);
}
