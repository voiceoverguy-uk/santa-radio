import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, copyFile, writeFile, mkdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const php = process.env.PHP_BINARY || 'php';
const available = spawnSync(php, ['-v']).status === 0;
test('workshop HTTPS index lists only fixed child folders, preserving exact file identities and excluding unsafe entries', {
  skip: available ? false : 'Set PHP_BINARY to a PHP CLI executable.',
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'workshop-index-'));
  const script = join(root, 'workshop-index.php');
  const categories = { age: 'AGES', activity: 'Trying Hard at', achievement: 'Achievment', place: 'countries', treat: 'treats' };
  const run = (method = 'GET') => {
    const result = spawnSync(php, ['-n', '-r',
      '$_SERVER["REQUEST_METHOD"]=$argv[1]; $_GET["path"]="/etc"; register_shutdown_function(function(){fwrite(STDERR,(string)http_response_code());}); require $argv[2];',
      method, script], { timeout: 15000, maxBuffer: 3 * 1024 * 1024 });
    assert.equal(result.status, 0, result.stderr.toString());
    return { data: JSON.parse(result.stdout.toString()), status: Number(result.stderr.toString()) || 200 };
  };
  try {
    await copyFile('public/downloads/workshop-index.php', script);
    for (const folder of Object.values(categories)) {
      await mkdir(join(root, folder));
      await writeFile(join(root, folder, 'Exact-Éxample.WAV'), 'fixture');
      await writeFile(join(root, folder, 'not-audio.txt'), 'unrelated private data');
    }
    await writeFile(join(root, 'AGES', '1-months.wav'), 'fixture');
    await writeFile(join(root, 'AGES', '48-years-old.wav'), 'fixture');
    await writeFile(join(root, 'treats', 'pfeffernu╠êsse.wav'), 'fixture');
    await writeFile(join(root, 'countries', '.hidden.wav'), 'not exposed');
    await writeFile(join(root, 'countries', 'unsafe\\path.wav'), 'not exposed');
    await writeFile(join(root, 'countries', 'unsafe\nname.wav'), 'not exposed');
    await writeFile(join(root, 'unrelated.wav'), 'not indexed');
    await symlink(join(root, 'unrelated.wav'), join(root, 'countries', 'link.wav'));
    const first = run();
    assert.equal(first.status, 200);
    assert.equal(first.data.version, 1);
    assert.deepEqual(Object.keys(first.data.categories).sort(), Object.keys(categories).sort());
    for (const [key, folder] of Object.entries(categories)) {
      const exactFile = `${folder}/Exact-Éxample.WAV`;
      const record = first.data.categories[key].find(item => item.file === exactFile);
      assert.ok(record);
      assert.equal(record.id, `c-${createHash('sha256').update(exactFile).digest('hex')}`);
      assert.equal(record.bytes, 7);
    }
    assert.equal(first.data.excludedAudioCounts.place, 4);
    assert.ok(first.data.categories.treat.some(item => item.file === 'treats/pfeffernu╠êsse.wav'));
    assert.ok(!JSON.stringify(first.data).includes('not-audio'));
    assert.ok(!JSON.stringify(first.data).includes(root));
    assert.equal(run('POST').status, 405);
    await writeFile(join(root, 'Achievment', 'new-recording.wav'), 'fixture');
    assert.equal(run().data.categories.achievement.length, 2);
    await rm(join(root, 'AGES'), { recursive: true });
    assert.equal(run().status, 503, 'Never return a partial catalogue for a missing folder.');
    await symlink(join(root, 'countries'), join(root, 'AGES'));
    assert.equal(run().status, 503, 'Refuse symlinked category directories.');
  } finally { await rm(root, { recursive: true, force: true }); }
});
