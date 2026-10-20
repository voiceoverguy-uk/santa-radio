import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import {
  createNameLibrary, parseNameIndex, validateNameWav, fetchLimited, NAMES_INDEX, NAMES_ROOT, filenameId,
} from '../server/santa-name-library.js';

const demrie = { id: 'demrie', name: 'Demrie', file: 'demrie.wav', aliases: ['Dem'] };
const manifest = (names = [demrie]) => Buffer.from(JSON.stringify({ version: 1, names }));
const response = bytes => new Response(bytes);

test('hosted inventory, display names, exact filenames and aliases are verified', async () => {
  const library = createNameLibrary({ fetcher: async url => {
    assert.equal(url, NAMES_INDEX);
    return response(manifest());
  } });
  const found = await library.search(' de ');
  assert.deepEqual(found.records, [{ id: 'demrie', name: 'Demrie', downloadName: 'Santa-message-for-Demrie.mp3' }]);
  assert.equal(found.warning, null);
  assert.equal(found.hostedCount, 1, 'Only hosted recordings count, not the 13 bundled names.');
  const initial = await library.search('');
  assert.equal(initial.hostedCount, 1);
  assert.deepEqual(initial.records, [], 'The total is available before typing a name.');
  assert.equal((await library.resolve('demrie')).source, 'hosted');
  assert.equal(await library.resolve('../../outside'), null);
  assert.equal(await library.resolve('https://evil.test/audio.wav'), null);
  assert.equal(await library.resolve({ url: 'anything' }), null);
  assert.equal(await library.resolve('erin\n'), null);
});

test('cache deduplicates requests, refreshes new names after a minute and caches failures briefly', async () => {
  let now = 0, calls = 0, fail = false, names = [demrie];
  const library = createNameLibrary({ now: () => now, fetcher: async () => {
    calls++;
    if (fail) return new Response('bad', { status: 500 });
    return response(manifest(names));
  } });
  await Promise.all([library.search('d'), library.search('de'), library.resolve('demrie')]);
  assert.equal(calls, 1);
  names = [...names, { id: 'flora', name: 'Flora', file: 'Flora.wav' }];
  assert.equal((await library.search('flora')).records.length, 0);
  now = 60_001;
  assert.equal((await library.search('flora')).records[0].name, 'Flora');
  assert.equal((await library.search('')).hostedCount, 2);
  assert.equal(calls, 2);
  now += 60_001;
  fail = true;
  const unavailable = await library.search('flora');
  assert.match(unavailable.warning, /hosted name list is unavailable/);
  assert.equal(unavailable.hostedCount, null, 'An outage must not look like zero names.');
  assert.deepEqual(unavailable.records, []);
  assert.equal((await library.search('erin')).records[0].id, 'erin');
  assert.equal((await library.resolve('erin')).id, 'erin');
  await assert.rejects(library.resolve('demrie'));
  assert.equal(calls, 3);
  now += 10_001;
  fail = false;
  assert.equal((await library.search('flora')).warning, null);
  assert.equal(calls, 4);
});

test('hosted count includes all inventory entries, not only the filtered or capped search results', async () => {
  const library = createNameLibrary({ fetcher: async () => response(manifest(
    Array.from({ length: 25 }, (_, i) => ({ id: `anna-${i}`, name: 'Anna', file: `anna-${i}.wav` })),
  )) });
  const results = await library.search('anna');
  assert.equal(results.records.length, 20);
  assert.equal(results.hostedCount, 25);
  assert.equal((await library.search('not-recorded')).hostedCount, 25);
  const empty = createNameLibrary({ fetcher: async () => response(manifest([])) });
  assert.equal((await empty.search('')).hostedCount, 0);
});

test('hosted name overrides local only while inventory is valid', async () => {
  const library = createNameLibrary({ fetcher: async () => response(manifest([
    { id: 'erin', name: 'Erin', file: 'Erin.wav' },
  ])) });
  assert.equal((await library.resolve('erin')).source, 'hosted');
  assert.equal((await library.resolve('olivia')).id, 'olivia');
});

