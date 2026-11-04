import { studioLiveReadiness } from '../server/studio-live-readiness.js';
import { databasePool } from '../server/name-request-store.js';

// Explicit serving-runtime check, never called by the website build.
// Emits only our fixed reason codes, never provider errors, paths or secrets.
try {
  await studioLiveReadiness();
  console.log(JSON.stringify({ ready: true, scope: 'live_studio_serving_runtime', amount: 650, currency: 'gbp' }));
} catch (error) {
  const reason = /^STUDIO_[A-Z0-9_]+$/.test(error.message || '') ? error.message : 'STUDIO_LIVE_CHECK_UNAVAILABLE';
  console.log(JSON.stringify({ ready: false, scope: 'live_studio_serving_runtime', reason }));
  process.exitCode = 1;
} finally {
  if (process.env.DATABASE_URL) try { await databasePool().end(); } catch { /* No credential-bearing driver errors. */ }
}
