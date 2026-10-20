import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, copyFile, writeFile, mkdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseNameIndex } from '../server/santa-name-library.js';

const php = process.env.PHP_BINARY || 'php';
const available = spawnSync(php, ['-v']).status === 0;
test('standalone PHP enumerates 9501 real files, skips unsafe files and reports collisions', {
  skip: available ? false : 'Set PHP_BINARY to a PHP CLI executable to exercise the host script.',
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'santa-index-'));
  const script = join(directory, 'names-index.php');
  const run = (method = 'GET') => {
    const result = spawnSync(php, ['-r',
      '$_SERVER["REQUEST_METHOD"]=$argv[1]; register_shutdown_function(function(){fwrite(STDERR,(string)http_response_code());}); require $argv[2];',
      method, script], { timeout: 10000, maxBuffer: 3 * 1024 * 1024 });
    assert.equal(result.status, 0, result.stderr.toString());
    return { bytes: result.stdout, status: result.stderr.toString() };
  };
  try {
    await copyFile('public/downloads/names-index.php', script);
    for (let i = 0; i < 9501; i++) await writeFile(join(directory, `NaMe${i}.${i % 2 ? 'MP3' : 'WaV'}`), '');
    for (const file of ['unsafe name.mp3', 'notes.txt', '.hidden.mp3', 'escape.mp3.php']) {
      await writeFile(join(directory, file), '');
    }
    await mkdir(join(directory, 'directory.mp3'));
    await symlink(join(directory, 'NaMe0.WaV'), join(directory, 'link.mp3'));
    const first = parseNameIndex(run().bytes);
    assert.equal(first.length, 9501);
    assert.equal(first.find(item => item.id === 'name9500').file, 'NaMe9500.WaV');
    await writeFile(join(directory, 'DiXiE3.MP3'), '');
    assert.equal(parseNameIndex(run().bytes).length, 9502, 'A subsequent upload is discovered without a manual list.');
    await writeFile(join(directory, 'dixie3.wav'), '');
    const collision = run();
    assert.equal(collision.status, '503');
    const error = JSON.parse(collision.bytes);
    assert.match(error.error, /Duplicate name identifier/);
    assert.equal(error.id, 'dixie3');
    assert.deepEqual(error.files, ['DiXiE3.MP3', 'dixie3.wav']);
    assert.equal(error.names, undefined);
    assert.equal(run('POST').status, '405');
    await rm(join(directory, 'dixie3.wav'));
    await writeFile(join(directory, 'Anna-Marie.mp3'), '');
    await writeFile(join(directory, 'Anna_Marie.wav'), '');
    assert.equal(run().status, '503', 'Underscore/hyphen aliases also collide.');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