test('numbered recording labels do not break the hosted library or its total', async () => {
  const entries = [
    demrie,
    { id: 'dixie3', name: 'Dixie3', file: 'dixie3.wav', aliases: ['Dixie 3'] },
    { id: '3dixie', name: '3Dixie', file: '3dixie.wav' },
  ];
  const library = createNameLibrary({ fetcher: async () => response(manifest(entries)) });
  assert.equal((await library.search('')).hostedCount, 3);
  const results = await library.search('dix');
  assert.equal(results.warning, null);
  assert.deepEqual(results.records.map(record => record.id), ['dixie3']);
  assert.equal((await library.resolve('dixie3')).file, 'dixie3.wav');
  assert.equal((await library.search('3')).records[0].name, '3Dixie');
  assert.equal((await library.search('Demrie')).records[0].id, 'demrie');
});

test('untrusted inventory paths, controls, duplicate identifiers and invalid JSON fail explicitly', () => {
  for (const item of [
    { ...demrie, file: '../demrie.wav' }, { ...demrie, file: 'https://evil.test/demrie.wav' },
    { ...demrie, file: 'demrie.wav?x=1' }, { ...demrie, id: 'other' },
    { ...demrie, name: 'Bad\r\nHeader' }, { ...demrie, aliases: ['Bad\u0000'] },
  ]) assert.throws(() => parseNameIndex(manifest([item])));
  assert.throws(() => parseNameIndex(manifest([demrie, demrie])));
  assert.throws(() => parseNameIndex(Buffer.from('WordPress error')));
  assert.throws(() => parseNameIndex(Buffer.from('{"version":1,"names":null}')));
});

test('version 2 exact-byte identities support Unicode and punctuation without merging; legacy remains readable', async () => {
  const files = ['Mary Jane.MP3', 'Seán.mp3', 'Sea\u0301n.mp3', "O'Conner.wav", 'O’Conner.wav',
    'ana_kayla.mp3', 'ana-kayla.mp3', 'Dixie3.WaV', 'Dixie3.mp3'];
  const entries = files.map(file => ({ id: filenameId(file), file, name: file.slice(0, -4) }));
  const bytes = Buffer.from(JSON.stringify({ version: 2, names: entries }));
  assert.equal(new Set(parseNameIndex(bytes).map(record => record.id)).size, files.length);
  const library = createNameLibrary({ fetcher: async () => response(bytes) });
  for (const entry of entries) assert.equal((await library.resolve(entry.id)).file, entry.file);
  assert.equal((await library.search('SEÁN')).records.length, 2);
  assert.equal((await library.search("o'conner")).records.length, 2);
  assert.equal((await library.search('O’CONNER')).records.length, 2);
  assert.equal((await library.search('Mary J')).records[0].id, filenameId(files[0]));
  assert.equal(parseNameIndex(manifest())[0].id, 'demrie');
  for (const file of ['../bad.mp3', 'a/b.mp3', 'a\\b.mp3', 'bad%20name.mp3', 'x.mp3\n',
    'x\u0000.mp3', 'x\u007f.mp3', 'x\u202e.mp3', 'x?.mp3', 'x#.mp3']) {
    assert.throws(() => parseNameIndex(Buffer.from(JSON.stringify({ version: 2, names: [
      { id: filenameId(file), file, name: 'Safe' },
    ] }))), { code: 'INDEX_ENTRY' });
  }
  assert.throws(() => parseNameIndex(Buffer.from([0xff])), { code: 'INDEX_ENCODING' });
});

test('fetch is bounded, HTTPS URLs are fixed by callers and redirects are rejected', async () => {
  await assert.rejects(fetchLimited(NAMES_INDEX, 2, async () => new Response('123')), /unavailable/);
  await assert.rejects(fetchLimited(NAMES_INDEX, 10, async () => new Response('x', {
    headers: { 'Content-Length': '11' },
  })));
  await assert.rejects(fetchLimited(NAMES_INDEX, 10, async (_, options) => {
    assert.equal(options.redirect, 'error');
    return new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1/' } });
  }));
  const library = createNameLibrary({ fetcher: async url => {
    assert.ok(url.startsWith(NAMES_ROOT));
    return response(manifest());
  } });
  await assert.rejects(library.download({ source: 'hosted', file: '../escape.wav' }, '/tmp/unused'));
});

