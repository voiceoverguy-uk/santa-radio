import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as mapping from '../src/data/artistArtwork.js';
import { buildArtworkFeed, artworkFeedPath } from '../server/artwork-feed.js';

let server;
let base;
before(async () => {
  // Ephemeral server used only for this test, not a duplicate preview workflow.
  server = spawn(process.execPath, ['index.js', '--port=0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  base = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => { server.kill(); reject(new Error(`Production test server did not start: ${output}`)); }, 10000);
    server.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/listening on port (\d+)/);
      if (match) { clearTimeout(timeout); resolve(`http://127.0.0.1:${match[1]}`); }
    });
    server.stderr.on('data', chunk => { output += chunk; });
    server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Test server exited (${code}): ${output}`)); });
  });
});
after(async () => {
  if (server && server.exitCode === null) {
    await new Promise(resolve => { server.once('exit', resolve); server.kill(); });
  }
});

test('production build emits exactly the source-derived feed', async () => {
  const built = JSON.parse(await readFile(`dist${artworkFeedPath}`, 'utf8'));
  assert.deepEqual(built, await buildArtworkFeed(mapping));
  const response = await fetch(new URL(artworkFeedPath, base), { headers: { Origin: 'https://mobile.example.test' } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.equal(response.headers.get('cache-control'), 'no-cache');
  assert.deepEqual(await response.json(), built);
});

test('every unique served image matches the advertised hash, including fallback', async () => {
  const feed = await (await fetch(new URL(artworkFeedPath, base))).json();
  const entries = [...new Map([feed.fallback, ...Object.values(feed.artists)].map(image => [image.url, image])).values()];
  for (const image of entries) {
    const response = await fetch(new URL(image.url, base));
    assert.equal(response.status, 200, image.url);
    assert.equal(response.headers.get('content-type'), 'image/webp');
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
    assert.equal(response.headers.get('cache-control'), 'no-cache');
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(createHash('sha256').update(bytes).digest('hex'), image.version);
  }
});

test('HEAD and OPTIONS work, missing images are 404 not the HTML homepage', async () => {
  for (const path of [artworkFeedPath, '/artist-artwork/chris-kamara.webp']) {
    const head = await fetch(new URL(path, base), { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    const options = await fetch(new URL(path, base), { method: 'OPTIONS' });
    assert.equal(options.status, 204);
    assert.equal(options.headers.get('access-control-allow-origin'), '*');
  }
  const missing = await fetch(new URL('/artist-artwork/nonexistent.webp', base));
  assert.equal(missing.status, 404);
});

test('Vercel configuration includes public feed/image access and preserves asset routing', async () => {
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  const artwork = config.headers.find(item => item.source === '/artist-artwork/:path*');
  assert.equal(artwork.headers.find(header => header.key === 'Access-Control-Allow-Origin').value, '*');
  assert.equal(artwork.headers.find(header => header.key === 'Cache-Control').value, 'no-cache');
  assert.deepEqual(config.rewrites[0], { source: '/artist-artwork/:path*', destination: '/artist-artwork/:path*' });
});
