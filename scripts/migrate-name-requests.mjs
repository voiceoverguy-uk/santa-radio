import { seedPromotionLibrary } from '../server/app-promotions.js';
import { seedFriendVouchers } from '../server/friend-vouchers.js';
// Additive, release-time migration. Never changes schema from a visitor request.
import pg from 'pg';
import { readFile } from 'node:fs/promises';

if (process.env.VERCEL_ENV === 'production') {
  if (!process.env.DATABASE_URL) throw new Error('Name-request migration requires DATABASE_URL');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000, statement_timeout: 30000 });
  try {
    await client.connect();
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('santa-name-requests-schema'))");
    const schema = await readFile(new URL('../database/santa-name-requests.sql', import.meta.url), 'utf8');
    await client.query(schema);
    await client.query(await readFile(new URL('../database/free-message-verification.sql', import.meta.url), 'utf8'));
    await client.query(await readFile(new URL('../database/message-statistics.sql', import.meta.url), 'utf8'));
    await client.query(await readFile(new URL('../database/santa-message-reviews.sql', import.meta.url), 'utf8'));
    await client.query('SELECT request_key, recorded_at FROM santa_name_requests LIMIT 0');
    await client.query('SELECT id, recording_suggestions FROM santa_name_request_history LIMIT 0');
    await client.query('SELECT request_key FROM santa_name_recording_suggestions LIMIT 0');
    await client.query(await readFile(new URL('../database/dad-studio.sql', import.meta.url), 'utf8'));
    await client.query(await readFile(new URL('../database/dad-vouchers.sql', import.meta.url), 'utf8'));
    await client.query(await readFile(new URL('../database/friend-voucher-issues.sql', import.meta.url), 'utf8'));
    await client.query(await readFile(new URL('../database/catalogue-artwork.sql', import.meta.url), 'utf8'));
    await seedFriendVouchers(client);
    await client.query(await readFile(new URL('../database/app-promotions.sql', import.meta.url), 'utf8'));
    await seedPromotionLibrary(client, await readFile(new URL('../public/images/app-promotions/black-friday.jpg', import.meta.url)));
    await seedPromotionLibrary(client, await readFile(new URL('../public/images/app-promotions/santa-dash.jpg', import.meta.url)), 'santaDash');
    await client.query('COMMIT');
    console.log('Name-request schema verified; existing requests preserved.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Name-request schema migration failed', { code: error.code || 'UNEXPECTED' });
    process.exitCode = 1;
  } finally { await client.end(); }
} else {
  console.log('Name-request production migration skipped outside production.');
}
