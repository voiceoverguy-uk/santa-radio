import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import artworkFeedPlugin from './artwork-feed-plugin.mjs';
import * as mapping from '../src/data/artistArtwork.js';
import { buildArtworkFeed, artworkFeedPath } from '../server/artwork-feed.js';
import { songPortraits } from '../src/data/songArtwork.js';

test('development serves the production contract and hashes, and refreshes edited song assignments without restart', async () => {
  // Isolate edit tests: never alter the user's running website mappings.
  const root = await mkdtemp(join(tmpdir(), 'artwork-feed-'));
  let server;
  try {
    await mkdir(join(root, 'src/data'), { recursive: true });
    for (const name of ['artistArtwork.js', 'songArtwork.js', 'matchLiveSong.js', 'songs.json']) {
      await writeFile(join(root, 'src/data', name), await readFile(`src/data/${name}`));
    }
    server = await createServer({
      configFile: false, root, publicDir: resolve('public'), plugins: [artworkFeedPlugin()],
      server: { host: '127.0.0.1', port: 0 },
    });
    await server.listen();
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    const response = await fetch(new URL(artworkFeedPath, base));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
    assert.equal(response.headers.get('cache-control'), 'no-cache');
    const feed = await response.json();
    assert.deepEqual(feed, await buildArtworkFeed(mapping));
    const images = [feed.fallback, ...Object.values(feed.artists),
      ...Object.values(feed.recordings).map(recording => recording.image)];
    for (const image of new Map(images.map(image => [image.url, image])).values()) {
      const served = await fetch(new URL(image.url, base));
      assert.equal(served.status, 200, image.path);
      assert.equal(served.headers.get('content-type'), 'image/webp');
      assert.equal(served.headers.get('access-control-allow-origin'), '*');
      assert.equal(served.headers.get('cache-control'), 'no-cache');
      const bytes = Buffer.from(await served.arrayBuffer());
      assert.equal(createHash('sha256').update(bytes).digest('hex'), image.version);
      assert.deepEqual(bytes, await readFile(`public${image.path}`));
    }
    for (const method of ['HEAD', 'OPTIONS']) {
      const result = await fetch(new URL(artworkFeedPath, base), { method });
      assert.equal(result.status, method === 'HEAD' ? 200 : 204);
      assert.equal(await result.text(), '');
    }
    assert.equal((await fetch(new URL(artworkFeedPath, base), { method: 'POST' })).status, 405);
    const source = await readFile('src/data/songArtwork.js', 'utf8');
    await writeFile(join(root, 'src/data/songArtwork.js'),
      source.replace(songPortraits[75].path, songPortraits[527].path));
    let changed;
    for (let attempt = 0; attempt < 50; attempt++) {
      changed = await (await fetch(new URL(artworkFeedPath, base))).json();
      if (changed.version !== feed.version) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(changed.recordings['75'].image.path, songPortraits[527].path);
    assert.notEqual(changed.version, feed.version);
    assert.deepEqual(changed.artists, feed.artists);
    assert.deepEqual(changed.recordings['527'], feed.recordings['527']);
  } finally {
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
});
