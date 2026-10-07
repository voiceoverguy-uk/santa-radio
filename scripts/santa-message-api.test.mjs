import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import handler from '../api/santa-message.js';

let server;
let base;
before(async () => {
  server = createServer(async (req, res) => {
    if (req.url === '/parsed') {
      let body = '';
      for await (const chunk of req) body += chunk;
      req.body = JSON.parse(body);
    }
    await handler(req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));

for (const route of ['/stream', '/parsed']) {
  test(`Erin creates a playable MP3 with ${route} request handling`, { timeout: 100000 }, async () => {
    const response = await fetch(`${base}${route}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'erin' }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'audio/mpeg');
    assert.match(response.headers.get('content-disposition'), /Santa-message-for-Erin\.mp3/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const audio = Buffer.from(await response.arrayBuffer());
    assert.ok(audio.length > 100000);
    const decoded = spawnSync(ffmpegPath, [
      '-v', 'error', '-i', 'pipe:0', '-f', 'null', '-',
    ], { input: audio, timeout: 30000 });
    assert.equal(decoded.status, 0, decoded.stderr?.toString());
  });
}

test('unsupported names, malformed JSON and oversized bodies return useful errors', async () => {
  for (const [body, status] of [
    ['{"name":"not-a-recorded-name"}', 400],
    ['not JSON', 400],
    [JSON.stringify({ name: 'erin', extra: 'x'.repeat(1100) }), 413],
  ]) {
    const response = await fetch(`${base}/stream`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    });
    assert.equal(response.status, status);
    assert.ok((await response.json()).error);
  }
});

test('GET is rejected by the API rather than returning website HTML', async () => {
  const response = await fetch(`${base}/stream`);
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'POST');
  assert.ok((await response.json()).error);
});
