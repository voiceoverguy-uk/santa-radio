import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, copyFile, writeFile, mkdir, symlink, rm, readFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseNameIndex, createNameLibrary, filenameId, NAMES_INDEX, NAMES_ROOT } from '../server/santa-name-library.js';

const php = process.env.PHP_BINARY || 'php';
const available = spawnSync(php, ['-v']).status === 0;
test('PHP inventory preserves 9501 files and real-world names; private diagnostics explain exclusions', {
  skip: available ? false : 'Set PHP_BINARY to a PHP CLI executable to exercise the host script.',
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'santa-index-'));
  const script = join(directory, 'names-index.php');
  const run = (method = 'GET', diagnostic = false) => {
    const result = spawnSync(php, diagnostic ? ['-n', script, '--diagnose'] : ['-n', '-r',
      '$_SERVER["REQUEST_METHOD"]=$argv[1]; register_shutdown_function(function(){fwrite(STDERR,(string)http_response_code());}); require $argv[2];',
      method, script], { timeout: 10000, maxBuffer: 16 * 1024 * 1024 });
    assert.equal(result.status, 0, result.stderr.toString());
    return { bytes: result.stdout, status: result.stderr.toString() };
  };
  try {
    await copyFile('public/downloads/names-index.php', script);
    for (let i = 0; i < 9501; i++) await writeFile(join(directory, `NaMe${i}.${i % 2 ? 'MP3' : 'WaV'}`), '');
    const files = ['Mary Jane.mp3', 'Seán.MP3', 'Sea\u0301n.mp3', "O'Conner.mp3", 'O’Conner.mp3',
      'ana-kayla.mp3', 'ana_kayla.mp3', 'dixie3.wav', '3dixie.mp3', 'DiXiE3.MP3'];
    for (const file of [...files, 'notes.txt', '.hidden.mp3', 'escape.mp3.php', 'bad%.mp3', 'bad\nname.mp3']) {
      await writeFile(join(directory, file), '');
    }
    const malformed = Buffer.concat([Buffer.from(`${directory}/`), Buffer.from([0xff]), Buffer.from('.mp3')]);
    await writeFile(malformed, '');
    await mkdir(join(directory, 'directory.mp3'));
    await symlink(join(directory, 'NaMe0.WaV'), join(directory, 'link.mp3'));
    await writeFile(join(directory, 'unreadable.mp3'), '');
    await chmod(join(directory, 'unreadable.mp3'), 0);
    const first = run();
    const inventory = parseNameIndex(first.bytes);
    assert.equal(inventory.length, 9511);
    assert.equal(inventory.find(item => item.file === 'NaMe9500.WaV').id, filenameId('NaMe9500.WaV'));
    assert.equal(new Set(inventory.map(item => item.id)).size, 9511);
    const library = createNameLibrary({ fetcher: async url => {
      if (url === NAMES_INDEX) return new Response(first.bytes);
      assert.ok(files.some(file => url === `${NAMES_ROOT}${encodeURIComponent(file)}`));
      return new Response(await readFile('server/santa-audio/names/erin.wav'));
    } });
    for (const file of files) {
      const record = await library.resolve(filenameId(file));
      assert.equal(record.file, file);
      assert.ok((await library.search(file.slice(0, -4))).records.some(item => item.id === record.id));
      if (file.endsWith('.wav')) await library.download(record, join(directory, 'download.wav'));
    }
    assert.equal((await library.search("o'conner")).records.length, 2);
    assert.equal((await library.search('Seán')).records.length, 2);
    const diagnostic = JSON.parse(run('GET', true).bytes);
    assert.equal(Object.values(diagnostic.counts).reduce((a, b) => a + b), diagnostic.directory_entries);
    assert.equal(diagnostic.counts.malformed_utf8, 1);
    assert.equal(diagnostic.counts.unreadable, 1);
    assert.equal(diagnostic.counts.directory, 1);
    assert.equal(diagnostic.counts.symlink, 1);
    assert.equal(diagnostic.counts.unsupported_filename, 3);
    assert.ok(diagnostic.audio_entries.some(item => item.file === 'Mary Jane.mp3' && item.has_spaces && !item.legacy_included));
    assert.ok(!JSON.stringify(diagnostic).includes('notes.txt'), 'Unrelated filenames are not exposed.');
    assert.equal(diagnostic.audio_entries.find(item => item.reason === 'malformed_utf8').filename_base64, Buffer.from([0xff, 46, 109, 112, 51]).toString('base64'));
    await writeFile(join(directory, 'New Name.mp3'), '');
    assert.equal(parseNameIndex(run().bytes).length, 9513, 'Local fixture upload and earlier download are discovered.');
    assert.equal(run('POST').status, '405');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
