import { privateNameSnapshot } from '../server/santa-name-library.js';
import { databasePool } from '../server/name-request-store.js';

// Trusted server/terminal operators only. There is deliberately no public
// refresh endpoint and no new credential/token distribution to the browser.
const [command = 'status', confirmation] = process.argv.slice(2);
let pool;
try {
  if (!['status', 'refresh'].includes(command) ||
      (command === 'refresh' && confirmation !== '--confirm-refresh')) {
    throw Object.assign(new Error(), { code: 'USE_STATUS_OR_REFRESH_WITH_CONFIRM_REFRESH' });
  }
  pool = databasePool();
  // Read-only readiness on the operator's already-verified target. In
  // particular, a table alone does not mean the atomic limiter was installed.
  const readiness = await pool.query(`SELECT
    to_regclass('public.santa_name_catalogue') IS NOT NULL AS snapshot_table,
    to_regprocedure('public.santa_consume_name_access(text,text,integer,integer,timestamp with time zone,timestamp with time zone,text)')
      IS NOT NULL AS atomic_limiter`);
  console.log(JSON.stringify({ readiness: readiness.rows[0] }));
  if (!readiness.rows[0]?.snapshot_table || !readiness.rows[0]?.atomic_limiter) {
    throw Object.assign(new Error(), { code: 'INDEX_SCHEMA_NOT_READY' });
  }
  if (command === 'refresh') {
    const result = await privateNameSnapshot.refresh({ force: true });
    console.log(JSON.stringify(result));
    if (!result.published) process.exitCode = 2;
  }
  console.log(JSON.stringify(await privateNameSnapshot.status(), null, 2));
} catch (error) {
  const code = /^(INDEX_[A-Z_]+|UPSTREAM_[A-Z_]+|USE_[A-Z_]+|DATABASE_NOT_CONFIGURED)$/.test(error.code || '')
    ? error.code : 'PRIVATE_INDEX_OPERATION_FAILED';
  console.error(JSON.stringify({ error: code, note: 'Check approved database setup and private origin configuration. No credentials or inventory printed.' }));
  process.exitCode = 1;
} finally {
  await pool?.end();
}
