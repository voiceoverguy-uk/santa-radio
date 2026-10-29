import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'vite';
import publicPage from '../api/public-page.js';
import { resolvePublicRequest } from '../src/seo/routes.js';
import { songs, mugs, songPath, mugPath, ORIGIN } from '../src/seo/catalogue.js';
import { canonicalPaths } from '../src/seo/routes.js';
import { sitemap } from '../server/public-html.js';
import { parseMusicRows } from './import-music-catalogue.js';
import { repair } from './import-mugshots.js';

// RFC-style quoted fields are essential: Peggy Lee's two original URLs contain
// commas. Parse as data, never split CSV on commas or execute the retained SQL.
function csv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n')) {
      row.push(field.replace(/\r$/, '')); field = '';
      if (c === '\n') { rows.push(row); row = []; }
    } else field += c;
  }
  assert.equal(quoted, false, 'Unclosed CSV quote');
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  const [header, ...data] = rows;
  return data.map(cells => {
    assert.equal(cells.length, header.length);
    return Object.fromEntries(header.map((key, i) => [key, cells[i]]));
  });
}
const archive = 'attached_assets/Not_found_(404)_1793271072351.zip';
const member = name => {
  // Read only the three named CSV members; do not extract over the workspace or
  // read __MACOSX resource forks. Bounded output also rejects oversized exports.
  return execFileSync('unzip', ['-p', archive, `Not found (404)/${name}.csv`], { encoding: 'utf8', maxBuffer: 100000 });
};
const exported = csv(member('Table'));
const chart = csv(member('Chart'));
const metadata = csv(member('Metadata'));
const cases = csv(await readFile('docs/search-console-missing-links.csv', 'utf8')).map(row => ({
  raw: row.URL, crawled: row['Last crawled'], baseline: row.Baseline,
  outcome: row.Outcome, target: row.Destination, artist: row.Artist, title: row.Title, evidence: row.Evidence,
}));
const invalid = [
  '/christmas-song-lyrics', '/christmas-song-lyrics?s=', '/christmas-song-lyrics?s=100',
  '/christmas-song-lyrics?s=100-the-carpenters-sleigh-ride&s=100-the-carpenters-sleigh-ride',
  '/christmas-song-lyrics?s=100-the-carpenters-sleigh-ride&s=333-michael-buble-silver-bells',
  '/christmas-song-lyrics?s=333-the-carpenters-sleigh-ride',
  '/christmas-song-lyrics?s=999-michael-buble-silver-bells',
  '/christmas-song-lyrics?s=2-wham-last-christmas',
  '/christmas-song-lyrics?s=https%3A%2F%2Fevil.example',
  '/christmas-artist/549-wrong-band-christmas-isn’t-christmas',
  '/christmas-artist/2-wham!!!-last-christmas',
  '/christmas-artist/422-r-kelly-world-christmas',
  '/christmas-artist/482-on-ember-ft-blend-on-ember',
  '/messages/mugshots/unknown', '/messages/mugshots/chris-ramsey-comedian',
  '/mugshots/rob-walker-bbc-sport/unknown',
  '/mugshots/rob-walker-bbc-sport/bez-singer',
  '/santa-messages/christmas-artist/104-wrong-artist-white-christmas',
  '/santa-messages/christmas-artist/104',
  '/santa-messages/christmas-artist/333-michael-buble-silver-bells',
  '/santa-messages/Hermione/extra', '/santa-messages/%3Cscript%3E',
  '/santa-messages/Bradley?name=Chase',
];
const escape = text => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }[c]));
const songFor = target => songs.find(s => songPath(s) === target || songPath(s).replace('/christmas-artist/', '/christmas-karaoke-lyrics/') === target);

