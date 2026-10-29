import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'vite';
import publicPage from '../api/public-page.js';
import { resolvePublicRequest } from '../src/seo/routes.js';
import { songs, mugs, songPath, mugPath, mugAliases, ORIGIN } from '../src/seo/catalogue.js';
import { parseMusicRows } from './import-music-catalogue.js';

// These small source CSVs have no quoted/multiline cells; reject schema drift
// rather than silently misreading a future export.
async function csv(path, expectedHeader) {
  const [header, ...lines] = (await readFile(path, 'utf8')).trim().split(/\r?\n/);
  assert.equal(header, expectedHeader);
  return lines.map(line => {
    const cells = line.split(',');
    assert.equal(cells.length, header.split(',').length, path);
    assert.ok(!line.includes('"'), 'Quoted CSV needs a proper parser');
    return cells;
  });
}
const exported = await csv('attached_assets/Table_1793271000630.csv', 'URL,Last crawled');
const cases = (await csv('docs/search-console-duplicate-links.csv',
  'URL,Last crawled,Classification,Live baseline,Destination,Artist,Title'))
  .map(([raw, crawled, kind, baseline, target, artist, title]) => ({ raw, crawled, kind, baseline, target, artist, title }));
const invalid = [
  '/santa-messages/christmas-artist/unknown',
  '/santa-messages/christmas-artist/413-wrong-artist-i-saw-mommy-kissing-santa-claus',
  '/santa-messages/christmas-artist/413',
  '/santa-messages/christmas-artist/12-pogues-fairytale-of-new-york',
  '/santa-messages/christmas-artist/422-r-kelly-world-christmas',
  '/santa-messages/christmas-artist/482-on-ember-ft-blend-on-ember',
  '/santa-messages/christmas-karaoke-lyrics/137-nat-king-cole-frosty-the-snowman',
  '/santa-messages/christmas-artist/120-james-brown-the-christmas-song',
  '/santa-messages/christmas-artist/mugshots/unknown',
  '/santa-messages/christmas-artist/mugshots/everal-a-walsh',
  '/santa-messages/mugshots/christmas-artist/89-the-beach-boys-bells-of-christmas',
  '/santa-messages/santa-messages/christmas-artist/180-frank-sinatra-the-first-noel',
  '/santa-messages/artist?s=12',
  '/mugshots/rob-walker-bbc-sport/unknown',
  '/mugshots/rob-walker-bbc-sport/mark-radcliffe-radio-presenter',
  '/mugshots/rob-walker-bbc-sport/all/extra',
  '/artist?s=12-pogues-fairytale-of-new-york',
  '/artist?s=93&s=12',
];
const escape = text => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }[char]));

function assertDocument(html, row) {
  const path = row.target.split('?')[0];
  const canonicals = [...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*>/g)];
  assert.equal(canonicals.length, 1, row.raw);
  assert.ok(canonicals[0][0].includes(`href="${ORIGIN}${path}"`), row.raw);
  assert.equal((html.match(/<title\b/g) || []).length, 1);
  assert.match(html, /name="robots" content="index, follow"/);
  assert.match(html, /<h1\b/);
  assert.doesNotMatch(html, /Page not found/);
  if (row.kind === 'working-name') {
    assert.ok(html.includes('Santa Message'));
    // Initial HTML must not unlock the maker or contain generated results.
    assert.ok(html.includes('Get my free Santa message'));
    assert.ok(!html.includes('class="message-name-label"'));
    return;
  }
  if (row.kind === 'repair-gallery') {
    assert.ok(html.includes('Mug Shots'));
    assert.ok(html.includes('/mugshots/rob-walker-bbc-sport'));
    return;
  }
  const song = songs.find(s => songPath(s) === path || songPath(s).replace('/christmas-artist/', '/christmas-karaoke-lyrics/') === path);
  const mug = mugs.find(m => mugPath(m) === path);
  assert.equal((song || mug)?.artist, row.artist, row.target);
  assert.ok(html.includes(escape(row.artist)), row.target);
  if (song) {
    assert.equal(song.song, row.title);
    assert.ok(html.includes(escape(song.song)));
    assert.ok(song.lyrics.length > 20);
    assert.ok(html.includes(escape(song.lyrics)), 'Real initial lyrics');
    if (!path.startsWith('/christmas-karaoke-lyrics/'))
      assert.ok(html.includes(escape(song.info)), 'Real initial biography');
  } else {
    assert.ok(mug.info.length > 20);
    assert.ok(html.includes(escape(mug.info)), 'Real initial profile');
  }
}

