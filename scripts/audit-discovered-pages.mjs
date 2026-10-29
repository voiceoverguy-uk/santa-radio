// Read-only: two workers, 150 ms between documents, no retries, 15 s per hop.
// node scripts/audit-discovered-pages.mjs --fixture
// node scripts/audit-discovered-pages.mjs --live
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { readExport, classify, inspectHtml, documentProblems, fetchEvidence } from './discovered-pages-lib.mjs';
import { ORIGIN } from '../src/seo/catalogue.js';

const directory = 'docs/search-console-discovered';
const fixture = readExport();
assert.equal(fixture.rows.length, 447);
assert.equal(new Set(fixture.rows.map(r => r.url)).size, 447);
assert.ok(fixture.rows.every(r => new URL(r.url).origin === ORIGIN));
await mkdir(directory, { recursive: true });
if (process.argv.includes('--fixture')) {
  await writeFile(`${directory}/inventory.json`, JSON.stringify(fixture, null, 2) + '\n');
} else if (process.argv.includes('--live')) {
  const startedAt = new Date().toISOString();
  const rows = fixture.rows.map(classify);
  const targets = [...new Set([ORIGIN + '/robots.txt', ORIGIN + '/sitemap.xml',
    ...rows.flatMap(r => r.discoveryPath.map(path => ORIGIN + path))])];
  const results = new Map(); let cursor = 0;
  async function worker() {
    while (cursor < targets.length) {
      const url = targets[cursor++];
      const result = await fetchEvidence(url);
      const { body, ...evidence } = result;
      if (body !== undefined) {
        if (url.endsWith('/robots.txt')) evidence.text = body;
        else if (url.endsWith('/sitemap.xml')) evidence.locations = [...body.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
        else evidence.document = inspectHtml(body, result.finalUrl);
      }
      results.set(url, evidence);
      if (results.size % 50 === 0) console.log(`${results.size}/${targets.length} completed`);
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }
  await Promise.all([worker(), worker()]);
  const robots = results.get(ORIGIN + '/robots.txt'), sitemap = results.get(ORIGIN + '/sitemap.xml');
  const output = rows.map(row => {
    const live = results.get(row.url);
    const discovery = row.discoveryPath.slice(0, -1).map((from, i) => {
      const evidence = results.get(ORIGIN + from), to = row.discoveryPath[i + 1];
      return { from: ORIGIN + from, to: ORIGIN + to,
        result: evidence.error || evidence.finalStatus !== 200 ? 'unavailable' :
          evidence.document?.links.includes(to) ? 'linked' : 'missing',
        sourceStatus: evidence.finalStatus ?? null, error: evidence.error ?? null };
    });
    return { ...row, live,
      liveSitemap: sitemap.locations ? sitemap.locations.includes(row.url) : null,
      discovery,
      technicalObservations: live.error ? [`unavailable: ${live.error}`] :
        [...(live.finalStatus !== 200 ? [`HTTP ${live.finalStatus}`] : []),
          ...(live.document ? documentProblems(live.document, row, live.xRobotsTag) : ['no HTML inspection']),
          ...(live.chain.length > 1 ? ['redirected exported canonical URL'] : [])],
    };
  });
  const evidence = { startedAt, finishedAt: new Date().toISOString(), origin: ORIGIN,
    settings: { concurrency: 2, delayMs: 150, timeoutMs: 15000, maxRedirects: 5, retries: 0 },
    sourceSha256: fixture.archiveSha256, robots, sitemap,
    // Retain intermediary documents to substantiate every discovery edge and pair comparison.
    documents: Object.fromEntries([...results].filter(([url]) => !url.endsWith('/robots.txt') && !url.endsWith('/sitemap.xml'))),
    rows: output };
  await writeFile(`${directory}/live-audit.json`, JSON.stringify(evidence, null, 2) + '\n');
  const columns = ['row', 'url', 'family', 'lastCrawled', 'sourceEligible', 'localStatus', 'localNoindex',
    'expectedCanonical', 'localSitemap', 'lyricsCharacters', 'checkedAt', 'liveError', 'redirectChain',
    'finalStatus', 'finalUrl', 'canonicals', 'metaRobots', 'xRobotsTag', 'h1', 'mainCharacters',
    'liveSitemap', 'discovery', 'technicalObservations'];
  const cells = output.map(r => ({ ...r, checkedAt: r.live.checkedAt, liveError: r.live.error ?? '',
    redirectChain: r.live.chain, finalStatus: r.live.finalStatus, finalUrl: r.live.finalUrl,
    canonicals: r.live.document?.canonicals, metaRobots: r.live.document?.robots,
    xRobotsTag: r.live.xRobotsTag, h1: r.live.document?.h1, mainCharacters: r.live.document?.mainCharacters }));
  const quote = value => '"' + String(typeof value === 'object' ? JSON.stringify(value) : value ?? '').replaceAll('"', '""') + '"';
  await writeFile(`${directory}/audit.csv`, [columns, ...cells.map(r => columns.map(k => r[k]))].map(r => r.map(quote).join(',')).join('\n') + '\n');
  console.log(JSON.stringify({ total: output.length, requests: targets.length,
    statuses: output.reduce((a, r) => { const key = r.live.error || r.live.finalStatus; a[key] = (a[key] || 0) + 1; return a; }, {}),
    observations: output.filter(r => r.technicalObservations.length).map(r => ({ url: r.url, issues: r.technicalObservations })),
    missingDiscovery: output.filter(r => r.discovery.some(e => e.result !== 'linked')).map(r => r.url),
  }, null, 2));
} else throw new Error('Choose --fixture or --live explicitly');
