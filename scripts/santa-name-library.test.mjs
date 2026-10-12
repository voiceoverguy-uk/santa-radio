import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createNameLibrary, parseNameIndex, validateNameWav, fetchLimited, NAMES_INDEX, NAMES_ROOT,
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
  assert.equal((await library.resolve('demrie')).source, 'hosted');
  assert.equal(await library.resolve('../../outside'), null);
  assert.equal(await library.resolve('https://evil.test/audio.wav'), null);
  assert.equal(await library.resolve({ url: 'anything' }), null);
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
  assert.equal(calls, 2);
  now += 60_001;
  fail = true;
  const unavailable = await library.search('flora');
  assert.match(unavailable.warning, /hosted name list is unavailable/);
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

test('hosted name overrides local only while inventory is valid', async () => {
  const library = createNameLibrary({ fetcher: async () => response(manifest([
    { id: 'erin', name: 'Erin', file: 'Erin.wav' },
  ])) });
  assert.equal((await library.resolve('erin')).source, 'hosted');
  assert.equal((await library.resolve('olivia')).id, 'olivia');
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
