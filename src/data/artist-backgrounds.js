import songs from './songs.json' with { type: 'json' };

// Keep distinct acts/joint credits separate; ignore only case and whitespace.
export const artistBackgroundKey = artist => artist.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');
const grouped = new Map();
for (const song of songs) {
  const key = artistBackgroundKey(song.artist);
  if (!grouped.has(key)) grouped.set(key, { key, artist: song.artist, text: song.info || '', songCount: 0 });
  grouped.get(key).songCount++;
}
export const backgroundArtists = [...grouped.values()].sort((a, b) => a.artist.localeCompare(b.artist, 'en-GB'));
export const backgroundArtistByKey = new Map(backgroundArtists.map(artist => [artist.key, artist]));
