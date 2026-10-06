import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// Read SQL literals, never execute SQL. This importer deliberately accepts only
// the nine-column messages2 schema supplied for Mugshots.
export function parseRows(sql) {
  const rows = [];
  for (const match of sql.matchAll(/INSERT INTO `messages2` VALUES /g)) {
    let row = null, value = '', quoted = false, ended = false;
    for (let i = match.index + match[0].length; i < sql.length; i++) {
      const c = sql[i];
      if (quoted) {
        if (c === '\\') {
          const next = sql[++i];
          value += ({ n: '\n', r: '\r', t: '\t', 0: '\0' }[next] ?? next);
        } else if (c === "'") {
          if (sql[i + 1] === "'") { value += "'"; i++; }
          else quoted = false;
        } else value += c;
      } else if (c === "'") quoted = true;
      else if (c === '(') { row = []; value = ''; }
      else if (c === ',' && row) { row.push(value); value = ''; }
      else if (c === ')' && row) { row.push(value); rows.push(row); row = null; }
      else if (c === ';') { ended = true; break; }
      else if (row) value += c;
    }
    if (!ended || quoted || row) throw new Error('Incomplete SQL INSERT');
  }
  if (!rows.length || rows.some(row => row.length !== 9)) throw new Error('Unexpected Mugshot schema');
  return rows;
}

const cp1252 = new Map();
for (let b = 0; b < 256; b++) cp1252.set(String.fromCharCode(b), b);
// Explicit mapping also works on Node builds without full ICU legacy decoders.
[...'€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ']
  .forEach((char, index) => cp1252.set(char, 0x80 + index));
export function repair(text) {
  return text.replace(/[^\x00-\x7f]+/g, run => {
    if (!/[ÃÂâð]/.test(run)) return run;
    const bytes = [...run].map(c => cp1252.get(c));
    if (bytes.some(b => b === undefined)) return run;
    try { return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes)); }
    catch { return run; }
  });
}
export function plainText(value) {
  if (value === 'NULL') return '';
  const entities = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
  return repair(value)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (all, key) => {
      if (key[0] !== '#') return entities[key.toLowerCase()] ?? all;
      const n = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
      return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '';
    }).replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
}
export function socialUrl(raw) {
  let value = plainText(raw);
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (!['x.com', 'twitter.com', 'www.x.com', 'www.twitter.com'].includes(url.hostname) || url.username || url.password) return '';
      value = url.pathname.replace(/^\/|\/$/g, '');
    } catch { return ''; }
  }
  const match = value.match(/^@?([a-z0-9_]{1,15})$/i);
  if (!match || /^(none|null|no|yes|home|intent|share|search)$/i.test(match[1])) return '';
  return `https://x.com/${match[1]}`;
}
const norm = value => repair(value).replace(/&/g, 'and').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function reconcile(existing, rows) {
  const source = rows.map(r => ({ id: Number(r[0]), slug: r[1].trim(), name: plainText(r[2]), image: r[3].trim(), info: plainText(r[4]), role: plainText(r[5]), credit: plainText(r[6]), socialUrl: socialUrl(r[7]), rawSocial: r[7] }));
  const matches = [], unmatched = [], ambiguous = [], used = new Set(), disputed = new Set();
  const output = existing.map(old => {
    let method = 'slug';
    let candidates = source.filter(s => s.slug === old.song);
    if (!candidates.length && old.image) {
      method = 'image';
      candidates = source.filter(s => s.image.toLowerCase() === old.image.split('/').pop().toLowerCase());
    }
    if (!candidates.length) {
      method = 'name';
      candidates = source.filter(s => norm(s.name) === norm(old.artist));
    }
    const publicContent = s => JSON.stringify([s.slug, s.name, s.image, s.info, s.role, s.credit, s.socialUrl]);
    const identicalDuplicates = candidates.length > 1 && new Set(candidates.map(publicContent)).size === 1;
    if (candidates.length !== 1 && !identicalDuplicates) {
      candidates.forEach(s => disputed.add(s.id));
      (candidates.length ? ambiguous : unmatched).push({ slug: old.song, name: old.artist, candidateIds: candidates.map(s => s.id) });
      return old;
    }
    const s = candidates[0];
    candidates.forEach(s => used.add(s.id));
    matches.push({ slug: old.song, image: old.image, sourceId: s.id, method, ...(identicalDuplicates ? { identicalSourceIds: candidates.map(s => s.id) } : {}) });
    return { ...old, artist: s.name || old.artist, link: s.role || old.link, info: s.info, credit: s.credit, socialUrl: s.socialUrl };
  });
  const duplicates = [...new Set(source.map(s => s.slug))].filter(slug => source.filter(s => s.slug === slug).length > 1);
  return { output, report: {
    sourceRecords: source.length, catalogueRecords: existing.length,
    matched: matches.length, matches, unmatched, ambiguous, duplicateSourceSlugs: duplicates,
    databaseOnly: source.filter(s => !used.has(s.id) && !disputed.has(s.id)).map(s => ({ id: s.id, slug: s.slug, name: s.name, image: s.image })),
    rejectedSocialHandles: source.filter(s => s.rawSocial.trim() && !s.socialUrl).map(s => ({ id: s.id, slug: s.slug, value: s.rawSocial })),
  } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: node scripts/import-mugshots.js dump.sql [--write]');
  const existing = JSON.parse(fs.readFileSync('src/data/mugshots.json', 'utf8'));
  const { output, report } = reconcile(existing, parseRows(fs.readFileSync(path, 'utf8')));
  if (process.argv.includes('--write')) {
    fs.writeFileSync('src/data/mugshots.json', JSON.stringify(output, null, 2) + '\n');
    fs.mkdirSync('reports', { recursive: true });
    fs.writeFileSync('reports/mugshot-import.json', JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify({ ...report, matches: report.matches.length }, null, 2));
}