test('real name WAV validates; HTML, truncated audio and oversized duration are rejected', async () => {
  const bytes = await readFile('server/santa-audio/names/erin.wav');
  validateNameWav(bytes);
  assert.throws(() => validateNameWav(Buffer.from('<html>error</html>')));
  assert.throws(() => validateNameWav(bytes.subarray(0, bytes.length - 8)));
  const forged = Buffer.from(bytes);
  const format = forged.indexOf('fmt ');
  forged.writeUInt32LE(1, format + 16); // Inconsistent sample rate / byte rate.
  assert.throws(() => validateNameWav(forged));
});

test('more than 9000 mixed-format names retain exact case and numbered variants', async () => {
  const entries = Array.from({ length: 9501 }, (_, i) => ({
    id: `name${i}`, name: `Name${i}`, file: `NaMe${i}.${i % 2 ? 'MP3' : 'WaV'}`,
  }));
  const library = createNameLibrary({ fetcher: async () => response(manifest(entries)) });
  assert.equal((await library.search('')).hostedCount, 9501);
  assert.equal((await library.resolve('name9500')).file, 'NaMe9500.WaV');
  assert.equal((await library.search('Name9500')).records[0].id, 'name9500');
  for (const pair of [
    ['Anna.mp3', 'anna.WAV'], ['Anna-Marie.mp3', 'Anna_Marie.MP3'],
  ]) {
    assert.throws(() => parseNameIndex(manifest(pair.map(file => ({
      id: file.slice(0, -4).toLowerCase().replaceAll('_', '-'), name: 'Anna', file,
    })))), { code: 'INDEX_DUPLICATE' });
  }
  assert.throws(() => parseNameIndex(Buffer.alloc(2 * 1024 * 1024 + 1)), { code: 'INDEX_SIZE' });
  assert.throws(() => parseNameIndex(manifest(Array(20001).fill(demrie))), { code: 'INDEX_FORMAT' });
});

test('MP3 downloads decode in isolated files, preserve case and reject invalid or long audio', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'santa-mp3-test-'));
  const encode = seconds => {
    const result = spawnSync(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i',
      'sine=frequency=523:sample_rate=44100', '-t', String(seconds), '-c:a', 'libmp3lame',
      '-threads', '1', '-f', 'mp3', 'pipe:1'], { timeout: 10000 });
    assert.equal(result.status, 0);
    return result.stdout;
  };
  let bytes = encode(0.6);
  const library = createNameLibrary({ fetcher: async url => {
    assert.equal(url, `${NAMES_ROOT}DiXiE3.MP3`);
    return response(bytes);
  } });
  const record = { source: 'hosted', file: 'DiXiE3.MP3' };
  try {
    await Promise.all([0, 1].map(async i => {
      const path = join(directory, `${i}.wav`);
      await library.download(record, path);
      validateNameWav(await readFile(path));
    }));
    for (const invalid of [
      Buffer.from('<html>WordPress database error</html>'),
      Buffer.from('#EXTM3U\nhttps://evil.test/audio.mp3'),
      bytes.subarray(0, 25), encode(31.5),
    ]) {
      bytes = invalid;
      await assert.rejects(library.download(record, join(directory, 'bad.wav')), { code: 'INVALID_MP3' });
      assert.deepEqual((await readdir(directory)).sort(), ['0.wav', '1.wav']);
    }
    bytes = Buffer.alloc(10 * 1024 * 1024 + 1);
    await assert.rejects(library.download(record, join(directory, 'bad.wav')), { code: 'UPSTREAM_SIZE' });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a stalled upstream request is aborted rather than returning an empty inventory', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const request = fetchLimited(NAMES_INDEX, 1024, async (_, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
  }));
  const rejected = assert.rejects(request, { code: 'UPSTREAM_FETCH' });
  t.mock.timers.tick(10000);
  await rejected;
});

test('PHP and renameable TXT downloads are identical standalone source', async () => {
  const source = await readFile('public/downloads/names-index.php', 'utf8');
  assert.equal(await readFile('public/downloads/names-index.php.txt', 'utf8'), source);
  assert.doesNotMatch(source, /(?:require|include)\s*[\('"]/);
});
