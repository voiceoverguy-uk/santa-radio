import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inspectLock, inspectManifest, inspectProject } from './check-dependency-portability.mjs';

const entry = { version: '6.4.5', resolved: 'https://registry.npmjs.org/vite/-/vite-6.4.5.tgz',
  integrity: 'sha512-4enwjFfi4IwtEh0w+jPzpLVOFQiPHmmzPxcHXQOyEur47o6u0jE573DmGpjA+7irXoMLYRZD5ZaFUEneS3abPg==' };
const lock = change => ({ packages: { '': {}, 'node_modules/vite': { ...entry, ...change } } });
test('public npm tarballs with retained integrity are accepted, including scoped packages', () => {
  assert.deepEqual(inspectLock(lock()).errors, []);
  assert.deepEqual(inspectLock(lock({ resolved: 'https://registry.npmjs.org/@clerk/shared/-/shared-4.40.0.tgz' })).errors, []);
  assert.deepEqual(inspectManifest({ dependencies: { '@replit/connectors-sdk': '^0.5.0' } }), []);
});
test('the actual Replit firewall failure, local sources and insecure alternatives are rejected', () => {
  for (const resolved of [
    'http://package-firewall.replit.internal/npm/vite/-/vite-6.4.5.tgz',
    'https://package-firewall.replit.internal/npm/vite/-/vite-6.4.5.tgz',
    'https://example.replit.dev/vite.tgz', 'https://127.0.0.1/vite.tgz',
    'http://registry.npmjs.org/vite/-/vite-6.4.5.tgz', 'file:vendor/vite.tgz',
    'https://user:password@registry.npmjs.org/vite/-/vite-6.4.5.tgz',
    'https://registry.npmjs.org/vite/-/vite-6.4.5.tgz?temporary=1',
  ]) assert.ok(inspectLock(lock({ resolved })).errors.length, resolved);
  assert.ok(inspectLock(lock({ integrity: undefined })).errors.length);
});
test('nested dependencies cannot hide a nonportable source', () => {
  const nested = lock();
  nested.packages['node_modules/express/node_modules/qs'] = { ...entry,
    resolved: 'http://package-firewall.replit.internal/npm/qs/-/qs-6.17.1.tgz' };
  assert.ok(inspectLock(nested).errors.some(error => error.includes('express/node_modules/qs')));
});
test('project registries, overrides, scripts and secondary Python lockfiles are inspected', async () => {
  assert.ok(inspectManifest({ overrides: { qs: 'http://package-firewall.replit.internal/npm/qs.tgz' } }).length);
  assert.ok(inspectManifest({ dependencies: { vite: 'file:vendor/vite' } }).length);
  const root = await mkdtemp(join(tmpdir(), 'portability-test-'));
  try {
    await writeFile(join(root, 'package.json'), '{}');
    await writeFile(join(root, 'package-lock.json'), JSON.stringify(lock()));
    for (const file of ['.npmrc', '.yarnrc.yml', 'uv.lock', 'pyproject.toml']) {
      await writeFile(join(root, file), 'registry = "http://package-firewall.replit.internal/npm/"');
    }
    const result = await inspectProject(root);
    for (const file of ['.npmrc', '.yarnrc.yml', 'uv.lock', 'pyproject.toml']) {
      assert.ok(result.errors.some(error => error.startsWith(file)));
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('real project passes, and Vercel checks sources before exact npm ci installation', async () => {
  assert.deepEqual((await inspectProject()).errors, []);
  const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(vercel.installCommand, 'node scripts/check-dependency-portability.mjs && npm ci');
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts.prebuild, 'npm run check:dependency-portability');
});
test('command-line preflight exits unsuccessfully for the reported internal Vite source', async () => {
  const root = await mkdtemp(join(tmpdir(), 'portability-cli-'));
  try {
    await writeFile(join(root, 'package.json'), '{}');
    await writeFile(join(root, 'package-lock.json'), JSON.stringify(lock({
      resolved: 'http://package-firewall.replit.internal/npm/vite/-/vite-6.4.5.tgz',
    })));
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./check-dependency-portability.mjs', import.meta.url))],
      { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Dependency portability check failed/);
    assert.match(result.stderr, /node_modules\/vite/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
