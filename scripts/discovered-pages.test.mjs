import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import handler from '../api/public-page.js';
import { songs, ORIGIN } from '../src/seo/catalogue.js';
import { sitemap } from '../server/public-html.js';
import { readExport, classify, plain, inspectHtml, documentProblems, fetchEvidence, csvRows } from './discovered-pages-lib.mjs';

const fixture = JSON.parse(await readFile('docs/search-console-discovered/inventory.json', 'utf8'));
const rows = fixture.rows.map(classify);
const paths = [...new Set(rows.flatMap(row => row.discoveryPath))];
const songFor = row => songs.find(song => `${song.id}-${song.link}` === row.path.split('/').at(-1));
function checkDocument(html, row, headers = '') {
  const doc = inspectHtml(html, row.url);
  assert.deepEqual(documentProblems(doc, row, headers), [], row.url);
  assert.ok(doc.h1.includes(row.artist), `${row.url}: exact performer`);
  if (row.family !== 'mugshot') {
    const song = songFor(row);
    assert.ok(doc.h1.includes(song.song), `${row.url}: title`);
    assert.equal(doc.lyrics, plain(song.lyrics), `${row.url}: full source lyrics in initial HTML`);
  }
}
async function checkInventory(get) {
  const documents = new Map();
  for (const path of paths) {
    const result = await get(path);
    assert.equal(result.status, 200, path);
    documents.set(path, result);
  }
  for (const row of rows) {
    const result = documents.get(row.path);
    checkDocument(result.html, row, result.xRobotsTag);
    for (let i = 0; i < row.discoveryPath.length - 1; i++) {
      const from = row.discoveryPath[i], to = row.discoveryPath[i + 1];
      assert.ok(inspectHtml(documents.get(from).html, ORIGIN + from).links.includes(to), `${from} must server-render a link to ${to}`);
    }
  }
}

test('exact export fixture retains all source rows, chart and metadata without treating epoch dates as crawls', () => {
  assert.deepEqual(readExport(), fixture);
  assert.equal(rows.length, 447);
  assert.equal(new Set(rows.map(r => r.url)).size, 447);
  assert.deepEqual(rows.reduce((out, row) => { out[row.family] = (out[row.family] || 0) + 1; return out; }, {}), { song: 49, lyrics: 373, mugshot: 25 });
  assert.ok(rows.every(r => r.lastCrawled === '1970-01-01'));
  assert.deepEqual(fixture.chart.at(-1), { date: '2026-10-23', pages: 447 });
  for (const row of rows) {
    assert.ok(row.sourceEligible, row.url);
    assert.equal(row.localStatus, 200, row.url);
    assert.equal(row.localNoindex, false, row.url);
    assert.equal(row.localSitemap, true, row.url);
    assert.ok(sitemap().includes(`<loc>${row.url}</loc>`), row.url);
    if (row.family === 'lyrics') assert.ok(row.lyricsCharacters > 0, row.url);
  }
});

test('all exported pages and discovery edges in development initial HTTP HTML', { timeout: 180000 }, async t => {
  const server = await createServer({ server: { port: 0, host: '127.0.0.1' } });
  t.after(() => server.close());
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  await checkInventory(async path => {
    const response = await fetch(base + path, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    return { status: response.status, html: await response.text(), xRobotsTag: response.headers.get('x-robots-tag') || '' };
  });
});

test('all exported pages and discovery edges in compiled Node HTTP HTML', { timeout: 180000 }, async t => {
  const child = spawn(process.execPath, ['index.js', '--port=0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill('SIGTERM'));
  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Node startup timeout')); }, 15000);
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Node exited ${code}`)); });
    child.stdout.on('data', data => {
      const match = data.toString().match(/listening on port (\d+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
    child.stderr.on('data', data => console.error(data.toString()));
  });
  await checkInventory(async path => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    return { status: response.status, html: await response.text(), xRobotsTag: response.headers.get('x-robots-tag') || '' };
  });
});

test('all exported pages and discovery edges through the Vercel rewritten document handler', async () => {
  await checkInventory(async path => {
    const response = { headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      status(code) { this.code = code; return this; }, end(body) { this.body = body; } };
    await handler({ method: 'GET', url: '/api/public-page?' + new URLSearchParams({ __sr_route: path }) }, response);
    assert.equal(response.headers['x-santa-page-mode'], 'prerendered', path);
    return { status: response.code, html: response.body, xRobotsTag: response.headers['x-robots-tag'] || '' };
  });
});

test('document checks catch bad canonical, noindex, missing content and missing ordinary links', () => {
  const row = rows.find(r => r.family === 'lyrics');
  const html = `<head><link rel="canonical" href="${row.url}"><meta name="robots" content="index, follow"></head>
    <main><h1>${row.artist} — ${row.title}</h1><pre>${'lyrics '.repeat(30)}</pre><a href="/christmas-music">Music</a></main>`;
  assert.deepEqual(documentProblems(inspectHtml(html, row.url), row), []);
  assert.ok(documentProblems(inspectHtml(html.replace(row.url, ORIGIN + '/wrong'), row.url), row).includes('incorrect canonical'));
  assert.ok(documentProblems(inspectHtml(html.replace('index, follow', 'noindex, follow'), row.url), row).includes('restrictive crawl directive'));
  assert.ok(documentProblems(inspectHtml(html, row.url), row, 'noindex').includes('restrictive crawl directive'));
  assert.ok(documentProblems(inspectHtml('<main></main>', row.url), row).includes('missing meaningful main content'));
  assert.ok(documentProblems(inspectHtml(html.replace(/<pre>.*?<\/pre>/, ''), row.url), row).includes('missing initial lyrics'));
  assert.ok(!inspectHtml(html.replace('href="/christmas-music"', ''), row.url).links.includes('/christmas-music'));
  assert.deepEqual(csvRows('URL,Value\r\n"https://example.com/a,b","say ""yes"""\r\n'), [['URL', 'Value'], ['https://example.com/a,b', 'say "yes"']]);
});

test('live evidence retains redirect chains, non-200s, exceptions and bounded timeouts without retries', async () => {
  let calls = 0;
  const result = await fetchEvidence(ORIGIN + '/a', { fetcher: async () => {
    calls++; return calls === 1 ? new Response(null, { status: 308, headers: { location: '/b' } }) : new Response('missing', { status: 404 });
  } });
  assert.equal(calls, 2);
  assert.deepEqual(result.chain.map(r => r.status), [308, 404]);
  assert.equal(result.finalStatus, 404);
  assert.equal(result.finalUrl, ORIGIN + '/b');
  const failed = await fetchEvidence(ORIGIN, { fetcher: async () => { throw new Error('offline'); } });
  assert.match(failed.error, /offline/);
  const timedOut = await fetchEvidence(ORIGIN, { timeout: 5, fetcher: async (_, { signal }) =>
    new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))) });
  assert.equal(timedOut.error, 'timeout');
  const loop = await fetchEvidence(ORIGIN, { fetcher: async () => new Response(null, { status: 302, headers: { location: ORIGIN } }) });
  assert.equal(loop.error, 'redirect loop');
  const external = await fetchEvidence(ORIGIN, { fetcher: async () => new Response(null, { status: 302, headers: { location: 'https://example.org' } }) });
  assert.match(external.error, /outside audited HTTPS origin/);
});
