import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { createFreeBellsAudition, freeBellsAuditionPath as path } from '../server/free-bells-audition.js';

async function withServer(options, action) {
  const middleware = createFreeBellsAudition(options);
  const server = createServer((req, res) => middleware(req, res, () => res.writeHead(404).end()));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await action(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }); }
}

test('free audition is unavailable outside explicit development mode', async () => {
  const previous = process.env.NODE_ENV;
  try {
    for (const environment of ['development', 'production', 'test']) {
      process.env.NODE_ENV = environment;
      for (const development of [true, false]) {
        if (development && environment === 'development') continue;
        await withServer({ development, render: () => assert.fail('No render outside development') }, async base => {
          assert.equal((await fetch(base + path)).status, 404);
        });
      }
    }
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test('one temporary controlled example: no preload, token allowlist, ranges, expiry and no archive', async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  let calls = 0;
  try {
    await withServer({ development: true, lifetimeMs: 300, render: async () => {
      calls++;
      return Buffer.from('controlled-example');
    } }, async base => {
      const response = await fetch(base + path);
      assert.match(response.headers.get('cache-control'), /private, no-store/);
      assert.match(response.headers.get('x-robots-tag'), /noindex/);
      const html = await response.text();
      assert.match(html, /preload="none"/);
      assert.doesNotMatch(html, /autoplay/);
      assert.match(html, /not human listening approval/);
      const audioPath = html.match(/src="([^"]+\.mp3)"/)[1];
      assert.equal(calls, 0);
      assert.equal((await fetch(base + path + '/wrong/arabella.mp3')).status, 404);
      assert.equal((await fetch(base + audioPath, { method: 'POST' })).status, 405);
      assert.equal((await fetch(base + audioPath, { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
      const results = await Promise.all([fetch(base + audioPath), fetch(base + audioPath)]);
      assert.equal(calls, 1);
      for (const result of results) assert.equal(await result.text(), 'controlled-example');
      const ranged = await fetch(base + audioPath, { headers: { Range: 'bytes=1-3' } });
      assert.equal(ranged.status, 206);
      assert.equal(await ranged.text(), 'ont');
      assert.equal((await fetch(base + audioPath, { headers: { Range: 'bytes=999-' } })).status, 416);
      assert.equal((await fetch(base + audioPath, { method: 'HEAD' })).status, 200);
      await delay(350);
      assert.equal((await fetch(base + audioPath)).status, 410);
      assert.equal(calls, 1, 'Expiry clears audio without silently regenerating or retaining it.');
    });
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
