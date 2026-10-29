import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'vite';
import publicPage from '../api/public-page.js';
import { resolvePublicRequest, legacyMatches } from '../src/seo/routes.js';
import { songs, mugs, songPath, mugPath, ORIGIN } from '../src/seo/catalogue.js';

const repairs = new Map([
  ['/artist?s=494', '/christmas-artist/494-sabrina-claudio-christmas-blues'],
  ['/artist?s=140', '/christmas-artist/140-paul-potts-ave-maria'],
  ['/artist?s=314', '/christmas-artist/314-kylie-minogue-100-degrees-feat-dannii-minogue'],
  ['/artist?s=200', '/christmas-artist/200-the-mills-brothers-i-believe-in-santa-claus'],
  ['/artist?s=450-donny-hathaway-this-christmas', '/christmas-artist/450-donny-hathaway-this-christmas'],
  ['/artist?s=84-barbra-streisand-the-christmas-song', '/christmas-artist/84-barbra-streisand-the-christmas-song'],
  ['/christmas-karaoke-lyrics/christmas-karaoke-lyrics/369-dean-martin-let-it-snow-let-it-snow-let-it-snow', '/christmas-karaoke-lyrics/369-dean-martin-let-it-snow-let-it-snow-let-it-snow'],
  ['/christmas-karaoke-lyrics/564-laufey-santa-claus-is-comin--to-town', '/christmas-karaoke-lyrics/564-laufey-santa-claus-is-comin-to-town'],
]);
const existingAliases = new Map([
  ['/christmas-karaoke-lyrics/509-ed-sheeran-and-elton-john-merry-christmas', '/christmas-karaoke-lyrics/509-ed-sheeran-elton-john-merry-christmas'],
  ['/christmas-karaoke-lyrics/83-band-aid-do-they-know-it-s-christmas', '/christmas-karaoke-lyrics/83-band-aid-do-they-know-its-christmas'],
]);
// The export, including its original host variants, remains the input. Never
// substitute a shortened list of the eight repairs for this regression suite.
const csv = await readFile('attached_assets/Table_1793268036948.csv', 'utf8');
const [header, ...lines] = csv.trim().split(/\r?\n/);
assert.equal(header, 'URL,Last crawled');
const cases = lines.map(line => {
  const [raw, crawled] = line.split(',');
  assert.match(crawled, /^2026-\d{2}-\d{2}$/);
  const url = new URL(raw);
  const path = url.pathname + url.search;
  const target = repairs.get(path) || existingAliases.get(path) || path;
  return { raw, path, target, status: target === path ? 200 : 308 };
});
assert.equal(cases.length, 31);
assert.equal(cases.filter(row => repairs.has(row.path)).length, 8);
assert.ok(cases.some(row => row.raw === 'https://santaradio.co.uk/christmas-karaoke-lyrics/25-mariah-carey-oh-santa'));

const invalid = [
  '/artist', '/artist?s=', '/artist?s=999999', '/artist?s=450', '/artist?s=84',
  '/artist?s=212', // Current catalogue ID, not an established historical query.
  '/artist?s=3-waitresses-christmas-wrapping', // Historical 3 is Pat Benatar.
  '/artist?s=140-wrong-artist-ave-maria',
  '/artist?s=999-donny-hathaway-this-christmas',
  '/artist?s=450-barbra-streisand-the-christmas-song',
  '/artist?s=450-donny-hathaway-this-christmas-extra',
  '/artist?s=494junk', '/artist?s=-494', '/artist?s=1.4e2',
  '/artist?s=140&s=200', '/artist?s=140&s=140',
  '/artist?s=450-donny-hathaway-this-christmas&s=200',
  '/artist?s=https%3A%2F%2Fevil.example',
  '/christmas-karaoke-lyrics/christmas-karaoke-lyrics/unknown',
  '/christmas-karaoke-lyrics/564-wrong-artist-santa-claus-is-comin--to-town',
  '/christmas-karaoke-lyrics/christmas-karaoke-lyrics/christmas-karaoke-lyrics/369-dean-martin-let-it-snow-let-it-snow-let-it-snow',
];
const escape = text => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }[char]));
function assertDocument(html, target) {
  const song = songs.find(row => songPath(row) === target || `/christmas-karaoke-lyrics/${row.id}-${row.link}` === target);
  const mug = mugs.find(row => mugPath(row) === target);
  const row = song || mug;
  assert.ok(row, `Expected a real catalogue identity: ${target}`);
  assert.ok(html.includes(`rel="canonical" href="${ORIGIN}${target}"`), `${target}: canonical`);
  assert.match(html, /name="robots" content="index, follow"/);
  assert.equal((html.match(/<title\b/g) || []).length, 1);
  assert.ok(html.includes('<h1'), target);
  assert.ok(html.includes(escape(row.artist)), `${target}: performer`);
  if (song) {
    assert.ok(html.includes(escape(song.song)), `${target}: title`);
    assert.ok(song.lyrics.length > 20);
    assert.ok(html.includes(escape(song.lyrics)), `${target}: initial lyrics`);
  }
  // Sing-along pages intentionally contain lyrics, not the separate artist bio.
  if (row.info && !target.startsWith('/christmas-karaoke-lyrics/'))
    assert.ok(html.includes(escape(row.info)), `${target}: initial biography`);
  assert.doesNotMatch(html, /Page not found/);
}

