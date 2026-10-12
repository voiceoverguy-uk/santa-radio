import { readFile } from 'node:fs/promises';
import { databasePool } from '../server/name-request-store.js';

// REPLIT_ENVIRONMENT can be "production" in a development workspace too;
// require explicit dev intent and reject actual deployment execution instead.
if (!process.argv.includes('--development') ||
    process.env.REPLIT_DEPLOYMENT === '1' || process.env.NODE_ENV === 'production') {
  throw new Error('This setup is restricted to the development workspace. Production schema changes require approved Publish.');
}
const pool = databasePool();
try {
  await pool.query(await readFile(new URL('../database/santa-name-requests.sql', import.meta.url), 'utf8'));
  console.log('Development name-request schema ready; existing requests preserved.');
} finally { await pool.end(); }
