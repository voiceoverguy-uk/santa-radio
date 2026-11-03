// Test-only Node preload. Simulate missing tables without deleting real data.
// Never imported by the application, build or production entrypoints.
import pg from 'pg';
import { appendFileSync } from 'node:fs';

const mode = process.env.STUDIO_TEST_MISSING_TABLES;
if (mode) {
  if (!['reporting', 'generation-and-reporting'].includes(mode) || process.env.VERCEL === '1') {
    throw new Error('Invalid isolated Studio storage test configuration.');
  }
  const query = pg.Client.prototype.query;
  pg.Client.prototype.query = function (...args) {
    const sql = typeof args[0] === 'string' ? args[0] : args[0]?.text || '';
    const reporting = /\b(?:FROM|INTO|UPDATE)\s+(?:public\.)?santa_workshop_usage_sessions\b/i.test(sql);
    const generation = mode === 'generation-and-reporting'
      && /\b(?:FROM|INTO|UPDATE)\s+(?:public\.)?santa_studio_generation_(?:access|results)\b/i.test(sql);
    if (!reporting && !generation) return query.apply(this, args);
    if (process.env.STUDIO_TEST_QUERY_LOG) {
      appendFileSync(process.env.STUDIO_TEST_QUERY_LOG, reporting ? 'reporting\n' : 'generation\n');
    }
    const error = Object.assign(new Error('Isolated test: required relation absent.'), { code: '42P01' });
    const callback = args.findLast(value => typeof value === 'function');
    if (callback) { queueMicrotask(() => callback(error)); return; }
    return Promise.reject(error);
  };
}