function assertDocument(html, row) {
  const canonical = [...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*>/g)];
  assert.equal(canonical.length, 1, row.raw);
  assert.ok(canonical[0][0].includes(`href="${ORIGIN}${row.target}"`), row.target);
  assert.equal((html.match(/<title\b/g) || []).length, 1);
  assert.match(html, /name="robots" content="index, follow"/);
  assert.match(html, /<h1\b/);
  assert.doesNotMatch(html, /Page not found/);
  const song = songFor(row.target);
  const mug = mugs.find(m => mugPath(m) === row.target);
  if (song || mug) {
    const entity = song || mug;
    assert.equal(entity.artist, row.artist);
    assert.ok(html.includes(escape(row.artist)), row.target);
    if (song) {
      assert.equal(song.song, row.title);
      assert.ok(html.includes(escape(row.title)), row.target);
      assert.ok(html.includes(escape(song.lyrics)), 'Initial lyrics');
      if (row.outcome === 'redirect-artist') assert.ok(html.includes(escape(song.info)), 'Initial artist biography');
    } else {
      assert.ok(html.includes(escape(mug.info)), 'Initial person biography');
      assert.ok(html.includes(mug.image), 'Correct mug photograph');
    }
  } else if (row.outcome === 'redirect-apps') {
    for (const text of ['Santa Radio App', 'Santa Messages', 'Santa Dash', 'id1021183593']) assert.ok(html.includes(text));
  } else {
    assert.equal(row.outcome, 'redirect-tunein');
    assert.ok(html.includes('Santa Radio on TuneIn'));
    assert.ok(html.includes('https://tunein.com/radio/Santa-Radio-s252505/'));
    assert.ok(!html.includes('<iframe'), 'Redirect must not bypass media consent');
  }
}

test('all three original CSV members and all 64 exact examples remain accounted for', () => {
  assert.equal(cases.length, 64);
  assert.equal(new Set(cases.map(r => r.raw)).size, 64);
  assert.deepEqual(cases.map(r => ({ URL: r.raw, 'Last crawled': r.crawled })), exported);
  assert.deepEqual(metadata, [{ Property: 'Sitemap', Value: 'All known pages' }, { Property: 'Issue', Value: 'Not found (404)' }]);
  assert.equal(chart.find(r => r.Date === '2026-10-05')['Affected pages'], '25');
  for (const day of ['20', '21', '22', '23']) assert.equal(chart.find(r => r.Date === `2026-10-${day}`)['Affected pages'], '64');
  assert.equal(cases.filter(r => r.target).length, 42);
  assert.equal(cases.filter(r => r.outcome === 'retain-404').length, 15);
  assert.equal(cases.filter(r => r.outcome === 'owner-decision').length, 7);
  assert.ok(cases.every(r => r.baseline === '404' && r.evidence));
  assert.ok(cases.some(r => r.raw.startsWith('http://santaradio.co.uk/')));
});

test('destinations are full retained identities; original SQL supports music, with one expanded artist credit', async () => {
  const sql = parseMusicRows(await readFile('attached_assets/cl57-thesongs_1791303552293.sql', 'utf8'));
  const normalize = s => repair(s).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  for (const row of cases.filter(r => r.target)) {
    const song = songFor(row.target);
    if (song) {
      assert.equal(song.artist, row.artist);
      assert.equal(song.song, row.title);
      // The original SQL abbreviates Cerys Matthews, while the retained current
      // catalogue expands her name. Neither numeric IDs nor punctuation alone
      // establish the artist. Keep this one documented credit equivalence.
      const artist = row.artist === 'Tom Jones & Cerys Matthews' ? 'Tom Jones & C Matthews' : row.artist;
      assert.equal(sql.filter(r => normalize(r[1]) === normalize(row.title) && normalize(r[2]) === normalize(artist)).length, 1, row.raw);
      assert.equal(row.target.startsWith('/christmas-karaoke-lyrics/'), row.outcome === 'redirect-lyrics');
    } else if (row.outcome === 'redirect-profile') {
      assert.equal(mugs.find(m => mugPath(m) === row.target)?.artist, row.artist);
    }
  }
  // Retained public profile is evidence the planning snapshot missed.
  assert.equal(mugs.find(m => m.song === 'liesl-radio-presenter')?.artist, 'Liesl Soards');
  const rawMugs = JSON.parse(await readFile('src/data/mugshots.json', 'utf8'));
  for (const slug of ['chris-ramsey-comedian', 'wesley-nelson-reality-star']) {
    assert.ok(rawMugs.find(m => m.song === slug));
    assert.ok(!mugs.find(m => m.song === slug), 'Do not restore a biography-free source row');
  }
  const php = name => execFileSync('unzip', ['-p', 'attached_assets/Public_Folder_Santa_Radio_PHP_Files_1774459903533.zip', name], { encoding: 'utf8' });
  assert.ok(php('newmenu.php').includes('https://www.santaradio.co.uk/free-christmas-apps'));
  assert.ok(php('live.php').includes('id1021183593'));
  assert.ok(php('tunein.php').includes('https://tunein.com/embed/player/s252505/'));
});

