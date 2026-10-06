import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { buildCatalogue } from '../src/data/mugshot-catalogue.js';

// RFC-style quoted CSV fields, including embedded newlines and escaped quotes.
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false, closed = false;
  text = text.replace(/^\uFEFF/, '');
  const cell = () => { row.push(field); field = ''; closed = false; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else field += c;
    } else if (c === ',' || c === '\n' || c === '\r') {
      cell();
      if (c !== ',') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        if (row.some(value => value !== '')) rows.push(row);
        row = [];
      }
    } else if (c === '"' && !field && !closed) quoted = true;
    else {
      if (closed || c === '"') throw new Error('Malformed CSV quoting');
      field += c;
    }
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  if (field || row.length || closed) { cell(); rows.push(row); }
  const headers = rows.shift();
  if (!headers || new Set(headers).size !== headers.length) throw new Error('Missing or duplicate CSV headers');
  for (const required of ['Page path', 'Current biography', 'Replacement content', 'Research sources', 'Editorial notes']) {
    if (!headers.includes(required)) throw new Error(`Missing column: ${required}`);
  }
  return rows.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`Wrong column count on row ${index + 2}`);
    return Object.fromEntries(headers.map((key, i) => [key, values[i]]));
  });
}

export function prepareImport(raw, rows, existing = {}) {
  const base = buildCatalogue(raw, {});
  const profiles = new Map(base.catalogue.map(profile => [profile.song, profile]));
  const overrides = { ...existing }, applied = [], skipped = [], seen = new Set();
  for (const row of rows) {
    const path = row['Page path'];
    if (!path.startsWith('/mugshots/')) throw new Error(`Invalid path: ${path}`);
    const slug = base.aliases[path.slice('/mugshots/'.length)];
    const profile = profiles.get(slug);
    if (!profile || seen.has(slug)) throw new Error(`Missing or duplicate profile: ${path}`);
    seen.add(slug);
    if (profile.info !== row['Current biography']) throw new Error(`Original biography changed: ${path}`);
    const count = profile.info.trim().split(/\s+/).length;
    if (count < 6 || count > 35) throw new Error(`Original outside 6–35 words: ${path}`);
    const replacement = row['Replacement content'];
    if (!replacement.trim() || /<[^>]*>/.test(replacement)) throw new Error(`Invalid replacement: ${path}`);
    const entry = { slug, name: profile.artist, path, original: profile.info, replacement,
      sources: row['Research sources'], notes: row['Editorial notes'] };
    if (/\bREVIEW\s*:/i.test(entry.notes)) {
      skipped.push(entry);
      continue;
    }
    if (Object.hasOwn(existing, slug) && existing[slug] !== replacement) throw new Error(`Existing editorial override conflicts: ${path}`);
    overrides[slug] = replacement;
    applied.push(entry);
  }
  return { overrides, report: { appliedCount: applied.length, skippedCount: skipped.length, applied, skipped } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const source = process.argv[2];
  if (!source) throw new Error('Usage: node scripts/import-expanded-biographies.js file.csv [--write]');
  const raw = JSON.parse(fs.readFileSync('src/data/mugshots.json', 'utf8'));
  const existing = JSON.parse(fs.readFileSync('src/data/mugshot-biographies.json', 'utf8'));
  const { overrides, report } = prepareImport(raw, parseCsv(fs.readFileSync(source, 'utf8')), existing);
  if (process.argv.includes('--write')) {
    fs.writeFileSync('src/data/mugshot-biographies.json', JSON.stringify(overrides, null, 2) + '\n');
    fs.writeFileSync('reports/mugshot-biography-import.json', JSON.stringify({ source, ...report }, null, 2) + '\n');
  }
  console.log(JSON.stringify({ applied: report.appliedCount, skipped: report.skipped.map(entry => ({ name: entry.name, reason: entry.notes })) }, null, 2));
}
