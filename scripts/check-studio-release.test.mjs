import test from 'node:test';
import assert from 'node:assert/strict';
import { checkStudioRelease } from './check-studio-release.mjs';

test('local and Preview builds never claim production readiness or connect to storage', async () => {
  for (const env of [{}, { VERCEL: '1', VERCEL_ENV: 'preview' }]) {
    const result = await checkStudioRelease({ env, diagnose: async () => assert.fail('No production query') });
    assert.equal(result.checked, false);
  }
});
test('production builds require shared generation storage, not optional usage reporting', async () => {
  for (const recordingReady of [true, false]) {
    const result = await checkStudioRelease({
      env: { VERCEL: '1', VERCEL_ENV: 'production' },
      diagnose: async options => {
        assert.equal(options.includeReporting, false);
        return { database: { connected: true, host: 'fixture.example', name: 'fixture' },
          tables: [], storage: { recordingReady, reportingReady: false } };
      },
    });
    assert.equal(result.checked, true);
    assert.equal(result.ready, recordingReady);
    assert.equal(result.reportingReady, false);
    assert.equal(result.scope, 'vercel_production_build_binding_not_serving_runtime');
  }
});
test('a missing or unreachable production binding blocks release', async () => {
  const result = await checkStudioRelease({ env: { VERCEL: '1', VERCEL_ENV: 'production' },
    diagnose: async () => ({ database: { connected: false }, storage: {}, tables: [] }) });
  assert.equal(result.ready, false);
});
