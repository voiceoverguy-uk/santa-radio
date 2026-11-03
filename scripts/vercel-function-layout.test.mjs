import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectFunctionFiles } from './vercel-function-layout.mjs';

const file = { type: 'FileBlob', data: '', mode: 0o100644 };
const link = target => ({ type: 'FileBlob', data: target, mode: 0o120777 });
const handler = { 'api/example.js': file };

test('rejects the reproduced FFmpeg symlink/file overlap, including actual filesystem links', async t => {
  const root = await mkdtemp(join(tmpdir(), 'santa-function-layout-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await symlink('.pnpm/ffmpeg-static@5.3.0/node_modules/ffmpeg-static', join(root, 'ffmpeg-static'));
  const errors = await inspectFunctionFiles({
    ...handler,
    'node_modules/ffmpeg-static': { type: 'FileFsRef', fsPath: join(root, 'ffmpeg-static'), mode: 0o120777 },
    'node_modules/ffmpeg-static/ffmpeg': file,
    'node_modules/.pnpm/ffmpeg-static@5.3.0/node_modules/ffmpeg-static/index.js': file,
  }, 'api/example.js');
  assert.ok(errors.some(error => error.includes('Symlink/file overlap: node_modules/ffmpeg-static contains')));
});

test('accepts flat npm packages and self-contained directory symlinks without overlapping children', async () => {
  for (const files of [
    { ...handler, 'node_modules/ffmpeg-static/ffmpeg': file },
    { ...handler, 'node_modules/pkg': link('.pnpm/pkg/node_modules/pkg'),
      'node_modules/.pnpm/pkg/node_modules/pkg/index.js': file },
  ]) assert.deepEqual(await inspectFunctionFiles(files, 'api/example.js'), []);
});

test('rejects broken, escaping, absolute and cyclic links, unsafe paths and missing handlers', async () => {
  for (const files of [
    { ...handler, 'node_modules/pkg': link('missing') },
    { ...handler, 'node_modules/pkg': link('../../outside') },
    { ...handler, 'node_modules/pkg': link('/outside') },
    { ...handler, a: link('b'), b: link('a') },
    { ...handler, '../outside': file },
    { ...handler, '/absolute': file },
    { ...handler, 'foo/../bar': file },
    {},
  ]) assert.ok((await inspectFunctionFiles(files, 'api/example.js')).length);
});

test('all first-matching function configs reuse the completed website npm install', async () => {
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  assert.equal(config.installCommand, 'node scripts/check-dependency-portability.mjs && npm ci');
  async function walk(root) {
    const results = [];
    for (const entry of await readdir(root, { withFileTypes: true })) {
      const path = `${root}/${entry.name}`;
      if (entry.isDirectory()) results.push(...await walk(path));
      else if (path.endsWith('.js')) results.push(path);
    }
    return results;
  }
  for (const path of [...await walk('api'), 'api/future/nested.js']) {
    // All configured patterns are exact paths, followed by one catch-all.
    const match = Object.entries(config.functions).find(([pattern]) => pattern === path || pattern === 'api/**/*.js');
    assert.equal(match?.[1].installCommand, '', path);
  }
  for (const path of ['api/santa-mobile.js', 'api/santa-message.js', 'api/santa-studio-message.js']) {
    assert.match(config.functions[path].includeFiles, /node_modules\/ffmpeg-static\/\*\*/);
    assert.equal(config.functions[path].maxDuration, 120);
  }
  assert.match(config.functions['api/public-page.js'].includeFiles, /dist\/server\/\*\*/);
  assert.ok(await readFile('pnpm-lock.yaml', 'utf8'));
  assert.ok(await readFile('pnpm-workspace.yaml', 'utf8'));
});
