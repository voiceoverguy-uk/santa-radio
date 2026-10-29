import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import publicPage from '../api/public-page.js';
import { exported, csv, member, requestPath } from './audit-alternate-canonicals.mjs';
import { alternateProfileRedirects } from '../src/seo/alternateRedirects.js';
import { resolvePublicRequest, legacyMatches } from '../src/seo/routes.js';
import { mugs, mugPath, mugAliases, ORIGIN } from '../src/seo/catalogue.js';
import rawMugs from '../src/data/mugshots.json' with { type: 'json' };

const audit = JSON.parse(await readFile('docs/search-console-alternate-live.json', 'utf8'));
const destinations = JSON.parse(await readFile('docs/search-console-alternate-destinations.json', 'utf8'));
const decisions = csv(await readFile('docs/search-console-alternate-links.csv', 'utf8')).slice(1);
const summary = JSON.parse(await readFile('docs/search-console-alternate-summary.json', 'utf8'));
const repairs = new Map(alternateProfileRedirects);
const oldSitemap = member('attached_assets/Public_Folder_Santa_Radio_PHP_Files_1774459903533.zip', 'sitemap.xml');
const escape = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }[c]));
const normalize = s => s.toLowerCase()
  .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_, h, d) => String.fromCodePoint(parseInt(h || d, h ? 16 : 10)))
  .replace(/&amp;/g, '&').replace(/[^a-z0-9]/g, '');
const negatives = [...new Set([
  '/messages/mugshots/not-a-real-person', '/messages/mugshots/ben-fogle-wrong-role',
  '/messages/mugshots/mugshots/ben-fogle-tv-personality',
  '/messages/messages/mugshots/ben-fogle-tv-personality',
  '/santa-messages/mugshots/mugshots/mugshots/rob-ostlere-actor',
  '/santa-messages/christmas-artist/120-james-brown-the-christmas-song',
  '/messages/christmas-artist/356-bing-crosby-i-heard-the-bells-on-christmas-day',
  '/assets/img/artists/mugshots/ben-fogle-tv-personality',
  '/messages/mugshots/sir-michael-palin-tv-personality',
  '/messages/mugshots/mugshots/sam-ryder-musician',
  '/messages/mugshots/mugshots/steve-bracknall-podcaster',
  '/search?q=%7Bsearch_term_string%7D', '/mugshots/bryony-gordon-author',
  ...decisions.filter(d => d[10] === '404').map(d => requestPath(d[0])),
])];
const variants = [
  ['/free-santa-message?name=Arthur', '/free-santa-message'],
  ['/free-santa-message?name=Albie', '/free-santa-message'],
  ['/free-santa-message?name=Gracie', '/free-santa-message'],
  ['/mugshots/giovanna-fletcher-author', '/mugshots/giovanna-fletcher-author'],
  ['/mugshots/zoe-lyons', '/mugshots/zoe-lyons-comedian'],
];
// Confirm exact representative spellings from the original export/catalogue.
variants[3] = [requestPath(exported.find(r => r.url.includes('giovanna-fletcher')).url), mugPath(mugs.find(m => m.artist === 'Giovanna Fletcher'))];
variants[4] = [requestPath(exported.find(r => r.url.includes('zoe-lyons')).url), mugPath(mugs.find(m => m.artist === 'Zoe Lyons'))];

