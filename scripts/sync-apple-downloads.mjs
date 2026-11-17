// Supply DATABASE_URL and APPLE_REPORTS_* through the deployment environment.
// For local setup APPLE_REPORTS_KEY_FILE can point to the original downloaded key.
import { readFile } from 'node:fs/promises';
import { databasePool } from '../server/name-request-store.js';
import { syncAppleDownloads } from '../server/apple-download-statistics.js';
if (process.env.APPLE_REPORTS_KEY_FILE) process.env.APPLE_REPORTS_PRIVATE_KEY=await readFile(process.env.APPLE_REPORTS_KEY_FILE,'utf8');
try { console.log(await syncAppleDownloads()); }
catch { console.error('Apple download sync failed. Check server credentials, schema and Apple report availability.'); process.exitCode=1; }
finally { await databasePool().end(); }
