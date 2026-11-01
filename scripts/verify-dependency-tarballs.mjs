// Read-only verification of the four repaired sources; never rewrites the lock.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
for (const name of ['body-parser', 'express', 'qs', 'vite']) {
  const entry = lock.packages[`node_modules/${name}`];
  const expected = `https://registry.npmjs.org/${name}/-/${name}-${entry.version}.tgz`;
  const response = await fetch(`https://registry.npmjs.org/${name}/${entry.version}`, {
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, 200, `${name}: exact-version metadata unavailable`);
  const metadata = await response.json();
  assert.equal(metadata.version, entry.version, `${name}: version mismatch`);
  assert.equal(metadata.dist.tarball, expected, `${name}: public tarball mismatch`);
  assert.equal(metadata.dist.integrity, entry.integrity, `${name}: registry integrity mismatch`);
  assert.equal(entry.resolved, expected, `${name}: package source mismatch`);
  if (lock.dependencies) {
    assert.equal(lock.dependencies[name].resolved, expected, `${name}: compatibility source mismatch`);
    assert.equal(lock.dependencies[name].integrity, entry.integrity, `${name}: compatibility integrity mismatch`);
    assert.equal(lock.dependencies[name].version, entry.version, `${name}: compatibility version mismatch`);
  }
  const tarball = await fetch(expected, { signal: AbortSignal.timeout(30000) });
  assert.equal(tarball.status, 200, `${name}: tarball unavailable`);
  const integrity = 'sha512-' + createHash('sha512')
    .update(Buffer.from(await tarball.arrayBuffer())).digest('base64');
  assert.equal(integrity, entry.integrity, `${name}: downloaded bytes differ from locked integrity`);
  console.log(`${name}@${entry.version}: public metadata and downloaded SHA-512 verified`);
}
