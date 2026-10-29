import { readFile } from 'node:fs/promises';
import { databasePool } from '../server/name-request-store.js';
// Operator must confirm this connection is the non-production development DB.
if (!process.argv.includes('--confirmed-development-target') ||
    process.env.REPLIT_DEPLOYMENT === '1' || process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') {
  throw new Error('Requires a confirmed non-production target. Never run during build or app startup.');
}
const pool = databasePool();
try {
  await pool.query(await readFile(new URL('../database/christmas-contenders.sql',import.meta.url),'utf8'));
  console.log('Development competition schema ready; existing ballots preserved.');
} finally { await pool.end(); }
