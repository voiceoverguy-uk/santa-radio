import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'vite';
import publicPage from '../api/public-page.js';
import { resolvePublicRequest, canonicalPaths } from '../src/seo/routes.js';
import { songs, mugs, songPath, mugPath, ORIGIN } from '../src/seo/catalogue.js';
import { sitemap } from '../server/public-html.js';
import { sourceCsv, exportedRows } from './audit-crawled-links.mjs';
import { parseMusicRows } from './import-music-catalogue.js';
import { repair } from './import-mugshots.js';

const cases = JSON.parse(await readFile('docs/search-console-crawled/dispositions.json', 'utf8'));
const live = JSON.parse(await readFile('docs/search-console-crawled/live.json', 'utf8'));
const liveDestinations = JSON.parse(await readFile('docs/search-console-crawled/destinations-live.json', 'utf8'));
const localUrl = raw => { const u = new URL(raw, ORIGIN); return u.pathname + u.search; };
const invalid = [
  '/artist?s=494-wrong-artist-christmas-blues',
  '/artist?s=108-extreme-christmas-time-again&s=277-bing-crosby-silver-bells',
  '/artist?s=153-x-mas-donkey-&unknown', '/artist?s=153-x-mas-donkey-',
  '/artist?s=153-x-mas-donkey-&-the-glittering-balls-at-the-christmas-ball=other',
  '/artist?s=153-x-mas-donkey-&-the-glittering-balls-at-the-christmas-ball&-the-glittering-balls-at-the-christmas-ball',
  '/artist?s=153-x-mas-donkey-%26-the-glittering-balls-at-the-christmas-ball&-the-glittering-balls-at-the-christmas-ball',
  '/artist?s=153-x-mas-donkey-&-the-glittering-balls-at-the-christmas-ball&s=153-x-mas-donkey-',
  '/mugshots/rob-walker-bbc-sport/matthew-cottle-actor',
  '/shop/product/mugshots/mugshots/rob-rinder-judge',
  '/santa-messages/mugshots/christmas-artist/christmas-karaoke-lyrics/58-wrong-saviours-day',
  '/personalised/unknown', '/christmas-artist/422',
  '/christmas-artist/549-other-song', '/christmas-artist/422-r-kelly-world-christmas',
  '//evil.example/christmas-music', '///christmas-music',
];
const escape = text => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }[char]));
function assertDocument(html, destination) {
  const path = destination.split('?')[0];
  const canonical = [...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*>/g)];
  assert.equal(canonical.length, 1, path);
  assert.ok(canonical[0][0].includes(`href="${ORIGIN}${path}"`), path);
  assert.equal((html.match(/<title\b/g) || []).length, 1, path);
  assert.match(html, /name="robots" content="index, follow"/);
  assert.doesNotMatch(html, /name="(?:robots|googlebot)" content="[^"]*noindex/);
  assert.match(html, /<h1\b/);
  assert.doesNotMatch(html, /Page not found/);
  const song = songs.find(song => [songPath(song), songPath(song).replace('/christmas-artist/', '/christmas-karaoke-lyrics/')].includes(path));
  if (song) {
    assert.ok(html.includes(escape(song.song)), path);
    assert.ok(html.includes(escape(song.artist)), path);
    assert.ok(html.includes(escape(song.lyrics.trim().split('\n').find(Boolean).trim())), path);
    assert.ok(html.includes(path.startsWith('/christmas-karaoke-lyrics/') ? 'Sing-Along Lyrics' : 'Artist background'), path);
  } else if (path.startsWith('/mugshots/') && path !== '/mugshots/all') {
    const mug = mugs.find(mug => mugPath(mug) === path);
    assert.ok(mug, path);
    assert.ok(html.includes(escape(mug.artist)), path);
    assert.ok(html.includes(mug.image), path);
    assert.ok(html.includes(escape(mug.info.trim().slice(0, 55))), path);
  } else if (path === '/free-santa-message') {
    assert.ok(html.includes('Get my free Santa message'));
    assert.ok(!html.includes('class="message-name-label"'), 'Adult gate must remain');
    assert.ok(!html.includes('santa-recorded-message-for-'), 'No generated recording');
  } else {
    assert.ok(['/', '/christmas-music'].includes(path), path);
    assert.ok(html.includes('Santa Radio'));
    if (path === '/christmas-music') assert.ok(html.includes('/christmas-artist/494-sabrina-claudio-christmas-blues'));
  }
}
test('all three archive members, 113 exact examples and live evidence are preserved', async () => {
  for (const member of ['Table', 'Chart', 'Metadata'])
    assert.equal(await readFile(`docs/search-console-crawled/${member}.csv`, 'utf8'), sourceCsv(member));
  assert.equal(cases.length, 113);
  assert.equal(new Set(cases.map(row => row.url)).size, 113);
  assert.deepEqual(cases.map(row => ({ url: row.url, lastCrawled: row.lastCrawled })), exportedRows());
  assert.deepEqual(live.map(row => ({ url: row.url, lastCrawled: row.lastCrawled })), exportedRows());
  assert.equal(live.filter(row => row.status === 200).length, 87);
  assert.equal(live.filter(row => row.status === 404).length, 19);
  assert.equal(live.filter(row => row.failure?.code === 60 && /certificate.*hostname|certificate.*host|subject name.*hostname/i.test(row.failure.message)).length, 7);
  assert.equal(cases.filter(row => row.kind === 'working-name').length, 59);
  assert.equal(cases.filter(row => row.kind === 'repair-exact').length, 11);
  assert.equal(cases.filter(row => row.kind === 'pending-404-report').length, 3);
  for (const row of cases) {
    assert.equal(row.originalHost, new URL(row.url).hostname);
    assert.ok(row.owner && row.remainingAction && row.overlaps.length);
  }
  // These were read-only HTML observations, not Google's indexability decision.
  for (const row of live.filter(row => row.status === 200)) {
    assert.deepEqual(row.html.canonical, [ORIGIN + new URL(row.finalUrl).pathname], row.url);
    assert.ok(row.html.h1.length && row.html.mainTextCharacters > 100, row.url);
    assert.ok(!row.html.robots.some(value => /noindex/i.test(value)), row.url);
    assert.ok(!row.responses.some(response => /noindex/i.test(response.robots || '')), row.url);
  }
  const liveSitemap = liveDestinations.find(row => row.url.endsWith('/sitemap.xml'));
  assert.equal(liveSitemap.status, 200);
  assert.equal(liveSitemap.entries, 1560);
  assert.ok(liveSitemap.requestedCanonicals.every(row => row.included));
  for (const row of liveDestinations.filter(row => row.html)) {
    assert.equal(row.status, 200, row.url);
    assert.equal(row.finalUrl, row.url);
    assert.deepEqual(row.html.canonical, [row.url]);
    assert.ok(row.html.h1.length && row.html.mainTextCharacters > 100, row.url);
    assert.ok(!row.html.robots.some(value => /noindex/i.test(value)), row.url);
  }
});
test('new recording/profile destinations agree with retained source identities, not numeric guesses', async () => {
  const original = parseMusicRows(await readFile('attached_assets/cl57-thesongs_1791303552293.sql', 'utf8'));
  const originalSitemap = execFileSync('unzip', ['-p', 'attached_assets/Public_Folder_Santa_Radio_PHP_Files_1774459903533.zip', 'sitemap.xml'], { encoding: 'utf8' });
  for (const id of [494, 108, 153, 277, 287, 549, 58]) {
    const row = original.find(row => +row[0] === id);
    const song = songs.find(song => song.id === id);
    assert.equal(repair(row[1]), song.song);
    assert.equal(repair(row[2]), song.artist);
    if (id !== 549) {
      const sourceSlug = id === 153 ? song.aliases[0] : `${id}-${song.link}`;
      assert.ok(originalSitemap.includes(`${ORIGIN}/christmas-artist/${sourceSlug}</loc>`), song.artist);
    }
  }
  assert.equal(songs.find(song => song.id === 549).link, 'bon-jovi-christmas-isna-tmt-christmas');
  for (const slug of ['rob-rinder-judge', 'kell-brook-boxer', 'matthew-cottle-actor'])
    assert.ok(originalSitemap.includes(`${ORIGIN}/mugshots/${slug}</loc>`), slug);
  const oldMaker = execFileSync('unzip', ['-p', 'attached_assets/Public_Folder_Santa_Radio_PHP_Files_1774459903533.zip', 'personalised.php'], { encoding: 'utf8' });
  assert.ok(oldMaker.includes('$dir = "audio-messages/"'));
  assert.ok(oldMaker.includes('/personalised-santa-message/<?php echo $newFileName ?>'));
});
test('113-row resolver audit, strict raw ampersand handling, same-origin redirects and sitemap hygiene', async () => {
  const xml = sitemap();
  assert.equal(xml, await readFile('dist/sitemap.xml', 'utf8'));
  for (const row of cases) {
    if (row.kind === 'tls-hosting-handoff') {
      assert.equal(resolvePublicRequest(row.destination).status, 200);
      assert.ok(xml.includes(`<loc>${row.canonical}</loc>`));
      continue; // Never pretend application routing fixes a certificate.
    }
    for (const raw of [localUrl(row.url), 'https://preview.example' + localUrl(row.url)]) {
      const result = resolvePublicRequest(raw);
      assert.equal(result.status, row.localStatus, row.url);
      assert.equal(result.location || null, row.localLocation, row.url);
      if (result.location) {
        assert.ok(result.location.startsWith('/') && !result.location.startsWith('//'));
        assert.equal(new URL(result.location, 'https://preview.example').origin, 'https://preview.example');
        assert.equal(resolvePublicRequest(result.location).status, 200, 'No loop/intermediate alias');
      }
    }
    if (row.destination) {
      assert.ok(xml.includes(`<loc>${row.canonical}</loc>`), row.url);
      if (row.localStatus === 308) assert.ok(!canonicalPaths.includes(localUrl(row.url)), row.url);
    } else assert.ok(!canonicalPaths.includes(localUrl(row.url)), row.url);
  }
  for (const path of invalid) assert.equal(resolvePublicRequest(path).status, 404, path);
  assert.equal(resolvePublicRequest('/artist?s=12').location, '/christmas-artist/93-bing-crosby-the-christmas-song');
  assert.equal(resolvePublicRequest('/artist?s=494').location, '/christmas-artist/494-sabrina-claudio-christmas-blues');
  assert.equal(resolvePublicRequest('/artist?s=153-x-mas-donkey-%26-the-glittering-balls-at-the-christmas-ball').location,
    '/christmas-artist/153-x-mas-donkey-the-glittering-balls-at-the-christmas-ball');
});
async function checkServing(get) {
  for (const row of cases) {
    if (row.kind === 'tls-hosting-handoff') {
      const counterpart = await get(row.destination);
      assert.equal(counterpart.status, 200);
      assertDocument(await counterpart.text(), row.destination);
      continue;
    }
    for (const method of ['GET', 'HEAD']) {
      const response = await get(localUrl(row.url), method);
      assert.equal(response.status, row.localStatus, row.url);
      assert.equal(response.headers.get('location'), row.localLocation, row.url);
      if (row.localStatus === 404) {
        if (!/\.(?:jpg|php)(?:\?|$)/.test(localUrl(row.url)))
          assert.match(response.headers.get('x-robots-tag') || '', /noindex/);
        continue; // Static missing assets/obsolete PHP need no invented document.
      }
      const destination = row.localLocation ? await get(row.localLocation, method) : response;
      assert.equal(destination.status, 200, row.url);
      assert.equal(destination.headers.get('location'), null);
      assert.equal(destination.headers.get('x-robots-tag'), null);
      if (method === 'GET') assertDocument(await destination.text(), row.destination);
      else assert.equal(await destination.text(), '');
    }
  }
  for (const row of cases.filter(row => row.localStatus === 308)) {
    const raw = localUrl(row.url);
    const response = await get(raw + (raw.includes('?') ? '&' : '?') + 'utm_source=archive&tag=one&tag=two&next=https%3A%2F%2Fevil.example');
    assert.equal(response.status, 308, raw);
    const target = new URL(response.headers.get('location'), 'https://preview.example');
    assert.equal(target.origin, 'https://preview.example');
    assert.equal(target.pathname, new URL(row.destination, ORIGIN).pathname);
    assert.equal(target.searchParams.get('utm_source'), 'archive');
    assert.deepEqual(target.searchParams.getAll('tag'), ['one', 'two']);
    assert.equal(target.searchParams.get('next'), 'https://evil.example');
    assert.equal(target.searchParams.has('s'), false);
    assert.equal(target.searchParams.has('-the-glittering-balls-at-the-christmas-ball'), false);
    if (row.kind === 'working-name') assert.equal(target.searchParams.get('name'), new URL(row.destination, ORIGIN).searchParams.get('name'));
  }
  const encoded = await get('/artist?s=153-x-mas-donkey-%26-the-glittering-balls-at-the-christmas-ball');
  assert.equal(encoded.status, 308);
  for (const path of invalid) {
    for (const method of ['GET', 'HEAD']) {
      const response = await get(path, method);
      assert.equal(response.status, 404, path);
      assert.equal(response.headers.get('location'), null);
    }
  }
}
test('113-row report through actual ordered Vercel rewrites and the document handler', async () => {
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  await checkServing(async (raw, method = 'GET') => {
    const url = new URL('https://preview.example' + raw);
    const route = config.routes.find(route => route.dest && route.src && new RegExp(`^${route.src}$`).test(url.pathname));
    assert.ok(route, raw);
    const rewritten = url.pathname.replace(new RegExp(`^${route.src}$`), route.dest);
    const response = {
      headers: new Headers(),
      setHeader(key, value) { this.headers.set(key, value); },
      status(value) { this.code = value; return this; },
      end(body) { this.body = body; },
    };
    await publicPage({ method, url: rewritten + (url.search ? '&' + url.search.slice(1) : '') }, response);
    return new Response(response.body, { status: response.code, headers: response.headers });
  });
});
test('113-row report through development serving', { timeout: 180000 }, async t => {
  const server = await createServer({ server: { port: 0, host: '127.0.0.1' } });
  t.after(() => server.close());
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  await checkServing((raw, method = 'GET') => fetch(base + raw, { method, redirect: 'manual' }));
});
test('113-row report through compiled Node serving', { timeout: 180000 }, async t => {
  const child = spawn(process.execPath, ['index.js', '--port=0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill('SIGTERM'));
  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Built Node server did not start')), 15000);
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Built server exited ${code}`)); });
    child.stdout.on('data', data => {
      const match = data.toString().match(/listening on port (\d+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
    child.stderr.on('data', data => process.stderr.write(data));
  });
  await checkServing((raw, method = 'GET') => fetch(`http://127.0.0.1:${port}${raw}`, { method, redirect: 'manual' }));
});