test('shared resolver gives one relative permanent hop or a deliberate genuine error for every row', () => {
  for (const row of cases) {
    assert.deepEqual(resolvePublicRequest(row.raw), row.target ? { status: 308, location: row.target } : { status: 404 }, row.raw);
    if (row.target) {
      assert.deepEqual(resolvePublicRequest(row.target), { status: 200 });
      assert.ok(canonicalPaths.includes(row.target));
      assert.equal(new URL(row.target, 'https://preview.example').origin, 'https://preview.example');
    }
    assert.ok(!sitemap().includes(`<loc>${row.raw}</loc>`));
  }
  for (const path of invalid) assert.equal(resolvePublicRequest(path).status, 404, path);
});

async function checkServing(get) {
  for (const row of cases) {
    for (const method of ['GET', 'HEAD']) {
      const response = await get(row.raw, method);
      assert.equal(response.status, row.target ? 308 : 404, row.raw);
      assert.equal(response.headers.get('location'), row.target || null, row.raw);
      if (method === 'HEAD') assert.equal(await response.text(), '');
      else if (!row.target) {
        assert.match(response.headers.get('x-robots-tag'), /noindex/);
        assert.match(await response.text(), /<h1[^>]*>[\s\S]*?(?:404|not found)/i);
      }
    }
    if (!row.target) continue;
    const destination = await get(new URL(row.target, row.raw).href);
    assert.equal(destination.status, 200, row.target);
    assert.equal(destination.headers.get('location'), null);
    assert.equal(destination.headers.get('x-robots-tag'), null);
    assertDocument(await destination.text(), row);
    const head = await get(row.target, 'HEAD');
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    const url = new URL(row.raw);
    url.searchParams.set('utm_source', 'archive');
    url.searchParams.append('tag', 'one');
    url.searchParams.append('tag', 'two');
    url.searchParams.set('next', 'https://evil.example');
    const queryResponse = await get(url.href);
    const expected = row.target + '?utm_source=archive&tag=one&tag=two&next=https%3A%2F%2Fevil.example';
    assert.equal(queryResponse.headers.get('location'), expected, row.raw);
    assertDocument(await (await get(expected)).text(), row);
    // Encoded punctuation is the same exact path identity, not another slug.
    if (url.pathname.includes('&')) {
      const encoded = await get(url.pathname.replaceAll('&', '%26'));
      assert.equal(encoded.headers.get('location'), row.target);
    }
  }
  for (const path of invalid) {
    for (const method of ['GET', 'HEAD']) {
      const response = await get(path, method);
      assert.equal(response.status, 404, path);
      assert.equal(response.headers.get('location'), null);
      assert.match(response.headers.get('x-robots-tag'), /noindex/);
      if (method === 'HEAD') assert.equal(await response.text(), '');
    }
  }
  // Existing, independently proven name route still validates and prefills only
  // a request; it must not unlock adult access, promise a recording or make audio.
  const named = await get('/personalised-santa-message/Hermione?name=Chase&utm_source=archive');
  assert.equal(named.headers.get('location'), '/free-santa-message?name=Hermione&utm_source=archive');
  const maker = await get(named.headers.get('location'));
  assert.equal(maker.status, 200);
  const html = await maker.text();
  assert.ok(html.includes(`rel="canonical" href="${ORIGIN}/free-santa-message"`));
  assert.ok(html.includes('Get my free Santa message'));
  assert.ok(!html.includes('class="message-name-label"'));
  assert.equal((await get('/personalised-santa-message/%3Cscript%3E')).status, 404);
}

test('64-row report through ordered Vercel rewrites and compiled document handler', { timeout: 120000 }, async () => {
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  await checkServing(async (raw, method = 'GET') => {
    const url = new URL(raw, ORIGIN);
    const route = config.routes.find(r => r.src && r.dest && new RegExp(`^${r.src}$`).test(url.pathname));
    assert.ok(route, url.pathname);
    const rewritten = url.pathname.replace(new RegExp(`^${route.src}$`), route.dest);
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

test('64-row report through development SSR', { timeout: 180000 }, async t => {
  const server = await createServer({ server: { port: 0, host: '127.0.0.1' } });
  t.after(() => server.close());
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  await checkServing((raw, method = 'GET') => {
    const url = new URL(raw, ORIGIN);
    return fetch(base + url.pathname + url.search, { method, redirect: 'manual' });
  });
});

test('64-row report through compiled Node serving', { timeout: 120000 }, async t => {
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