test('all 507 exact URLs, dates and live evidence remain reproducible and reconciled', () => {
  assert.deepEqual(audit.rows.map(({ url, crawled }) => ({ url, crawled })), exported);
  assert.equal(decisions.length, 507);
  assert.deepEqual(decisions.map(r => r.slice(0, 2)), exported.map(r => [r.url, r.crawled]));
  const counts = {};
  for (let i = 0; i < exported.length; i++) {
    const r = audit.rows[i], d = decisions[i], url = new URL(r.url);
    assert.match(r.crawled, /^2026-\d{2}-\d{2}$/);
    assert.ok(r.live.checkedAt && r.live.finalUrl);
    const key = r.live.tlsFailure ? 'TLS' : r.live.status;
    counts[key] = (counts[key] || 0) + 1;
    if (r.live.tlsFailure) assert.equal(r.live.exitCode, 60);
    else assert.ok(r.live.hops.length);
    if (r.live.status === 200 && !r.live.error) {
      assert.deepEqual(r.live.canonicals, [r.local.canonical], r.url);
      assert.ok(r.live.h1.length && r.live.rootTextLength > 100, r.url);
      assert.doesNotMatch(r.live.robots.join(' '), /noindex/i);
      assert.equal(r.live.hops.at(-1).xRobotsTag, null, r.url);
      const person = r.local.identity?.person || r.local.identity?.artist;
      if (person) assert.ok(normalize(r.live.title).includes(normalize(person)), r.url);
    }
    assert.ok(d[6] && d[8] && d[9] && d[14], r.url);
    const local = resolvePublicRequest(r.url);
    assert.equal(local.status, Number(d[10]), r.url);
    if (url.pathname === '/free-santa-message') {
      assert.deepEqual(local, { status: 200 });
      assert.equal(d[12], ORIGIN + '/free-santa-message');
      assert.equal(r.live.canonicals[0], ORIGIN + '/free-santa-message');
    }
  }
  assert.deepEqual(counts, { 200: 384, 404: 104, TLS: 19 });
  assert.equal(audit.rows.filter(r => new URL(r.url).pathname === '/free-santa-message').length, 230);
  assert.equal(audit.canonicalDestinations.length, 155);
  for (const d of audit.canonicalDestinations) {
    assert.equal(d.status, 200, d.url);
    assert.equal(d.exitCode, 0);
    assert.deepEqual(d.canonicals, [d.url]);
    assert.ok(d.h1.length && d.rootTextLength > 100, d.url);
    assert.doesNotMatch(d.robots.join(' '), /noindex/i);
  }
  assert.deepEqual(summary.builtDocumentLinksToReportedBadPaths, []);
  assert.deepEqual(summary.builtSitemapBadPaths, []);
  assert.deepEqual(summary.liveSitemapBadPaths, []);
  assert.deepEqual(summary.canonicalDestinationsMissingFromBuiltSitemap, []);
  assert.deepEqual(summary.canonicalDestinationsMissingFromLiveSitemap, []);
});

