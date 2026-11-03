import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkStudioRelease } from './check-studio-release.mjs';

test('website compilation is independent of Studio storage; strict Studio readiness remains separately available', () => {
  const { scripts } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(scripts['check:studio-readiness'], 'node scripts/check-studio-release.mjs');
  assert.equal(scripts.prebuild, 'npm run check:dependency-portability');
  assert.equal(scripts.build, 'node scripts/prepare-santa-audio.mjs && vite build && vite build --ssr src/entry-server.jsx --outDir dist/server && node scripts/build-public-pages.mjs');
  assert.doesNotMatch(scripts.build, /check-studio-release|db:push|drizzle|migrate|psql/i);
});

test('local and Preview builds never claim production readiness or connect to storage', async () => {
  for (const env of [{}, { VERCEL: '1', VERCEL_ENV: 'preview' }]) {
    const result = await checkStudioRelease({ env, diagnose: async () => assert.fail('No production query') });
    assert.equal(result.checked, false);
  }
});
test('explicit production Studio readiness requires access protection, not generation history or usage reporting', async () => {
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
test('a missing or unreachable production binding still fails explicit Studio readiness', async () => {
  const result = await checkStudioRelease({ env: { VERCEL: '1', VERCEL_ENV: 'production' },
    diagnose: async () => ({ database: { connected: false }, storage: {}, tables: [] }) });
  assert.equal(result.ready, false);
});
