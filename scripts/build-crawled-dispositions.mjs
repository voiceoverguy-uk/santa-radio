// Rebuild the independent, export-driven expected outcomes and owner handoff.
// Does not read routing implementation to choose expected results.
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { directory } from './audit-crawled-links.mjs';
import { mugs, mugPath, ORIGIN } from '../src/seo/catalogue.js';
const live = JSON.parse(await readFile(`${directory}/live.json`, 'utf8'));
const repairs = new Map([
  ['/artist?s=494-sabrina-claudio-christmas-blues', '/christmas-artist/494-sabrina-claudio-christmas-blues'],
  ['/artist?s=108-extreme-christmas-time-again', '/christmas-artist/108-extreme-christmas-time-again'],
  ['/artist?s=153-x-mas-donkey-&-the-glittering-balls-at-the-christmas-ball', '/christmas-artist/153-x-mas-donkey-the-glittering-balls-at-the-christmas-ball'],
  ['/artist?s=277-bing-crosby-silver-bells', '/christmas-artist/277-bing-crosby-silver-bells'],
  ['/artist?s=287-mitch-miller-and-the-gang-the-twelve-days-of-christmas', '/christmas-artist/287-mitch-miller-and-the-gang-the-twelve-days-of-christmas'],
  ['/christmas-artist/549-bon-jovi-christmas-isn-t-christmas', '/christmas-artist/549-bon-jovi-christmas-isna-tmt-christmas'],
  ['/mugshots/rob-walker-bbc-sport/rob-rinder-judge', '/mugshots/rob-rinder-judge'],
  ['/mugshots/rob-walker-bbc-sport/kell-brook-boxer', '/mugshots/kell-brook-boxer'],
  ['/shop/product/mugshots/mugshots/matthew-cottle-actor', '/mugshots/matthew-cottle-actor'],
  ['/santa-messages/mugshots/christmas-artist/christmas-karaoke-lyrics/58-cliff-richard-saviours-day', '/christmas-karaoke-lyrics/58-cliff-richard-saviours-day'],
  ['/personalised', '/free-santa-message'],
]);
function rows(text) {
  return text.trim().split(/\r?\n/).slice(1).map(line => {
    // Report URLs may contain literal commas, quoted by Search Console.
    const match = line.match(/^(?:"([^"]+)"|([^,]+)),(\d{4}-\d{2}-\d{2})$/);
    if (!match) throw new Error('Unexpected export CSV quoting');
    return match[1] || match[2];
  });
}
const duplicate = rows(await readFile('attached_assets/Table_1793271000630.csv', 'utf8'));
const notFound = rows(execFileSync('unzip', ['-p', 'attached_assets/Not_found_(404)_1793271072351.zip', 'Not found (404)/Table.csv'], { encoding: 'utf8' }));
const pathQuery = raw => { const u = new URL(raw); return decodeURIComponent(u.pathname) + u.search; };
const sourceKey = raw => pathQuery(raw).replace(/^\/+/, '/').replace(/\/$/, '');
const identity = raw => {
  const u = new URL(raw, ORIGIN);
  if (/\/(?:personalised-santa-message|santa-messages)\/[^/]+$/.test(u.pathname) || u.pathname === '/free-santa-message') return 'shared-maker';
  if (/\/(?:christmas-artist|christmas-karaoke-lyrics)\//.test(u.pathname)) return u.pathname.split('/').at(-1).replace(/^\d+-/, '').normalize('NFKD').replace(/&/g, 'and').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
  if (u.pathname === '/christmas-song-lyrics') return identity('/christmas-karaoke-lyrics/' + u.searchParams.get('s'));
  if (u.pathname.includes('/mugshots/')) return 'profile:' + u.pathname.split('/').at(-1);
  return sourceKey(u.href);
};
const knownDestinations = new Map((await readFile('docs/search-console-duplicate-links.csv', 'utf8')).trim().split(/\r?\n/).slice(1).map(line => {
  const cells = line.split(','); return [cells[0], cells[4]];
}));
const audit = live.map(row => {
  const path = pathQuery(row.url);
  let kind, owner, localStatus, localLocation = null, destination = null, action;
  if (row.failure) {
    const slug = path.split('/').at(-1);
    const mug = mugs.find(m => m.song === slug || slug === 'faye-tozer-singer' && m.song === 'faye-tozer-singer-dancer');
    if (!mug) throw new Error('Unverified public profile counterpart');
    kind = 'tls-hosting-handoff'; owner = 'Hosting owner';
    // This is the www counterpart, NOT a result obtained from the failed host.
    destination = mugPath(mug); localStatus = null;
    action = 'Owner to review hostname/certificate and old backlinks separately; do not change service hosts. Public counterpart verified locally; no TLS bypass.';
  } else if (repairs.has(path)) {
    kind = 'repair-exact'; owner = '366'; localStatus = 308; localLocation = repairs.get(path); destination = localLocation;
    action = 'Release only after approval; GET/HEAD old URL then inspect final canonical content in Search Console.';
  } else if (row.status === 200) {
    kind = path.startsWith('/personalised-santa-message/') ? 'working-name' : 'working-content'; owner = 'Existing routing';
    const final = new URL(row.finalUrl);
    destination = final.pathname + final.search;
    localStatus = path === destination ? 200 : 308;
    localLocation = localStatus === 308 ? destination : null;
    action = kind === 'working-name' ? 'Keep consolidated maker and requested name; no new name landing page. Review maker canonical after release.' : 'Review canonical page rather than asking Google to index this alias.';
  } else if (path.includes('free-christmas-apps') || path.startsWith('/christmas-song-lyrics?')) {
    kind = 'pending-404-report'; owner = '365 separate repair (not integrated)'; localStatus = 404;
    action = path.includes('free-christmas-apps') ? 'Separate 365 owns original free-apps equivalence investigation; reuse approved repair when integrated. Still 404 in this branch.' : 'Separate 365 owns legacy lyrics-query repair; this additional Michael Buble query remains 404 pending shared repair integration and exact-query verification. Do not infer ID-only equivalence.';
  } else {
    kind = 'retained-error'; owner = '366 disposition'; localStatus = 404;
    if (path === '/christmas-artist/422') action = 'Intentionally removed historical recording; retain genuine error and exclude from sitemap. Never restore or remap numeric identity.';
    else if (path.includes('charles-brown.jpg')) action = 'No exact source image in either supplied PHP/assets archive; do not substitute modern illustrated art. Retain 404 unless owner supplies original asset and rights.';
    else if (path.includes('karaoke4.php')) action = 'Original endpoint displayed changing now-playing lyrics; random query did not select a song. No static equivalent; retain 404, do not restore obsolete dynamic feature.';
    else action = 'No questions page or same-purpose destination established by supplied archive/sitemap/current content; retain 404. Tracker questions are not evidence of equivalence.';
  }
  const overlaps = [];
  for (const [report, urls] of [['364', duplicate], ['365 separate repair', notFound]]) {
    const exact = urls.filter(url => url === row.url);
    const semantic = urls.filter(url => sourceKey(url) === sourceKey(row.url) && url !== row.url);
    const content = destination ? urls.filter(url => [identity(destination), identity(row.url)].includes(identity(knownDestinations.get(url) || url))) : [];
    if (exact.length) overlaps.push(`${report} exact URL: ${exact.join(' | ')}`);
    if (semantic.length) overlaps.push(`${report} host/separator equivalent: ${semantic.join(' | ')}`);
    if (content.length) overlaps.push(`${report} shared destination/identity (${content.length} examples): ${identity(destination) === 'shared-maker' ? '/free-santa-message (different legacy names)' : [...new Set(content.map(url => knownDestinations.get(url) || pathQuery(url)))].join(' | ')}`);
  }
  return {
    url: row.url, lastCrawled: row.lastCrawled, originalHost: row.host,
    liveStatus: row.failure ? 'TLS hostname validation failure (curl 60)' : row.status,
    liveFinal: row.finalUrl, kind, owner, overlaps: overlaps.length ? overlaps : ['No exact or verified content overlap with the two supplied reports'],
    localStatus, localLocation, destination,
    canonical: destination ? ORIGIN + destination.split('?')[0] : null,
    remainingAction: action,
  };
});
await writeFile(`${directory}/dispositions.json`, JSON.stringify(audit, null, 2) + '\n');
const columns = ['url', 'lastCrawled', 'originalHost', 'liveStatus', 'liveFinal', 'kind', 'owner', 'overlaps', 'localStatus', 'localLocation', 'destination', 'canonical', 'remainingAction'];
const cell = value => `"${String(Array.isArray(value) ? value.join('; ') : value ?? '').replace(/"/g, '""')}"`;
await writeFile(`${directory}/dispositions.csv`, columns.join(',') + '\n' + audit.map(row => columns.map(key => cell(row[key])).join(',')).join('\n') + '\n');
console.log(audit.reduce((counts, row) => { counts[row.kind] = (counts[row.kind] || 0) + 1; return counts; }, {}));