test('new historical identities are supported by retained original PHP and SQL, not current IDs alone', async () => {
  // Only inspect the lookup statement, never print the old PHP's connection settings.
  const php = execFileSync('unzip', ['-p', 'attached_assets/Public_Folder_Santa_Radio_PHP_Files_1774459903533.zip', 'artist.php'], { encoding: 'utf8' });
  assert.ok(php.includes(`SELECT * FROM messages2  WHERE id = '".$_GET["s"]."'`));
  const sql = await readFile('attached_assets/cl57-thesongs_1791303552293.sql', 'utf8');
  for (const [id, title, artist] of [
    [140, 'Ave Maria', 'Paul Potts'],
    [200, 'I Believe In Santa Claus', 'The Mills Brothers'],
    [314, '100 Degrees feat Dannii Minogue', 'Kylie Minogue'],
    [494, 'Christmas Blues', 'Sabrina Claudio'],
    [450, 'This Christmas', 'Donny Hathaway'],
    [84, 'The Christmas Song', 'Barbra Streisand'],
  ]) assert.ok(sql.includes(`(${id},'${title}','${artist}',`), `Original SQL identity ${id}`);
});

test('all 31 exact export URLs resolve in one hop, preserving existing history and rejecting conflicts', () => {
  for (const { raw, target, status } of cases) {
    assert.deepEqual(resolvePublicRequest(raw), status === 308 ? { status, location: target } : { status }, raw);
    assert.deepEqual(resolvePublicRequest(target), { status: 200 }, `${raw}: no chain/loop`);
    if (status === 308) assert.equal(new URL(target, 'https://preview.example').origin, 'https://preview.example');
  }
  const originalArtists = ['Cruz Beckham', 'Ava Max', 'Pat Benatar', 'Leona Lewis', 'Dion', 'The Beach Boys', 'Kylie Minogue', 'Jason Mraz', 'Snap!', 'Mariah Carey', 'Cher', 'Bing Crosby', 'Jon Bon Jovi', 'Gladys Knight & The Pips', 'Matt Monro', 'Michael Buble', 'Sam Ryder', 'Al Green', 'Paul McCartney', 'Chuck Berry', 'John Legend', 'Bing Crosby', 'Michael Buble', 'Kylie Minogue'];
  for (const [index, artist] of originalArtists.entries()) {
    const target = resolvePublicRequest(`/artist?s=${index + 1}`).location;
    const song = songs.find(song => songPath(song) === target);
    assert.equal(song?.artist, artist, `Original historical identity ${index + 1}`);
    const legacy = legacyMatches.find(row => row.legacy.id === index + 1).legacy;
    assert.equal(song.song, index === 13 ? "When You Love Someone (It's Christmas Everyday)" : legacy.song);
  }
  for (const path of invalid) assert.equal(resolvePublicRequest(path).status, 404, path);
});

async function checkServing(get) {
  for (const { raw, path, target, status } of cases) {
    const response = await get(raw);
    assert.equal(response.status, status, raw);
    if (status === 308) assert.equal(response.headers.get('location'), target, raw);
    const destination = status === 308 ? await get(new URL(target, raw).href) : response;
    assert.equal(destination.status, 200, target);
    assert.equal(destination.headers.get('x-robots-tag'), null, target);
    assertDocument(await destination.text(), target);
    if (repairs.has(path)) {
      const head = await get(raw, 'HEAD');
      assert.equal(head.status, 308);
      assert.equal(head.headers.get('location'), target);
      assert.equal(await head.text(), '');
    }
  }
  for (const [path, target] of repairs) {
    const response = await get(`https://preview.example${path}${path.includes('?') ? '&' : '?'}utm_source=archive&next=https%3A%2F%2Fevil.example`);
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), `${target}?utm_source=archive&next=https%3A%2F%2Fevil.example`);
    assertDocument(await (await get(response.headers.get('location'))).text(), target);
  }
  for (const path of invalid) {
    const response = await get(path);
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.get('location'), null, path);
    assert.match(response.headers.get('x-robots-tag'), /noindex/);
    assert.match(await response.text(), /<h1[^>]*>[\s\S]*?(?:404|not found)/i);
  }
}

test('all exported URLs and unsafe variants work through Vercel compiled documents', async () => {
  await checkServing(async (raw, method = 'GET') => {
    const url = new URL(raw, ORIGIN);
    url.searchParams.set('__sr_route', url.pathname);
    const response = {
      headers: new Headers(),
      setHeader(key, value) { this.headers.set(key, value); },
      status(code) { this.code = code; return this; },
      end(body) { this.body = body; },
    };
    await publicPage({ method, url: '/api/public-page' + url.search }, response);
    return new Response(response.body, { status: response.code, headers: response.headers });
  });
});

test('all exported URLs and unsafe variants work in development SSR', { timeout: 120000 }, async t => {
  const server = await createServer({ server: { port: 0, host: '127.0.0.1' } });
  t.after(() => server.close());
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  await checkServing((raw, method = 'GET') => {
    const url = new URL(raw, ORIGIN);
    return fetch(base + url.pathname + url.search, { method, redirect: 'manual' });
  });
});

test('all exported URLs and unsafe variants work in the built Node server', { timeout: 120000 }, async t => {
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