test('85 repairs preserve full retained profile identities and do not duplicate other reports', () => {
  assert.equal(repairs.size, 85);
  for (const [source, destination] of repairs) {
    const rows = audit.rows.filter(r => requestPath(r.url) === source);
    assert.equal(rows.length, 1, source);
    assert.deepEqual(rows[0].overlaps, [], source);
    assert.equal(rows[0].live.status, 404, source);
    assert.equal(rows[0].local.initial.status, 404, source);
    const slug = source.split('/').at(-1);
    const raw = rawMugs.find(m => m.song === slug);
    assert.ok(raw && raw.artist && raw.info, source);
    const expected = '/mugshots/' + mugAliases[slug];
    assert.equal(destination, expected, source);
    const profile = mugs.find(m => mugPath(m) === destination);
    assert.equal(profile.artist, raw.artist, source);
    // Reviewed duplicate profiles may intentionally use another retained photo.
    // The existing identity alias, not an image filename guess, selects it.
    const retainedFinal = rawMugs.find(m => m.song === mugAliases[slug]);
    assert.ok(retainedFinal, source);
    assert.equal(profile.image, retainedFinal.image, source);
    // Old sitemap corroborates many (not all) retained catalogue identities.
    if (oldSitemap.includes('/mugshots/' + slug)) assert.ok(rows[0].url.endsWith(slug));
    assert.deepEqual(resolvePublicRequest(source), { status: 308, location: expected });
    assert.deepEqual(resolvePublicRequest(expected), { status: 200 });
    const liveTarget = destinations.rows.find(r => r.url === ORIGIN + destination)?.live;
    assert.ok(liveTarget, destination);
    assert.equal(liveTarget.exitCode, 0, destination);
    assert.equal(liveTarget.status, 200, destination);
    assert.equal(liveTarget.finalUrl, ORIGIN + destination);
    assert.deepEqual(liveTarget.canonicals, [ORIGIN + destination]);
    assert.ok(normalize(liveTarget.title).includes(normalize(profile.artist)), destination);
    assert.ok(liveTarget.h1.length && liveTarget.rootTextLength > 100, destination);
    assert.doesNotMatch(liveTarget.robots.join(' '), /noindex/i);
  }
  for (const p of negatives) assert.equal(resolvePublicRequest(p).status, 404, p);
  // Existing historical artist namespace and established aliases remain intact.
  for (const row of legacyMatches.filter(r => r.target))
    assert.equal(resolvePublicRequest(`/artist?s=${row.legacy.id}`).location, row.target);
});
function assertDocument(html, target) {
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
  assert.ok(html.includes(`rel="canonical" href="${ORIGIN}${target}"`), target);
  assert.match(html, /name="robots" content="index, follow"/);
  assert.equal((html.match(/<title\b/g) || []).length, 1);
  assert.match(html, /<h1\b/);
  assert.doesNotMatch(html, /Page not found/);
  const profile = mugs.find(m => mugPath(m) === target);
  if (profile) {
    assert.ok(html.includes(escape(profile.artist)), target);
    assert.ok(html.includes(escape(profile.info)), 'Initial real biography: ' + target);
    assert.ok(html.includes(profile.image), 'Correct photograph: ' + target);
  } else {
    assert.equal(target, '/free-santa-message');
    assert.match(html, /personalised/i);
    assert.match(html, /adult|18|parent/i);
  }
}
async function checkServing(get) {
  for (const [source, target] of [...repairs, ...variants]) {
    const expected = resolvePublicRequest(source);
    for (const method of ['GET', 'HEAD']) {
      const r = await get(source, method);
      assert.equal(r.status, expected.status, source);
      if (expected.location) assert.equal(r.headers.get('location'), expected.location, source);
      if (method === 'HEAD') assert.equal(await r.text(), '');
      else if (!expected.location) assertDocument(await r.text(), target);
    }
    const r = await get(target);
    assert.equal(r.status, 200, target);
    assert.equal(r.headers.get('x-robots-tag'), null);
    assertDocument(await r.text(), target);
    const head = await get(target, 'HEAD');
    assert.equal(head.status, 200, target);
    assert.equal(await head.text(), '');
    if (repairs.has(source)) {
      const query = '?utm_source=archive&name=Arthur&next=https%3A%2F%2Fexample.invalid';
      const r = await get('https://preview.example' + source + query);
      assert.equal(r.status, 308);
      assert.equal(r.headers.get('location'), target + query);
      assert.equal(new URL(r.headers.get('location'), 'https://preview.example').origin, 'https://preview.example');
    }
  }
  for (const p of negatives) {
    for (const method of ['GET', 'HEAD']) {
      const r = await get(p, method);
      assert.equal(r.status, 404, p);
      assert.equal(r.headers.get('location'), null);
      assert.match(r.headers.get('x-robots-tag'), /noindex/);
      const html = await r.text();
      if (method === 'HEAD') assert.equal(html, '');
      else {
        assert.match(html, /<h1[^>]*>[\s\S]*?(?:404|not found)/i);
        assert.doesNotMatch(html, /rel="canonical"/);
      }
    }
  }
}
test('alternate-report GET/HEAD through compiled Vercel document handler', async () => {
  await checkServing(async (raw, method = 'GET') => {
    const u = new URL(raw, ORIGIN);
    u.searchParams.set('__sr_route', u.pathname);
    const r = { headers: new Headers(), setHeader(k, v) { this.headers.set(k, v); },
      status(c) { this.code = c; return this; }, end(body) { this.body = body; } };
    await publicPage({ method, url: '/api/public-page' + u.search }, r);
    return new Response(r.body, { status: r.code, headers: r.headers });
  });
});
test('alternate-report GET/HEAD through development SSR', { timeout: 120000 }, async t => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  t.after(() => server.close());
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  await checkServing((raw, method = 'GET') => {
    const u = new URL(raw, ORIGIN);
    return fetch(base + u.pathname + u.search, { method, redirect: 'manual' });
  });
});
test('alternate-report GET/HEAD through built Node documents', { timeout: 120000 }, async t => {
  const child = spawn(process.execPath, ['index.js', '--port=0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill('SIGTERM'));
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Node startup timeout')), 15000);
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Node exited ${code}`)); });
    child.stdout.on('data', data => { const m = data.toString().match(/listening on port (\d+)/); if (m) { clearTimeout(timer); resolve(m[1]); } });
    child.stderr.on('data', data => process.stderr.write(data));
  });
  await checkServing((raw, method = 'GET') => {
    const u = new URL(raw, ORIGIN);
    return fetch(`http://127.0.0.1:${port}${u.pathname}${u.search}`, { method, redirect: 'manual' });
  });
});
