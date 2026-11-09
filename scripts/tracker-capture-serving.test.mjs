import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { resolvePublicRequest, canonicalPaths } from '../src/seo/routes.js';
import publicPage from '../api/public-page.js';

function assertCapture(html) {
  const root = html.split('<div id="root">')[1]?.split('<noscript>')[0];
  assert.ok(root?.includes('tracker-capture'), 'capture composition, not homepage fallback');
  assert.match(html, /<title[^>]*>Santa Tracker Map \| Santa Radio<\/title>/);
  assert.match(html, /name="robots" content="noindex, follow"/);
  assert.doesNotMatch(root, /class="(?:navbar|radio-dock)|<footer|tracker-heading|tracker-stage-stats|tracker-questions/);
  assert.doesNotMatch(html, /rel="canonical" href="https:\/\/www.santaradio.co.uk\/"/);
  assert.ok(root.includes('Loading Santa Tracker'), 'deterministic SSR skeleton; client supplies actual time');
}

test('capture resolver is noindex, query-safe and preserves ordinary route policy', () => {
  assert.deepEqual(resolvePublicRequest('/styt?capture=1'), { status: 200, noindex: true });
  assert.deepEqual(resolvePublicRequest('/styt/?capture=1'), { status: 308, location: '/styt?capture=1' });
  assert.equal(resolvePublicRequest('/styt/not-real').status, 404);
  assert.equal(resolvePublicRequest('/santa-tracker').status, 200);
  assert.ok(!canonicalPaths.includes('/styt'), 'capture route is not advertised in sitemap');
});

test('built capture entry and function documents contain only the clean capture composition', async () => {
  for (const file of ['dist/styt/index.html', 'dist/server/pages/styt/index.html']) {
    assertCapture(await readFile(file, 'utf8'));
  }
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  const route = config.routes.find(route => route.src && new RegExp(`^${route.src}$`).test('/styt') && route.dest);
  assert.equal(route.dest, '/api/public-page?__sr_route=/$1$2');
});

test('Vercel handler serves direct GET, HEAD and trailing-slash capture requests', async () => {
  for (const method of ['GET', 'HEAD']) {
    const response = { headers: {}, setHeader(key, value) { this.headers[key] = value; },
      status(value) { this.code = value; return this; }, end(body) { this.body = body; } };
    await publicPage({ method, url: '/api/public-page?__sr_route=/styt&capture=1' }, response);
    assert.equal(response.code, 200);
    assert.equal(response.headers['X-Robots-Tag'], 'noindex, follow');
    if (method === 'GET') {
      assertCapture(response.body);
      assert.equal(response.headers['X-Santa-Page-Mode'], 'dynamic-tracker');
    } else assert.equal(response.body, undefined);
  }
  const response = { setHeader(key, value) { this[key] = value; },
    status(value) { this.code = value; return this; }, end() {} };
  await publicPage({ method: 'GET', url: '/api/public-page?__sr_route=/styt/' }, response);
  assert.equal(response.code, 308);
  assert.equal(response.Location, '/styt');
});

test('actual Node server delivers direct capture HTML, assets and ordinary shell', async t => {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const child = spawn(process.execPath, ['index.js', `--port=${port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill('SIGTERM'));
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Node server did not start')), 15000);
    child.stdout.on('data', chunk => { if (chunk.toString().includes('listening')) { clearTimeout(timeout); resolve(); } });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Node exited ${code}`)); });
  });
  const base = `http://127.0.0.1:${port}`;
  const response = await fetch(`${base}/styt`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow');
  const html = await response.text();
  assertCapture(html);
  for (const asset of [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(match => match[1])) {
    assert.equal((await fetch(base + asset)).status, 200, asset);
  }
  for (const asset of ['santa-holiday.png', 'santa-holiday-front.png', 'santa-route-scout.png', 'santa-sleigh.png', 'santa-sleigh-left.png']) {
    const artwork = await fetch(`${base}/images/tracker/${asset}`);
    assert.equal(artwork.status, 200, asset);
    assert.equal(artwork.headers.get('content-type'), 'image/png', asset);
  }
  const ordinary = await fetch(`${base}/privacy-policy`);
  const body = await ordinary.text();
  assert.match(body, /<footer/);
  assert.match(body, /class="navbar/);
  assert.doesNotMatch(body, /tracker-capture/);
});