test('all three exports and the independent 32-row disposition are accounted for', async () => {
  assert.equal(cases.length, 32);
  assert.deepEqual(cases.map(row => [row.raw, row.crawled]), exported);
  assert.equal(new Set(cases.map(row => row.raw)).size, 32);
  assert.equal(cases.filter(row => row.kind === 'working-name').length, 14);
  assert.equal(cases.filter(row => row.kind === 'working-song').length, 1);
  assert.equal(cases.filter(row => row.kind.startsWith('repair-')).length, 17);
  assert.equal(cases.filter(row => row.baseline === '404').length, 17);
  assert.deepEqual(await csv('attached_assets/Metadata_1793271000629.csv', 'Property,Value'), [
    ['Sitemap', 'All known pages'], ['Issue', 'Duplicate without user-selected canonical'],
  ]);
  const chart = await csv('attached_assets/Chart_1793271000629.csv', 'Date,Affected pages');
  assert.equal(chart.length, 80);
  assert.deepEqual(chart[0], ['2026-08-05', '22']);
  assert.deepEqual(chart.at(-1), ['2026-10-23', '32']);
  assert.equal(Math.max(...chart.map(row => Number(row[1]))), 36);
  assert.equal(cases.map(row => row.crawled).sort()[0], '2018-12-29');
});

test('full source identities corroborate every song, profile alias and gallery destination', async () => {
  const sql = parseMusicRows(await readFile('attached_assets/cl57-thesongs_1791303552293.sql', 'utf8'));
  const sitemap = execFileSync('unzip', ['-p', 'attached_assets/Public_Folder_Santa_Radio_PHP_Files_1774459903533.zip', 'sitemap.xml'], { encoding: 'utf8' });
  const normalize = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const row of cases.filter(row => row.title)) {
    const sourcePath = new URL(row.raw).pathname.replace(/^\/santa-messages(?:\/mugshots)?/, '');
    assert.ok(sitemap.includes(`<loc>${ORIGIN}${sourcePath}</loc>`), sourcePath);
    assert.equal(sql.filter(source => source[1] === row.title && source[2] === row.artist).length, 1);
    // Full artist/title suffix independently agrees, not just its numeric prefix.
    assert.equal(normalize(sourcePath.replace(/^\/[^/]+\/\d+-/, '')), normalize(row.artist + row.title));
  }
  for (const slug of ['jeff-mostyn-bournemouth-fc-chairman', 'mark-radcliffe-radio-presenter', 'everal-a-walsh', 'all'])
    assert.ok(sitemap.includes(`<loc>${ORIGIN}/mugshots/${slug}</loc>`), slug);
  assert.equal(mugAliases['everal-a-walsh'], 'everal-a-walsh-actor');
  assert.equal(mugs.find(m => m.song === 'everal-a-walsh-actor')?.link, 'Actor');
});

test('all 32 exact links resolve directly, preserve query values and stay on the request origin', () => {
  for (const row of cases) {
    for (const origin of [ORIGIN, 'https://preview.example']) {
      const source = new URL(row.raw);
      const result = resolvePublicRequest(origin + source.pathname);
      assert.deepEqual(result, { status: 308, location: row.target });
      assert.equal(new URL(result.location, origin).origin, origin);
      assert.deepEqual(resolvePublicRequest(result.location), { status: 200 }, 'No loop or alias hop');
    }
  }
  for (const path of invalid) assert.equal(resolvePublicRequest(path).status, 404, path);
  // Independent historical query namespace is unchanged.
  assert.equal(resolvePublicRequest('/artist?s=12').location, '/christmas-artist/93-bing-crosby-the-christmas-song');
});

