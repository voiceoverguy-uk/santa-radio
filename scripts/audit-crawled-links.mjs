// Read-only, TLS-verified evidence capture. Never touches Search Console or hosts.
// Run explicitly: node scripts/audit-crawled-links.mjs --live
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const exec = promisify(execFile);
export const archive = 'attached_assets/Crawled_-_currently_not_indexed_1793271129086.zip';
export const directory = 'docs/search-console-crawled';
export function sourceCsv(member) {
  if (!['Table', 'Chart', 'Metadata'].includes(member)) throw new Error('Unexpected archive member');
  return execFileSync('unzip', ['-p', archive, `Crawled - currently not indexed/${member}.csv`], { encoding: 'utf8', maxBuffer: 100000 });
}
export function exportedRows() {
  const [header, ...lines] = sourceCsv('Table').trim().split(/\r?\n/);
  if (header !== 'URL,Last crawled') throw new Error('Export schema changed');
  return lines.map(line => {
    const cells = line.split(',');
    if (cells.length !== 2 || line.includes('"')) throw new Error('CSV requires a full parser');
    return { url: cells[0], lastCrawled: cells[1] };
  });
}
const tags = (html, pattern) => [...html.matchAll(pattern)].map(match => match[1]);
const attr = (tag, key) => tag.match(new RegExp(`\\b${key}=["']([^"']*)["']`, 'i'))?.[1] || '';
function htmlEvidence(html) {
  const links = tags(html, /(<link\b[^>]*>)/gi);
  const metas = tags(html, /(<meta\b[^>]*>)/gi);
  return {
    title: tags(html, /<title\b[^>]*>([\s\S]*?)<\/title>/gi),
    canonical: links.filter(tag => attr(tag, 'rel') === 'canonical').map(tag => attr(tag, 'href')),
    robots: metas.filter(tag => /^(robots|googlebot)$/i.test(attr(tag, 'name'))).map(tag => attr(tag, 'content')),
    h1: tags(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi).map(text => text.replace(/<[^>]+>/g, '').trim()),
    bytes: Buffer.byteLength(html),
    mainTextCharacters: (html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || '').replace(/<[^>]+>/g, '').trim().length,
  };
}
async function live() {
  await mkdir(directory, { recursive: true });
  for (const member of ['Table', 'Chart', 'Metadata']) await writeFile(`${directory}/${member}.csv`, sourceCsv(member));
  const rows = exportedRows();
  if (rows.length !== 113) throw new Error('Expected 113 examples');
  const temporary = await mkdtemp(join(tmpdir(), 'santa-crawled-'));
  const results = [];
  let cursor = 0;
  try {
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (cursor < rows.length) {
        const index = cursor++, row = rows[index], url = new URL(row.url);
        if (!/^(www\.|apis\.|listen\.|scm\.)?santaradio\.co\.uk$/.test(url.hostname)) throw new Error('Unexpected host');
        const body = join(temporary, `${index}.body`), headers = join(temporary, `${index}.headers`);
        let output = '', failure = null;
        try {
          ({ stdout: output } = await exec('curl', ['--silent', '--show-error', '--location', '--max-redirs', '8',
            '--connect-timeout', '15', '--max-time', '60', '--proto', '=http,https', '--proto-redir', '=https',
            '--dump-header', headers, '--output', body, '--write-out', '%{http_code}\n%{url_effective}', row.url]));
        } catch (error) {
          output = error.stdout || '';
          failure = { code: error.code, message: String(error.stderr || '').split('\n').filter(Boolean)[0] || 'GET failed' };
        }
        const [status, finalUrl] = output.trim().split('\n');
        const headerText = await readFile(headers, 'utf8').catch(() => '');
        const html = status === '200' ? await readFile(body, 'utf8') : '';
        results[index] = {
          ...row, host: url.hostname, checkedAt: new Date().toISOString(),
          status: Number(status) || null, finalUrl: failure ? null : finalUrl,
          attemptedUrl: finalUrl || row.url, failure,
          responses: headerText.split(/\r?\n\r?\n/).filter(part => /^HTTP\//.test(part)).map(part => ({
            status: Number(part.match(/^HTTP\/[\d.]+ (\d+)/)?.[1]),
            location: part.match(/^location:\s*(.+)/im)?.[1]?.trim() || null,
            robots: part.match(/^x-robots-tag:\s*(.+)/im)?.[1]?.trim() || null,
          })),
          ...(html ? { html: htmlEvidence(html) } : {}),
        };
      }
    }));
    await writeFile(`${directory}/live.json`, JSON.stringify(results, null, 2) + '\n');
    console.log(results.reduce((counts, row) => {
      const key = row.failure ? `curl-${row.failure.code}` : row.status;
      counts[key] = (counts[key] || 0) + 1; return counts;
    }, {}));
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
if (process.argv.includes('--live')) await live();
if (process.argv.includes('--destinations')) {
  // Additional retained destination evidence, not a second crawl of all examples.
  const dispositions = JSON.parse(await readFile(`${directory}/dispositions.json`, 'utf8'));
  const baseline = JSON.parse(await readFile(`${directory}/live.json`, 'utf8'));
  const existing = new Set(baseline.filter(row => row.status === 200).map(row => row.finalUrl.split('?')[0]));
  const destinations = [...new Set(dispositions.filter(row => row.canonical && !existing.has(row.canonical)).map(row => row.canonical))];
  const checks = [];
  for (const url of [...destinations, 'https://www.santaradio.co.uk/sitemap.xml']) {
    // Each URL is fixed to the intended public origin, never a service host.
    if (new URL(url).origin !== 'https://www.santaradio.co.uk') throw new Error('Unexpected destination origin');
    const { stdout } = await exec('curl', ['--silent', '--show-error', '--location', '--max-redirs', '4',
      '--connect-timeout', '15', '--max-time', '60', '--proto', '=https', '--proto-redir', '=https',
      '--write-out', '\nSANTA_CURL_RESULT:%{http_code} %{url_effective}', url], { maxBuffer: 2000000 });
    const [body, result] = stdout.split('\nSANTA_CURL_RESULT:');
    if (!result) throw new Error('Missing curl result');
    const [status, finalUrl] = result.trim().split(' ');
    checks.push({ url, status: Number(status), finalUrl, checkedAt: new Date().toISOString(),
      ...(url.endsWith('/sitemap.xml') ? {
        entries: tags(body, /<loc>([^<]+)<\/loc>/g).length,
        requestedCanonicals: [...new Set(dispositions.filter(row => row.canonical).map(row => row.canonical))]
          .map(canonical => ({ canonical, included: body.includes(`<loc>${canonical}</loc>`) })),
      } : { html: htmlEvidence(body) }),
    });
  }
  await writeFile(`${directory}/destinations-live.json`, JSON.stringify(checks, null, 2) + '\n');
  console.log(`${checks.length} supplemental destination/sitemap checks captured`);
}
