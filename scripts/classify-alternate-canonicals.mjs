// Rebuild the disposition without repeating 507 public requests.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { exported, requestPath, localDisposition, member } from './audit-alternate-canonicals.mjs';
import { alternateProfileRedirects } from '../src/seo/alternateRedirects.js';
import { canonicalPaths } from '../src/seo/routes.js';
import { ORIGIN, mugs, mugPath } from '../src/seo/catalogue.js';
import rawMugs from '../src/data/mugshots.json' with { type: 'json' };

const audit = JSON.parse(await readFile('docs/search-console-alternate-live.json', 'utf8'));
const destinations = JSON.parse(await readFile('docs/search-console-alternate-destinations.json', 'utf8'));
if (JSON.stringify(audit.rows.map(({ url, crawled }) => ({ url, crawled }))) !== JSON.stringify(exported)) throw new Error('Live audit does not match archive');
const repairs = new Map(alternateProfileRedirects);
const oldSitemap = member('attached_assets/Public_Folder_Santa_Radio_PHP_Files_1774459903533.zip', 'sitemap.xml');
const badPaths = new Set(audit.rows.filter(r => r.local.initial.status === 404).map(r => requestPath(r.url)));
const emitted = [];
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = dir + '/' + entry.name;
    if (entry.isDirectory()) await scan(file);
    else if (entry.name === 'index.html') {
      const source = dir.replace('dist/server/pages', '') || '/';
      const html = await readFile(file, 'utf8');
      for (const m of html.matchAll(/\b(href|src|action)=["']([^"']+)["']/g)) {
        let u;
        try { u = new URL(m[2].replace(/&amp;/g, '&'), ORIGIN + source); } catch { continue; }
        if (u.origin === ORIGIN && badPaths.has(requestPath(u.href)))
          emitted.push({ source, attribute: m[1], url: u.href });
      }
    }
  }
}
await scan('dist/server/pages');
const sitemap = await readFile('dist/sitemap.xml', 'utf8');
const sitemapBad = [...badPaths].filter(p => sitemap.includes(`<loc>${ORIGIN}${p}</loc>`));
let discovery;
if (process.argv.includes('--live-discovery')) {
  discovery = [];
  for (const path of ['/robots.txt', '/sitemap.xml']) {
    const checkedAt = new Date().toISOString();
    const body = execFileSync('curl', ['-fsS', '--location', '--max-time', '35', '--proto', '=https', ORIGIN + path], { encoding: 'utf8', maxBuffer: 2e6 });
    discovery.push({ url: ORIGIN + path, checkedAt, body });
  }
  await writeFile('docs/search-console-alternate-discovery.json', JSON.stringify(discovery, null, 2) + '\n');
} else discovery = JSON.parse(await readFile('docs/search-console-alternate-discovery.json', 'utf8'));
const liveSitemap = discovery.find(r => r.url.endsWith('/sitemap.xml')).body;
const liveSitemapBad = [...badPaths].filter(p => liveSitemap.includes(`<loc>${ORIGIN}${p}</loc>`));
const relation = live => live.error ? 'unavailable: ' + (live.tlsFailure ? 'TLS hostname/certificate failure' : 'request failure')
  : live.status !== 200 ? `HTTP ${live.status}: not a canonical success`
    : live.canonicals.length !== 1 ? 'canonical count failure'
      : live.canonicals[0] === live.finalUrl ? 'final destination self-canonical' : 'alternate consolidates to clean maker';
