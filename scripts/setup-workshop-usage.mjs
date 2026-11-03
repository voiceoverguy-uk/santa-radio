import { readFile } from 'node:fs/promises';
import { databasePool } from '../server/name-request-store.js';

if (!process.argv.includes('--development') || process.env.REPLIT_DEPLOYMENT === '1'
  || process.env.NODE_ENV === 'production') {
  throw new Error('Use explicit development setup; production requires an approved schema migration.');
}
const pool = databasePool();
try {
  await pool.query(await readFile(new URL('../database/santa-workshop-usage.sql', import.meta.url), 'utf8'));
  console.log('Voucher usage schema ready; existing records preserved.');
} finally { await pool.end(); }
