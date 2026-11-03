import { readFile } from 'node:fs/promises';
import { databasePool } from '../server/name-request-store.js';
if (!process.argv.includes('--development') || process.env.REPLIT_DEPLOYMENT === '1' || process.env.NODE_ENV === 'production') {
  throw new Error('Mobile setup is restricted to the development workspace.');
}
const pool = databasePool();
try {
  await pool.query(await readFile(new URL('../database/santa-mobile.sql', import.meta.url), 'utf8'));
  console.log('Development mobile credential and usage schema ready.');
} finally { await pool.end(); }
