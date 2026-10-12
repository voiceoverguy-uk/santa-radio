import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import { createNameLibrary, NAMES_INDEX, NAMES_ROOT } from '../server/santa-name-library.js';
import { createSantaMessageHandler } from '../server/santa-message.js';
import { createSantaNamesHandler } from '../server/santa-names.js';

test('hosted name is fetched only for creation and produces a decodable MP3', { timeout: 30000 }, async () => {
  let downloads = 0;
  const nameBytes = await readFile('server/santa-audio/names/erin.wav');
  const library = createNameLibrary({ fetcher: async url => {
    if (url === NAMES_INDEX) return new Response(JSON.stringify({ version: 1, names: [
      { id: 'demrie', name: 'Demrie', file: 'demrie.wav' },
    ] }));
    assert.equal(url, `${NAMES_ROOT}demrie.wav`);
    downloads++;
    return new Response(nameBytes);
  } });
  const message = createSantaMessageHandler(library), names = createSantaNamesHandler(library);
  const server = createServer((req, res) => req.url.startsWith('/api/santa-names') ? names(req, res) : message(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const results = await fetch(`${base}/api/santa-names?q=Dem`);
    assert.equal((await results.json()).records[0].name, 'Demrie');
    assert.equal(downloads, 0);
    const response = await fetch(`${base}/api/santa-message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'demrie' }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'audio/mpeg');
    assert.match(response.headers.get('content-disposition'), /Santa-message-for-Demrie.mp3/);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(downloads, 1);
    const decoded = spawnSync(ffmpeg, ['-v', 'error', '-i', 'pipe:0', '-f', 'null', '-'], { input: bytes, timeout: 10000 });
    assert.equal(decoded.status, 0);
    const malformed = await fetch(`${base}/api/santa-message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '../escape' }),
    });
    assert.equal(malformed.status, 400);
    const postNames = await fetch(`${base}/api/santa-names`, { method: 'POST' });
    assert.equal(postNames.status, 405);
    assert.equal((await fetch(`${base}/api/santa-names?q=${'x'.repeat(81)}`)).status, 400);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
