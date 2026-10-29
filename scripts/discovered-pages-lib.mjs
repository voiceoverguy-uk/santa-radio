import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { songs, mugs, songPath, mugPath, ORIGIN } from '../src/seo/catalogue.js';
import { canonicalPaths, resolvePublicRequest } from '../src/seo/routes.js';

export const archive = 'attached_assets/Discovered_-_currently_not_indexed_1793271218067.zip';
export const sha256 = text => createHash('sha256').update(text).digest('hex');
export function csvRows(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n')) {
      row.push(cell.replace(/\r$/, '')); cell = '';
      if (c === '\n') { rows.push(row); row = []; }
    } else cell += c;
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows;
}
export function readExport() {
  const files = Object.fromEntries(['Table', 'Chart', 'Metadata'].map(name => [name,
    execFileSync('unzip', ['-p', archive, `Discovered - currently not indexed/${name}.csv`], { encoding: 'utf8', maxBuffer: 1000000 })]));
  const table = csvRows(files.Table);
  if (table[0].join(',') !== 'URL,Last crawled') throw new Error('Unexpected table schema');
  return {
    source: archive, archiveSha256: sha256(readFileSync(archive)),
    memberSha256: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, sha256(v)])),
    metadata: csvRows(files.Metadata).slice(1),
    chart: csvRows(files.Chart).slice(1).map(([date, pages]) => ({ date, pages: Number(pages) })),
    rows: table.slice(1).map(([url, lastCrawled], index) => ({ row: index + 1, url, lastCrawled })),
  };
}
const entries = new Map([
  ...songs.flatMap(song => [[songPath(song), { family: 'song', entry: song }],
    [songPath(song).replace('/christmas-artist/', '/christmas-karaoke-lyrics/'), { family: 'lyrics', entry: song }]]),
  ...mugs.map(mug => [mugPath(mug), { family: 'mugshot', entry: mug }]),
]);
export function classify(row) {
  const path = new URL(row.url).pathname;
  const { family = 'unknown', entry } = entries.get(path) || {};
  const route = resolvePublicRequest(row.url);
  return { ...row, path, family, sourceEligible: !!entry, localStatus: route.status,
    localNoindex: !!route.noindex, expectedCanonical: ORIGIN + path,
    localSitemap: canonicalPaths.includes(path),
    artist: entry?.artist, title: entry?.song,
    lyricsCharacters: family !== 'mugshot' ? (entry?.lyrics || '').trim().length : null,
    discoveryPath: family === 'mugshot' ? ['/', '/mugshots/all', path] :
      family === 'song' ? ['/', '/christmas-music', path] : ['/', '/christmas-music', path.replace('/christmas-karaoke-lyrics/', '/christmas-artist/'), path] };
}
export const decode = text => text.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, n) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' })[n]);
export const plain = html => decode(html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
export function inspectHtml(html, base) {
  const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
    .map(([, key, a, b]) => [key.toLowerCase(), decode(a ?? b)]));
  const tags = [...html.matchAll(/<(?:link|meta|a)\b[^>]*>/gi)].map(m => attrs(m[0]));
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || '';
  return {
    canonicals: tags.filter(a => a.rel?.toLowerCase() === 'canonical').map(a => a.href),
    robots: tags.filter(a => /^(robots|googlebot)$/i.test(a.name || '')).map(a => `${a.name}: ${a.content}`),
    links: [...new Set(tags.filter(a => a.href && !a.rel).flatMap(a => {
      try { const u = new URL(a.href, base); return u.origin === new URL(base).origin ? [u.pathname + u.search] : []; } catch { return []; }
    }))],
    h1: plain(main.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || ''),
    mainCharacters: plain(main).length,
    lyrics: plain(main.match(/<pre\b[^>]*>([\s\S]*?)<\/pre>/i)?.[1] || ''),
    hasBackground: /Artist background/.test(main),
    mainSha256: sha256(main),
  };
}
export function documentProblems(doc, row, xRobots = '') {
  const issues = [];
  if (doc.canonicals.length !== 1 || doc.canonicals[0] !== row.expectedCanonical) issues.push('incorrect canonical');
  if (/\b(noindex|nofollow|none)\b/i.test([...doc.robots, xRobots].join(' '))) issues.push('restrictive crawl directive');
  if (!doc.robots.some(value => /\bindex\b/i.test(value) && /\bfollow\b/i.test(value))) issues.push('missing index/follow metadata');
  if (!doc.h1 || doc.mainCharacters < 100) issues.push('missing meaningful main content');
  if (row.artist && !doc.h1.includes(row.artist)) issues.push('missing expected performer in heading');
  if (row.family !== 'mugshot' && row.title && !doc.h1.includes(row.title)) issues.push('missing expected song title in heading');
  if (row.family === 'lyrics' && !doc.lyrics) issues.push('missing initial lyrics');
  if (row.family === 'song' && !doc.hasBackground) issues.push('missing initial artist background');
  return issues;
}

// Single bounded attempt per hop, including reading the body. Never retries.
export async function fetchEvidence(url, { timeout = 15000, fetcher = fetch, maxHops = 5 } = {}) {
  const chain = [], seen = new Set();
  let current = url;
  for (let hop = 0; hop <= maxHops; hop++) {
    if (seen.has(current)) return { url, chain, error: 'redirect loop' };
    seen.add(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetcher(current, { redirect: 'manual', signal: controller.signal,
        headers: { 'User-Agent': 'SantaRadio-ReadOnly-Indexing-Audit/1.0' } });
      const step = { url: current, status: response.status, location: response.headers.get('location'),
        xRobotsTag: response.headers.get('x-robots-tag'), contentType: response.headers.get('content-type') };
      chain.push(step);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        if (!step.location) return { url, chain, error: 'redirect without Location' };
        const next = new URL(step.location, current);
        if (next.protocol !== 'https:' || next.origin !== new URL(url).origin)
          return { url, chain, error: `redirect outside audited HTTPS origin: ${next.href}` };
        current = next.href;
      } else {
        const body = await response.text();
        return { url, checkedAt: new Date().toISOString(), chain, finalUrl: current, finalStatus: response.status,
          xRobotsTag: step.xRobotsTag, contentType: step.contentType, bodySha256: sha256(body), body };
      }
    } catch (error) {
      return { url, checkedAt: new Date().toISOString(), chain, error: controller.signal.aborted ? 'timeout' : `${error.name}: ${error.message}` };
    } finally { clearTimeout(timer); }
  }
  return { url, chain, error: 'redirect limit exceeded' };
}
