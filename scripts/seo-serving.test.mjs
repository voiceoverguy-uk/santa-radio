import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { readFile, mkdtemp, cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import publicPage from '../api/public-page.js';
import { shareImage as radioShareImage, shareImageAlt, ORIGIN } from '../src/seo/catalogue.js';
import { assertFaviconHead, assertFaviconResponse, faviconFiles } from './favicon-checks.mjs';

test('deployment-style document package needs neither TypeScript nor runtime React package resolution', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'santa-vercel-documents-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const path of ['api/public-page.js', 'server/public-html.js', 'src/seo', 'src/data', 'dist/server', 'package.json']) {
    await cp(path, join(directory, path), {
      recursive: true,
      filter: source => !/\.(?:ts|tsx|jsx)$/.test(source),
    });
  }
  // Deliberately omit node_modules entirely: the function must ship everything
  // it needs instead of passing only because workspace packages are available.
  // Reject all runtime UI package resolution to catch Vercel's
  // CommonJS/ESM mismatches, which workspace imports alone cannot reproduce.
  const loader = 'data:text/javascript,' + encodeURIComponent(`
    import { isBuiltin } from 'node:module';
    export function resolve(specifier, context, nextResolve) {
      if (!specifier.startsWith('.') && !specifier.startsWith('/') &&
          !specifier.startsWith('file:') && !isBuiltin(specifier))
        throw new Error('UI dependencies must not be resolved by the serverless runtime: ' + specifier);
      return nextResolve(specifier, context);
    }
  `);
  const output = execFileSync(process.execPath, ['--no-experimental-strip-types', '--experimental-loader', loader, '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import handler from './api/public-page.js';
    for (const [path, status] of [
      ['/', 200], ['/apps', 200], ['/christmas-music', 200], ['/mugshots/all', 200],
      ['/mugshots/debbie-arnold-actress', 200], ['/free-santa-message', 200],
      ['/christmas-artist/3-waitresses-christmas-wrapping', 200],
      ['/santa-tracker', 200], ['/artist?s=3', 308], ['/artist?s=14', 308],
      ['/personalised-santa-message/all', 308], ['/personalised-santa-message/Cooper', 308],
      ['/spanish/mugshots/mugshots/jermaine', 404],
    ]) {
      const url = new URL(path, 'https://www.santaradio.co.uk');
      url.searchParams.set('__sr_route', url.pathname);
      const response = {
        headers: {},
        setHeader(key, value) { this.headers[key] = value; },
        status(value) { this.code = value; return this; },
        end(body) { this.body = body; },
      };
      await handler({ method: 'GET', url: '/api/public-page' + url.search }, response);
      assert.equal(response.code, status, path);
      if (status === 200) assert.ok(response.body.includes('<h1'), path);
      if (status === 200 && path !== '/santa-tracker')
        assert.equal(response.headers['X-Santa-Page-Mode'], 'prerendered', path);
    }
    console.log('Deployment-style package passed');
  `], { cwd: directory, encoding: 'utf8', timeout: 30000 });
  assert.match(output, /Deployment-style package passed/);
});

test('built Node server returns actual pages, permanent redirects, images, API responses and error statuses', async t => {
  const child = spawn(process.execPath, ['index.js', '--port=0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill('SIGTERM'));
  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Production server did not start')), 10000);
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Production server exited: ${code}`)); });
    child.stdout.on('data', data => {
      const match = data.toString().match(/listening on port (\d+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
    child.stderr.on('data', data => console.error(data.toString()));
  });
  const get = path => fetch(`http://127.0.0.1:${port}${path}`, { redirect: 'manual' });
  for (const [path, word] of [
    ['/', 'Santa Radio'], ['/christmas-music', 'Christmas Song Lyrics'],
    ['/christmas-artist/3-waitresses-christmas-wrapping', 'Artist background'],
    ['/mugshots/a1-singers', 'Bruce Davis'], ['/santa-tracker', 'Is this real GPS tracking?'],
  ]) {
    const response = await get(path); assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('x-robots-tag'), null, path);
    const html = await response.text();
    assertFaviconHead(html);
    assert.ok(html.includes(word), path); assert.ok(html.includes('<h1'), path);
    if (['/', '/christmas-music'].includes(path)) {
      const head = html.split('</head>')[0];
      for (const name of ['og:image', 'twitter:image'])
        assert.match(head, new RegExp(`(?:property|name)="${name}" content="${ORIGIN + radioShareImage}"`));
      assert.ok(head.includes(shareImageAlt));
      assert.ok(!head.includes('/images/santa-radio-share-green.jpg'));
    }
  }
  for (const [path, target] of [['/music', '/christmas-music'], ['/santa-tracker/', '/santa-tracker'], ['/artist?s=3', '/christmas-artist/420-pat-benatar-please-come-home-for-christmas'], ['/artist?s=14', '/christmas-artist/212-gladys-knight-the-pips-its-christmas-everyday'], ['/artist?s=14&utm_source=archive', '/christmas-artist/212-gladys-knight-the-pips-its-christmas-everyday?utm_source=archive']]) {
    const response = await get(path); assert.equal(response.status, 308); assert.equal(response.headers.get('location'), target);
  }
  for (const path of ['/unknown', '/christmas-artist/unknown', '/mugshots/unknown', '/images/unknown.png', '/api/unknown', '/server/entry-server.js'])
    assert.equal((await get(path)).status, 404, path);
  for (const [path, target] of [
    ['/personalised-santa-message/all', '/free-santa-message'],
    ['/personalised-santa-message/Cooper?utm_source=google', '/free-santa-message?utm_source=google&name=Cooper'],
  ]) {
    const response = await get(path);
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), target);
    const destination = await get(target);
    assert.equal(destination.status, 200);
    assert.ok((await destination.text()).includes(`rel="canonical" href="https://www.santaradio.co.uk/free-santa-message"`));
  }
  const gladys = await get('/christmas-artist/212-gladys-knight-the-pips-its-christmas-everyday');
  assert.equal(gladys.status, 200);
  assert.ok((await gladys.text()).includes('When You Love Someone'));
  const preview = await get('/santa-tracker/preview');
  assert.match(preview.headers.get('x-robots-tag'), /noindex/);
  assert.ok(!(await preview.text()).includes('application/ld+json'));
  const image = await get('/images/santa-tracker-share.png');
  assert.equal(image.status, 200); assert.equal(image.headers.get('content-type'), 'image/png');
  const bytes = Buffer.from(await image.arrayBuffer());
  assert.equal(bytes.readUInt32BE(16), 1200); assert.equal(bytes.readUInt32BE(20), 630);
  const shareImage = await get(radioShareImage);
  assert.equal(shareImage.status, 200);
  assert.equal(shareImage.headers.get('content-type'), 'image/jpeg');
  assert.deepEqual(Buffer.from(await shareImage.arrayBuffer()), await readFile(`public${radioShareImage}`));
  assert.match((await get('/mugshot-thumbnails/a1-singers-320.webp')).headers.get('content-type'), /image\/webp/);
  const artwork = await get('/artist-artwork/catalogue.json');
  assert.equal(artwork.status, 200); assert.equal(artwork.headers.get('access-control-allow-origin'), '*');
  assert.equal((await get('/api/santa-message')).status, 405);
  assert.equal((await get('/sitemap.xml')).status, 200);
  for (const [path, type] of faviconFiles) {
    const bytes = await readFile(`public${path}`);
    await assertFaviconResponse(await get(path), bytes, { type });
    await assertFaviconResponse(await fetch(`http://127.0.0.1:${port}${path}`, { method: 'HEAD', redirect: 'manual' }), bytes, { type, head: true });
  }
});

