import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { collectOnce, historyPool } from '../server/radio-history-store.js';
import { readCurrentSnapshot } from '../server/radio-metadata.js';

export function pollingCadence(value = '15000') {
  const ms = Number(value);
  if (!Number.isInteger(ms) || ms < 5000 || ms > 30000) throw new Error('RADIO_HISTORY_POLL_MS must be 5000–30000');
  return ms;
}
export async function runCollector({ signal, poll = collectOnce, read = readCurrentSnapshot,
  cadenceMs = pollingCadence(process.env.RADIO_HISTORY_POLL_MS), wait = sleep } = {}) {
  let failures = 0;
  while (!signal.aborted) {
    try {
      const result = await poll({ read, cadenceMs });
      failures = result.failed ? failures + 1 : 0;
      console.info('[radio-history]', result.failed ? 'Feed read failed' : result.skipped ? 'Shared poll skipped' :
        result.baseline ? 'Uncertain baseline saved' : result.counted ? 'Song transition saved' : 'Observation saved');
    } catch {
      failures++;
      console.error('[radio-history] Storage/read failed; check database and schema');
    }
    try { await wait(Math.min(60000, cadenceMs * 2 ** Math.min(failures, 3)), undefined, { signal }); }
    catch (error) { if (error.name !== 'AbortError') throw error; }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const controller = new AbortController();
  for (const event of ['SIGINT', 'SIGTERM']) process.once(event, () => controller.abort());
  try {
    if (process.env.RADIO_HISTORY_ENABLED !== 'true') throw new Error('Radio history is not activated');
    const cadenceMs = pollingCadence(process.env.RADIO_HISTORY_POLL_MS);
    // Read-only readiness; no remote schema mutations.
    await historyPool().query('SELECT id,observed_at FROM radio_history_checkpoint WHERE id=1; SELECT identity FROM radio_history_plays LIMIT 0; SELECT ended_at FROM radio_history_coverage LIMIT 0');
    await runCollector({ signal: controller.signal, cadenceMs });
  } catch (error) { console.error('[radio-history]', error.message.startsWith('Radio history') || error.message.startsWith('RADIO_HISTORY_') ? error.message : 'Startup failed; check database/schema'); process.exitCode = 1; }
  finally { if (process.env.RADIO_HISTORY_DATABASE_URL) await historyPool().end(); }
}
