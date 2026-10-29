// Read-only public GET audit. No credentials, insecure TLS, DNS or site mutations.
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolvePublicRequest, canonicalPaths } from '../src/seo/routes.js';
import { songs, mugs, songPath, mugPath, ORIGIN } from '../src/seo/catalogue.js';
import { alternateProfileRedirects } from '../src/seo/alternateRedirects.js';

const exec = promisify(execFile);
export const archive = 'attached_assets/Alternate_page_with_proper_canonical_tag_1793271286217.zip';
const folder = 'Alternate page with proper canonical tag';
export function csv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n')) {
      row.push(cell.replace(/\r$/, '')); cell = '';
      if (c === '\n') { rows.push(row); row = []; }
    } else cell += c;
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows;
}
export const member = (zip, name) => execFileSync('unzip', ['-p', zip, name], { encoding: 'utf8', maxBuffer: 2e6 });
export const exported = csv(member(archive, `${folder}/Table.csv`)).slice(1).map(([url, crawled]) => ({ url, crawled }));
if (exported.length !== 507 || new Set(exported.map(r => r.url)).size !== 507) throw new Error('Export inventory drift');
export const requestPath = raw => { const u = new URL(raw, ORIGIN); return u.pathname + u.search; };
export function localDisposition(raw) {
  const initial = resolvePublicRequest(raw);
  const destination = initial.location || requestPath(raw);
  const path = new URL(destination, ORIGIN).pathname;
  const song = songs.find(s => songPath(s) === path || `/christmas-karaoke-lyrics/${s.id}-${s.link}` === path);
  const mug = mugs.find(m => mugPath(m) === path);
  const status = resolvePublicRequest(destination).status;
  return { initial, destination, finalStatus: status, canonical: status === 200 && canonicalPaths.includes(path) ? ORIGIN + path : null,
    identity: song ? { artist: song.artist, title: song.song } : mug ? { person: mug.artist, role: mug.link } : null };
}
async function inventories() {
  const inputs = [
    ['legacy', 'attached_assets/Table_1793268036948.csv'],
    ['duplicate', 'attached_assets/Table_1793271000630.csv'],
    ['missing', 'attached_assets/Not_found_(404)_1793271072351.zip'],
    ['crawled', 'attached_assets/Crawled_-_currently_not_indexed_1793271129086.zip'],
    ['discovered', 'attached_assets/Discovered_-_currently_not_indexed_1793271218067.zip'],
  ];
  return Promise.all(inputs.map(async ([scope, path]) => {
    const text = path.endsWith('.zip') ? member(path, execFileSync('unzip', ['-Z1', path], { encoding: 'utf8' }).split('\n').find(n => !n.startsWith('__MACOSX/') && n.endsWith('/Table.csv'))) : await readFile(path, 'utf8');
    return { scope, urls: csv(text).slice(1).map(r => r[0]) };
  }));
}
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
function metadata(html) {
  const tags = html.match(/<(?:link|meta)\b[^>]*>/gi) || [];
  const attr = (tag, name) => tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] || '';
  return {
    canonicals: tags.filter(t => attr(t, 'rel').toLowerCase() === 'canonical').map(t => attr(t, 'href')),
    robots: tags.filter(t => attr(t, 'name').toLowerCase() === 'robots').map(t => attr(t, 'content')),
    title: text(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''),
    h1: [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => text(m[1])),
    rootTextLength: text(html.match(/<div id="root">([\s\S]*?)<\/body>/i)?.[1] || '').length,
    sha256: createHash('sha256').update(html).digest('hex'), bytes: Buffer.byteLength(html),
  };
}
export async function main() {
  const repairOnly = process.argv[2] === '--repair-destinations';
  const input = repairOnly ? [...new Set(alternateProfileRedirects.map(([, target]) => ORIGIN + target))]
    .map(url => ({ url, crawled: null })) : exported;
  const scopes = await inventories();
  const dir = await mkdtemp(join(tmpdir(), 'canonical-audit-'));
  const cache = new Map();
  let serial = 0;
  async function get(url) {
    if (cache.has(url)) return cache.get(url);
    const pending = (async () => {
      const id = serial++, headersFile = join(dir, `${id}.headers`), bodyFile = join(dir, `${id}.body`);
      const checkedAt = new Date().toISOString();
      let output = '', error = null, exitCode = 0;
      try {
        const result = await exec('curl', ['--silent', '--show-error', '--location', '--max-redirs', '8', '--connect-timeout', '10', '--max-time', '35', '--max-filesize', '4194304',
          '--proto', '=http,https', '--proto-redir', '=http,https', '--user-agent', 'SantaRadio-CanonicalAudit/1.0', '--dump-header', headersFile, '--output', bodyFile,
          '--write-out', '%{json}', url], { maxBuffer: 1e6 });
        output = result.stdout;
      } catch (e) { output = e.stdout || ''; exitCode = e.code; error = e.stderr?.trim() || e.message; }
      let info = {}; try { info = JSON.parse(output); } catch {}
      const headers = await readFile(headersFile, 'utf8').catch(() => '');
      const hops = headers.split(/\r?\n\r?\n/).filter(h => /^HTTP\//.test(h)).filter(h => !/^HTTP\/[\d.]+ 200 Connection established/i.test(h)).map(h => ({
        status: Number(h.match(/^HTTP\/[\d.]+ (\d+)/)?.[1]), location: h.match(/^location:\s*(.+)$/im)?.[1]?.trim() || null,
        contentType: h.match(/^content-type:\s*(.+)$/im)?.[1]?.trim() || null,
        xRobotsTag: h.match(/^x-robots-tag:\s*(.+)$/im)?.[1]?.trim() || null,
      }));
      const body = await readFile(bodyFile, 'utf8').catch(() => '');
      await Promise.all([rm(headersFile, { force: true }), rm(bodyFile, { force: true })]);
      return { checkedAt, url, exitCode, error, tlsFailure: exitCode === 60, finalUrl: info.url_effective || url,
        status: info.http_code || null, hops, ...metadata(body) };
    })();
    cache.set(url, pending); return pending;
  }
  const rows = new Array(input.length);
  let next = 0;
  try {
    await Promise.all(Array.from({ length: 3 }, async () => {
      while (next < input.length) {
        const i = next++, source = input[i];
        const overlaps = scopes.flatMap(s => {
          const exact = s.urls.includes(source.url);
          const path = s.urls.some(u => requestPath(u) === requestPath(source.url));
          return path ? [{ scope: s.scope, match: exact ? 'exact-url' : 'same-path-other-host' }] : [];
        });
        const live = await get(source.url);
        rows[i] = { ...source, overlaps, local: localDisposition(source.url), live };
        if ((i + 1) % 50 === 0) console.log(`Audited ${i + 1}/${input.length}`);
      }
    }));
    const canonicalUrls = [...new Set(rows.flatMap(r => r.live.canonicals))].filter(u => {
      try { return new URL(u).origin === ORIGIN; } catch { return false; }
    });
    let c = 0; const destinations = [];
    await Promise.all(Array.from({ length: 3 }, async () => {
      while (c < canonicalUrls.length) destinations.push(await get(canonicalUrls[c++]));
    }));
    const context = {
      archive, archiveSha256: createHash('sha256').update(await readFile(archive)).digest('hex'),
      purpose: repairOnly ? 'Additional repair destination verification, not original export rows' : 'Complete exact export audit',
      metadata: csv(member(archive, `${folder}/Metadata.csv`)), chart: csv(member(archive, `${folder}/Chart.csv`)),
      method: 'curl GET; normal TLS/hostname verification; concurrency 3; no retry; 35s request limit; max 8 redirects; public requests without cookies or credentials',
      rows, canonicalDestinations: destinations,
    };
    // Preserve the reviewed historical evidence in docs on ordinary reruns.
    const output = repairOnly ? 'docs/search-console-alternate-destinations.json'
      : process.argv[2] || 'generated-artifacts/alternate-canonical-live.json';
    await mkdir(join(output, '..'), { recursive: true });
    await writeFile(output, JSON.stringify(context, null, 2) + '\n');
    console.log(`Saved ${rows.length} rows and ${destinations.length} canonical checks to ${output}`);
  } finally { await rm(dir, { recursive: true, force: true }); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