function decision(row) {
  const p = requestPath(row.url), local = localDisposition(row.url), u = new URL(row.url);
  let kind, owner, action, evidence = '';
  if (repairs.has(p)) {
    kind = 'repair-profile'; owner = 'alternate-report';
    action = 'Release exact 308 then check live; do not request indexing for malformed source';
    const target = repairs.get(p), slug = p.split('/').at(-1);
    const raw = rawMugs.find(m => m.song === slug), mug = mugs.find(m => mugPath(m) === target);
    if (!raw || !mug) throw new Error(`Missing retained identity ${p}`);
    const checked = destinations.rows.find(r => r.url === ORIGIN + target)?.live;
    if (!checked || checked.error || checked.status !== 200 || checked.canonicals.length !== 1 || checked.canonicals[0] !== ORIGIN + target)
      throw new Error(`Destination has not passed live verification: ${target}`);
    evidence = `Retained profile: ${raw.artist}; role: ${raw.link}; photograph: ${raw.image || 'empty duplicate; existing identity consolidation supplies photograph'}; historical sitemap: ${oldSitemap.includes('/mugshots/' + slug) ? 'yes' : 'not present'}; final identity: ${mug.artist}; destination live 200/self-canonical at ${checked.checkedAt}; title: ${checked.title}`;
  } else if (local.finalStatus === 200) {
    kind = p.startsWith('/free-santa-message?') ? 'intentional-name-canonical' : local.initial.location ? 'established-alias' : 'canonical-content';
    owner = 'existing-canonical-policy';
    action = 'Keep current canonical; inspect destination only if Google differs';
  } else if (p.startsWith('/assets/')) {
    kind = 'unproven-asset-resource'; owner = 'owner-content-review';
    action = 'Retain 404: profile slug matches do not prove an image resource is equivalent to an HTML profile';
  } else if (p.startsWith('/christmas-song-lyrics')) {
    kind = 'legacy-lyrics-scope'; owner = 'missing-page-report: legacy lyrics family';
    action = 'Hand exact Bing Crosby query to existing legacy-lyrics repair; no competing route implementation';
  } else if (p.startsWith('/search')) {
    kind = 'unsupported-placeholder-search'; owner = 'none';
    action = 'Retain 404; no genuine search term or supported search page';
  } else if (p.includes('sir-michael-palin-tv-personality')) {
    kind = 'ambiguous-profile'; owner = 'existing-uncertain-mugshot-identities';
    action = 'Retain 404: two retained Michael Palin profiles/photos; no proof which one this address represented';
  } else {
    kind = 'unsupported-profile'; owner = row.overlaps.some(o => o.scope === 'missing') ? 'missing-page-report' : 'owner-content-review';
    action = 'Retain 404: no exact retained public profile; do not invent biography or use an unrelated fallback';
  }
  if (row.live.tlsFailure) {
    owner += '; domain/hosting administrator';
    action = 'Hosting owner must confirm purpose and certificate/routing for ' + u.hostname + '; no DNS/TLS/integration changes here. ' + action;
  }
  return { url: row.url, crawled: row.crawled, classification: kind, owner, action, evidence, local, canonicalRelationship: relation(row.live) };
}
const decisions = audit.rows.map(decision);
const header = ['URL', 'Last crawled', 'Checked UTC', 'Live result', 'Live final URL', 'Live canonical', 'Canonical relationship', 'Overlapping reports', 'Classification', 'Owner', 'Current local status', 'Local destination', 'Local canonical', 'Identity evidence', 'Action'];
const quote = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
const lines = decisions.map((d, i) => {
  const r = audit.rows[i];
  return [d.url, d.crawled, r.live.checkedAt, r.live.error ? `curl ${r.live.exitCode}: ${r.live.error}` : r.live.status, r.live.finalUrl,
    r.live.canonicals.join(' | '), d.canonicalRelationship, r.overlaps.map(o => `${o.scope}:${o.match}`).join(' | '), d.classification, d.owner,
    d.local.initial.status, d.local.destination, d.local.canonical, d.evidence, d.action].map(quote).join(',');
});
await writeFile('docs/search-console-alternate-links.csv', [header.map(quote).join(','), ...lines].join('\n') + '\n');
const counts = key => decisions.reduce((c, r) => (c[r[key]] = (c[r[key]] || 0) + 1, c), {});
const summary = { count: decisions.length, classifications: counts('classification'), canonicalRelationships: counts('canonicalRelationship'),
  builtDocumentLinksToReportedBadPaths: emitted, builtSitemapBadPaths: sitemapBad, liveSitemapBadPaths: liveSitemapBad,
  canonicalDestinationsMissingFromBuiltSitemap: audit.canonicalDestinations.filter(d => !canonicalPaths.includes(new URL(d.url).pathname)).map(d => d.url),
  canonicalDestinationsMissingFromLiveSitemap: audit.canonicalDestinations.filter(d => !liveSitemap.includes(`<loc>${d.url}</loc>`)).map(d => d.url),
  builtDocumentCount: canonicalPaths.length,
};
await writeFile('docs/search-console-alternate-summary.json', JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
