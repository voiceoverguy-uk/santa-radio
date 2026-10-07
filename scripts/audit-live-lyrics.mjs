// Run: node scripts/audit-live-lyrics.mjs
// Read-only catalogue audit; intentionally does not rewrite titles or source lyrics.
import songs from '../src/data/songs.json' with { type: 'json' };
import { matchLiveSong, normalizeTrackText, hasUsableLyrics, liveSongAliases } from '../src/data/matchLiveSong.js';

const label = s => ({ id: s.id, artist: s.artist, title: s.song });
const grouped = new Map();
const summary = {};
for (const song of songs) {
  const key = `${normalizeTrackText(song.artist)}|${normalizeTrackText(song.song)}`;
  grouped.set(key, [...(grouped.get(key) || []), song]);
  const { status } = matchLiveSong({ artist: song.artist, title: song.song });
  summary[status] = (summary[status] || 0) + 1;
}
const duplicates = [...grouped.values()].filter(group => group.length > 1).map(group => ({
  records: group.map(label),
  identicalLyrics: group.every(s => s.lyrics?.trim() === group[0].lyrics?.trim()),
  matchingStatus: matchLiveSong({ artist: group[0].artist, title: group[0].song }).status,
}));
const missingLyrics = songs.filter(s => !hasUsableLyrics(s)).map(label);
const shortEntries = songs.filter(s => s.lyrics?.trim() && s.lyrics.trim().length < 160).map(label);
const titleReview = songs.filter(s => /^[a-z]+(?:-[a-z]+)+$/.test(s.song)).map(label);
const brokenAliases = liveSongAliases.filter(alias =>
  !songs.some(s => s.id === alias.songId) ||
  matchLiveSong(alias).song?.id !== alias.songId);
console.log(JSON.stringify({
  catalogueRecords: songs.length,
  summary, duplicates, missingLyrics, shortEntries, titleReview, brokenAliases,
  limitations: 'Self-matching does not verify every broadcast title, recording version or lyric transcription. A full station playlist export is needed for that comparison.',
}, null, 2));
if (brokenAliases.length) process.exitCode = 1;
