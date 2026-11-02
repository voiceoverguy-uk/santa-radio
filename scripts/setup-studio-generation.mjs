import { readFile } from 'node:fs/promises';
import { databasePool } from '../server/name-request-store.js';

if (!process.argv.includes('--development') || process.env.REPLIT_DEPLOYMENT === '1'
  || process.env.NODE_ENV === 'production') {
  throw new Error('Use explicit development setup; production requires the approved schema migration.');
}
const pool = databasePool();
try {
  await pool.query(await readFile(new URL('../database/santa-studio-generation.sql', import.meta.url), 'utf8'));
  console.log('Studio generation schema ready; existing allowances preserved.');
} finally { await pool.end(); }
