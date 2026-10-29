// Read-only evidence audit. Never imports SQL into the catalogue or changes routes.
// Run from the project root: node scripts/audit-historical-music-links.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseMusicRows } from './import-music-catalogue.js';
import { resolvePublicRequest, legacyMatches } from '../src/seo/routes.js';
import { songs, songPath } from '../src/seo/catalogue.js';

const archive = 'attached_assets/Public_Folder_Santa_Radio_PHP_Files_1774459903533.zip';
const sqlFile = 'attached_assets/cl57-thesongs_1791303552293.sql';
const sqlText = readFileSync(sqlFile, 'utf8');
const sqlRows = parseMusicRows(sqlText).map(row => ({
  id: Number(row[0]), artist: row[2], title: row[1],
}));
assert.equal(new Set(sqlRows.map(row => row.id)).size, sqlRows.length);
assert.match(sqlText, /CREATE TABLE `messages2` \(\s*`id`[^,]+,\s*`song`[^,]+,\s*`artist`/);
const bySourceId = new Map(sqlRows.map(row => [row.id, row]));
const xml = execFileSync('unzip', ['-p', archive, 'sitemap.xml'], { encoding: 'utf8' });
const php = execFileSync('unzip', ['-p', archive, 'artist.php'], { encoding: 'utf8' });
// Do not print PHP: the archive also contains obsolete private connection settings.
assert.ok(php.includes(`SELECT * FROM messages2  WHERE id = '".$_GET["s"]."'`));
const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1].replaceAll('&amp;', '&'));
const pathOf = raw => { const url = new URL(raw); return url.pathname + url.search; };
const reported = new Set(readFileSync('attached_assets/Table_1793268036948.csv', 'utf8')
  .trim().split(/\r?\n/).slice(1).map(line => pathOf(line.split(',')[0])));
const music = urls.filter(raw => /^\/(?:christmas-artist|christmas-karaoke-lyrics|christmas-music|artist|music|karaoke-lyrics)(?:\/|$)/.test(new URL(raw).pathname));
const remaining = music.filter(raw => !reported.has(pathOf(raw)));
assert.equal(new Set(remaining).size, remaining.length, 'Audit distinct sitemap URLs, not duplicate occurrences');
const normalize = text => text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/&/g, 'and').replace(/[^\p{L}\p{N}]/gu, '');
const identity = row => normalize(row.artist) + ':' + normalize(row.title ?? row.song);
const combined = row => normalize(row.artist + (row.title ?? row.song));
const destinations = new Map(songs.flatMap(song => [
  [songPath(song), song],
  [songPath(song).replace('/christmas-artist/', '/christmas-karaoke-lyrics/'), song],
]));
// Exact editorial changes only; never apply fuzzy matching to other recordings.
const editorial = [
  ['Mike Oldfield', 'Il Dulci Jubilo', 'Mike Oldfield', 'In Dulci Jubilo'],
  ['Gladys Knight & The Pips', "It's Christmas Everyday", 'Gladys Knight & The Pips', "When You Love Someone (It's Christmas Everyday)"],
  ['Megan Trainor', 'My Kind Of Present', 'Meghan Trainor', 'My Kind Of Present'],
  ['Tom Jones & C Matthews', 'Baby Its Cold Outside', 'Tom Jones & Cerys Matthews', 'Baby Its Cold Outside'],
].map(([artist, title, targetArtist, targetTitle]) => [
  identity({ artist, title }), identity({ artist: targetArtist, title: targetTitle }),
]);

function trace(raw) {
  const origin = new URL(raw).origin;
  const hops = [];
  const seen = new Set();
  let url = new URL(raw);
  for (let count = 0; count < 10; count++) {
    if (seen.has(url.href)) throw new Error(`Redirect loop: ${raw}`);
    seen.add(url.href);
    const result = resolvePublicRequest(url.href);
    hops.push({ path: pathOf(url.href), ...result });
    if (result.status !== 308) return hops;
    assert.ok(result.location.startsWith('/') && !result.location.startsWith('//'), raw);
    url = new URL(result.location, url);
    assert.equal(url.origin, origin, raw);
  }
  throw new Error(`Excessive redirects: ${raw}`);
}

const results = remaining.map(raw => {
  const path = pathOf(raw);
  const hops = trace(raw);
  const first = hops[0];
  const last = hops.at(-1);
  const match = path.match(/^\/(?:christmas-artist|christmas-karaoke-lyrics)\/(\d+)(?:-(.+))?$/);
  // Source IDs come ONLY from the original SQL namespace. Full slugs must
  // corroborate that identity. Never look up current songs by this number.
  const source = match ? bySourceId.get(Number(match[1])) : undefined;
  const target = destinations.get(last.path);
  let classification;
  if (last.status !== 200) classification = 'broken';
  else if (!match && last.path === '/christmas-music') classification = 'music-index';
  else if (!target) classification = 'unresolved-destination';
  else if (source && match[2] && normalize(match[2]) !== combined(source)) classification = 'conflicting-source';
  else if (source && identity(source) === identity(target)) classification = 'source-identity-match';
  else if (source && editorial.some(([from, to]) => from === identity(source) && to === identity(target))) classification = 'documented-editorial-change';
  else if (!source && match?.[2] && normalize(match[2]) === combined(target)
    && sqlRows.some(row => identity(row) === identity(target))) classification = 'full-slug-and-sql-identity-match';
  else classification = 'conflicting-or-unknown-identity';
  return {
    url: raw, firstStatus: first.status, finalStatus: last.status,
    destination: last.path, redirects: hops.length - 1, classification,
    ...(source && { sqlIdentity: source }),
    ...(target && { destinationIdentity: { artist: target.artist, title: target.song } }),
  };
});

// Check independence without creating any new historical query mapping.
for (const { legacy, target } of legacyMatches) {
  assert.ok(target, `Unresolved established query ${legacy.id}`);
  assert.equal(resolvePublicRequest(`/artist?s=${legacy.id}`).location, target);
}
for (const path of ['/artist?s=212', '/artist?s=422', '/artist?s=482', '/artist?s=999999',
  '/artist?s=12-pogues-fairytale-of-new-york', '/artist?s=140&s=200']) {
  assert.equal(resolvePublicRequest(path).status, 404, path);
}

const counts = field => Object.fromEntries([...new Set(results.map(row => row[field]))]
  .map(value => [value, results.filter(row => row[field] === value).length]));
console.log(JSON.stringify({
  scope: 'Local shared resolver only; no production requests, route edits or publishing',
  sources: {
    archive, archiveSha256: createHash('sha256').update(readFileSync(archive)).digest('hex'),
    sql: sqlFile, sqlSha256: createHash('sha256').update(sqlText).digest('hex'),
    sqlRows: sqlRows.length, sitemapUrls: urls.length,
  },
  musicUrls: music.length, excludedReportedUrls: music.length - remaining.length,
  auditedUrls: results.length, firstStatuses: counts('firstStatus'),
  finalStatuses: counts('finalStatus'), classifications: counts('classification'),
  maximumRedirects: Math.max(...results.map(row => row.redirects)),
  findings: results.filter(row => !['source-identity-match', 'music-index'].includes(row.classification)),
}, null, 2));
