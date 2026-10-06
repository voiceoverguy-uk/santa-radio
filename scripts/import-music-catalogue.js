// Import this project's eight-column messages2 export as data; never execute SQL.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { repair } from './import-mugshots.js';

export function parseMusicRows(sql) {
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
if (!rows.length || rows.some(r => r.length !== 8)) throw new Error('Unexpected export schema');
return rows;
}
const normalize = s => repair(s).replace(/&/g, 'and').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const clean = value => value === 'NULL' ? '' : repair(value).replace(/\r\n?/g, '\n').trim();
export function reconcileMusic(existing, rows) {
const songs = rows.map(r => ({
  id: Number(r[0]), song: clean(r[1]), artist: clean(r[2]),
  info: clean(r[4]), website: clean(r[5]), lyrics: clean(r[6]), youtube: clean(r[7]),
}));
if (songs.some(s => !Number.isSafeInteger(s.id) || s.id < 1) || new Set(songs.map(s => s.id)).size !== songs.length) throw new Error('Invalid or duplicate database IDs');
const report = [];
const used = new Set();
const output = existing.map(old => {
  const url = `${old.id}-${old.link}`;
  const names = songs.filter(s => normalize(s.artist) === normalize(old.artist) && normalize(s.song) === normalize(old.song));
  const routes = songs.filter(s => normalize(`${s.artist} ${s.song}`) === normalize(old.link));
  const byId = songs.find(s => s.id === old.id);
  const candidates = names.length ? names : routes;
  const match = candidates.length === 1 ? candidates[0] :
    candidates.length > 1 && candidates.includes(byId) ? byId : null;
  if (!match) {
    report.push({ url, status: candidates.length ? 'ambiguous' : 'unmatched',
      candidateIds: candidates.map(s => s.id), conflictingId: byId?.id ?? null,
      reason: 'No unique artist/title or route evidence; ID alone is insufficient.' });
    return old;
  }
  used.add(match.id);
  const updated = { ...old, artist: match.artist, song: match.song,
    info: match.info || old.info, lyrics: match.lyrics || old.lyrics,
    website: /^https?:\/\//i.test(match.website) ? match.website : old.website || '',
    youtube: /^[\w-]{11}$/.test(match.youtube) ? match.youtube : old.youtube || '' };
  report.push({ url, databaseId: match.id, status: names.length ? 'artist-title' : 'route-evidence',
    conflictingId: match.id !== old.id ? old.id : null,
    previousArtist: old.artist, previousSong: old.song, artist: updated.artist, song: updated.song });
  return updated;
});
return { output, report: { existingRecords: existing.length, databaseRecords: songs.length,
  matched: report.filter(r => r.databaseId).length, matches: report,
  unresolved: report.filter(r => !r.databaseId),
  databaseOnly: songs.filter(s => !used.has(s.id)).map(({ id, artist, song }) => ({ id, artist, song })) } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: node scripts/import-music-catalogue.js dump.sql [--write]');
  const existing = JSON.parse(fs.readFileSync('src/data/songs.json', 'utf8'));
  const result = reconcileMusic(existing, parseMusicRows(fs.readFileSync(path, 'utf8')));
  if (process.argv.includes('--write')) {
    fs.writeFileSync('src/data/songs.json', JSON.stringify(result.output, null, 2) + '\n');
    // Preserve music-import.json as the original 433-route migration evidence.
    fs.writeFileSync('reports/music-reconciliation.json', JSON.stringify(result.report, null, 2) + '\n');
  }
  console.log(JSON.stringify({ records: result.output.length, matched: result.report.matched,
    unresolved: result.report.unresolved, databaseOnly: result.report.databaseOnly }, null, 2));
}
