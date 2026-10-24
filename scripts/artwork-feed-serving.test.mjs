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

test('built pages and SSR share verified song images without altering other recordings', async () => {
  const { render } = await import('../dist/server/entry-server.js');
  for (const [path, artwork] of [
    ['/christmas-artist/24-mariah-carey-all-i-want-for-christmas-is-you', '/artist-artwork/mariah-carey-all-i-want-for-christmas-is-you.webp'],
    ['/christmas-artist/25-mariah-carey-oh-santa', '/artist-artwork/mariah-carey.webp'],
    ['/christmas-artist/319-michael-buble-all-i-want-for-christmas-is-you', '/artist-artwork/michael-buble.webp'],
    ['/christmas-artist/61-chris-de-burgh-a-spaceman-came-travelling', '/artist-artwork/chris-de-burgh.webp'],
    ['/christmas-artist/399-elvis-presley-blue-christmas', '/artist-artwork/elvis-presley-blue-christmas.webp'],
    ['/christmas-artist/260-elvis-presley-santa-bring-my-baby-back-to-me', '/artist-artwork/elvis-presley.webp'],
    ['/christmas-artist/116-glen-campbell-blue-christmas', '/artist-artwork/glen-campbell.webp'],
  ]) {
    const response = await fetch(new URL(path, base));
    assert.equal(response.status, 200);
    const served = await response.text();
    const ssr = render(path);
    for (const html of [served, `${ssr.head}${ssr.markup}`]) {
      assert.ok(html.includes(`src="${artwork}"`), path);
      for (const tag of ['property="og:image"', 'name="twitter:image"']) {
        assert.ok(html.includes(`${tag} content="https://www.santaradio.co.uk${artwork}"`), path);
      }
      assert.ok(html.includes(`"contentUrl":"https://www.santaradio.co.uk${artwork}"`), path);
    }
  }
  for (const path of ['/artist-artwork/elvis-presley-blue-christmas.webp',
    '/artist-artwork/mariah-carey-all-i-want-for-christmas-is-you.webp']) {
    const image = await fetch(new URL(path, base));
    assert.equal(image.status, 200);
    assert.equal(image.headers.get('content-type'), 'image/webp');
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), await readFile(`public${path}`));
  }
});

test('built Chris De Burgh delivery image matches the replacement advertised in the artist feed', async () => {
  const path = '/artist-artwork/chris-de-burgh.webp';
  const feed = await (await fetch(new URL(artworkFeedPath, base))).json();
  const response = await fetch(new URL(feed.artists['chris de burgh'].url, base));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/webp');
  const image = Buffer.from(await response.arrayBuffer());
  assert.deepEqual(image, await readFile(`public${path}`));
  assert.equal(createHash('sha256').update(image).digest('hex'), feed.artists['chris de burgh'].version);
  const catalogue = await (await fetch(new URL('/christmas-music', base))).text();
  assert.ok(catalogue.includes(`src="${path}"`));
});

test('Vercel configuration includes public feed/image access and preserves asset routing', async () => {
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  const artwork = config.routes.find(item => item.src === '/artist-artwork/(.*)');
  assert.equal(artwork.headers['Access-Control-Allow-Origin'], '*');
  assert.equal(artwork.headers['Cache-Control'], 'no-cache');
  assert.equal(artwork.continue, true);
  assert.equal(artwork.dest, undefined);
  assert.ok(config.routes.some(route => route.handle === 'filesystem'));
});