test('development SSR advertises working favicon images without document fallbacks', { timeout: 60000 }, async t => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { port: 0, host: '127.0.0.1' } });
  t.after(() => server.close());
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  for (const [path, type] of faviconFiles) {
    const bytes = await readFile(`public${path}`);
    await assertFaviconResponse(await fetch(base + path, { redirect: 'manual' }), bytes, { type });
    await assertFaviconResponse(await fetch(base + path, { method: 'HEAD', redirect: 'manual' }), bytes, { type, head: true });
  }
  for (const path of ['/', '/apps', '/santa-tracker']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-robots-tag'), null);
    assertFaviconHead(await response.text());
  }
  assert.match(await (await fetch(base + '/robots.txt')).text(), /User-agent: \*\nAllow: \//);
});

test('Vercel document handler preserves statuses, metadata and relative locations without hosting changes', async () => {
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  const filesystem = config.routes.findIndex(route => route.handle === 'filesystem');
  const documentRoute = config.routes.findIndex(route => route.src?.includes('christmas-artist'));
  assert.ok(documentRoute < filesystem);
  for (const [path] of faviconFiles) {
    // Simulate Vercel's ordered routing: each icon must reach the existing
    // filesystem file before the catch-all document function can rewrite it.
    for (const route of config.routes.slice(0, filesystem)) {
      if (!route.src || !new RegExp(`^${route.src}$`).test(path)) continue;
      assert.ok(!route.dest, `${path} must not be rewritten to a document`);
      assert.doesNotMatch(JSON.stringify(route.headers || {}), /noindex|noimageindex/i);
    }
    assert.deepEqual(await readFile(`dist${path}`), await readFile(`public${path}`));
  }
  const expression = new RegExp(`^${config.routes[documentRoute].src}$`);
  for (const path of ['/', '/christmas-music', '/artist', '/santa-tracker/', '/santa-tracker/preview', '/mugshots/a1-singers', '/personalised-santa-message/all', '/personalised-santa-message/Cooper'])
    assert.ok(expression.test(path), path);
  for (const path of ['/artist-artwork/catalogue.json', '/images/santa-tracker-share.png', '/api/santa-message'])
    assert.ok(!expression.test(path), path);
  for (const [path, status] of [['/christmas-artist/3-waitresses-christmas-wrapping', 200], ['/unknown', 404], ['/music', 308], ['/artist?s=14', 308], ['/artist?s=14&utm_source=archive', 308], ['/artist?s=999', 404], ['/santa-tracker/preview', 200]]) {
    const url = new URL(path, 'https://www.santaradio.co.uk');
    const query = new URLSearchParams(url.search);
    query.set('__sr_route', url.pathname);
    const response = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, end(body) { this.body = body; return this; } };
    await publicPage({ method: 'GET', url: `/api/public-page?${query}` }, response);
    assert.equal(response.statusCode, status, path);
    if (status === 308) assert.equal(response.headers.Location, path === '/music' ? '/christmas-music' : '/christmas-artist/212-gladys-knight-the-pips-its-christmas-everyday' + (path.includes('utm_source') ? '?utm_source=archive' : ''));
    else {
      assertFaviconHead(response.body);
      if (!path.includes('preview')) assert.ok(response.body.includes('<h1'), path);
      if (!path.includes('preview')) assert.ok(response.body.includes('www.santaradio.co.uk'), path);
    }
    if (status === 404 || path.includes('preview'))
      assert.match(response.headers['X-Robots-Tag'], /noindex/);
  }
});
