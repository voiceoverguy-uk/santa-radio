import { readFile } from 'node:fs/promises';
import { databasePool } from '../server/name-request-store.js';

// Only the supported post-merge development setup invokes this. A workspace's
// environment label is not proof of a deployed runtime or database destination.
if (process.argv.slice(2).join(' ') !== '--development'
  || process.env.VERCEL === '1' || process.env.REPLIT_DEPLOYMENT === '1'
  || process.env.NODE_ENV === 'production') {
  throw new Error('Studio live schema setup is development-only; production requires the approved managed schema-sync process.');
}
const pool = databasePool();
try {
  await pool.query(await readFile(new URL('../database/santa-studio-live.sql', import.meta.url), 'utf8'));
  await pool.query(await readFile(new URL('../database/santa-studio-creation-allowance.sql', import.meta.url), 'utf8'));
  console.log('Studio live development schema ready; existing purchases and sales settings preserved.');
} finally {
  await pool.end();
}
