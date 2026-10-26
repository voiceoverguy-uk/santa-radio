import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, copyFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import { createNameLibrary, NAMES_INDEX, NAMES_ROOT, filenameId } from '../server/santa-name-library.js';
import { createSantaMessageHandler } from '../server/santa-message.js';
import { createSantaNamesHandler } from '../server/santa-names.js';

const php = process.env.PHP_BINARY || 'php';
const phpAvailable = spawnSync(php, ['-v']).status === 0;

for (const file of ['Demrie.wav', 'Demrie.MP3', 'Mary Jane.MP3', 'Seán.mp3', 'Sea\u0301n.mp3',
  "O'Conner.mp3", 'O’Conner.mp3', 'ana_kayla.mp3', 'ana-kayla.mp3', 'Dixie3.WaV']) test(`fixture ${file} is fetched only for creation and mixed into the greeting`, { timeout: 30000 }, async t => {
  const format = file.slice(-3);
  const id = filenameId(file);
  const name = file.slice(0, -4);
  let downloads = 0;
  let nameBytes = await readFile('server/santa-audio/names/erin.wav');
  if (format.toLowerCase() === 'mp3') {
    const encoded = spawnSync(ffmpeg, ['-v', 'error', '-i', 'pipe:0', '-c:a', 'libmp3lame',
      '-threads', '1', '-f', 'mp3', 'pipe:1'], { input: nameBytes, timeout: 10000 });
    assert.equal(encoded.status, 0);
    nameBytes = encoded.stdout;
  }
  let indexBytes = JSON.stringify({ version: 2, names: [{ id, name, file }] });
  if (phpAvailable) {
    const directory = await mkdtemp(join(tmpdir(), 'santa-roundtrip-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    await copyFile('public/downloads/names-index.php', join(directory, 'names-index.php'));
    await writeFile(join(directory, file), nameBytes);
    const result = spawnSync(php, ['-n', '-r', '$_SERVER["REQUEST_METHOD"]="GET";require $argv[1];',
      join(directory, 'names-index.php')], { timeout: 10000 });
    assert.equal(result.status, 0, result.stderr.toString());
    indexBytes = result.stdout;
  } else {
    t.diagnostic('PHP unavailable: hand-built inventory fixture; PHP execution is covered separately when configured.');
  }
  const library = createNameLibrary({ fetcher: async url => {
    if (url === NAMES_INDEX) return new Response(indexBytes);
    assert.equal(url, `${NAMES_ROOT}${encodeURIComponent(file)}`);
    downloads++;
    return new Response(nameBytes);
  } });
  // Never use the configured external publisher during a rendering fixture.
  const message = createSantaMessageHandler(library, {
    prepare: async () => null, publish: async () => assert.fail('No live publishing in tests'),
    singleFlight: (_, work) => work(),
  }), names = createSantaNamesHandler(library);
  const server = createServer((req, res) => req.url.startsWith('/api/santa-names') ? names(req, res) : message(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const results = await fetch(`${base}/api/santa-names?q=${encodeURIComponent(name)}`);
    assert.equal((await results.json()).records[0].name.toLocaleLowerCase('en-GB'), name.toLocaleLowerCase('en-GB'));
    assert.equal(downloads, 0);
    const response = await fetch(`${base}/api/santa-message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: id, outro: 2 }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'audio/mpeg');
    assert.ok(response.headers.get('content-disposition').includes('filename*=UTF-8'));
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(downloads, 1);
    const decode = input => spawnSync(ffmpeg, ['-v', 'error', '-i', 'pipe:0',
      '-ar', '44100', '-ac', '2', '-f', 'f32le', '-'],
    { input, timeout: 10000, maxBuffer: 40 * 1024 * 1024 });
    const decoded = decode(bytes);
    assert.equal(decoded.status, 0);
    const sources = await Promise.all(['free-intro.mp3', 'free-outro-2.mp3']
      .map(file => readFile(`server/santa-audio/${file}`)));
    const expectedFrames = [...sources, nameBytes].reduce((sum, source) => {
      const result = decode(source);
      assert.equal(result.status, 0);
      return sum + result.stdout.length / 8;
    }, 0);
    // Streamed MP3 has encoder delay/end padding; it must not lose recorded
    // pauses or add the old 0.1-second-per-segment gaps (13,230 frames).
    assert.ok(Math.abs(decoded.stdout.length / 8 - expectedFrames) < 2304,
      'Hosted WAV/MP3 joins must retain the full source durations without extra gaps.');
    nameBytes = Buffer.from('<html>database error</html>');
    const failed = await fetch(`${base}/api/santa-message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: id, outro: 2 }),
    });
    assert.equal(failed.status, 503);
    assert.match((await failed.json()).error, /recording could not be loaded or mixed/);
    const malformed = await fetch(`${base}/api/santa-message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '../escape', outro: 2 }),
    });
    assert.equal(malformed.status, 400);
    const postNames = await fetch(`${base}/api/santa-names`, { method: 'POST' });
    assert.equal(postNames.status, 405);
    assert.equal((await fetch(`${base}/api/santa-names?q=${'x'.repeat(81)}`)).status, 400);
    for (const query of ['%FF', '%C3%28', '%zz']) {
      const invalid = await fetch(`${base}/api/santa-names?q=${query}`);
      assert.equal(invalid.status, 400);
      assert.match((await invalid.json()).error, /malformed UTF-8 or URL encoding/);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