async function checkServing(get) {
  for (const row of cases) {
    for (const method of ['GET', 'HEAD']) {
      const response = await get(row.raw, method);
      assert.equal(response.status, 308, row.raw);
      assert.equal(response.headers.get('location'), row.target);
      assert.equal(await response.text(), '');
      const final = await get(row.target, method);
      assert.equal(final.status, 200, row.target);
      assert.equal(final.headers.get('location'), null);
      assert.equal(final.headers.get('x-robots-tag'), null);
      if (method === 'GET') assertDocument(await final.text(), row);
      else assert.equal(await final.text(), '');
    }
    const source = new URL(row.raw);
    const query = '?utm_source=archive&tag=one&tag=two&next=https%3A%2F%2Fevil.example' +
      (row.kind === 'working-name' ? '&name=wrong&name=other' : '');
    const response = await get('https://preview.example' + source.pathname + query);
    assert.equal(response.status, 308);
    const location = response.headers.get('location');
    assert.ok(location.startsWith('/') && !location.startsWith('//'));
    const final = new URL(location, 'https://preview.example');
    assert.equal(final.origin, 'https://preview.example');
    assert.equal(final.pathname, new URL(row.target, ORIGIN).pathname);
    assert.equal(final.searchParams.get('utm_source'), 'archive');
    assert.deepEqual(final.searchParams.getAll('tag'), ['one', 'two']);
    assert.equal(final.searchParams.get('next'), 'https://evil.example');
    if (row.kind === 'working-name')
      assert.deepEqual(final.searchParams.getAll('name'), [new URL(row.target, ORIGIN).searchParams.get('name')]);
    const destination = await get(location);
    assert.equal(destination.status, 200);
    assertDocument(await destination.text(), row);
  }
  for (const path of invalid) {
    for (const method of ['GET', 'HEAD']) {
      const response = await get(path, method);
      assert.equal(response.status, 404, path);
      assert.equal(response.headers.get('location'), null);
      assert.match(response.headers.get('x-robots-tag'), /noindex/);
      if (method === 'GET') assert.match(await response.text(), /<h1[^>]*>[\s\S]*?(?:404|not found)/i);
      else assert.equal(await response.text(), '');
    }
  }
}

test('32-row report through Vercel ordered routing and the compiled document handler', async () => {
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  await checkServing(async (raw, method = 'GET') => {
    const url = new URL(raw, ORIGIN);
    // Model the actual first matching Vercel rewrite, including the catch-all
    // needed by /santa-messages. Do not bypass config by inventing __sr_route.
    const route = config.routes.find(route => route.dest && route.src && new RegExp(`^${route.src}$`).test(url.pathname));
    assert.ok(route, url.pathname);
    const rewritten = url.pathname.replace(new RegExp(`^${route.src}$`), route.dest);
    assert.ok(rewritten.startsWith('/api/public-page?'));
    const response = {
      headers: new Headers(),
      setHeader(key, value) { this.headers.set(key, value); },
      status(code) { this.code = code; return this; },
      end(body) { this.body = body; },
    };
    await publicPage({ method, url: rewritten + (url.search ? '&' + url.search.slice(1) : '') }, response);
    return new Response(response.body, { status: response.code, headers: response.headers });
  });
});

test('32-row report through development SSR', { timeout: 120000 }, async t => {
  const server = await createServer({ server: { port: 0, host: '127.0.0.1' } });
  t.after(() => server.close());
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  await checkServing((raw, method = 'GET') => {
    const url = new URL(raw, ORIGIN);
    return fetch(base + url.pathname + url.search, { method, redirect: 'manual' });
  });
});

test('32-row report through compiled Node serving', { timeout: 120000 }, async t => {
  const child = spawn(process.execPath, ['index.js', '--port=0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill('SIGTERM'));
  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Built Node server did not start')), 15000);
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Built Node server exited: ${code}`)); });
    child.stdout.on('data', data => {
      const match = data.toString().match(/listening on port (\d+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
    child.stderr.on('data', data => process.stderr.write(data));
  });
  await checkServing((raw, method = 'GET') => {
    const url = new URL(raw, ORIGIN);
    return fetch(`http://127.0.0.1:${port}${url.pathname}${url.search}`, { method, redirect: 'manual' });
  });
});
