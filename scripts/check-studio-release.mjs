import { pathToFileURL } from 'node:url';
import { studioStorageDiagnostic } from '../server/studio-storage-diagnostic.js';
import { databasePool } from '../server/name-request-store.js';

export async function checkStudioRelease({ env = process.env, diagnose = studioStorageDiagnostic } = {}) {
  if (env.VERCEL !== '1' || env.VERCEL_ENV !== 'production') {
    return { checked: false, scope: 'not_vercel_production_build' };
  }
  const result = await diagnose({ env, includeReporting: false });
  // Reporting remains optional for entry and rendering. Mandatory generation
  // state must never be replaced with an in-memory allowance on serverless.
  return { checked: true, scope: 'vercel_production_build_binding_not_serving_runtime',
    ready: result.database.connected && result.storage.recordingReady === true,
    reportingReady: result.storage.reportingReady === true,
    database: result.database, tables: result.tables, storage: result.storage };
}

async function main() {
  let report;
  try { report = await checkStudioRelease(); }
  catch { report = { checked: true, ready: false, reason: 'readiness_check_unavailable' }; }
  finally {
    if (process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production' && process.env.DATABASE_URL) {
      try { await databasePool().end(); } catch { /* No raw driver exceptions. */ }
    }
  }
  console.log(JSON.stringify({ event: 'studio_release_readiness', ...report }));
  if (report.checked && !report.ready) {
    console.error('Studio release blocked: verify this production-build database binding and repair mandatory metadata storage through the approved migration process. No database changes were made.');
    process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
