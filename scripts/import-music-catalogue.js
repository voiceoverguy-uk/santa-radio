// Import this project's eight-column messages2 export as data; never execute SQL.
import fs from 'node:fs';

const path = process.argv[2];
if (!path) throw new Error('Usage: node scripts/import-music-catalogue.js dump.sql');
const sql = fs.readFileSync(path, 'utf8');
const existing = JSON.parse(fs.readFileSync('src/data/songs.json', 'utf8'));
const rows = [];
for (const match of sql.matchAll(/INSERT INTO `messages2` VALUES /g)) {
  let row = null, value = '', quoted = false;
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
    else if (c === ';') break;
    else if (row) value += c;
  }
}
if (!rows.length || rows.some(r => r.length !== 8)) throw new Error('Unexpected export schema');
const normalize = s => s.replace(/&/g, 'and').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const slugify = s => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function repair(text) {
  // Only decode suspicious Latin-1 sequences when decoding loses no characters.
  return text.replace(/[^\x00-\x7f]+/g, run => {
    if (!/[ÃÂ]/.test(run) || [...run].some(c => c.charCodeAt(0) > 255)) return run;
    const decoded = Buffer.from(run, 'latin1').toString('utf8');
    return decoded.includes('\uFFFD') ? run : decoded;
  }).replace(/\r\n/g, '\n');
}
const songs = rows.map(r => ({
  id: Number(r[0]), song: repair(r[1]), artist: repair(r[2]), image: '',
  info: repair(r[4]), website: r[5], lyrics: repair(r[6]), youtube: r[7].trim(),
  link: slugify(`${repair(r[2])} ${repair(r[1])}`), aliases: [],
}));
if (new Set(songs.map(s => s.id)).size !== songs.length) throw new Error('Duplicate database IDs');
const report = [];
const unresolved = [];
for (const old of existing) {
  const url = `${old.id}-${old.link}`;
  const byName = songs.filter(s => normalize(`${s.artist} ${s.song}`) === normalize(old.link));
  const byId = songs.find(s => s.id === old.id);
  const verifiedId = byId && (
    /^\d+$/.test(old.link) ||
    normalize(`${byId.artist} ${byId.song}`) === normalize(old.link) ||
    normalize(`${byId.artist} ${byId.song}`) === normalize(`${old.artist} ${old.song}`)
  );
  const match = byName.length === 1 ? byName[0] : verifiedId ? byId : null;
  if (!match) { unresolved.push(old); report.push({ url, status: 'retained-unmatched' }); continue; }
  // Historical IDs identify placeholder and mis-split sitemap entries.
  match.aliases.push(url, ...(old.aliases || []));
  if (old.image) match.image = old.image;
  report.push({ url, databaseId: match.id, status: byName.length === 1 ? 'artist-title' : 'historical-id', previousArtist: old.artist, previousSong: old.song, artist: match.artist, song: match.song });
}
for (const song of songs) song.aliases = [...new Set(song.aliases)];
fs.writeFileSync('src/data/songs.json', JSON.stringify([...songs, ...unresolved], null, 2) + '\n');
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/music-import.json', JSON.stringify({ databaseRecords: songs.length, retainedUnmatched: unresolved.length, matches: report }, null, 2) + '\n');
console.log(`${songs.length} database songs imported; ${unresolved.length} unmatched old entries retained.`);
